import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage

from chat.chat_agent_graph import chat_engine 
from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str

@router.post("/chats/{chat_id}/messages")
async def process_chat_query(
    chat_id: str,
    req: ChatMessageRequest,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    # 1. Fetch Chat Data & Schema
    chat_meta = await conn.fetchrow(
        "SELECT schema_metadata FROM chats WHERE chat_id = $1::uuid AND tenant_id = $2", 
        chat_id, user_id
    )
    if not chat_meta or not chat_meta['schema_metadata']:
        raise HTTPException(status_code=400, detail="Schema not finalized.")

    # 2. Fetch S3 URLs
    datasets = await conn.fetch(
        "SELECT table_alias, s3_url FROM user_datasets WHERE chat_id = $1::uuid AND s3_url IS NOT NULL", 
        chat_id
    )
    s3_urls = {d['table_alias']: d['s3_url'] for d in datasets}

    # 3. Build LangChain Message History
    raw_history = await conn.fetch(
        "SELECT role, content FROM messages WHERE chat_id = $1::uuid ORDER BY created_at ASC", 
        chat_id
    )
    history = []
    for row in raw_history:
        if row['role'] == 'user':
            history.append(HumanMessage(content=row['content']))
        elif row['role'] == 'assistant':
            history.append(AIMessage(content=row['content']))
            
    # 4. Fetch past learned rules (RAG)
    past_rules = await conn.fetch(
        "SELECT context_text FROM business_context_embeddings WHERE chat_id = $1::uuid", 
        chat_id
    )
    retrieved_context = "\n".join([r['context_text'] for r in past_rules])

    # 5. Define Graph Initial State
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
        # Run graph to completion
        final_state = await chat_engine.ainvoke(initial_state)
        
        status = final_state.get("status")
        error_reason = final_state.get("error_reason", "Request blocked.")
        generated_sql = final_state.get("generated_sql", "")
        new_rule = final_state.get("extracted_business_logic")
        
        if status in ["rejected", "clarify"]:
            prefix = "Request blocked: " if status == "rejected" else ""
            full_response = f"{prefix}{error_reason}"
        else:
            messages = final_state.get("messages", [])
            if messages:
                last_msg = messages[-1]
                full_response = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    except Exception as e:
        print(f"Graph execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

    # 6. Save to DB
    if full_response.strip():
        try:
            async with conn.transaction():
                await conn.execute(
                    "INSERT INTO messages (chat_id, tenant_id, role, content) VALUES ($1, $2, 'user', $3)",
                    chat_id, user_id, req.message
                )
                await conn.execute(
                    "INSERT INTO messages (chat_id, tenant_id, role, content, metadata) VALUES ($1, $2, 'assistant', $3, $4::jsonb)",
                    chat_id, user_id, full_response, json.dumps({"generated_sql": generated_sql})
                )
                if new_rule:
                    rule_text = json.dumps(new_rule)
                    await conn.execute(
                        "INSERT INTO business_context_embeddings (chat_id, tenant_id, context_text) VALUES ($1, $2, $3)",
                        chat_id, user_id, rule_text
                    )
        except Exception as db_err:
            print(f"Failed to save message history to DB: {db_err}")

    # Return standard JSON that normal frontend fetch/axios calls expect
    return {"reply": full_response, "generated_sql": generated_sql}