-- Migration 021: RPC functions backing the unified `find` search tool.
--
-- Four functions, paired by target table × strategy:
--   * find_tiles_keyword     → trigram similarity over expanded queries
--   * find_tiles_semantic    → pgvector cosine over the query embedding
--   * find_sparks_keyword    → trigram similarity over expanded queries
--   * find_sparks_semantic   → pgvector cosine over the query embedding
--
-- The keyword variants accept a TEXT[] of expanded queries (synonyms / LLM
-- variants from the find pipeline) and return the MAX similarity score across
-- the variants, so a single hit on any variant ranks the row.
--
-- All filtering parameters are NULL-safe: passing NULL means "no constraint".
--
-- Idempotent: CREATE OR REPLACE everywhere.

-- ============================================================================
-- 1. find_tiles_keyword
-- ============================================================================
CREATE OR REPLACE FUNCTION find_tiles_keyword(
  p_user_id uuid,
  p_queries text[],
  p_threshold float DEFAULT 0.2,
  p_action_types text[] DEFAULT NULL,
  p_is_cta boolean DEFAULT NULL,
  p_is_completed boolean DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  action_type text,
  is_completed boolean,
  is_cta boolean,
  start_at timestamptz,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.action_type::text,
    t.is_completed,
    t.is_cta,
    t.start_at,
    GREATEST(
      MAX(similarity(immutable_unaccent(lower(coalesce(t.title, ''))), immutable_unaccent(lower(q)))),
      MAX(similarity(immutable_unaccent(lower(coalesce(t.description, ''))), immutable_unaccent(lower(q))))
    )::float AS score
  FROM tiles t
  CROSS JOIN unnest(p_queries) AS q
  WHERE t.user_id = p_user_id
    AND (
      similarity(immutable_unaccent(lower(coalesce(t.title, ''))), immutable_unaccent(lower(q))) > p_threshold
      OR similarity(immutable_unaccent(lower(coalesce(t.description, ''))), immutable_unaccent(lower(q))) > p_threshold
    )
    AND (p_action_types IS NULL OR t.action_type = ANY(p_action_types))
    AND (p_is_cta IS NULL OR t.is_cta = p_is_cta)
    AND (p_is_completed IS NULL OR t.is_completed = p_is_completed)
    AND (p_date_from IS NULL OR coalesce(t.start_at, t.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR coalesce(t.start_at, t.created_at) <= p_date_to)
    AND (
      p_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM tile_tags tt
        WHERE tt.tile_id = t.id AND tt.tag_id = ANY(p_tag_ids)
      )
    )
  GROUP BY t.id, t.title, t.description, t.action_type, t.is_completed, t.is_cta, t.start_at
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. find_tiles_semantic
-- ============================================================================
CREATE OR REPLACE FUNCTION find_tiles_semantic(
  p_user_id uuid,
  p_embedding vector(1536),
  p_threshold float DEFAULT 0.55,
  p_action_types text[] DEFAULT NULL,
  p_is_cta boolean DEFAULT NULL,
  p_is_completed boolean DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  action_type text,
  is_completed boolean,
  is_cta boolean,
  start_at timestamptz,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.action_type::text,
    t.is_completed,
    t.is_cta,
    t.start_at,
    (1 - (t.embedding <=> p_embedding))::float AS score
  FROM tiles t
  WHERE t.user_id = p_user_id
    AND t.embedding IS NOT NULL
    AND (1 - (t.embedding <=> p_embedding)) > p_threshold
    AND (p_action_types IS NULL OR t.action_type = ANY(p_action_types))
    AND (p_is_cta IS NULL OR t.is_cta = p_is_cta)
    AND (p_is_completed IS NULL OR t.is_completed = p_is_completed)
    AND (p_date_from IS NULL OR coalesce(t.start_at, t.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR coalesce(t.start_at, t.created_at) <= p_date_to)
    AND (
      p_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM tile_tags tt
        WHERE tt.tile_id = t.id AND tt.tag_id = ANY(p_tag_ids)
      )
    )
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. find_sparks_keyword
-- ============================================================================
CREATE OR REPLACE FUNCTION find_sparks_keyword(
  p_user_id uuid,
  p_queries text[],
  p_threshold float DEFAULT 0.2,
  p_spark_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tile_id uuid,
  content text,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tile_id,
    s.content,
    MAX(similarity(immutable_unaccent(lower(coalesce(s.content, ''))), immutable_unaccent(lower(q))))::float AS score
  FROM sparks s
  CROSS JOIN unnest(p_queries) AS q
  WHERE s.user_id = p_user_id
    AND s.content IS NOT NULL
    AND similarity(immutable_unaccent(lower(s.content)), immutable_unaccent(lower(q))) > p_threshold
    AND (p_spark_types IS NULL OR s.type = ANY(p_spark_types))
  GROUP BY s.id, s.tile_id, s.content
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. find_sparks_semantic
--    Filters ai_status='completed' so only fully-indexed sparks compete.
-- ============================================================================
CREATE OR REPLACE FUNCTION find_sparks_semantic(
  p_user_id uuid,
  p_embedding vector(1536),
  p_threshold float DEFAULT 0.55,
  p_spark_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tile_id uuid,
  content text,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tile_id,
    s.content,
    (1 - (s.embedding <=> p_embedding))::float AS score
  FROM sparks s
  WHERE s.user_id = p_user_id
    AND s.embedding IS NOT NULL
    AND (1 - (s.embedding <=> p_embedding)) > p_threshold
    AND (p_spark_types IS NULL OR s.type = ANY(p_spark_types))
    AND s.ai_status = 'completed'
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;
