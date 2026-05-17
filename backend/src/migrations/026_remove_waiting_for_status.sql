-- Migration: remove the 'waiting_for' system status.
-- Its role is now covered by the Flow feature (tiles waiting on upstream nodes
-- are tracked via flow_node_owner_status / blocked-by edges), so we no longer
-- need a dedicated system status. Custom user-created statuses are NOT touched.
--
-- Idempotent: re-running is safe (nothing matches the second time).

-- ── Step A: detach tiles currently pointing to any waiting_for system row ────
UPDATE tiles
SET status_id = NULL
WHERE status_id IN (
  SELECT id FROM statuses
  WHERE category = 'system' AND name = 'waiting_for'
);

-- ── Step B: delete the waiting_for rows across all users ─────────────────────
DELETE FROM statuses
WHERE category = 'system' AND name = 'waiting_for';
