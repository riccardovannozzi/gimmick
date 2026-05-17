-- Migration: remove user-created custom statuses, keep only the canonical
-- SYSTEM set (active, done, paused, blocked, cancelled).
--
-- Tiles currently pointing to a custom status are detached (status_id → NULL)
-- so they fall back to the action_type-derived shape instead of orphaning.
-- The `category` column is preserved — it still distinguishes the system
-- rows for code that looks them up by `(category, name)`.
--
-- Idempotent: re-runs find nothing to delete.

-- Step A: detach tiles from any custom status about to be deleted.
UPDATE tiles
SET status_id = NULL
WHERE status_id IN (SELECT id FROM statuses WHERE category = 'custom');

-- Step B: delete every custom status across all users.
DELETE FROM statuses WHERE category = 'custom';
