import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage

# IMPORTANT: Ensure this matches the name of your LangGraph file
# If you renamed it back to chat_agent.py, change this to: from chat.chat_agent import chat_engine
from chat.chat_agent_graph import chat_engine 

from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str

# FIX: Endpoint is now exactly /chats/{chat_id}/messages to match your frontend
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
    
    # 6. Stream Generator Setup
    async def event_generator():
        full_response = ""
        generated_sql = ""
        new_rule = None
        
        async for event in chat_engine.astream_events(initial_state, version="v2"):
            kind = event["event"]
            node = event.get("metadata", {}).get("langgraph_node")

            if kind == "on_chat_model_stream" and node == "synthesizer":
                chunk = event["data"]["chunk"].content
                if chunk:
                    full_response += chunk
                    yield chunk 
            
            elif kind == "on_chain_end" and node == "drafter":
                generated_sql = event["data"]["output"].get("generated_sql", "")
                
            elif kind == "on_chain_end" and node == "supervisor":
                status = event["data"]["output"].get("status")
                
                # Gracefully intercept rejections OR clarification requests and stream them to the UI
                if status in ["rejected", "clarify"]:
                    error_reason = event["data"]["output"].get("error_reason", "Request blocked.")
                    prefix = "Request blocked: " if status == "rejected" else ""
                    full_response = f"{prefix}{error_reason}"
                    yield full_response
                
                new_rule = event["data"]["output"].get("extracted_business_logic")

        # 7. Persist to DB once the stream completes
        if full_response.strip():
            async with conn.transaction():
                # Save User Message
                await conn.execute(
                    "INSERT INTO messages (chat_id, tenant_id, role, content) VALUES ($1, $2, 'user', $3)",
                    chat_id, user_id, req.message
                )
                # Save AI Response & Generated SQL
                await conn.execute(
                    "INSERT INTO messages (chat_id, tenant_id, role, content, metadata) VALUES ($1, $2, 'assistant', $3, $4::jsonb)",
                    chat_id, user_id, full_response, json.dumps({"generated_sql": generated_sql})
                )
                
                # Save newly learned business rule
                if new_rule:
                    rule_text = json.dumps(new_rule)
                    await conn.execute(
                        "INSERT INTO business_context_embeddings (chat_id, tenant_id, context_text) VALUES ($1, $2, $3)",
                        chat_id, user_id, rule_text
                    )

    return StreamingResponse(event_generator(), media_type="text/plain")