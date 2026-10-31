import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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
        "https://your-production-app.com" # You can update this to your Render URL later
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


# Changed from "/" to "/api/health" so it doesn't block the React frontend
@app.get("/api/health")
async def root():
    return {
        "status": "API is running. Database pool is active."
    }

# ==========================================
# FRONTEND SERVING LOGIC FOR DEPLOYMENT
# ==========================================
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))

if os.path.exists(frontend_dist):
    # Serve Vite's compiled assets (CSS, JS)
    app.mount("/assets", StaticFiles(directory=f"{frontend_dist}/assets"), name="assets")

    # Catch-all route to serve React's index.html for UI routing
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        # Prevent the catch-all from intercepting missing API routes
        if catchall.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "API route not found"})
            
        index_path = os.path.join(frontend_dist, "index.html")
        requested_file = os.path.join(frontend_dist, catchall)
        
        # Serve specific files if they exist (like favicon.ico, vite.svg)
        if os.path.isfile(requested_file):
            return FileResponse(requested_file)

        # Serve index.html for React Router
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
        return {"error": "Frontend build not found"}