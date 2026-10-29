from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
import os

from auth.routes import get_current_user
from database import get_db_connection

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str

# Initialize the Groq LLM for the chat interface
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
    
    # 3. Query Groq
    chain = prompt | chat_llm
    result = await chain.ainvoke({
        "schema_context": schema_context,
        "user_message": req.message
    })
    
    return {
        "reply": result.content
    }