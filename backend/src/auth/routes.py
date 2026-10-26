import os
import uuid
import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel
from passlib.context import CryptContext

# Import your Neon DB connection pool
from database import get_db_connection

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
cookie_scheme = APIKeyCookie(name="session_id", auto_error=False)

# ==========================================
# ASYNC REDIS CONNECTION POOL
# ==========================================
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True,
    max_connections=100
)

# ==========================================
# PASSWORD HASHING SETUP
# ==========================================
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================
class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# ==========================================
# AUTHENTICATION DEPENDENCY
# ==========================================
async def get_current_user(request: Request, session_cookie: str = Depends(cookie_scheme)):
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Not logged in. Session cookie missing."
        )

    # Await the async fetch from Redis
    user_id = await redis_client.get(session_id)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Session not found or expired."
        )

    return user_id

# ==========================================
# ROUTES
# ==========================================
@router.post("/register")
async def register(req: RegisterRequest, conn = Depends(get_db_connection)):
    existing_user = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1", 
        req.email
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email is already registered."
        )

    # Hash the password securely before saving
    hashed_password = pwd_context.hash(req.password)

    user_id = await conn.fetchval('''
        INSERT INTO users (email, password_hash) 
        VALUES ($1, $2) 
        RETURNING id
    ''', req.email, hashed_password)

    return {
        "message": "User registered successfully", 
        "user_id": str(user_id)
    }

@router.post("/login")
async def login(req: LoginRequest, response: Response, conn = Depends(get_db_connection)):
    user_record = await conn.fetchrow(
        "SELECT id, password_hash FROM users WHERE email = $1", 
        req.email
    )

    # Verify user exists, has a password (not just OAuth), and password matches hash
    if not user_record or not user_record["password_hash"] or not pwd_context.verify(req.password, user_record["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid credentials"
        )

    session_id = str(uuid.uuid4())
    user_id_str = str(user_record["id"])
    
    # Save to Redis asynchronously with a 24-hour expiration (86400 seconds)
    await redis_client.setex(
        name=session_id,
        time=86400,
        value=user_id_str
    )
    
    response.set_cookie(
        key="session_id", 
        value=session_id, 
        httponly=True,
        samesite="lax"
    )
    
    return {"message": "Successfully logged in", "user_id": user_id_str}

@router.post("/logout")
async def logout(response: Response, request: Request):
    session_id = request.cookies.get("session_id")
    
    if session_id:
        # Delete the session from Redis
        await redis_client.delete(session_id)
    
    # Instruct the browser to destroy the cookie
    response.delete_cookie(key="session_id", httponly=True, samesite="lax")
    
    return {"message": "Successfully logged out"}