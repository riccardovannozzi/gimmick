-- Migration 002: Rename memos → sparks, scheduled_at → start_at, scheduled_end → end_at
-- Run this in the Supabase SQL Editor

-- ============================================================
-- STEP 1: Rename memos table → sparks
-- ============================================================
ALTER TABLE memos RENAME TO sparks;

-- ============================================================
-- STEP 2: Add calendar columns to tiles
-- ============================================================
ALTER TABLE tiles ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;
ALTER TABLE tiles ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE tiles ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- ============================================================
-- STEP 3: Update indexes (drop old, create new)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tiles_start_at ON tiles (start_at)
  WHERE start_at IS NOT NULL;

-- Sparks indexes (renamed from memos)
-- The existing indexes on memos are auto-renamed with the table,
-- but the embedding index name stays. Recreate for clarity:
DROP INDEX IF EXISTS memos_embedding_idx;
CREATE INDEX IF NOT EXISTS sparks_embedding_idx ON sparks USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- STEP 4: Recreate match_sparks RPC (was match_memos)
-- ============================================================
DROP FUNCTION IF EXISTS match_memos;

CREATE OR REPLACE FUNCTION match_sparks(
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
    s.id,
    s.type,
    s.content,
    s.file_name,
    s.metadata,
    s.storage_path,
    s.thumbnail_path,
    s.tile_id,
    1 - (s.embedding <=> query_embedding) AS similarity,
    s.created_at
  FROM sparks s
  WHERE s.user_id = match_user_id
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- STEP 5: Reset stuck processing sparks
-- ============================================================
UPDATE sparks SET ai_status = 'pending' WHERE ai_status = 'processing';

-- ============================================================
-- STORAGE NOTE:
-- The Supabase storage bucket "memos" must be renamed to "sparks"
-- manually via the Supabase Dashboard > Storage > Rename bucket
-- ============================================================
