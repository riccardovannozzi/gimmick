-- Migration: Tags and tile-tag associations
-- Run this in the Supabase SQL Editor

-- 1. Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create tile_tags junction table
CREATE TABLE IF NOT EXISTS tile_tags (
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tile_id UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, tile_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS tags_user_id_idx ON tags(user_id);
CREATE INDEX IF NOT EXISTS tile_tags_tile_id_idx ON tile_tags(tile_id);
CREATE INDEX IF NOT EXISTS tile_tags_tag_id_idx ON tile_tags(tag_id);

-- 4. Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tile_tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for tags
CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own tags"
  ON tags FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  USING (user_id = auth.uid());

-- 6. RLS Policies for tile_tags
CREATE POLICY "Users can view own tile_tags"
  ON tile_tags FOR SELECT
  USING (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own tile_tags"
  ON tile_tags FOR INSERT
  WITH CHECK (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tile_tags"
  ON tile_tags FOR DELETE
  USING (tag_id IN (SELECT id FROM tags WHERE user_id = auth.uid()));
