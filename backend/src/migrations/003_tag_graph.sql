-- Migration 003: Tag graph (weighted co-occurrence relations)
-- Run this in the Supabase SQL Editor

-- ============================================================
-- STEP 1: Add slug and usage_count to existing tags table
-- ============================================================
ALTER TABLE tags ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Populate slug from existing names (lowercase, trim, replace spaces with hyphens)
UPDATE tags SET slug = lower(trim(regexp_replace(name, '\s+', '-', 'g')))
WHERE slug IS NULL;

-- Add unique constraint on (user_id, slug)
CREATE UNIQUE INDEX IF NOT EXISTS tags_user_slug_idx ON tags(user_id, slug);

-- ============================================================
-- STEP 2: Create tag_relations table (weighted directed edges)
-- ============================================================
CREATE TABLE IF NOT EXISTS tag_relations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_from   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tag_to     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  weight     FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tag_from, tag_to)
);

-- Indexes for fast graph traversal
CREATE INDEX IF NOT EXISTS tag_relations_user_id_idx ON tag_relations(user_id);
CREATE INDEX IF NOT EXISTS tag_relations_tag_from_idx ON tag_relations(tag_from);
CREATE INDEX IF NOT EXISTS tag_relations_tag_to_idx ON tag_relations(tag_to);

-- ============================================================
-- STEP 3: Enable RLS on tag_relations
-- ============================================================
ALTER TABLE tag_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tag_relations"
  ON tag_relations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tag_relations"
  ON tag_relations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tag_relations"
  ON tag_relations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tag_relations"
  ON tag_relations FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- STEP 4: Backfill usage_count from existing tile_tags
-- ============================================================
UPDATE tags t
SET usage_count = sub.cnt
FROM (
  SELECT tag_id, COUNT(*) AS cnt
  FROM tile_tags
  GROUP BY tag_id
) sub
WHERE t.id = sub.tag_id;

-- ============================================================
-- STEP 5: Backfill tag_relations from existing co-occurrences
-- ============================================================
INSERT INTO tag_relations (user_id, tag_from, tag_to, weight)
SELECT
  t1.user_id,
  tt1.tag_id AS tag_from,
  tt2.tag_id AS tag_to,
  COUNT(*)::FLOAT AS weight
FROM tile_tags tt1
JOIN tile_tags tt2 ON tt1.tile_id = tt2.tile_id AND tt1.tag_id < tt2.tag_id
JOIN tags t1 ON tt1.tag_id = t1.id
GROUP BY t1.user_id, tt1.tag_id, tt2.tag_id
ON CONFLICT (user_id, tag_from, tag_to) DO UPDATE SET weight = EXCLUDED.weight;

-- Also insert reverse direction (B→A)
INSERT INTO tag_relations (user_id, tag_from, tag_to, weight)
SELECT
  t1.user_id,
  tt2.tag_id AS tag_from,
  tt1.tag_id AS tag_to,
  COUNT(*)::FLOAT AS weight
FROM tile_tags tt1
JOIN tile_tags tt2 ON tt1.tile_id = tt2.tile_id AND tt1.tag_id < tt2.tag_id
JOIN tags t1 ON tt1.tag_id = t1.id
GROUP BY t1.user_id, tt2.tag_id, tt1.tag_id
ON CONFLICT (user_id, tag_from, tag_to) DO UPDATE SET weight = EXCLUDED.weight;
