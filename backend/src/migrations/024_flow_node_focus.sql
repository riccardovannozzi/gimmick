-- Migration 024: per-tile "focus" marker on flow_nodes.
--
-- A user can mark exactly one node per Tile as the "current focus" — the
-- visual anchor for "where am I in this flow right now". Uniqueness is
-- enforced application-side (the API clears any previous focus on the same
-- tile before setting a new one) so we keep the schema as simple as a flag.
--
-- Idempotent.

ALTER TABLE flow_nodes
  ADD COLUMN IF NOT EXISTS is_focus BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS flow_nodes_tile_focus_idx
  ON flow_nodes(tile_id)
  WHERE is_focus = TRUE;
