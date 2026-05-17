'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFlow } from '@/lib/hooks/useFlow';
import { useContacts } from '@/lib/hooks/useContacts';
import { FlowNodeView } from './FlowNodeView';
import { FlowEdgeView } from './FlowEdgeView';
import { cn } from '@/lib/utils';
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

/** Total SVG width — fills the FlowInspector area exactly. TileSidebar is
 *  w-[280px] with a 1px `border-l`, so the inner aside is 279px wide. The
 *  matching SVG width lets the rightmost body's right edge line up with
 *  the right border of the form's input boxes above. */
const SVG_WIDTH = 279;
const NODE_RADIUS = 10;
/** Matches FlowInspector's `p-3` padding (12px). Aligns the label start
 *  with the left border of the form fields (Etichetta, Status, Contatto…)
 *  rendered above the diagram. */
const LEFT_MARGIN = 12;
const RIGHT_MARGIN = 12;
/** Gap between the right edge of the label area and the leftmost body. */
const BODY_TO_LABEL_GAP = 10;
/** Horizontal split: 60% labels (left, right-aligned so they "point" at
 *  the bodies), 40% lane/body area (right). Fixed ratio, doesn't shrink
 *  with the number of lanes — the lane width itself adapts instead. */
const LABEL_RATIO = 0.6;
/** Lane width adapts to the number of active lanes within the right-side
 *  body area. MIN was tuned so 5 lanes still fit inside the 40% body slice. */
const MIN_LANE_WIDTH = 18;
const MAX_LANE_WIDTH = 40;
/** Hard ceiling on parallel sibling lanes. Overflow siblings reuse the last
 *  lane (different Y keeps them separated visually). */
const MAX_LANES = 5;

// Derived layout — labels live on the left, bodies on the right.
const AVAILABLE_WIDTH = SVG_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
/** Fixed width of the label area on the left side of the SVG. */
const LABEL_WIDTH = Math.floor(AVAILABLE_WIDTH * LABEL_RATIO);
const LABEL_X = LEFT_MARGIN;
/** Leftmost body center X — sits past the label area + the gap. */
const BODY_X_LEFT = LEFT_MARGIN + LABEL_WIDTH + BODY_TO_LABEL_GAP + NODE_RADIUS;
/** Total horizontal room available for the bodies on the right. */
const LANE_AREA_WIDTH = SVG_WIDTH - RIGHT_MARGIN - (LEFT_MARGIN + LABEL_WIDTH + BODY_TO_LABEL_GAP);

const ROW_HEIGHT = 72;
/** Vertical gap between consecutive siblings (consecutive nodes sharing the
 *  same parent). Tighter than ROW_HEIGHT so siblings read as a pair rather
 *  than two unrelated rows on the spine, but large enough to fit a label
 *  with two main lines + one contact subline without overlap. */
const SIBLING_GAP = 52;
const TOP_MARGIN = 16;
const BOTTOM_MARGIN = 12;
/** Fixed vertical extent of the label block, centered on the body. Sized
 *  for 2 main-label lines (16px line-height each) + 1 contact subline. */
const LABEL_HEIGHT = 48;

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

  /** Adaptive lane width: comfortable (MAX) for 1–2 lanes, shrinks toward
   *  MIN as more branchings appear so 5 lanes still fit inside the 40%
   *  right-side body slice. */
  const laneWidth = useMemo(() => {
    if (numLanes <= 1) return MAX_LANE_WIDTH;
    // Body diameters take 2*NODE_RADIUS on the ends; the rest is split among
    // the (numLanes - 1) gaps between consecutive lane centers.
    const budget = LANE_AREA_WIDTH - 2 * NODE_RADIUS;
    const computed = budget / (numLanes - 1);
    return Math.max(MIN_LANE_WIDTH, Math.min(MAX_LANE_WIDTH, computed));
  }, [numLanes]);

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
              x={LABEL_X}
              y={cy - LABEL_HEIGHT / 2}
              width={LABEL_WIDTH}
              height={LABEL_HEIGHT}
              style={{ overflow: 'visible' }}
            >
              <div
                onClick={() => onSelectNode(n.id)}
                className={cn(
                  // Typography mirrors the left-sidebar tag list: text-xs base,
                  // selected = white + medium, idle = zinc-400 with a brighter
                  // hover. Keeps the two panels visually consistent.
                  'flex flex-col justify-center h-full cursor-pointer text-left text-xs',
                  selectedNodeId === n.id
                    ? 'text-white font-medium'
                    : 'text-zinc-300 hover:text-zinc-200',
                )}
              >
                <span
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
                  <span className="text-xs text-zinc-500 truncate">{cname}</span>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
