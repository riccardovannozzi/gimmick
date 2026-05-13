-- Migration 023: optional manual x,y positions for flow nodes.
--
-- When (x, y) is NULL the FlowTrack falls back to its auto-layout (Dagre LR).
-- When the user drags a node, the new position is persisted here so the next
-- render keeps the manual placement.
--
-- Idempotent.

ALTER TABLE flow_nodes
  ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION;
