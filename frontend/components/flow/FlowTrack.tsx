'use client';

import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import dagre from 'dagre';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useFlow } from '@/lib/hooks/useFlow';
import { useContacts } from '@/lib/hooks/useContacts';
import { FlowNodeView } from './FlowNodeView';
import { FlowEdgeView } from './FlowEdgeView';
import type { FlowNode } from '@/types/flow';

interface Props {
  tileId: string;
  tileTitle?: string;
  onClose: () => void;
  /** Tells the parent which node(s) are selected.
   *  - `null` → clear the whole selection
   *  - `id` without `opts.multi` → replace selection with just this one
   *  - `id` with `opts.multi === true` → toggle this node in the existing
   *    selection (ctrl/cmd-click semantics) */
  onSelectNode?: (nodeId: string | null, opts?: { multi?: boolean }) => void;
  /** Multi-selection state from the parent. */
  selectedNodeIds?: string[];
  focusNodeId?: string | null;
}

const NODE_RADIUS = 11;
const NODE_WIDTH = NODE_RADIUS * 2;
const NODE_HEIGHT = NODE_RADIUS * 2 + 36;
// Grid: nodes snap to multiples of these values on both axes.
const GRID_X = 120;
const GRID_Y = 80;
const DRAG_THRESHOLD_PX = 3;
const PORT_RADIUS = 5;

type DragState =
  | { kind: 'none' }
  | {
      kind: 'node';
      nodeId: string;
      startMouse: { x: number; y: number };
      startPos: { x: number; y: number };
      didMove: boolean;
      /** Whether the gesture started with ctrl/cmd held — used to toggle
       *  multi-selection on a no-move click. */
      multi: boolean;
    }
  | { kind: 'edge'; fromNodeId: string; mouseX: number; mouseY: number };

/** Snap a point to the grid. */
function snap(x: number, y: number): { x: number; y: number } {
  return { x: Math.round(x / GRID_X) * GRID_X, y: Math.round(y / GRID_Y) * GRID_Y };
}

/**
 * Bottom drawer that shows the DAG of Flow nodes for a Tile.
 *
 * Interaction model:
 *   - Node body drag → pure reposition on the grid. Existing incoming/outgoing
 *     edges are preserved and just redraw against the new position.
 *   - Click without movement → selects the node (Inspector tab opens in the
 *     right TileSidebar).
 *   - Drag from the blue OUT port (right side of a node) → dashed temp line;
 *     drop over another node creates the edge (server validates same-tile +
 *     acyclic).
 *   - To remove an edge: use the Inspector / delete the node (cascade).
 *
 * Layout: nodes with explicit x,y are placed there (snapped to grid). Others
 * fall back to Dagre LR auto-layout, also snapped.
 */
export function FlowTrack({
  tileId,
  tileTitle,
  onClose,
  onSelectNode,
  selectedNodeIds,
  focusNodeId,
}: Props) {
  const { graph, isLoading, addNode, updateNode, addEdge, deleteNode, setFocus } = useFlow(tileId);

  // Right-click context menu state. Stored in viewport (clientX/Y) coords so
  // the menu renders correctly even when the SVG itself is scrolled.
  const [nodeMenu, setNodeMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const { contacts } = useContacts();

  // Convenience: which nodes are currently selected, as a Set for fast lookup.
  const selectedSet = useMemo(() => new Set(selectedNodeIds ?? []), [selectedNodeIds]);
  // The primary (= only) selection — drives the quick-add handles and the
  // Inspector tab in TileSidebar.
  const primarySelectedId = (selectedNodeIds && selectedNodeIds.length === 1) ? selectedNodeIds[0] : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Close the right-click context menu on Escape.
  useEffect(() => {
    if (!nodeMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNodeMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodeMenu]);

  // Keyboard: Delete / Backspace removes every selected node.
  // Skip when the user is typing in a form field (Inspector autosave inputs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const ids = selectedNodeIds ?? [];
      if (ids.length === 0) return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      for (const id of ids) deleteNode.mutate(id);
      onSelectNode?.(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNodeIds, deleteNode, onSelectNode]);

  useEffect(() => {
    if (focusNodeId && onSelectNode) onSelectNode(focusNodeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);

  const contactById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contacts) m.set(c.id, c.name);
    return m;
  }, [contacts]);

  // ─── Layout: Dagre fallback for nodes without manual x/y ─────────────────
  const dagreLayout = useMemo(() => {
    if (!graph.nodes.length) return new Map<string, { x: number; y: number }>();
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', ranksep: GRID_X, nodesep: GRID_Y - NODE_HEIGHT, marginx: 120, marginy: 40 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of graph.nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    for (const e of graph.edges) {
      if (g.hasNode(e.parent_id) && g.hasNode(e.child_id)) g.setEdge(e.parent_id, e.child_id, {});
    }
    dagre.layout(g);
    const positions = new Map<string, { x: number; y: number }>();
    g.nodes().forEach((id) => {
      const n = g.node(id);
      // Snap Dagre output to grid so it aligns with manually-placed nodes.
      positions.set(id, snap(n.x, n.y));
    });
    return positions;
  }, [graph]);

  const nodeById = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph]);

  // ─── Drag state ─────────────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState>({ kind: 'none' });
  const [localPos, setLocalPos] = useState<Map<string, { x: number; y: number }>>(new Map());
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync optimistic local positions with the server once it catches up.
  useEffect(() => {
    setLocalPos((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [id, p] of prev) {
        const n = nodeById.get(id);
        if (!n) {
          next.delete(id);
          changed = true;
          continue;
        }
        if (n.x != null && n.y != null && Math.abs(n.x - p.x) < 0.5 && Math.abs(n.y - p.y) < 0.5) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.nodes]);

  const getNodePos = useCallback(
    (n: FlowNode): { x: number; y: number } => {
      const l = localPos.get(n.id);
      if (l) return l;
      if (n.x != null && n.y != null) return { x: n.x, y: n.y };
      return dagreLayout.get(n.id) ?? { x: 0, y: 0 };
    },
    [localPos, dagreLayout],
  );

  const getSvgPoint = useCallback((e: React.PointerEvent | PointerEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const nodeAtPoint = useCallback(
    (point: { x: number; y: number }): FlowNode | null => {
      const r2 = (NODE_RADIUS + 6) ** 2;
      for (const n of graph.nodes) {
        const p = getNodePos(n);
        const dx = point.x - p.x;
        const dy = point.y - p.y;
        if (dx * dx + dy * dy <= r2) return n;
      }
      return null;
    },
    [graph.nodes, getNodePos],
  );

  // ─── Drag handlers ──────────────────────────────────────────────────────

  const handleNodeBodyPointerDown = useCallback(
    (e: React.PointerEvent<SVGGElement>, nodeId: string) => {
      // Only left-click starts a drag. Right-click (button 2) is reserved for
      // the context menu; middle-click etc. is ignored.
      if (e.button !== 0) return;
      e.stopPropagation();
      const node = nodeById.get(nodeId);
      if (!node) return;
      const start = getSvgPoint(e);
      const startPos = getNodePos(node);
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      // Capture whether the gesture started with ctrl/cmd so a no-move click
      // toggles multi-selection instead of replacing the selection.
      const multi = e.ctrlKey || e.metaKey || e.shiftKey;
      setDrag({ kind: 'node', nodeId, startMouse: start, startPos, didMove: false, multi });
    },
    [nodeById, getNodePos, getSvgPoint],
  );

  const handlePortPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, fromNodeId: string) => {
      e.stopPropagation();
      const p = getSvgPoint(e);
      try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      setDrag({ kind: 'edge', fromNodeId, mouseX: p.x, mouseY: p.y });
    },
    [getSvgPoint],
  );

  const handleSvgPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag.kind === 'none') return;
      const p = getSvgPoint(e);
      if (drag.kind === 'node') {
        const dx = p.x - drag.startMouse.x;
        const dy = p.y - drag.startMouse.y;
        const snapped = snap(drag.startPos.x + dx, drag.startPos.y + dy);
        setLocalPos((prev) => {
          const m = new Map(prev);
          m.set(drag.nodeId, snapped);
          return m;
        });
        const movedNow = Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;
        if (movedNow && !drag.didMove) {
          setDrag((d) => (d.kind === 'node' ? { ...d, didMove: true } : d));
        }
      } else {
        setDrag({ ...drag, mouseX: p.x, mouseY: p.y });
      }
    },
    [drag, getSvgPoint],
  );

  const handleSvgPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (drag.kind === 'none') return;
      if (drag.kind === 'node') {
        if (drag.didMove) {
          const final = localPos.get(drag.nodeId);
          if (final) updateNode.mutate({ id: drag.nodeId, updates: { x: final.x, y: final.y } });
        } else {
          onSelectNode?.(drag.nodeId, { multi: drag.multi });
        }
      } else {
        const p = getSvgPoint(e);
        const target = nodeAtPoint(p);
        if (target && target.id !== drag.fromNodeId) {
          addEdge.mutate({ parent_id: drag.fromNodeId, child_id: target.id });
        }
      }
      setDrag({ kind: 'none' });
    },
    [drag, localPos, updateNode, addEdge, nodeAtPoint, getSvgPoint, onSelectNode],
  );

  // ─── Add-node helpers ───────────────────────────────────────────────────

  /** Parents of a node, via current edges. */
  const parentsOf = useCallback(
    (nodeId: string): string[] => graph.edges.filter((e) => e.child_id === nodeId).map((e) => e.parent_id),
    [graph.edges],
  );

  const handleAddRoot = () => {
    // Place new roots 240px from the left edge of the drawer (2 grid cells
    // in). If there are already roots, stack the new one one grid row below
    // the lowest existing root so it doesn't overlap.
    const ROOT_X = 240;
    const existingRoots = graph.nodes.filter(
      (n) => !graph.edges.some((e) => e.child_id === n.id),
    );
    const baseY = existingRoots.length > 0
      ? Math.max(...existingRoots.map((n) => getNodePos(n).y)) + GRID_Y
      : GRID_Y;
    addNode.mutate({ label: 'Nuovo nodo', state: 'mine', x: ROOT_X, y: baseY });
  };

  /** Pin the reference node's current position before mutating the graph, so
   *  Dagre re-layout (triggered by a new edge) doesn't shuffle it. No-op if
   *  already pinned. Fire-and-forget. */
  const pinPositionIfFloating = useCallback(
    (node: FlowNode) => {
      if (node.x != null && node.y != null) return;
      const pos = getNodePos(node);
      updateNode.mutate({ id: node.id, updates: { x: pos.x, y: pos.y } });
    },
    [getNodePos, updateNode],
  );

  /** Sibling of selectedNode: shares its parents, placed at the given y offset. */
  const handleAddSibling = useCallback(
    async (dyCells: number) => {
      if (!primarySelectedId) return;
      const ref = nodeById.get(primarySelectedId);
      if (!ref) return;
      pinPositionIfFloating(ref);
      const refPos = getNodePos(ref);
      const target = snap(refPos.x, refPos.y + dyCells * GRID_Y);
      const parents = parentsOf(primarySelectedId);

      if (parents.length === 0) {
        // root sibling — no edges to add
        await addNode.mutateAsync({ label: 'Nuovo nodo', state: 'mine', x: target.x, y: target.y });
        return;
      }
      if (parents.length === 1) {
        await addNode.mutateAsync({
          label: 'Nuovo nodo',
          state: 'mine',
          parent_node_id: parents[0],
          x: target.x,
          y: target.y,
        });
        return;
      }
      // Multi-parent: create node first, then fan-out edges from each parent.
      const res = await addNode.mutateAsync({ label: 'Nuovo nodo', state: 'mine', x: target.x, y: target.y });
      if (!res?.node) return;
      for (const pid of parents) {
        try { await addEdge.mutateAsync({ parent_id: pid, child_id: res.node.id }); } catch { /* ignore */ }
      }
    },
    [primarySelectedId, nodeById, getNodePos, parentsOf, addNode, addEdge, pinPositionIfFloating],
  );

  /** Predecessor of selectedNode: placed one column to the LEFT of the
   *  selected node (right where the "+ predecessor" hover handle lives).
   *  Any existing ancestors (parents and their parents transitively) are
   *  shifted further left by one column so they don't overlap with the new
   *  predecessor's slot. The selected node and its descendants stay put.
   *  Then an edge new → selected is created (parallel to any existing
   *  parents — does not rewrite them). */
  const handleAddPredecessor = useCallback(async () => {
    if (!primarySelectedId) return;
    const ref = nodeById.get(primarySelectedId);
    if (!ref) return;
    pinPositionIfFloating(ref);
    const refPos = getNodePos(ref);

    // Backward closure: ancestors of selected (not including selected itself).
    const closure = new Set<string>();
    const queue: string[] = [];
    for (const e of graph.edges) {
      if (e.child_id === primarySelectedId) {
        if (!closure.has(e.parent_id)) {
          closure.add(e.parent_id);
          queue.push(e.parent_id);
        }
      }
    }
    while (queue.length) {
      const id = queue.shift()!;
      for (const e of graph.edges) {
        if (e.child_id === id && !closure.has(e.parent_id)) {
          closure.add(e.parent_id);
          queue.push(e.parent_id);
        }
      }
    }

    // Capture current positions of the ancestor closure BEFORE mutating.
    const positionsBeforeShift = new Map<string, { x: number; y: number }>();
    for (const id of closure) {
      const n = nodeById.get(id);
      if (n) positionsBeforeShift.set(id, getNodePos(n));
    }

    // Shift each ancestor LEFT by one column. Await all so the new edge
    // doesn't trigger a Dagre re-layout on an inconsistent state.
    if (closure.size > 0) {
      await Promise.all(
        Array.from(closure).map((id) => {
          const p = positionsBeforeShift.get(id);
          if (!p) return Promise.resolve();
          return updateNode.mutateAsync({ id, updates: { x: p.x - GRID_X, y: p.y } });
        }),
      );
    }

    // New predecessor at the LEFT of selected (snapped to grid).
    const target = snap(refPos.x - GRID_X, refPos.y);
    const res = await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'mine',
      x: target.x,
      y: target.y,
    });
    if (!res?.node) return;
    try {
      await addEdge.mutateAsync({ parent_id: res.node.id, child_id: primarySelectedId });
    } catch {
      // ignore (edge may already exist from a duplicate gesture)
    }
  }, [primarySelectedId, nodeById, getNodePos, graph.edges, updateNode, addNode, addEdge, pinPositionIfFloating]);

  /** Child of selectedNode: placed one column to the right. */
  const handleAddChild = useCallback(async () => {
    if (!primarySelectedId) return;
    const ref = nodeById.get(primarySelectedId);
    if (!ref) return;
    pinPositionIfFloating(ref);
    const refPos = getNodePos(ref);
    const target = snap(refPos.x + GRID_X, refPos.y);
    await addNode.mutateAsync({
      label: 'Nuovo nodo',
      state: 'mine',
      parent_node_id: primarySelectedId,
      x: target.x,
      y: target.y,
    });
  }, [primarySelectedId, nodeById, getNodePos, addNode, pinPositionIfFloating]);

  // ─── SVG dimensions: enclose every node + a little headroom ─────────────
  const svgWidth = Math.max(
    ...graph.nodes.map((n) => getNodePos(n).x + NODE_HEIGHT),
    600,
  );
  const svgHeight = Math.max(
    ...graph.nodes.map((n) => getNodePos(n).y + NODE_HEIGHT + 20),
    160,
  );

  return (
    <div
      className="bg-zinc-950 border-t border-zinc-800 shadow-2xl flex flex-col shrink-0"
      style={{
        // Drawer shrinks to the minimum height needed for the flow content,
        // but never grows beyond 40vh — beyond that the body scrolls.
        // Computed height = header (48px) + actual SVG content + padding.
        height: `min(40vh, ${48 + svgHeight + 16}px)`,
      }}
    >
      <div className="h-12 flex items-center gap-2 px-4 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Flow</span>
        {tileTitle && (
          <span className="text-xs text-zinc-200 truncate max-w-md">· {tileTitle}</span>
        )}
        <span className="text-[10px] text-zinc-600 ml-2">
          {graph.nodes.length} nodi · {graph.edges.length} edge
        </span>
        <div className="flex-1" />

        <button
          onClick={handleAddRoot}
          className="flex items-center gap-1.5 px-2.5 h-8 rounded text-xs leading-none font-medium bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Aggiungi nodo radice"
        >
          <IconPlus size={13} />
          Aggiungi nodo
        </button>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          title="Chiudi"
        >
          <IconX size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-950 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-700">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-zinc-500">Caricamento flow…</div>
        ) : graph.nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
            <p className="text-xs">Nessun nodo. Crea il primo per iniziare a tracciare il flusso.</p>
            <button
              onClick={handleAddRoot}
              className="flex items-center gap-1.5 px-3 h-8 rounded text-xs leading-none font-medium bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              <IconPlus size={13} />
              Crea il primo nodo
            </button>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={() => setDrag({ kind: 'none' })}
            onClick={(e) => {
              if (e.target === e.currentTarget) onSelectNode?.(null);
            }}
            className="block"
            style={{ touchAction: 'none' }}
          >
            {/* Edges — L-shape polyline (no curves) */}
            {graph.edges.map((e) => {
              const parent = nodeById.get(e.parent_id);
              const child = nodeById.get(e.child_id);
              if (!parent || !child) return null;
              const pp = getNodePos(parent);
              const cp = getNodePos(child);
              const pts = edgeControlPoints(pp.x + NODE_RADIUS, pp.y, cp.x - NODE_RADIUS, cp.y);
              return <FlowEdgeView key={e.id} parent={parent} child={child} points={pts} now={now} />;
            })}

            {/* Nodes */}
            {graph.nodes.map((n) => {
              const pos = getNodePos(n);
              const cname = n.contact_id ? contactById.get(n.contact_id) ?? null : null;
              return (
                <FlowNodeView
                  key={n.id}
                  node={n}
                  x={pos.x}
                  y={pos.y}
                  selected={selectedSet.has(n.id)}
                  contactName={cname}
                  shape={n.state === 'mine' ? 'square' : 'circle'}
                  onPointerDownBody={handleNodeBodyPointerDown}
                  onContextMenuBody={(e, id) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNodeMenu({ x: e.clientX, y: e.clientY, nodeId: id });
                  }}
                />
              );
            })}

            {/* OUT ports */}
            {graph.nodes.map((n) => {
              const pos = getNodePos(n);
              return (
                <circle
                  key={`port-${n.id}`}
                  cx={pos.x + NODE_RADIUS}
                  cy={pos.y}
                  r={PORT_RADIUS}
                  fill="#3B82F6"
                  fillOpacity={0.5}
                  stroke="#1C1C1E"
                  strokeWidth={1.5}
                  style={{ cursor: 'crosshair', touchAction: 'none' }}
                  onPointerDown={(e) => handlePortPointerDown(e, n.id)}
                />
              );
            })}

            {/* Quick add-node buttons that float around the selected node:
                  ▲ above  → sibling above (same parent, prev row)
                  ▼ below  → sibling below (same parent, next row)
                  ▶ right  → child (one column to the right)
                Visible only while a node is selected. They live above the
                ports/nodes so they're always click-accessible. */}
            {(() => {
              const id = primarySelectedId;
              if (!id) return null;
              const sel = nodeById.get(id);
              if (!sel) return null;
              const pos = getNodePos(sel);
              const offsetSide = NODE_RADIUS + 18;
              return (
                <g style={{ pointerEvents: 'auto' }}>
                  <QuickAddButton
                    x={pos.x}
                    y={pos.y - offsetSide}
                    title="Aggiungi fratello sopra"
                    onClick={() => handleAddSibling(-1)}
                  />
                  <QuickAddButton
                    x={pos.x}
                    y={pos.y + offsetSide}
                    title="Aggiungi fratello sotto"
                    onClick={() => handleAddSibling(1)}
                  />
                  <QuickAddButton
                    x={pos.x + offsetSide + 8}
                    y={pos.y}
                    title="Aggiungi figlio davanti"
                    onClick={() => handleAddChild()}
                  />
                  <QuickAddButton
                    x={pos.x - offsetSide - 8}
                    y={pos.y}
                    title="Aggiungi predecessore (gli altri nodi scorrono in avanti)"
                    onClick={() => handleAddPredecessor()}
                  />
                </g>
              );
            })()}

            {/* Temp edge while dragging from a port (same polyline as real edges) */}
            {drag.kind === 'edge' && (() => {
              const from = nodeById.get(drag.fromNodeId);
              if (!from) return null;
              const p = getNodePos(from);
              const pts = edgeControlPoints(p.x + NODE_RADIUS, p.y, drag.mouseX, drag.mouseY);
              const d = pts
                .map((pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `L ${pt.x},${pt.y}`))
                .join(' ');
              return (
                <path
                  d={d}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  strokeDasharray="4,3"
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
          </svg>
        )}
      </div>

      {/* Right-click context menu — fixed positioning in viewport coords so
          the menu stays put even if the SVG scrolls. Click on the backdrop
          (or Escape) closes it. */}
      {nodeMenu && (() => {
        const target = nodeById.get(nodeMenu.nodeId);
        if (!target) return null;
        return (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setNodeMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setNodeMenu(null); }}
            />
            <div
              className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 w-48 z-[9999]"
              style={{ top: nodeMenu.y + 4, left: nodeMenu.x + 4 }}
            >
              <button
                onClick={() => {
                  setFocus.mutate({ id: target.id, focus: !target.is_focus });
                  setNodeMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs leading-none font-medium text-zinc-200 hover:bg-zinc-800/70 transition-colors"
              >
                <span className="text-amber-500">★</span>
                {target.is_focus ? 'Rimuovi focus' : 'Imposta come focus'}
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <button
                onClick={() => {
                  deleteNode.mutate(target.id);
                  setNodeMenu(null);
                  onSelectNode?.(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs leading-none font-medium text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <span>🗑</span>
                Elimina nodo
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

/** Small circular "+" handle painted near the selected node. Used by the
 *  3 quick-add affordances (sibling above / below, child to the right).
 *
 *  The button is invisible by default and only fades in when the mouse
 *  enters the surrounding hit area (radius 2× the visible button) so it
 *  doesn't clutter the layout when not needed. */
function QuickAddButton({
  x,
  y,
  title,
  onClick,
}: {
  x: number;
  y: number;
  title: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <g
      transform={`translate(${x},${y})`}
      style={{ cursor: 'pointer' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <title>{title}</title>
      {/* Enlarged hit area (invisible) — provides the hover zone. */}
      <circle r={18} fill="transparent" pointerEvents="all" />
      {/* Visible chip — fades in on hover. pointer-events none so the
          parent g handles the click via the hit area. */}
      <g
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: 'none',
        }}
      >
        <circle r={9} fill="#27272A" stroke="#52525B" strokeWidth={1.5} />
        <line x1={-4} y1={0} x2={4} y2={0} stroke="#D4D4D8" strokeWidth={1.5} strokeLinecap="round" />
        <line x1={0} y1={-4} x2={0} y2={4} stroke="#D4D4D8" strokeWidth={1.5} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Edge polyline: short horizontal "stub" off each node, joined by a
 *  diagonal segment in the middle.
 *
 *       parent ─────╲
 *                    ╲
 *                     ──────── child
 *
 *  Same-y endpoints collapse to a straight 2-point horizontal line. The
 *  stub length is clamped if the two nodes are too close. */
function edgeControlPoints(x1: number, y1: number, x2: number, y2: number) {
  if (y1 === y2) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  const STUB = Math.min(28, Math.max(8, (x2 - x1) / 3));
  return [
    { x: x1, y: y1 },
    { x: x1 + STUB, y: y1 },
    { x: x2 - STUB, y: y2 },
    { x: x2, y: y2 },
  ];
}
