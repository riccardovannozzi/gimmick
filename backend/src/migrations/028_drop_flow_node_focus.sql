-- Migration: drop the per-tile "focus" marker from flow_nodes.
--
-- The FlowHub no longer differentiates "the one focused node per flow" from
-- the rest of the graph — Mine/Theirs/Fermi/Bloccati surface every matching
-- node directly. Removing the column drops the only consumer.
--
-- Idempotent.

DROP INDEX IF EXISTS flow_nodes_tile_focus_idx;
ALTER TABLE flow_nodes DROP COLUMN IF EXISTS is_focus;
