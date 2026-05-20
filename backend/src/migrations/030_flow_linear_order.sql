-- Migration 030: linearise the Flow data model.
--
-- The DAG (flow_edges parent → child) is being retired in favour of a flat,
-- ordered list of nodes per tile. The new UI is a draggable card stack —
-- each card is just a position in the list, no more branches / siblings /
-- predecessors. Edges stop being read by the API after this migration.
--
-- This script:
--   1) Adds `sort_order` to `flow_nodes` (NOT NULL, default 0).
--   2) Backfills `sort_order` per tile via topological sort of the existing
--      DAG: roots come first, then children by rank then by created_at.
--      Multi-parent / cycle nodes fall back to created_at ordering.
--   3) Leaves the `flow_edges` table in place for now (no destructive drop)
--      so an emergency rollback is just a code change. It can be dropped
--      in a follow-up migration once the new UI ships and stabilises.
--
-- Idempotent: re-running computes the same sort_order from the same edges,
-- so the values converge.

-- Step 1 — add the column.
ALTER TABLE flow_nodes
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Step 2 — backfill sort_order from a per-tile topological sort.
--
-- The recursive CTE walks the DAG from roots downward. A node's `rank` is
-- its longest path from any root (so multi-parent nodes land at the depth
-- of their deepest ancestor — no risk of appearing above an ancestor).
WITH RECURSIVE
  -- Roots: nodes with no incoming edge.
  walk AS (
    SELECT
      n.id,
      n.tile_id,
      0 AS rank,
      n.created_at
    FROM flow_nodes n
    WHERE NOT EXISTS (
      SELECT 1 FROM flow_edges e WHERE e.child_id = n.id
    )

    UNION ALL

    -- Descend along edges. The same node can be reached via multiple paths
    -- (multi-parent) — the GROUP BY in `ranked` keeps only the deepest.
    SELECT
      n.id,
      n.tile_id,
      w.rank + 1 AS rank,
      n.created_at
    FROM flow_nodes n
    JOIN flow_edges e ON e.child_id = n.id
    JOIN walk w ON w.id = e.parent_id
    -- Defensive: cap recursion depth in case of a cycle. The CHECK
    -- constraint on edges + acyclic enforcement at the API layer should
    -- prevent cycles, but be safe.
    WHERE w.rank < 100
  ),
  ranked AS (
    -- Pick the deepest rank for each node (multi-parent case).
    SELECT id, tile_id, MAX(rank) AS rank, MIN(created_at) AS created_at
    FROM walk
    GROUP BY id, tile_id
  ),
  -- Nodes the recursive CTE missed (e.g. cycles, orphan rows with no edges
  -- AND no parent — impossible by definition but defensive). Give them
  -- rank = +infinity so they sort after the well-behaved nodes.
  with_orphans AS (
    SELECT id, tile_id, rank, created_at FROM ranked
    UNION ALL
    SELECT n.id, n.tile_id, 1000000 AS rank, n.created_at
    FROM flow_nodes n
    WHERE n.id NOT IN (SELECT id FROM ranked)
  ),
  numbered AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY tile_id
        ORDER BY rank ASC, created_at ASC, id ASC
      ) - 1 AS sort_order
    FROM with_orphans
  )
UPDATE flow_nodes f
SET sort_order = n.sort_order
FROM numbered n
WHERE f.id = n.id;

-- Step 3 — index for ORDER BY sort_order scans on the read path.
CREATE INDEX IF NOT EXISTS flow_nodes_tile_sort_idx
  ON flow_nodes(tile_id, sort_order);
