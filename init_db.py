import os
import sys
import psycopg
from dotenv import load_dotenv

# Leave this commented out until you build the LangGraph agent
# from langgraph.checkpoint.postgres import PostgresSaver

load_dotenv()

def run_migrations():
    db_uri = os.getenv("NEON_DATABASE_URL") 
    if not db_uri:
        print("❌ ERROR: NEON_DATABASE_URL environment variable is missing.")
        sys.exit(1)

    print("⏳ Connecting to Neon Postgres to run migrations...")
    try:
        # autocommit=True is best practice for running DDL (schema) statements
        with psycopg.connect(db_uri, autocommit=True) as conn:
            
            # =========================================================
            # 1. LangGraph Checkpoint Tables (DEFERRED)
            # =========================================================
            # Uncomment these lines when you implement LangGraph memory:
            # checkpointer = PostgresSaver(conn)
            # checkpointer.setup()
            # print("✅ LangGraph checkpoint tables verified/created.")
            print("⏳ Skipping LangGraph checkpointer setup (Deferred).")

            # =========================================================
            # 2. Custom SaaS Schema (chats, files, embeddings, messages)
            # =========================================================
            sql_file_path = os.path.join(os.path.dirname(__file__), 'query.sql')
            if os.path.exists(sql_file_path):
                with open(sql_file_path, 'r') as file:
                    sql_commands = file.read()
                conn.execute(sql_commands)
                print("✅ SaaS tables verified/created from query.sql.")
            else:
                print(f"⚠️ WARNING: {sql_file_path} not found. Skipping SaaS tables.")

        print("🚀 Database initialization complete!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migrations()