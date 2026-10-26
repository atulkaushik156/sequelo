import uuid
import json
import logging
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

# Import your database and auth dependencies
from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)
class ColumnDefinition(BaseModel):
    name: str
    sample_data: List[Any]
    definition: str

class RelationshipDefinition(BaseModel):
    column: str
    references_table: str

class WizardPayload(BaseModel):
    table_alias: str
    overall_business_purpose: str
    columns: List[ColumnDefinition]
    relationships: Optional[List[RelationshipDefinition]] = []

class CreateChatRequest(BaseModel):
    title: Optional[str] = "New Chat"

@router.post("/api/chats")
async def create_chat(
    req: CreateChatRequest,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Generates a new chat session to satisfy file upload foreign keys."""
    chat_id = str(uuid.uuid4())
    
    try:
        await conn.execute('''
            INSERT INTO chats (chat_id, tenant_id, title) 
            VALUES ($1, $2, $3)
        ''', chat_id, user_id, req.title)
        
        return {"chat_id": chat_id, "title": req.title, "message": "Chat created successfully."}
    except Exception as e:
        logger.error(f"Failed to create chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat session.")