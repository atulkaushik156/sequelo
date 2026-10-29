import json
import traceback
import os
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel
from typing import Dict, Any

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate

from analyzing_agent.pipeline import ingestion_pipeline
from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()

# ---------------------------------------------------------
# 1. GENERATE SCHEMA (Wizard Step 1 & 2)
# ---------------------------------------------------------
@router.get("/chats/{chat_id}/schema")
async def analyze_chat_schema(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Fetches uploaded files from DB and triggers LangGraph AI."""
    records = await conn.fetch('''
        SELECT table_alias, s3_url 
        FROM user_datasets 
        WHERE chat_id = $1::uuid AND tenant_id = $2
    ''', chat_id, user_id)
    
    if not records:
        raise HTTPException(status_code=404, detail="No datasets found for this chat. Please upload files first.")
        
    s3_urls = {record['table_alias']: record['s3_url'] for record in records}
    
    try:
        final_state = await ingestion_pipeline.ainvoke({
            "tenant_id": user_id,
            "s3_urls": s3_urls
        })
        
        return {
            "table_schemas": final_state["table_schemas"],
            "relationships": final_state["relationships"]
        }
    except Exception as e:
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=f"AI Analysis Failed: {str(e)}")


# ---------------------------------------------------------
# 2. FINALIZE SCHEMA (Wizard Step 3)
# ---------------------------------------------------------
@router.post("/chats/{chat_id}/finalize-schema")
async def finalize_schema(
    chat_id: str,
    req: dict = Body(...), # THE FIX: Body(...) forces FastAPI to read the JSON correctly
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Saves the user-verified schema to the database."""
    
    # Safely extract arrays from the frontend request
    schema_metadata = {
        "tables": req.get("table_schemas", []),
        "relationships": req.get("relationships", []),
        "metrics": req.get("custom_metrics", [])
    }
    
    # Save the populated JSON to Neon DB
    result = await conn.execute('''
        UPDATE chats 
        SET schema_metadata = $1::jsonb
        WHERE chat_id = $2::uuid AND tenant_id = $3
    ''', json.dumps(schema_metadata), chat_id, user_id)
    
    # If no rows were updated, the chat ID doesn't exist
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Chat not found. Cannot save schema.")
    
    return {"status": "success"}


# ---------------------------------------------------------
# 3. CHAT AI (Chat Interface)
# ---------------------------------------------------------
class ChatMessageRequest(BaseModel):
    message: str

# Setup Groq for the chat responses
chat_llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model_name=os.getenv("GROQ_MODEL_NAME", "llama-3.1-8b-instant"),
    temperature=0
)

@router.post("/chats/{chat_id}/messages")
async def send_chat_message(
    chat_id: str,
    req: ChatMessageRequest,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Fetches the saved schema and generates an AI response based on the user's prompt."""
    
    # 1. Fetch the finalized schema from Neon DB
    record = await conn.fetchrow('''
        SELECT schema_metadata 
        FROM chats 
        WHERE chat_id = $1::uuid AND tenant_id = $2
    ''', chat_id, user_id)
    
    if not record or not record['schema_metadata']:
        raise HTTPException(status_code=400, detail="Schema not finalized for this chat yet.")
        
    schema_context = record['schema_metadata']
    
    # 2. Build the System Prompt injecting the dynamic schema
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert Data Analyst AI. 
You answer user questions based strictly on the following database schema and relationships.

DATA SCHEMA:
{schema_context}

If the user asks a data question, provide the exact DuckDB SQL query needed to get the answer. 
If they ask a general question, answer it clearly based on the schema's business logic."""),
        ("user", "{user_message}")
    ])
    
    # 3. Query Groq AI
    try:
        chain = prompt | chat_llm
        result = await chain.ainvoke({
            "schema_context": json.dumps(schema_context),
            "user_message": req.message
        })
        
        return {"reply": result.content}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"LLM Chat Error: {str(e)}")