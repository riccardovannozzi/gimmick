-- Migration: Canvas persistence tables
-- Tables backing the per-tag canvas board: tile positions, edges between nodes,
-- visual groups, and free text boxes. Routes in src/routes/canvas.ts depend on
-- the UNIQUE constraints below for upsert (onConflict) to work.

-- ── Layouts (tile positions per tag) ──
CREATE TABLE IF NOT EXISTS canvas_layouts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  tile_id UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id, tile_id)
);

CREATE INDEX IF NOT EXISTS canvas_layouts_tag_idx ON canvas_layouts(user_id, tag_id);

-- ── Edges (links between nodes on a tag's canvas) ──
CREATE TABLE IF NOT EXISTS canvas_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  source_port TEXT,
  target_port TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Required by upsert(onConflict: 'user_id,tag_id,source_id,target_id') in routes/canvas.ts
CREATE UNIQUE INDEX IF NOT EXISTS canvas_edges_unique_idx
  ON canvas_edges(user_id, tag_id, source_id, target_id);

CREATE INDEX IF NOT EXISTS canvas_edges_tag_idx ON canvas_edges(user_id, tag_id);

-- ── Groups ──
CREATE TABLE IF NOT EXISTS canvas_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  node_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canvas_groups_tag_idx ON canvas_groups(user_id, tag_id);

-- ── Text boxes ──
CREATE TABLE IF NOT EXISTS canvas_textboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  w DOUBLE PRECISION NOT NULL DEFAULT 200,
  h DOUBLE PRECISION NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canvas_textboxes_tag_idx ON canvas_textboxes(user_id, tag_id);

-- ── If canvas_edges already existed without the unique index, add it now ──
-- (Safe to re-run: IF NOT EXISTS above handles the already-correct case.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'canvas_edges_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX canvas_edges_unique_idx
      ON canvas_edges(user_id, tag_id, source_id, target_id);
  END IF;
END $$;
