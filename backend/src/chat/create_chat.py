import uuid
import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# Import your database and auth dependencies
from auth.routes import get_current_user
from database import get_db_connection

# 1. ADD THE PREFIX HERE: This automatically adds /api/chats to every route below
router = APIRouter(prefix="/api/chats", tags=["Chats"])
logger = logging.getLogger(__name__)

class CreateChatRequest(BaseModel):
    title: Optional[str] = "New Chat"

# EXACT FIX: Changed to "" so the final route is strictly POST /api/chats
@router.post("")
async def create_chat(
    req: CreateChatRequest,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Generates a new chat session when the user clicks 'New Chat'."""
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

# EXACT FIX: Changed to "" so the final route is strictly GET /api/chats
@router.get("")
async def get_user_chats(
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Fetches all previous chat sessions for the user's dashboard."""
    try:
        chats = await conn.fetch('''
            SELECT chat_id, title, created_at 
            FROM chats 
            WHERE tenant_id = $1 
            ORDER BY created_at DESC
        ''', user_id)
        
        return {"chats": [dict(chat) for chat in chats]}
    except Exception as e:
        logger.error(f"Failed to fetch chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chats.")

# This combines with the prefix to become GET /api/chats/{chat_id}/messages
@router.get("/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    user_id: str = Depends(get_current_user),
    conn = Depends(get_db_connection)
):
    """Fetches the message history for a specific chat to restore the session."""
    try:
        messages = await conn.fetch('''
            SELECT id, role, content, metadata, created_at
            FROM messages
            WHERE chat_id = $1 AND tenant_id = $2
            ORDER BY created_at ASC
        ''', chat_id, user_id)
        
        formatted_messages = []
        for msg in messages:
            msg_dict = dict(msg)
            if isinstance(msg_dict.get('metadata'), str):
                try:
                    msg_dict['metadata'] = json.loads(msg_dict['metadata'])
                except json.JSONDecodeError:
                    msg_dict['metadata'] = {}
            formatted_messages.append(msg_dict)

        return {"chat_id": chat_id, "messages": formatted_messages}
    except Exception as e:
        logger.error(f"Failed to fetch messages for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch chat history.")