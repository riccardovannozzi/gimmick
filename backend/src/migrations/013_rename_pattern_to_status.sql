-- Migration: rename the "pattern" feature to "status".
-- To avoid collision with the existing 'status' kanban-filter key (Done/Undone completion),
-- that filter is first rebranded to 'completion'. Only then can 'pattern' become 'status'.
-- Non-destructive: only names change; existing rows are preserved.

-- ── Step A: kanban filter key 'status' (Done/Undone) → 'completion' ───────────────
-- MUST run BEFORE step B, otherwise the Pattern→Status rewrite would clobber Done/Undone.
UPDATE kanban_columns
SET filters = (
  SELECT jsonb_agg(
    CASE WHEN f->>'type' = 'status'
         THEN jsonb_set(f, '{type}', '"completion"')
         ELSE f
    END
  )
  FROM jsonb_array_elements(filters) f
)
WHERE filters @> '[{"type":"status"}]';

-- ── Step B: kanban filter key 'pattern' → 'status' ───────────────────────────────
UPDATE kanban_columns
SET filters = (
  SELECT jsonb_agg(
    CASE WHEN f->>'type' = 'pattern'
         THEN jsonb_set(f, '{type}', '"status"')
         ELSE f
    END
  )
  FROM jsonb_array_elements(filters) f
)
WHERE filters @> '[{"type":"pattern"}]';

-- ── Step C: rename the patterns table and the FK column on tiles ─────────────────
ALTER TABLE IF EXISTS patterns RENAME TO statuses;
ALTER TABLE tiles RENAME COLUMN pattern_id TO status_id;
