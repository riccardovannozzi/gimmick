'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlow } from '@/lib/hooks/useFlow';
import { useContacts } from '@/lib/hooks/useContacts';
import { FlowNodeView } from './FlowNodeView';
import { FlowEdgeView } from './FlowEdgeView';
import type { FlowNode, FlowEdge } from '@/types/flow';

/**
 * Vertical "fishbone" view: each node occupies one row, body on the left
 * side of the canvas, label right-aligned on the far right. The fishbone
 * effect comes from the column assignment — when a parent has two children,
 * the second one shifts to a parallel column so its label can sit on the
 * right without overlapping its sibling's. Edges between same-column nodes
 * are straight vertical lines; column-crossing edges curve as cubic beziers.
 *
 * Read-only viewer: edges are added/removed via the inspector buttons
 * (Figlio / Predecessore / Fratello / Elimina), not by dragging.
 */

/** Total SVG width — sized to fit inside the TileSidebar (w-60 = 240px) with
 *  a small safety margin. Any wider and right-aligned labels would render
 *  past the sidebar's right edge and get clipped. */
const SVG_WIDTH = 232;
const NODE_RADIUS = 10;
const LEFT_MARGIN = 8;
/** X coordinate of column-0 (main spine) bodies. */
const BODY_X_LEFT = LEFT_MARGIN + NODE_RADIUS;
const RIGHT_MARGIN = 8;
/** Gap between the rightmost body and the start of the label area. */
const BODY_TO_LABEL_GAP = 10;
/** Lane width is computed at render time from the number of active lanes —
 *  capped between these two so a single branching doesn't crowd, and many
 *  branchings still leave usable label space. */
const MIN_LANE_WIDTH = 22;
const MAX_LANE_WIDTH = 40;
/** Hard floor for the right-aligned label area, in px. The lane width
 *  shrinks toward MIN_LANE_WIDTH before the label area drops below this. */
const MIN_LABEL_WIDTH = 80;
/** Hard ceiling on how many parallel sibling lanes the diagram opens. After
 *  this many, additional siblings stack on the last lane (different Y, same
 *  X) instead of pushing the lane count further. Keeps the diagram readable
 *  inside the 232px sidebar — at 5 lanes the label area is still ~80px. */
const MAX_LANES = 5;

const ROW_HEIGHT = 64;
/** Vertical gap between consecutive siblings (consecutive nodes sharing the
 *  same parent). Tighter than ROW_HEIGHT so siblings read as a pair rather
 *  than two unrelated rows on the spine. */
const SIBLING_GAP = 36;
const TOP_MARGIN = 16;
const BOTTOM_MARGIN = 12;
/** Fixed vertical extent of the right-aligned label block, centered on the
 *  body. Kept smaller than SIBLING_GAP so two sibling labels don't overlap. */
const LABEL_HEIGHT = 32;

interface Props {
  tileId: string;
  /** The currently-edited node — highlighted with the FlowNodeView selection
   *  ring. */
  selectedNodeId: string | null;
  /** Called when the user clicks a row. The caller updates whatever state
   *  drives `selectedNodeId`. */
  onSelectNode: (id: string | null) => void;
}

/** Rank-major topological sort. Walks ranks in ascending order (0, 1, 2, …);
 *  within a rank, groups nodes by their primary parent's already-emitted
 *  position and breaks ties by `created_at`. The result puts every sibling
 *  set in a contiguous block — which is what the Y-spacing logic downstream
 *  relies on to recognise consecutive nodes as siblings (and tighten the
 *  vertical gap between them). Falls back to insertion order for any nodes
 *  the rank pass missed (cycles — backend rejects them, defensive). */
function topoSort(nodes: FlowNode[], edges: { parent_id: string; child_id: string }[]): FlowNode[] {
  const rank = computeRanks(nodes, edges as FlowEdge[]);

  const byRank = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id);
    if (r == null) continue;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  }

  const primaryParent = new Map<string, string>();
  for (const e of edges) {
    if (!primaryParent.has(e.child_id)) primaryParent.set(e.child_id, e.parent_id);
  }

  const positionInResult = new Map<string, number>();
  const result: FlowNode[] = [];
  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);
  for (const r of sortedRanks) {
    const arr = byRank.get(r)!;
    if (r === 0) {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      arr.sort((a, b) => {
        const pa = primaryParent.get(a.id);
        const pb = primaryParent.get(b.id);
        const posA = pa ? positionInResult.get(pa) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const posB = pb ? positionInResult.get(pb) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        if (posA !== posB) return posA - posB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
    for (const n of arr) {
      positionInResult.set(n.id, result.length);
      result.push(n);
    }
  }

  if (result.length < nodes.length) {
    const seen = new Set(result.map((n) => n.id));
    for (const n of nodes) if (!seen.has(n.id)) result.push(n);
  }
  return result;
}

/** Assign every node to a swim-lane (column index) using a subtree-width
 *  layout: every subtree gets a contiguous block of lanes equal to its
 *  "width" (number of leaves), and a node's first child shares the node's
 *  lane (the spine continues), while subsequent children land on lanes
 *  offset by the cumulative width of their already-placed left-siblings.
 *
 *  This guarantees that two unrelated subtrees never compete for the same
 *  lane, which is what eliminates edge crossings — a child of a left branch
 *  can't end up in a lane reserved by a right branch's descendants.
 *
 *  Lane indices are clamped to MAX_LANES - 1 at the end, so very wide trees
 *  collapse onto the last lane (still readable thanks to per-node Y). */
function assignColumns(ordered: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const cols = new Map<string, number>();
  const orderIndex = new Map<string, number>();
  ordered.forEach((n, i) => orderIndex.set(n.id, i));

  // Children-of map, sorted by topo order so siblings are processed in the
  // same sequence the rest of the component already uses (consistent X for
  // the user as they add new siblings).
  const childrenOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!childrenOf.has(e.parent_id)) childrenOf.set(e.parent_id, []);
    childrenOf.get(e.parent_id)!.push(e.child_id);
  }
  for (const ids of childrenOf.values()) {
    ids.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
  }

  const hasParent = new Set<string>();
  for (const e of edges) hasParent.add(e.child_id);
  const roots = ordered.filter((n) => !hasParent.has(n.id));

  // Memoised subtree width = number of leaves in the subtree rooted at id.
  // Leaves are width 1; internal nodes sum their children's widths. Cycle
  // guard via `visiting` set (backend rejects cycles, defensive only).
  const widthCache = new Map<string, number>();
  const subtreeWidth = (id: string, visiting: Set<string>): number => {
    const cached = widthCache.get(id);
    if (cached != null) return cached;
    if (visiting.has(id)) return 1;
    visiting.add(id);
    const children = childrenOf.get(id) ?? [];
    let w = 0;
    if (children.length === 0) {
      w = 1;
    } else {
      for (const c of children) w += subtreeWidth(c, visiting);
      if (w < 1) w = 1;
    }
    visiting.delete(id);
    widthCache.set(id, w);
    return w;
  };

  // Recursively place a subtree starting at `start`. Parent takes `start`;
  // first child inherits; remaining children shift right by the cumulative
  // width of already-placed siblings.
  const placed = new Set<string>();
  const layout = (id: string, start: number) => {
    if (placed.has(id)) return; // multi-parent: keep the first placement
    placed.add(id);
    cols.set(id, Math.min(start, MAX_LANES - 1));
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) return;
    layout(children[0], start);
    let offset = subtreeWidth(children[0], new Set());
    for (let i = 1; i < children.length; i++) {
      layout(children[i], start + offset);
      offset += subtreeWidth(children[i], new Set());
    }
  };

  let rootStart = 0;
  for (const root of roots) {
    layout(root.id, rootStart);
    rootStart += subtreeWidth(root.id, new Set());
  }

  // Orphans (cycles, etc.) fall back to lane 0 so they at least render.
  for (const n of ordered) {
    if (!cols.has(n.id)) cols.set(n.id, 0);
  }
  return cols;
}

/** Longest-path rank per node: 0 for roots, parentRank + 1 otherwise.
 *  Multi-parent nodes take the deepest parent's rank + 1 so a node never
 *  sits above one of its ancestors. */
function computeRanks(nodes: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.parent_id) || !indeg.has(e.child_id)) continue;
    indeg.set(e.child_id, (indeg.get(e.child_id) ?? 0) + 1);
    adj.get(e.parent_id)!.push(e.child_id);
  }
  const rank = new Map<string, number>();
  const ready: string[] = [];
  for (const [id, d] of indeg) {
    if (d === 0) {
      rank.set(id, 0);
      ready.push(id);
    }
  }
  while (ready.length) {
    const id = ready.shift()!;
    const myRank = rank.get(id) ?? 0;
    for (const child of adj.get(id) ?? []) {
      rank.set(child, Math.max(rank.get(child) ?? 0, myRank + 1));
      indeg.set(child, (indeg.get(child) ?? 0) - 1);
      if (indeg.get(child) === 0) ready.push(child);
    }
  }
  return rank;
}

/** Build an SVG `d` string for an edge between two body centers. Straight
 *  vertical line when the two share a column, smooth cubic bezier otherwise.
 *  Endpoints are inset to the body's top/bottom edges so the stroke meets the
 *  ring cleanly. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  // Inset both ends by the radius so the line touches the body, not the center.
  const y1Out = y1 + NODE_RADIUS;
  const y2In = y2 - NODE_RADIUS;
  if (x1 === x2) {
    return `M ${x1},${y1Out} L ${x2},${y2In}`;
  }
  const midY = (y1Out + y2In) / 2;
  return `M ${x1},${y1Out} C ${x1},${midY} ${x2},${midY} ${x2},${y2In}`;
}

export function VerticalFlowTrack({ tileId, selectedNodeId, onSelectNode }: Props) {
  const { graph, isLoading } = useFlow(tileId);
  const { contacts } = useContacts();

  const contactById = useMemo(() => {
    const m = new Map<string, { name: string; is_self: boolean }>();
    for (const c of contacts) m.set(c.id, { name: c.name, is_self: c.is_self });
    return m;
  }, [contacts]);

  const nodeShape = useCallback(
    (n: FlowNode): 'square' | 'circle' => {
      if (!n.contact_id) return 'square';
      const c = contactById.get(n.contact_id);
      return c?.is_self ? 'square' : 'circle';
    },
    [contactById],
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ordered = useMemo(() => topoSort(graph.nodes, graph.edges), [graph.nodes, graph.edges]);
  const columnById = useMemo(() => assignColumns(ordered, graph.edges), [ordered, graph.edges]);
  const ranksById = useMemo(() => computeRanks(graph.nodes, graph.edges), [graph.nodes, graph.edges]);

  /** Number of lanes actually in use — drives the adaptive lane width below
   *  so a flow with a single branching uses comfortable spacing, while one
   *  with many branchings stays inside the sidebar. */
  const numLanes = useMemo(() => {
    let max = 0;
    for (const c of columnById.values()) max = Math.max(max, c);
    return max + 1;
  }, [columnById]);

  /** Adaptive lane width: comfortable (MAX) when 1–2 lanes are used, shrinks
   *  toward MIN as more branchings appear so label area never goes below
   *  MIN_LABEL_WIDTH. */
  const laneWidth = useMemo(() => {
    if (numLanes <= 1) return MAX_LANE_WIDTH;
    const budget =
      SVG_WIDTH - BODY_X_LEFT - NODE_RADIUS - BODY_TO_LABEL_GAP - MIN_LABEL_WIDTH - RIGHT_MARGIN;
    const computed = budget / (numLanes - 1);
    return Math.max(MIN_LANE_WIDTH, Math.min(MAX_LANE_WIDTH, computed));
  }, [numLanes]);

  /** X of the right-aligned label block — sits past the rightmost lane body
   *  plus a small breathing gap. */
  const labelX = useMemo(() => {
    const rightmostBody = BODY_X_LEFT + (numLanes - 1) * laneWidth;
    return rightmostBody + NODE_RADIUS + BODY_TO_LABEL_GAP;
  }, [numLanes, laneWidth]);
  const labelWidth = SVG_WIDTH - RIGHT_MARGIN - labelX;

  /** Per-node Y, walking ordered top-to-bottom. Consecutive siblings (same
   *  primary parent) use SIBLING_GAP; everything else uses ROW_HEIGHT. */
  const yById = useMemo(() => {
    const m = new Map<string, number>();
    const primaryParent = new Map<string, string>();
    for (const e of graph.edges) {
      if (!primaryParent.has(e.child_id)) primaryParent.set(e.child_id, e.parent_id);
    }
    let y = TOP_MARGIN + NODE_RADIUS;
    let prevParent: string | undefined;
    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      const currParent = primaryParent.get(n.id);
      if (i > 0) {
        const areSiblings = !!prevParent && !!currParent && prevParent === currParent;
        y += areSiblings ? SIBLING_GAP : ROW_HEIGHT;
      }
      m.set(n.id, y);
      prevParent = currParent;
    }
    return m;
  }, [ordered, graph.edges]);

  const rowCenterY = useCallback((id: string): number => yById.get(id) ?? 0, [yById]);

  /** Y positions of the dashed dividers between rank N and rank N+1 — drawn
   *  as a subtle horizontal cue that groups siblings (which share a rank)
   *  visually between two adjacent dividers. */
  const rankBoundaries = useMemo(() => {
    const result: number[] = [];
    for (let i = 1; i < ordered.length; i++) {
      const prevRank = ranksById.get(ordered[i - 1].id);
      const currRank = ranksById.get(ordered[i].id);
      if (prevRank !== currRank) {
        const prevY = yById.get(ordered[i - 1].id) ?? 0;
        const currY = yById.get(ordered[i].id) ?? 0;
        result.push((prevY + currY) / 2);
      }
    }
    return result;
  }, [ordered, ranksById, yById]);

  const bodyX = useCallback(
    (id: string): number => BODY_X_LEFT + (columnById.get(id) ?? 0) * laneWidth,
    [columnById, laneWidth],
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return <p className="text-xs text-zinc-500 px-1 py-2">Caricamento…</p>;
  }
  if (ordered.length === 0) {
    return null;
  }

  const lastNode = ordered[ordered.length - 1];
  const lastY = yById.get(lastNode.id) ?? TOP_MARGIN + NODE_RADIUS;
  const svgHeight = lastY + NODE_RADIUS + BOTTOM_MARGIN;

  return (
    <svg
      width={SVG_WIDTH}
      height={svgHeight}
      viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectNode(null);
      }}
      className="block"
      style={{ touchAction: 'none' }}
    >
      {/* Rank dividers — subtle dashed horizontals that group siblings
          (same rank) between adjacent lines. Drawn first so they sit
          beneath every other layer. */}
      {rankBoundaries.map((y, i) => (
        <line
          key={`rank-${i}`}
          x1={4}
          x2={SVG_WIDTH - 4}
          y1={y}
          y2={y}
          stroke="#FFFFFF"
          strokeOpacity={0.25}
          strokeWidth={1}
          strokeDasharray="2,3"
        />
      ))}

      {/* Edges first so node bodies render on top of them. */}
      {graph.edges.map((e) => {
        const parent = ordered.find((n) => n.id === e.parent_id);
        const child = ordered.find((n) => n.id === e.child_id);
        if (!parent || !child) return null;
        const d = edgePath(
          bodyX(parent.id),
          rowCenterY(parent.id),
          bodyX(child.id),
          rowCenterY(child.id),
        );
        return <FlowEdgeView key={e.id} parent={parent} child={child} d={d} now={now} />;
      })}

      {/* Rows: body (SVG) + label (HTML via foreignObject, right-aligned). */}
      {ordered.map((n) => {
        const cy = rowCenterY(n.id);
        const cx = bodyX(n.id);
        const c = n.contact_id ? contactById.get(n.contact_id) : null;
        const cname = c ? (c.is_self ? `[ ${c.name} ]` : c.name) : null;
        return (
          <g key={n.id}>
            <FlowNodeView
              node={n}
              x={cx}
              y={cy}
              radius={NODE_RADIUS}
              selected={selectedNodeId === n.id}
              shape={nodeShape(n)}
              hideLabel
              onPointerDownBody={(e) => {
                e.stopPropagation();
                onSelectNode(n.id);
              }}
            />
            <foreignObject
              x={labelX}
              y={cy - LABEL_HEIGHT / 2}
              width={labelWidth}
              height={LABEL_HEIGHT}
              style={{ overflow: 'visible' }}
            >
              <div
                onClick={() => onSelectNode(n.id)}
                className="flex flex-col justify-center h-full cursor-pointer text-right text-zinc-200 hover:text-white"
              >
                <span
                  className="text-[11px] leading-snug font-medium"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {n.label.trim() || '—'}
                </span>
                {cname && (
                  <span className="text-[9px] text-zinc-500 truncate leading-tight">{cname}</span>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
