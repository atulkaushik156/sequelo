-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
-- Required for vector embeddings (RAG)
CREATE EXTENSION IF NOT EXISTS vector;
-- Required for auto-generating UUIDs (PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 2. TABLE CREATION
-- ==============================================================================


CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT, -- Removed NOT NULL to allow OAuth logins later
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Table: chats (The Session Parent)
CREATE TABLE IF NOT EXISTS chats (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: user_datasets (The File Registry)
CREATE TABLE IF NOT EXISTS user_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
    tenant_id VARCHAR NOT NULL,
    original_filename VARCHAR NOT NULL,
    table_alias VARCHAR NOT NULL,
    s3_url VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: business_context_embeddings (The RAG Brain)
CREATE TABLE IF NOT EXISTS business_context_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
    tenant_id VARCHAR NOT NULL,
    table_alias VARCHAR NOT NULL,
    context_text TEXT NOT NULL,
    -- Adjust dimensions (e.g., 1536 for OpenAI, 768 for Nomic/Llama, 384 for MiniLM)
    embedding vector(1536), 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: messages (The Chat History & AI Memory)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(chat_id) ON DELETE CASCADE,
    tenant_id VARCHAR NOT NULL,
    role VARCHAR NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'error')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. PERFORMANCE & SECURITY INDEXES
-- ==============================================================================

-- Indexes for 'chats'
CREATE INDEX IF NOT EXISTS idx_chats_tenant ON chats(tenant_id);

-- Indexes for 'user_datasets'
CREATE INDEX IF NOT EXISTS idx_datasets_tenant_chat ON user_datasets(tenant_id, chat_id);

-- Indexes for 'business_context_embeddings'
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_chat ON business_context_embeddings(tenant_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_alias ON business_context_embeddings(table_alias);

-- Indexes for 'messages'
CREATE INDEX IF NOT EXISTS idx_messages_tenant_chat ON messages(tenant_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);