-- Migration: AI Indexing support
-- Run this in the Supabase SQL Editor

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add AI columns to memos table
ALTER TABLE memos ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending';
ALTER TABLE memos ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create similarity search function
CREATE OR REPLACE FUNCTION match_memos(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  content TEXT,
  file_name TEXT,
  metadata JSONB,
  storage_path TEXT,
  thumbnail_path TEXT,
  tile_id UUID,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.type,
    m.content,
    m.file_name,
    m.metadata,
    m.storage_path,
    m.thumbnail_path,
    m.tile_id,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.created_at
  FROM memos m
  WHERE m.user_id = match_user_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Create index for fast vector search
CREATE INDEX IF NOT EXISTS memos_embedding_idx ON memos USING hnsw (embedding vector_cosine_ops);

-- 5. Reset any stuck processing memos (useful after server restart)
UPDATE memos SET ai_status = 'pending' WHERE ai_status = 'processing';
