import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Import database connection managers
from database import init_db_pool, close_db_pool

# Import your routers 
from auth.routes import router as auth_router
from file_upload.routes import router as upload_router
from chat.create_chat import router as chat_router

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Neon DB connection pool
    logger.info("Starting up: Connecting to Neon DB...")
    await init_db_pool()
    
    yield
    
    # Shutdown: Close connections safely
    logger.info("Shutting down: Closing Neon DB connections...")
    await close_db_pool()

app = FastAPI(title="SaaS Text-to-SQL API", lifespan=lifespan)

# Configure CORS for Next.js frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,                  
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# GLOBAL EXCEPTION HANDLER
# ==========================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full error internally so you can debug it in your terminal
    logger.error(f"Unhandled system error on {request.method} {request.url}: {exc}")
    
    # Return a safe, generic JSON response to the user instead of crashing
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Please try again later."},
    )

# Register the routes with FastAPI
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(chat_router)

@app.get("/")
async def root():
    return {"status": "API is running. Database pool is active."}