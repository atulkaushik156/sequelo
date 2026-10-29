import json
import traceback
from fastapi import APIRouter, HTTPException, Depends, Body
from typing import Dict, Any

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
        WHERE chat_id = $1::uuid 
          AND tenant_id = $2 
          AND s3_url IS NOT NULL 
          AND s3_url != ''
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
    req: dict = Body(...),
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Saves the user-verified schema to the database."""
    
    schema_metadata = {
        "tables": req.get("table_schemas", []),
        "relationships": req.get("relationships", []),
        "metrics": req.get("custom_metrics", [])
    }
    
    result = await conn.execute('''
        UPDATE chats 
        SET schema_metadata = $1::jsonb
        WHERE chat_id = $2::uuid AND tenant_id = $3
    ''', json.dumps(schema_metadata), chat_id, user_id)
    
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail="Chat not found. Cannot save schema.")
    
    return {"status": "success"}


# ---------------------------------------------------------
# 3. CHAT STATUS (Handles UI Routing)
# ---------------------------------------------------------
@router.get("/chats/{chat_id}/status")
async def get_chat_status(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Checks the database to determine which screen the frontend should display."""
    
    chat = await conn.fetchrow('''
        SELECT schema_metadata FROM chats 
        WHERE chat_id = $1::uuid AND tenant_id = $2
    ''', chat_id, user_id)
    
    if chat:
        metadata = chat['schema_metadata']
        
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except Exception:
                metadata = {}
                
        if metadata and isinstance(metadata, dict) and "tables" in metadata:
            return {"step": 3}
            
    dataset_count = await conn.fetchval('''
        SELECT COUNT(*) FROM user_datasets 
        WHERE chat_id = $1::uuid 
          AND tenant_id = $2
          AND s3_url IS NOT NULL 
          AND s3_url != ''
    ''', chat_id, user_id)
    
    if dataset_count and dataset_count > 0:
        return {"step": 2}
        
    return {"step": 1}