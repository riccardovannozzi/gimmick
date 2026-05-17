-- Migration: make `tiles.is_completed` a projection of `tiles.status_id`.
-- After this migration a tile is "completed" iff its status is the user's
-- system 'done' status. All other reads of `is_completed` (filters, sorts,
-- doneShape fallback) keep working unchanged.
--
-- Strategy (type a): status wins. is_completed is rewritten from the status.
-- Any pre-existing is_completed=true on tiles whose status != 'done' is LOST
-- by design — the user opted for status as the single source of truth.
--
-- Idempotent: safe to re-run.

-- ── Mark as completed every tile whose status is the system 'done' ──────────
UPDATE tiles t
SET is_completed = TRUE
FROM statuses s
WHERE t.status_id = s.id
  AND s.category = 'system'
  AND s.name = 'done'
  AND t.is_completed IS DISTINCT FROM TRUE;

-- ── Mark as NOT completed every other tile (no status, or status != 'done') ─
UPDATE tiles t
SET is_completed = FALSE
WHERE t.is_completed IS DISTINCT FROM FALSE
  AND NOT EXISTS (
    SELECT 1 FROM statuses s
    WHERE s.id = t.status_id
      AND s.category = 'system'
      AND s.name = 'done'
  );
