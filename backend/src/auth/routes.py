import os
import uuid
import secrets
import hashlib
import base64
import json
from datetime import datetime
import redis.asyncio as redis
import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from fastapi.security import APIKeyCookie
from pydantic import BaseModel

# Import your Neon DB connection pool
from database import get_db_connection

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
cookie_scheme = APIKeyCookie(name="session_id", auto_error=False)

# ==========================================
# CONFIGURATION & ENVIRONMENT
# ==========================================
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
SESSION_TTL = int(os.getenv("SESSION_TTL_SECONDS", 86400))

# ==========================================
# ASYNC REDIS CONNECTION POOL
# ==========================================
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    password=os.getenv("REDIS_PASSWORD", None),
    decode_responses=True,
    max_connections=100
)

# ==========================================
# AUTHENTICATION DEPENDENCY
# ==========================================
async def get_current_user(request: Request, session_cookie: str = Depends(cookie_scheme)):
    """Validates the session cookie against Redis and returns the user_id (UUID)."""
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Not logged in. Session cookie missing."
        )

    user_id = await redis_client.get(session_id)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Session not found or expired."
        )

    return user_id

# ==========================================
# OAUTH2 JWKS CACHE
# ==========================================
google_jwks_cache = None

async def get_google_jwks():
    """Fetches and caches Google's public keys for ID token verification asynchronously."""
    global google_jwks_cache
    if not google_jwks_cache:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://www.googleapis.com/oauth2/v3/certs")
            resp.raise_for_status()
            google_jwks_cache = resp.json()
    return google_jwks_cache

# ==========================================
# ROUTES
# ==========================================

@router.get("/google/login")
async def google_login():
    """Initiates the Google OAuth 2.0 flow with PKCE, State, and Nonce."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

    # Cryptographically secure random generation
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    code_verifier = secrets.token_urlsafe(64)
    
    # PKCE Challenge (S256)
    code_challenge_bytes = hashlib.sha256(code_verifier.encode('ascii')).digest()
    code_challenge = base64.urlsafe_b64encode(code_challenge_bytes).decode('ascii').rstrip('=')

    # Store OAuth metadata in Redis for 10 minutes
    oauth_data = json.dumps({"nonce": nonce, "code_verifier": code_verifier})
    await redis_client.setex(f"oauth_state:{state}", 600, oauth_data)

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={GOOGLE_REDIRECT_URI}&"
        f"scope=openid%20email%20profile&"
        f"state={state}&"
        f"nonce={nonce}&"
        f"code_challenge={code_challenge}&"
        f"code_challenge_method=S256&"
        f"access_type=online"
    )
    
    # CRITICAL FIX: Attach the cookie directly to the RedirectResponse
    redirect = RedirectResponse(url=auth_url)
    redirect.set_cookie(
    key="oauth_state",
    value=state,
    httponly=True,
    secure=COOKIE_SECURE,
    samesite="none", # Changed from "lax"
    max_age=600,
    path="/"
    )
    
    return redirect


@router.get("/google/callback")
async def google_callback(request: Request, response: Response, conn = Depends(get_db_connection)):
    """Handles the OAuth callback, verifies tokens, and issues app sessions."""
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")
    
    if error:
        return RedirectResponse(url=f"{FRONTEND_URL}?error={error}")

    # 1. State/CSRF Validation
    cookie_state = request.cookies.get("oauth_state")
    
    # Diagnostic print to check if the browser successfully returned the cookie
    print(f"\n[DEBUG OAUTH] URL State: {state}")
    print(f"[DEBUG OAUTH] Cookie State: {cookie_state}\n")
    
    if not state or not cookie_state or state != cookie_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state. Potential CSRF attack.")
    
    # 2. Retrieve temporary PKCE/Nonce data from Redis
    oauth_raw = await redis_client.get(f"oauth_state:{state}")
    if not oauth_raw:
        raise HTTPException(status_code=400, detail="OAuth session expired or invalid.")
    
    # Burn the state to prevent replay
    await redis_client.delete(f"oauth_state:{state}")
    response.delete_cookie("oauth_state", path="/")
    
    oauth_data = json.loads(oauth_raw)
    code_verifier = oauth_data["code_verifier"]
    expected_nonce = oauth_data["nonce"]

    # 3. Exchange Auth Code for Tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "code_verifier": code_verifier,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code"
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code.")
        
        tokens = token_resp.json()
        id_token = tokens.get("id_token")

    if not id_token:
        raise HTTPException(status_code=400, detail="No ID token provided by Google.")

    # 4. Verify ID Token using Google's JWKS
    try:
        unverified_header = jwt.get_unverified_header(id_token)
        jwks = await get_google_jwks()
        
        # Find the correct public key matching the token's kid
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = RSAAlgorithm.from_jwk(json.dumps(key))
                break
        
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Public key not found in Google JWKS.")

        payload = jwt.decode(
            id_token,
            rsa_key,
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID,
            issuer=["accounts.google.com", "https://accounts.google.com"]
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google ID token: {str(e)}")

    # 5. Validate Nonce & Verified Email status
    if payload.get("nonce") != expected_nonce:
        raise HTTPException(status_code=401, detail="Invalid token nonce.")
    
    if not payload.get("email_verified"):
        raise HTTPException(status_code=403, detail="Unverified Google email address. Access denied.")

    # Extract user profile
    google_sub = payload["sub"] # The stable identifier
    email = payload["email"]
    full_name = payload.get("name", "")
    picture_url = payload.get("picture", "")

    # 6. Upsert User in PostgreSQL
    try:
        user_id = await conn.fetchval("""
            INSERT INTO users (email, google_sub, full_name, picture_url, email_verified, last_login_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (google_sub) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                picture_url = EXCLUDED.picture_url,
                last_login_at = NOW()
            RETURNING id
        """, email, google_sub, full_name, picture_url, True)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Database conflict handling Google Identity.")

    # 7. Create Session
    session_id = secrets.token_urlsafe(32)
    user_id_str = str(user_id)
    
    await redis_client.setex(
        name=session_id,
        time=SESSION_TTL,
        value=user_id_str
    )
    
    # 8. Set application session cookie and redirect directly on the RedirectResponse
    redirect_response = RedirectResponse(url=f"{FRONTEND_URL}/dashboard")
    redirect_response.set_cookie(
    key="session_id", 
    value=session_id, 
    httponly=True,
    secure=COOKIE_SECURE,
    samesite="none", # Changed from "lax"
    max_age=SESSION_TTL,
    path="/"
    )
    
    return redirect_response


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user), conn = Depends(get_db_connection)):
    """Returns the profile of the currently authenticated user."""
    user = await conn.fetchrow("""
        SELECT id, email, full_name, picture_url 
        FROM users 
        WHERE id = $1::uuid
    """, user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User record missing.")
        
    return {
        "authenticated": True,
        "user": dict(user)
    }


@router.post("/logout")
async def logout(request: Request, response: Response):
    """Destroys the Redis session and clears the cookie."""
    session_id = request.cookies.get("session_id")
    
    if session_id:
        await redis_client.delete(session_id)
    
    response.delete_cookie(key="session_id", httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/")
    return {"message": "Successfully logged out"}