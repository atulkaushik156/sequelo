import os
import asyncpg
from dotenv import load_dotenv
load_dotenv()

# Global variable to hold the connection pool
DB_POOL = None

async def init_db_pool():
    """Creates a global connection pool for Neon DB on application startup."""
    global DB_POOL
    database_url = os.getenv("NEON_DATABASE_URL")
    
    if not database_url:
        raise ValueError("NEON_DATABASE_URL is not set in the environment variables.")
        
    # Create the connection pool
    DB_POOL = await asyncpg.create_pool(
        database_url,
        min_size=1,
        max_size=10 # Adjust based on expected concurrent users
    )

async def close_db_pool():
    """Closes the Neon DB connection pool safely on server shutdown."""
    global DB_POOL
    if DB_POOL is not None:
        await DB_POOL.close()
        DB_POOL = None

async def get_db_connection():
    """FastAPI Dependency to yield a connection from the pool for your routes."""
    global DB_POOL
    if DB_POOL is None:
        raise RuntimeError("Database pool is not initialized.")
        
    # Acquire a connection and automatically release it back to the pool afterward
    async with DB_POOL.acquire() as connection:
        yield connection