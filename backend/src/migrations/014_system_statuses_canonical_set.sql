-- Migration: canonical set of system statuses.
-- The system-scoped entries in `statuses` are replaced with: active, waiting_for,
-- paused, blocked, cancelled, done. Old system rows are deleted, tiles that
-- pointed to them are detached (status_id → NULL). Custom (per-user) statuses
-- are NOT touched.
--
-- Idempotent: all steps can be re-run safely. Useful because an earlier run
-- committed Steps A and B then failed on Step C due to a stale CHECK constraint.

-- ── Step A: detach tiles from any system status about to be deleted ───────────
UPDATE tiles
SET status_id = NULL
WHERE status_id IN (SELECT id FROM statuses WHERE category = 'system');

-- ── Step B: delete all existing system statuses ──────────────────────────────
DELETE FROM statuses WHERE category = 'system';

-- ── Step B.5: fix the shape CHECK constraint ────────────────────────────────
-- The original `patterns_shape_check` (carried over after the patterns→statuses
-- rename) didn't include 'vertical', even though the TypeScript shape union and
-- the shape-renderers do support it. Drop the stale one and recreate with the
-- full canonical set so Step C can use 'vertical' for the 'paused' status.
ALTER TABLE statuses DROP CONSTRAINT IF EXISTS patterns_shape_check;
ALTER TABLE statuses DROP CONSTRAINT IF EXISTS statuses_shape_check;
ALTER TABLE statuses ADD CONSTRAINT statuses_shape_check
  CHECK (shape IN (
    'cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl',
    'square', 'bubble', 'question', 'exclamation', 'arrows', 'vertical',
    'hourglass', 'pause_bars', 'lock', 'check_badge'
  ));

-- ── Step C: seed the canonical set for every existing user ───────────────────
-- Shapes were picked per concept; users can freely edit them from the UI.
-- action_type is intentionally left NULL: system statuses are no longer linked
-- to action types (that coupling was leftover from the old "pattern" feature).
WITH new_statuses(name, shape) AS (
  VALUES
    ('active',      'solid'),
    ('waiting_for', 'hourglass'),
    ('paused',      'pause_bars'),
    ('blocked',     'lock'),
    ('cancelled',   'cross'),
    ('done',        'shade')
)
INSERT INTO statuses (user_id, category, name, shape, action_type)
SELECT u.id, 'system', ns.name, ns.shape, NULL
FROM auth.users u
CROSS JOIN new_statuses ns;

-- ── Step D: backfill existing tiles to the system 'active' status ────────────
-- Tiles that were orphaned in Step A (or pre-existing NULL) get the canonical
-- default. Safe to re-run: only rows with status_id IS NULL are updated.
UPDATE tiles t
SET status_id = s.id
FROM statuses s
WHERE s.user_id = t.user_id
  AND s.category = 'system'
  AND s.name = 'active'
  AND t.status_id IS NULL;
