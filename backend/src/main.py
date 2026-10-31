import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from database import init_db_pool, close_db_pool

from auth.routes import router as auth_router
from file_upload.routes import router as upload_router
from chat.create_chat import router as chat_router
from analyzing_agent.routes import router as schema_router
from chat.routes import router as chat_agent_router
from chat.delete_chat import router as delete_chat_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up: Connecting to Neon DB...")
    await init_db_pool()

    yield

    logger.info("Shutting down: Closing database connections...")
    await close_db_pool()


app = FastAPI(
    title="SaaS Text-to-SQL API",
    lifespan=lifespan
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-production-app.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(
        "Unhandled error on %s %s",
        request.method,
        request.url
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected server error occurred. Please try again later."
        }
    )


# Authentication
app.include_router(auth_router)

# File upload
app.include_router(
    upload_router, 
    prefix="/api"
)

# Chat creation 
# EXACT FIX: Removed prefix="/api" here because create_chat.py natively sets "/api/chats"
app.include_router(chat_router)

# Schema verification
app.include_router(
    schema_router,
    prefix="/api",
    tags=["Schema Verification"]
)

# Chat agent / LangGraph processing
app.include_router(
    chat_agent_router,
    prefix="/api",
    tags=["Chat Agent Processing"]
)
app.include_router(delete_chat_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "status": "API is running. Database pool is active."
    }