-- Migration 020: Foundation for the unified `find` search tool.
--
-- This adds the building blocks the find() pipeline relies on:
--   * pg_trgm + unaccent extensions for typo/accent-tolerant keyword search
--   * tiles.embedding (vector 1536) so tiles get the same semantic capability sparks already have
--   * GIN trigram indexes on tile title/description and spark content
--   * IVFFlat index on the new tile embedding column
--   * Composite indexes that match the most common find filters
--
-- Idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE.

-- ============================================================================
-- 1. Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent(text) is STABLE, not IMMUTABLE, so it can't be used in index
-- expressions directly. Wrap it in an IMMUTABLE SQL function — the result is
-- deterministic for a fixed dictionary so this is safe.
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT public.unaccent($1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- ============================================================================
-- 2. tiles.embedding
-- ============================================================================
ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- IVFFlat with lists=100 fits comfortably up to ~100k tiles per user.
-- Switch to HNSW if dataset grows beyond that.
CREATE INDEX IF NOT EXISTS idx_tiles_embedding
  ON tiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 3. GIN trigram indexes (typo + accent tolerant keyword search)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tiles_title_trgm
  ON tiles USING gin (immutable_unaccent(lower(coalesce(title, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tiles_description_trgm
  ON tiles USING gin (immutable_unaccent(lower(coalesce(description, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sparks_content_trgm
  ON sparks USING gin (immutable_unaccent(lower(coalesce(content, ''))) gin_trgm_ops);

-- ============================================================================
-- 4. Filter-support indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tiles_user_action
  ON tiles (user_id, action_type, is_completed);

CREATE INDEX IF NOT EXISTS idx_sparks_user_tile_aistatus
  ON sparks (user_id, tile_id, ai_status);
