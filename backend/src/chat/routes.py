import os
import re
import uuid
import json
import logging
import boto3
from typing import List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from chat.chat_agent_graph import chat_engine 
from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)

# ==============================================================================
# 1. INITIALIZATION & VECTOR MATH
# ==============================================================================
embeddings_model = GoogleGenerativeAIEmbeddings(
    model=os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
    google_api_key=os.getenv("GOOGLE_API_KEY_RAG")
)

def truncate_and_normalize(vector: List[float], target_dim: int = 768) -> List[float]:
    if len(vector) <= target_dim:
        return vector
    truncated = vector[:target_dim]
    norm = sum(v * v for v in truncated) ** 0.5
    return [v / norm for v in truncated] if norm > 0 else truncated

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('AWS_ENDPOINT_URL_S3'),
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        region_name=os.environ.get('AWS_REGION')
    )

def create_table_alias(filename: str) -> str:
    name = filename.rsplit('.csv', 1)[0]
    name = name.rsplit('.xlsx', 1)[0]
    clean_name = re.sub(r'[^a-zA-Z0-9]', '_', name.lower())
    clean_name = re.sub(r'^[0-9]+', '', clean_name).strip('_')
    return clean_name or "dataset"

class ChatMessageRequest(BaseModel):
    message: str

# ==============================================================================
# 2. FILE UPLOAD & MANAGEMENT ROUTES
# ==============================================================================
@router.post("/upload_documents")
async def upload_document(
    files: List[UploadFile] = File(...), 
    chat_id: str = Form(...),
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection) 
) -> list[dict]:
    s3_client = get_s3_client()
    BUCKET_NAME = os.environ.get("B2_BUCKET_NAME") 
    upload_results = []

    for file in files:
        # STRICT BACKEND VALIDATION
        if not file.filename.lower().endswith((".csv", ".xlsx")):
            raise HTTPException(status_code=400, detail="Please use file format of CSV or Excel only.")

        clean_alias = create_table_alias(file.filename)
        file_uuid = str(uuid.uuid4())
        
        # Keep original extension
        ext = ".xlsx" if file.filename.lower().endswith(".xlsx") else ".csv"
        b2_file_name = f"{user_id}/{chat_id}/{file_uuid}_{clean_alias}{ext}"
        s3_url = f"s3://{BUCKET_NAME}/{b2_file_name}"
        
        try:
            file_bytes = await file.read()
            await run_in_threadpool(
                s3_client.put_object,
                Bucket=BUCKET_NAME,
                Key=b2_file_name,
                Body=file_bytes
            )
            await conn.execute('''
                INSERT INTO user_datasets 
                (id, chat_id, tenant_id, original_filename, table_alias, s3_url)
                VALUES ($1, $2::uuid, $3, $4, $5, $6)
            ''', file_uuid, chat_id, user_id, file.filename, clean_alias, s3_url)
            upload_results.append({
                "original_filename": file.filename,
                "table_alias": clean_alias,
                "s3_url": s3_url
            })
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process {file.filename}.")
        finally:
            await file.close()
    return upload_results

@router.get("/chats/{chat_id}/files")
async def get_chat_files(chat_id: str, user_id: str = Depends(get_current_user), conn = Depends(get_db_connection)):
    records = await conn.fetch('SELECT id, original_filename FROM user_datasets WHERE chat_id = $1::uuid AND tenant_id = $2', chat_id, user_id)
    return {"files": [{"file_id": str(r["id"]), "file_name": r["original_filename"], "file_size": 0} for r in records]}

@router.get("/chats/{chat_id}/files/{file_id}/download")
async def generate_download_link(chat_id: str, file_id: str, user_id: str = Depends(get_current_user), conn = Depends(get_db_connection)):
    record = await conn.fetchrow('SELECT s3_url FROM user_datasets WHERE id = $1::uuid AND chat_id = $2::uuid AND tenant_id = $3', file_id, chat_id, user_id)
    if not record: raise HTTPException(status_code=404, detail="File not found or access denied")
    s3_url = record["s3_url"]
    BUCKET_NAME = os.environ.get("B2_BUCKET_NAME") 
    b2_key = s3_url[len(f"s3://{BUCKET_NAME}/"):] if s3_url.startswith(f"s3://{BUCKET_NAME}/") else s3_url
    try:
        presigned_url = get_s3_client().generate_presigned_url('get_object', Params={'Bucket': BUCKET_NAME, 'Key': b2_key}, ExpiresIn=900)
        return {"download_url": presigned_url}
    except Exception:
        raise HTTPException(status_code=500, detail="Could not generate download link")

@router.get("/chats/{chat_id}/messages")
async def get_chat_history(chat_id: str, user_id: str = Depends(get_current_user), conn = Depends(get_db_connection)):
    records = await conn.fetch('SELECT role, content, metadata FROM messages WHERE chat_id = $1::uuid AND tenant_id = $2 ORDER BY created_at ASC', chat_id, user_id)
    frontend_messages = []
    for row in records:
        meta = row["metadata"] or {}
        if isinstance(meta, str):
            try: meta = json.loads(meta)
            except: meta = {}
        sql = meta.get("generated_sql", "") if isinstance(meta, dict) else ""
        frontend_messages.append({"role": row["role"], "content": row["content"], "sql": sql})
    return {"messages": frontend_messages}

# ==============================================================================
# 3. CHAT MESSAGE & VECTOR RAG ROUTES
# ==============================================================================
@router.post("/chats/{chat_id}/messages")
async def process_chat_query(
    chat_id: str,
    req: ChatMessageRequest,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    chat_meta = await conn.fetchrow("SELECT schema_metadata FROM chats WHERE chat_id = $1::uuid AND tenant_id = $2", chat_id, user_id)
    if not chat_meta or not chat_meta['schema_metadata']: raise HTTPException(status_code=400, detail="Schema not finalized or access denied.")

    datasets = await conn.fetch("SELECT table_alias, s3_url FROM user_datasets WHERE chat_id = $1::uuid AND tenant_id = $2 AND s3_url IS NOT NULL", chat_id, user_id)
    s3_urls = {d['table_alias']: d['s3_url'] for d in datasets}

    raw_history = await conn.fetch("SELECT role, content FROM messages WHERE chat_id = $1::uuid AND tenant_id = $2 ORDER BY created_at ASC", chat_id, user_id)
    history = [HumanMessage(content=row['content']) if row['role'] == 'user' else AIMessage(content=row['content']) for row in raw_history]
            
    raw_query_vector = await embeddings_model.aembed_query(req.message)
    query_vector = truncate_and_normalize(raw_query_vector, 768)
    
    past_rules = await conn.fetch("""
        SELECT context_text 
        FROM business_context_embeddings 
        WHERE tenant_id = $1 AND chat_id = $2::uuid 
        ORDER BY embedding <=> $3::vector
        LIMIT 5
    """, user_id, chat_id, str(query_vector))
    
    retrieved_context = "\n".join([r['context_text'] for r in past_rules])

    initial_state = {
        "tenant_id": user_id,
        "chat_id": chat_id,
        "messages": history,
        "user_query": req.message,
        "s3_urls": s3_urls,
        "schema_metadata": json.dumps(chat_meta['schema_metadata']),
        "retrieved_context": retrieved_context
    }
    
    full_response = ""
    generated_sql = ""
    new_rule = None
    
    try:
        final_state = await chat_engine.ainvoke(initial_state)
        status = final_state.get("status")
        error_reason = final_state.get("error_reason", "Request blocked.")
        generated_sql = final_state.get("generated_sql", "")
        new_rule = final_state.get("extracted_business_logic")
        
        if status in ["rejected", "clarify"]:
            full_response = f"{'Request blocked: ' if status == 'rejected' else ''}{error_reason}"
        else:
            messages = final_state.get("messages", [])
            if messages: full_response = messages[-1].content if hasattr(messages[-1], "content") else str(messages[-1])
    except Exception as e:
        logger.error(f"Graph execution error: {e}")
        raise HTTPException(status_code=500, detail="Processing error occurred.")

    if full_response.strip():
        try:
            async with conn.transaction():
                await conn.execute("INSERT INTO messages (chat_id, tenant_id, role, content) VALUES ($1::uuid, $2, 'user', $3)", chat_id, user_id, req.message)
                await conn.execute("INSERT INTO messages (chat_id, tenant_id, role, content, metadata) VALUES ($1::uuid, $2, 'assistant', $3, $4::jsonb)", chat_id, user_id, full_response, json.dumps({"generated_sql": generated_sql}))
        except Exception as db_err:
            pass
            
        if new_rule:
            try:
                rule_text = str(new_rule)
                raw_rule_vector = await embeddings_model.aembed_query(rule_text)
                rule_vector = truncate_and_normalize(raw_rule_vector, 768)
                vector_str = json.dumps(rule_vector)
                
                await conn.execute("""
                    INSERT INTO business_context_embeddings (chat_id, tenant_id, table_alias, context_text, embedding) 
                    VALUES ($1::uuid, $2, 'global', $3, $4::vector)
                """, chat_id, user_id, rule_text, vector_str)
            except Exception as vector_err:
                pass

    return {"reply": full_response, "generated_sql": generated_sql}