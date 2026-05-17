-- Migration: replace shape 'check_badge' with a new 'shade' shape that dims
-- the whole tile by ~50%. Any existing status row using 'check_badge' is
-- migrated to 'shade'. The CHECK constraint is tightened at the end to drop
-- 'check_badge' from the allowed set.
--
-- Idempotent: all steps can be re-run.

-- ── Step A: relaxed CHECK constraint that temporarily allows BOTH values ─────
-- Needed so the UPDATE below doesn't violate the old constraint before/after
-- the in-place swap.
ALTER TABLE statuses DROP CONSTRAINT IF EXISTS statuses_shape_check;
ALTER TABLE statuses ADD CONSTRAINT statuses_shape_check
  CHECK (shape IN (
    'cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl',
    'square', 'bubble', 'question', 'exclamation', 'arrows', 'vertical',
    'hourglass', 'pause_bars', 'lock', 'check_badge', 'shade'
  ));

-- ── Step B: migrate data ─────────────────────────────────────────────────────
UPDATE statuses SET shape = 'shade' WHERE shape = 'check_badge';

-- ── Step C: tighten the CHECK constraint to drop 'check_badge' ──────────────
ALTER TABLE statuses DROP CONSTRAINT statuses_shape_check;
ALTER TABLE statuses ADD CONSTRAINT statuses_shape_check
  CHECK (shape IN (
    'cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl',
    'square', 'bubble', 'question', 'exclamation', 'arrows', 'vertical',
    'hourglass', 'pause_bars', 'lock', 'shade'
  ));
