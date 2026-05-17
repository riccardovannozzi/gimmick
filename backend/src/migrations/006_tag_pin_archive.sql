-- Migration: Add pin/archive state to tags
-- Replaces the client-side localStorage "pinned" concept with DB-persisted state.
-- A tag can be in one of three states:
--   - normal    (is_pinned = false, is_archived = false)
--   - pinned    (is_pinned = true)
--   - archived  (is_archived = true)
-- is_pinned and is_archived are mutually exclusive by convention (not enforced by constraint).

ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS tags_is_pinned_idx ON tags(user_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX IF NOT EXISTS tags_is_archived_idx ON tags(user_id, is_archived) WHERE is_archived = TRUE;
