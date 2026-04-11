-- Migration: Tile subtasks (checklist items linked to a tile)
-- Run this in the Supabase SQL Editor

-- 1. Create tile_subtasks table
CREATE TABLE IF NOT EXISTS tile_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tile_id UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS tile_subtasks_tile_id_idx ON tile_subtasks(tile_id);
CREATE INDEX IF NOT EXISTS tile_subtasks_user_id_idx ON tile_subtasks(user_id);
CREATE INDEX IF NOT EXISTS tile_subtasks_tile_sort_idx ON tile_subtasks(tile_id, sort_order);

-- 3. Enable RLS
ALTER TABLE tile_subtasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can view own subtasks"
  ON tile_subtasks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own subtasks"
  ON tile_subtasks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subtasks"
  ON tile_subtasks FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own subtasks"
  ON tile_subtasks FOR DELETE
  USING (user_id = auth.uid());

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_tile_subtasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tile_subtasks_updated_at_trigger ON tile_subtasks;
CREATE TRIGGER tile_subtasks_updated_at_trigger
  BEFORE UPDATE ON tile_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tile_subtasks_updated_at();