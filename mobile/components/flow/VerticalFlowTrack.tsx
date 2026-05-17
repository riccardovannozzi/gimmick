/**
 * Vertical "fishbone" view of a tile's Flow DAG — mobile port of
 * frontend/components/flow/VerticalFlowTrack.tsx.
 *
 * Same layout algorithm (rank-major topo sort + subtree-width column
 * assignment + adaptive lane width), but the rendering is hybrid: nodes and
 * edges are drawn with `react-native-svg`, while labels are regular
 * `<View>` overlays positioned absolutely on top of the SVG. RN-svg doesn't
 * support `<foreignObject>`, so this is the cleanest way to keep readable
 * text without re-implementing line-wrap inside SVG.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useFlow } from '@/hooks/useFlow';
import { useContacts } from '@/hooks/useContacts';
import { FLOW_STATE_COLORS } from '@/lib/flow-colors';
import { computeEdgeWidth } from '@/lib/flow-edge-width';
import type { FlowNode, FlowEdge } from '@/types';

const NODE_RADIUS = 12;
const LEFT_MARGIN = 12;
const RIGHT_MARGIN = 12;
const BODY_TO_LABEL_GAP = 10;
const LABEL_RATIO = 0.6;
const MIN_LANE_WIDTH = 22;
const MAX_LANE_WIDTH = 44;
const MAX_LANES = 5;

const ROW_HEIGHT = 80;
const SIBLING_GAP = 58;
const TOP_MARGIN = 18;
const BOTTOM_MARGIN = 14;
const LABEL_HEIGHT = 54;

interface Props {
  tileId: string;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

// ─── Layout helpers ────────────────────────────────────────────────────────

/** Rank-major topological sort. Walks ranks ascending; within a rank, groups
 *  nodes by their primary parent's already-emitted position. Mirrors the web
 *  implementation exactly so the visual order is stable across platforms. */
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

/** Subtree-width swim-lane assignment. See web impl for the full rationale. */
function assignColumns(ordered: FlowNode[], edges: FlowEdge[]): Map<string, number> {
  const cols = new Map<string, number>();
  const orderIndex = new Map<string, number>();
  ordered.forEach((n, i) => orderIndex.set(n.id, i));

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

  const placed = new Set<string>();
  const layout = (id: string, start: number) => {
    if (placed.has(id)) return;
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

  for (const n of ordered) {
    if (!cols.has(n.id)) cols.set(n.id, 0);
  }
  return cols;
}

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

/** SVG `d` for an edge between two body centers — vertical line for same
 *  column, smooth cubic bezier otherwise. Endpoints are inset by NODE_RADIUS
 *  so the stroke meets the node boundary, not the center. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const y1Out = y1 + NODE_RADIUS;
  const y2In = y2 - NODE_RADIUS;
  if (x1 === x2) {
    return `M ${x1},${y1Out} L ${x2},${y2In}`;
  }
  const midY = (y1Out + y2In) / 2;
  return `M ${x1},${y1Out} C ${x1},${midY} ${x2},${midY} ${x2},${y2In}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function VerticalFlowTrack({ tileId, selectedNodeId, onSelectNode }: Props) {
  const { graph, isLoading } = useFlow(tileId);
  const { contacts } = useContacts();
  const { width: screenWidth } = useWindowDimensions();
  // Account for the screen's outer padding (16) and the surrounding card.
  const svgWidth = Math.max(280, screenWidth - 32);

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

  // Clock ticks every 30s so open edges keep widening visually.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const ordered = useMemo(() => topoSort(graph.nodes, graph.edges), [graph.nodes, graph.edges]);
  const columnById = useMemo(() => assignColumns(ordered, graph.edges), [ordered, graph.edges]);
  const ranksById = useMemo(() => computeRanks(graph.nodes, graph.edges), [graph.nodes, graph.edges]);

  const numLanes = useMemo(() => {
    let max = 0;
    for (const c of columnById.values()) max = Math.max(max, c);
    return max + 1;
  }, [columnById]);

  // Derived layout — depends on svgWidth, so recompute when dimensions change.
  const layout = useMemo(() => {
    const availableWidth = svgWidth - LEFT_MARGIN - RIGHT_MARGIN;
    const labelWidth = Math.floor(availableWidth * LABEL_RATIO);
    const labelX = LEFT_MARGIN;
    const bodyXLeft = LEFT_MARGIN + labelWidth + BODY_TO_LABEL_GAP + NODE_RADIUS;
    const laneAreaWidth = svgWidth - RIGHT_MARGIN - (LEFT_MARGIN + labelWidth + BODY_TO_LABEL_GAP);
    let laneWidth = MAX_LANE_WIDTH;
    if (numLanes > 1) {
      const budget = laneAreaWidth - 2 * NODE_RADIUS;
      const computed = budget / (numLanes - 1);
      laneWidth = Math.max(MIN_LANE_WIDTH, Math.min(MAX_LANE_WIDTH, computed));
    }
    return { labelWidth, labelX, bodyXLeft, laneWidth };
  }, [svgWidth, numLanes]);

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
  const bodyX = useCallback(
    (id: string): number => layout.bodyXLeft + (columnById.get(id) ?? 0) * layout.laneWidth,
    [columnById, layout],
  );

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

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
        <Text style={{ color: '#71717A', fontSize: 12 }}>Caricamento…</Text>
      </View>
    );
  }
  if (ordered.length === 0) return null;

  const lastNode = ordered[ordered.length - 1];
  const lastY = yById.get(lastNode.id) ?? TOP_MARGIN + NODE_RADIUS;
  const svgHeight = lastY + NODE_RADIUS + BOTTOM_MARGIN;

  return (
    <View style={{ width: svgWidth, height: svgHeight, position: 'relative' }}>
      {/* SVG underlay: rank dividers + edges + node bodies + status decorators */}
      <Svg width={svgWidth} height={svgHeight}>
        {rankBoundaries.map((y, i) => (
          <Line
            key={`rank-${i}`}
            x1={4}
            x2={svgWidth - 4}
            y1={y}
            y2={y}
            stroke="#FFFFFF"
            strokeOpacity={0.25}
            strokeWidth={1}
            strokeDasharray="2,3"
          />
        ))}

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
          const sw = computeEdgeWidth(parent, child, now);
          const isOpen = child.state === 'active' || child.state === 'wait';
          const opacity = child.state === 'undo' ? 0.4 : isOpen ? 0.55 : 0.6;
          return (
            <Path
              key={e.id}
              d={d}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={opacity}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {ordered.map((n) => {
          const cx = bodyX(n.id);
          const cy = rowCenterY(n.id);
          const shape = nodeShape(n);
          const selected = selectedNodeId === n.id;
          const bodyFill = selected ? '#3F3F46' : '#000000';
          return (
            <NodeBody
              key={n.id}
              node={n}
              x={cx}
              y={cy}
              shape={shape}
              bodyFill={bodyFill}
            />
          );
        })}
      </Svg>

      {/* Label + tap target overlays — one Pressable per node, absolutely
          positioned to the left of its body. Tapping the label OR the body
          area selects the node. */}
      {ordered.map((n) => {
        const cy = rowCenterY(n.id);
        const cx = bodyX(n.id);
        const c = n.contact_id ? contactById.get(n.contact_id) : null;
        const cname = c ? (c.is_self ? `[ ${c.name} ]` : c.name) : null;
        const selected = selectedNodeId === n.id;
        return (
          <View key={`label-${n.id}`} pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, width: svgWidth, height: svgHeight }}>
            {/* Label area on the left, right-aligned text */}
            <Pressable
              onPress={() => onSelectNode(n.id)}
              style={{
                position: 'absolute',
                left: layout.labelX,
                top: cy - LABEL_HEIGHT / 2,
                width: layout.labelWidth,
                height: LABEL_HEIGHT,
                justifyContent: 'center',
              }}
            >
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 12,
                  textAlign: 'left',
                  color: selected ? '#FFFFFF' : '#D4D4D8',
                  fontWeight: selected ? '500' : '400',
                }}
              >
                {n.label.trim() || '—'}
              </Text>
              {cname && (
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}
                >
                  {cname}
                </Text>
              )}
            </Pressable>
            {/* Tap target around the node body — extends a bit past the
                visual radius so it's comfortable on touch. */}
            <Pressable
              onPress={() => onSelectNode(n.id)}
              style={{
                position: 'absolute',
                left: cx - NODE_RADIUS - 6,
                top: cy - NODE_RADIUS - 6,
                width: NODE_RADIUS * 2 + 12,
                height: NODE_RADIUS * 2 + 12,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Body + status decorator for a single node, drawn inside SVG. Mirrors the
 *  web FlowNodeView (state icons drawn as inline SVG paths). */
function NodeBody({
  node,
  x,
  y,
  shape,
  bodyFill,
}: {
  node: FlowNode;
  x: number;
  y: number;
  shape: 'square' | 'circle';
  bodyFill: string;
}) {
  const r = NODE_RADIUS;
  const statusColor = FLOW_STATE_COLORS[node.state];

  return (
    <>
      {shape === 'square' ? (
        <Rect
          x={x - r}
          y={y - r}
          width={r * 2}
          height={r * 2}
          rx={4}
          fill={bodyFill}
          stroke="#FFFFFF"
          strokeWidth={1}
        />
      ) : (
        <Circle cx={x} cy={y} r={r} fill={bodyFill} stroke="#FFFFFF" strokeWidth={1} />
      )}
      {node.state !== 'active' && (
        <StatusGlyph state={node.state} color={statusColor} cx={x} cy={y} size={r * 1.2} />
      )}
      {node.state === 'active' && !node.occurred_at && node.scheduled_at && (
        shape === 'square' ? (
          <Rect
            x={x - r * 0.45}
            y={y - r * 0.45}
            width={r * 0.9}
            height={r * 0.9}
            rx={2}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.7}
            strokeWidth={2}
          />
        ) : (
          <Circle
            cx={x}
            cy={y}
            r={r * 0.45}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.7}
            strokeWidth={2}
          />
        )
      )}
    </>
  );
}

/** Status decorator paths — port of the web StatusIcon (inline SVG, no icon lib). */
function StatusGlyph({
  state,
  color,
  cx,
  cy,
  size,
}: {
  state: Exclude<FlowNode['state'], 'active'>;
  color: string;
  cx: number;
  cy: number;
  size: number;
}) {
  const s = size / 2;
  const sw = Math.max(1.6, size * 0.16);
  if (state === 'done') {
    return (
      <Path
        d={`M ${cx - s * 0.7},${cy} L ${cx - s * 0.15},${cy + s * 0.55} L ${cx + s * 0.75},${cy - s * 0.55}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (state === 'wait') {
    return (
      <>
        <Path
          d={`M ${cx - s * 0.7},${cy - s * 0.75} L ${cx + s * 0.7},${cy - s * 0.75} L ${cx},${cy} Z`}
          fill={color}
        />
        <Path
          d={`M ${cx - s * 0.7},${cy + s * 0.75} L ${cx + s * 0.7},${cy + s * 0.75} L ${cx},${cy} Z`}
          fill={color}
        />
      </>
    );
  }
  if (state === 'undo') {
    return (
      <Path
        d={`M ${cx - s * 0.7},${cy + s * 0.7} L ${cx + s * 0.7},${cy - s * 0.7}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    );
  }
  // stop → X
  return (
    <>
      <Path
        d={`M ${cx - s * 0.65},${cy - s * 0.65} L ${cx + s * 0.65},${cy + s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      <Path
        d={`M ${cx + s * 0.65},${cy - s * 0.65} L ${cx - s * 0.65},${cy + s * 0.65}`}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </>
  );
}
