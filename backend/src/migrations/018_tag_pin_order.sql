-- Migration 018: Add pin_order to tags
--
-- Stores the user's manual ordering of pinned tags (used by the Canvas topbar
-- breadcrumb chips, drag-and-drop reorderable). For non-pinned tags the value
-- is irrelevant. Lower number = leftmost.

ALTER TABLE tags ADD COLUMN IF NOT EXISTS pin_order INTEGER NOT NULL DEFAULT 0;

-- Backfill existing pinned tags with a deterministic initial order: by created_at ascending.
-- This runs once; on re-execution the WHERE clause skips already-positioned rows.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS rn
  FROM tags
  WHERE is_pinned = TRUE AND pin_order = 0
)
UPDATE tags t SET pin_order = ranked.rn
FROM ranked WHERE t.id = ranked.id;

CREATE INDEX IF NOT EXISTS tags_pin_order_idx ON tags(user_id, pin_order) WHERE is_pinned = TRUE;
