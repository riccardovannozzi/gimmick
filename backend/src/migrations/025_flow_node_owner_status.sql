-- Migration 025: split flow_node `state` into two orthogonal axes.
--
-- Before: a single `state` enum (mine | theirs | done | blocked | cancelled)
-- that conflated two concepts: who currently owns the action ("la palla") and
-- where the action is in its lifecycle (open, done, blocked, cancelled).
--
-- After:
--   owner  TEXT NOT NULL  IN ('mine', 'theirs')        — who has the ball
--   state  TEXT NOT NULL  IN ('active','done','wait','undo','stop')
--          — lifecycle decorator; 'active' = no decoration
--
-- Backfill mapping (preserves information where present):
--   state='mine'      → owner='mine',   state='active'
--   state='theirs'    → owner='theirs', state='active'
--   state='done'      → owner='mine',   state='done'      (owner default — old rows lack the info)
--   state='blocked'   → owner='mine',   state='stop'
--   state='cancelled' → owner='mine',   state='undo'
--
-- Idempotent. Safe to re-run.

-- Step A — add the owner column with a temporary permissive default so we
-- can backfill existing rows without violating NOT NULL.
ALTER TABLE flow_nodes
  ADD COLUMN IF NOT EXISTS owner TEXT;

-- Step B — backfill owner from the old state value. Only runs for rows that
-- haven't been migrated yet (owner IS NULL).
UPDATE flow_nodes
   SET owner = CASE
                 WHEN state = 'theirs' THEN 'theirs'
                 ELSE 'mine'
               END
 WHERE owner IS NULL;

-- Step C — drop the OLD state CHECK constraint *before* rewriting values.
-- The old constraint allows ('mine','theirs','done','blocked','cancelled');
-- writing 'active'/'stop'/'undo' under it would fail. We re-add the new
-- constraint in Step E once the values are migrated.
ALTER TABLE flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_state_check;

-- Step D — rewrite the state column to the new vocabulary. Idempotent —
-- after first run the only rows touched are ones still on the old enum
-- (typically zero on re-run).
UPDATE flow_nodes SET state = 'active' WHERE state IN ('mine', 'theirs');
UPDATE flow_nodes SET state = 'stop'   WHERE state = 'blocked';
UPDATE flow_nodes SET state = 'undo'   WHERE state = 'cancelled';

-- Step E — enforce NOT NULL + default on owner now that every row has a value.
ALTER TABLE flow_nodes ALTER COLUMN owner SET NOT NULL;
ALTER TABLE flow_nodes ALTER COLUMN owner SET DEFAULT 'mine';

-- Step F — install the new state CHECK constraint.
ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_state_check
  CHECK (state IN ('active', 'done', 'wait', 'undo', 'stop'));

-- Step G — owner CHECK constraint.
ALTER TABLE flow_nodes DROP CONSTRAINT IF EXISTS flow_nodes_owner_check;
ALTER TABLE flow_nodes
  ADD CONSTRAINT flow_nodes_owner_check
  CHECK (owner IN ('mine', 'theirs'));

-- Step H — index on owner for hub-style queries that filter by ownership.
CREATE INDEX IF NOT EXISTS flow_nodes_user_owner_idx
  ON flow_nodes(user_id, owner);

-- Update the default for new INSERTs to land in the new vocabulary.
ALTER TABLE flow_nodes ALTER COLUMN state SET DEFAULT 'active';

-- Step I — the flow_node_activity view (created in migration 022) references
-- the old state values for `is_open`. Drop+recreate with the new vocabulary,
-- and expose the new `owner` column so the API can filter on it.
--   is_open = state IN ('active', 'wait')  — pending states; done/undo/stop
--             are considered closed for FlowHub purposes (stop = blocked
--             externally, treated as "needs handling later" but not actively
--             open to the user).
DROP VIEW IF EXISTS flow_node_activity;
CREATE OR REPLACE VIEW flow_node_activity AS
SELECT
  n.id,
  n.user_id,
  n.tile_id,
  n.owner,
  n.state,
  n.contact_id,
  n.occurred_at,
  n.scheduled_at,
  n.updated_at,
  COALESCE(n.occurred_at, n.scheduled_at, n.updated_at) AS last_activity_at,
  (n.state IN ('active', 'wait'))                       AS is_open,
  NOT EXISTS (
    SELECT 1 FROM flow_edges e WHERE e.parent_id = n.id
  )                                                      AS is_leaf
FROM flow_nodes n;
