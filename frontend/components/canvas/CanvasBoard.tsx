'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Tile } from '@/types';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { useTypeIcons } from '@/store/type-icons-store';
import * as TablerIcons from '@tabler/icons-react';
import { readableOn } from '@/lib/palette';
import { usePixelTheme } from '@/components/pixel';
import { TextEditor } from './TextEditor';

const TILE_W = 130;
const TILE_H = 90;
const TILE_GAP = 8;
const OFFSET_X = 24;
const OFFSET_Y = 24;
const PORT_R = 5;
const GROUP_PAD = 12;
const LABEL_H = 20;

export interface CanvasNode { id: string; title: string; actionType: string; statusShape?: string; typeIcon?: string; typeColor?: string; startAt?: string; endAt?: string; allDay?: boolean; subtasks?: { is_done: boolean }[]; x: number; y: number; }
export type PortKey = 'top' | 'right' | 'bottom' | 'left';
// port format: "top"|"right"|"bottom"|"left" for tile, "g:top"|"g:right"|"g:bottom"|"g:left" for group
export interface CanvasEdge { id: string; source_id: string; target_id: string; source_port?: string; target_port?: string; }
export interface CanvasGroup { id: string; label: string; nodeIds: string[]; }
// Polymorphic canvas box: shared geometry (x/y/w/h) + per-type content payload.
//   type 'text'  → content = { html: string }
//   type 'image' → content = { src: string; alt?: string }
export type CanvasBoxTextContent = { html: string };
export type CanvasBoxImageContent = { src: string; alt?: string };
export type CanvasBox =
  | { id: string; type: 'text'; content: CanvasBoxTextContent; x: number; y: number; w: number; h: number }
  | { id: string; type: 'image'; content: CanvasBoxImageContent; x: number; y: number; w: number; h: number };
// Backward-compat alias (kept until all consumers are migrated).
export type CanvasTextBox = CanvasBox;

const TB_MIN_W = 100;
const TB_MIN_H = 40;
const TB_PAD = 8;

const PORTS = [
  { key: 'top', cx: TILE_W / 2, cy: 0 },
  { key: 'right', cx: TILE_W, cy: TILE_H / 2 },
  { key: 'bottom', cx: TILE_W / 2, cy: TILE_H },
  { key: 'left', cx: 0, cy: TILE_H / 2 },
];

interface CanvasBoardProps {
  tiles: Tile[];
  layout: { tile_id: string; x: number; y: number }[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
  textBoxes: CanvasTextBox[];
  moveEnabled: boolean;
  linkEnabled: boolean;
  textMode: boolean;
  tileMode: boolean;
  onAddTileAt: (x: number, y: number) => void;
  onPositionChange: (positions: { tile_id: string; x: number; y: number }[]) => void;
  onAddEdge: (source_id: string, target_id: string, source_port?: string, target_port?: string) => void;
  onDeleteEdge: (id: string) => void;
  onEdgeContextMenu: (e: { x: number; y: number; edgeId: string }) => void;
  onTileContextMenu: (e: { x: number; y: number; tileId: string; inGroup: boolean }) => void;
  onTileClick: (tileId: string) => void;
  onGroupsChange: (groups: CanvasGroup[]) => void;
  onAddTextBox: (x: number, y: number, w: number, h: number) => void;
  onUpdateTextBox: (id: string, updates: { type?: 'text' | 'image'; content?: CanvasBoxTextContent | CanvasBoxImageContent; x?: number; y?: number; w?: number; h?: number }) => void;
  onTextBoxContextMenu: (e: { x: number; y: number; textBoxId: string }) => void;
  /** Image mode: when true, drag on empty canvas draws a rectangle, then a file
      picker opens; the picked image fills the rectangle. */
  imageMode?: boolean;
  onAddImageBox?: (file: File, x: number, y: number, w: number, h: number) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[], screenBbox: { x: number; y: number; w: number; h: number } | null) => void;
  fitTrigger: number;
  zoom100Trigger?: number;
  /** Set of tile ids that own at least one Flow node — used to render a
   *  "FLOW" badge in the tile's top-right corner. */
  tilesWithFlows?: Set<string>;
  /** Called when the user clicks the FLOW badge on a tile — opens the Flow
   *  modal. Click on the badge does NOT also select the tile. */
  onFlowBadgeClick?: (tileId: string) => void;
  /** Optional ref the parent passes in; CanvasBoard sets `.current` to a
   *  function that converts viewport (clientX/Y) coords to canvas-local
   *  coords using the live zoom/pan transform. Useful for drops from outside
   *  the canvas (e.g. the staging panel) to land under the cursor. */
  screenToLocalRef?: React.RefObject<((clientX: number, clientY: number) => { x: number; y: number }) | null>;
  /** Tested at the end of every tile drag — if it returns true, the tile(s)
   *  were dropped over the staging panel and should be removed from the
   *  canvas instead of having their new position saved. */
  isOverStaging?: (clientX: number, clientY: number) => boolean;
  /** Called when a tile drag ends over the staging zone (isOverStaging
   *  returned true). Receives the dragged tile id(s) so the parent can drop
   *  their canvas_layout entries. */
  onTilesRemovedFromCanvas?: (ids: string[]) => void;
  /** Continuous drag callback — fires on every pointer move while a tile
   *  is being dragged. Used by the parent to highlight the staging panel
   *  when the cursor is over it. */
  onTileDragMove?: (clientX: number, clientY: number) => void;
  /** Drag ended — always fires (regardless of drop target). Used to reset
   *  any drag-state UI the parent maintains (e.g. staging highlight). */
  onTileDragEnd?: () => void;
}

export const CanvasBoard = React.memo(function CanvasBoard({
  tiles, layout, edges, groups, textBoxes,
  moveEnabled, linkEnabled, textMode, tileMode, imageMode, onAddTileAt,
  onPositionChange, onAddEdge, onDeleteEdge,
  onEdgeContextMenu, onTileContextMenu, onTileClick,
  onGroupsChange, onAddTextBox, onUpdateTextBox, onTextBoxContextMenu, onAddImageBox,
  selectedIds, onSelectionChange,
  fitTrigger, zoom100Trigger,
  tilesWithFlows, onFlowBadgeClick,
  screenToLocalRef,
  isOverStaging, onTilesRemovedFromCanvas,
  onTileDragMove, onTileDragEnd,
}: CanvasBoardProps) {
  const theme = usePixelTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  // HTML overlay refs — host TipTap editors at fixed canvas coordinates.
  // overlayInnerRef gets a CSS transform that mirrors the D3 zoom/pan, so
  // editors stay glued to their D3-drawn box frames without React re-renders.
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<CanvasNode[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const actionColors = useActionColors();
  const { statuses: allStatuses, getActionTypeShape } = useStatuses();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const moveRef = useRef(moveEnabled); moveRef.current = moveEnabled;
  const linkRef = useRef(linkEnabled); linkRef.current = linkEnabled;
  const textModeRef = useRef(textMode); textModeRef.current = textMode;
  const tileModeRef = useRef(tileMode); tileModeRef.current = tileMode;
  const imageModeRef = useRef(imageMode); imageModeRef.current = imageMode;
  const onAddImageBoxRef = useRef(onAddImageBox); onAddImageBoxRef.current = onAddImageBox;

  // Refs for callbacks to avoid re-render of the entire SVG
  const onTileClickRef = useRef(onTileClick); onTileClickRef.current = onTileClick;
  const onTileContextMenuRef = useRef(onTileContextMenu); onTileContextMenuRef.current = onTileContextMenu;
  const onEdgeContextMenuRef = useRef(onEdgeContextMenu); onEdgeContextMenuRef.current = onEdgeContextMenu;
  const onTextBoxContextMenuRef = useRef(onTextBoxContextMenu); onTextBoxContextMenuRef.current = onTextBoxContextMenu;
  const onAddTileAtRef = useRef(onAddTileAt); onAddTileAtRef.current = onAddTileAt;
  const onPositionChangeRef = useRef(onPositionChange); onPositionChangeRef.current = onPositionChange;
  const onGroupsChangeRef = useRef(onGroupsChange); onGroupsChangeRef.current = onGroupsChange;
  const onAddEdgeRef = useRef(onAddEdge); onAddEdgeRef.current = onAddEdge;
  const onDeleteEdgeRef = useRef(onDeleteEdge); onDeleteEdgeRef.current = onDeleteEdge;
  const onAddTextBoxRef = useRef(onAddTextBox); onAddTextBoxRef.current = onAddTextBox;
  const onUpdateTextBoxRef = useRef(onUpdateTextBox); onUpdateTextBoxRef.current = onUpdateTextBox;
  const onSelectionChangeRef = useRef(onSelectionChange); onSelectionChangeRef.current = onSelectionChange;
  const onFlowBadgeClickRef = useRef(onFlowBadgeClick); onFlowBadgeClickRef.current = onFlowBadgeClick;
  const isOverStagingRef = useRef(isOverStaging); isOverStagingRef.current = isOverStaging;
  const onTilesRemovedFromCanvasRef = useRef(onTilesRemovedFromCanvas); onTilesRemovedFromCanvasRef.current = onTilesRemovedFromCanvas;
  const onTileDragMoveRef = useRef(onTileDragMove); onTileDragMoveRef.current = onTileDragMove;
  const onTileDragEndRef = useRef(onTileDragEnd); onTileDragEndRef.current = onTileDragEnd;
  const selectedIdsRef = useRef<string[]>(selectedIds || []); selectedIdsRef.current = selectedIds || [];

  // Publish a viewport→canvas-local coordinate converter to the parent (used
  // for staging-panel drops). The function reads zoomTransformRef on every
  // call, so it always reflects the latest pan/zoom.
  useEffect(() => {
    if (!screenToLocalRef) return;
    screenToLocalRef.current = (clientX, clientY) => {
      const svg = svgRef.current;
      const t = zoomTransformRef.current;
      if (!svg) return { x: clientX, y: clientY };
      const r = svg.getBoundingClientRect();
      return {
        x: (clientX - r.left - t.x) / t.k,
        y: (clientY - r.top - t.y) / t.k,
      };
    };
    return () => {
      if (screenToLocalRef) screenToLocalRef.current = null;
    };
  }, [screenToLocalRef]);

  // Pending HTML save timers per text box — debounce TipTap onUpdate calls.
  const editorSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => {
    editorSaveTimersRef.current.forEach((t) => clearTimeout(t));
    editorSaveTimersRef.current.clear();
  }, []);

  // Link drag state
  const linkSrc = useRef<{ id: string; px: number; py: number; port: string } | null>(null);
  const dropTarget = useRef<{ nodeId: string; groupId?: string; port?: string } | null>(null);

  const getColor = useCallback((at: string) => (actionColors as Record<string, string>)[at] || actionColors.none || theme.ink3, [actionColors]);

  const buildNodes = useCallback((): CanvasNode[] => {
    const pm = new Map(layout.map((p) => [p.tile_id, p]));
    const currentPosMap = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));
    return tiles.map((t, i) => {
      const cur = currentPosMap.get(t.id);
      const s = pm.get(t.id);
      // Priority: DB layout > in-memory (drag) > default column
      // If DB has a position, use it. In-memory is only a fallback (e.g. for freshly created tiles not yet persisted).
      const x = s?.x ?? cur?.x ?? OFFSET_X;
      const y = s?.y ?? cur?.y ?? (OFFSET_Y + i * (TILE_H + TILE_GAP));
      // Resolve status shape (lookup against all statuses — system + custom).
      // status_id is now the single source of truth for "done"; the visual
      // treatment for completed tiles comes from the system 'done' row.
      let shape = 'solid';
      if (t.status_id) {
        const st = allStatuses.find((s) => s.id === t.status_id);
        if (st) shape = st.shape;
      } else {
        shape = getActionTypeShape(t.action_type || 'none');
      }
      // Type icon
      const tiId = typeTileIcons[t.id];
      const ti = tiId ? typeIcons.find((ic) => ic.id === tiId) : null;
      // Treat ALL DAY tiles as the 'allday' virtual action_type so colors/borders
      // resolve against the ALL DAY palette (not the TIMED one used for plain event).
      const resolvedActionType = (t.all_day && t.action_type === 'event') ? 'allday' : (t.action_type || 'none');
      return { id: t.id, title: t.title || 'Senza titolo', actionType: resolvedActionType, statusShape: shape, typeIcon: ti?.icon, typeColor: ti?.color, startAt: t.start_at, endAt: t.end_at, allDay: t.all_day, subtasks: t.subtasks, x, y };
    });
  }, [tiles, layout, allStatuses, getActionTypeShape, typeIcons, typeTileIcons]);

  const getGroupBounds = (g: CanvasGroup, ns: CanvasNode[]) => {
    const gn = ns.filter((n) => g.nodeIds.includes(n.id));
    if (!gn.length) return null;
    const x = Math.min(...gn.map((n) => n.x)) - GROUP_PAD;
    const y = Math.min(...gn.map((n) => n.y)) - GROUP_PAD;
    return { x, y, w: Math.max(...gn.map((n) => n.x + TILE_W)) + GROUP_PAD - x, h: Math.max(...gn.map((n) => n.y + TILE_H)) + GROUP_PAD - y };
  };

  // Hit-test result: nodeId to connect to + optional groupId for highlight
  // preferGroup: when true, containers take priority over tiles inside them
  interface HitResult { nodeId: string; groupId?: string; }
  const hitTest = useCallback((bx: number, by: number, excludeId: string, preferGroup = false): HitResult | null => {
    const ns = nodesRef.current;
    const gs = groupsRef.current;
    const TOL = 8;

    let sourceGroupId: string | null = null;
    gs.forEach((g) => { if (g.nodeIds.includes(excludeId)) sourceGroupId = g.id; });

    // Group check
    const findGroup = (): HitResult | null => {
      for (const g of gs) {
        if (g.id === sourceGroupId) continue;
        const b = getGroupBounds(g, ns);
        if (!b) continue;
        if (bx >= b.x - TOL && bx <= b.x + b.w + TOL && by >= b.y - LABEL_H - TOL && by <= b.y + b.h + TOL) {
          const first = ns.find((n) => g.nodeIds.includes(n.id) && n.id !== excludeId);
          if (first) return { nodeId: first.id, groupId: g.id };
        }
      }
      return null;
    };

    // Tile check (ungrouped tiles only when preferGroup, ALL tiles otherwise)
    const findTile = (): HitResult | null => {
      const groupedIds = preferGroup ? new Set(gs.flatMap((g) => g.nodeIds)) : new Set<string>();
      const tile = ns.find((n) => n.id !== excludeId && !groupedIds.has(n.id) && bx >= n.x && bx <= n.x + TILE_W && by >= n.y && by <= n.y + TILE_H);
      if (tile) return { nodeId: tile.id };
      return null;
    };

    // Text box check
    const findTextBox = (): HitResult | null => {
      for (const tb of textBoxes) {
        const tbId = `tb:${tb.id}`;
        if (tbId === excludeId) continue;
        if (bx >= tb.x && bx <= tb.x + tb.w && by >= tb.y && by <= tb.y + tb.h) {
          return { nodeId: tbId };
        }
      }
      return null;
    };

    if (preferGroup) {
      return findGroup() || findTile() || findTextBox();
    } else {
      const tile = ns.find((n) => n.id !== excludeId && bx >= n.x && bx <= n.x + TILE_W && by >= n.y && by <= n.y + TILE_H);
      if (tile) return { nodeId: tile.id };
      return findTextBox() || findGroup();
    }
  }, [textBoxes]);


  const render = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();

    // Forward-declared so the zoom handler (registered before the function body
    // is reachable) can safely call it without hitting a TDZ on transform restore.
    let computeSelectionScreenBbox: () => { x: number; y: number; w: number; h: number } | null = () => null;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .filter((ev) => {
        if ((textModeRef.current || tileModeRef.current || imageModeRef.current) && ev.type === 'mousedown') return false; // block pan in text/tile/image mode
        return ev.type === 'wheel' || ev.type?.startsWith('touch') || (ev.type === 'mousedown' && ev.button === 0 && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && ev.target === svg);
      })
      .on('zoom', (ev) => {
        zoomTransformRef.current = ev.transform;
        board.attr('transform', ev.transform);
        // Mirror the SVG transform on the HTML overlay so TipTap editors stay
        // glued to their D3-drawn box frames during pan/zoom — without forcing
        // a React re-render of the editor list.
        if (overlayInnerRef.current) {
          overlayInnerRef.current.style.transform = `translate(${ev.transform.x}px,${ev.transform.y}px) scale(${ev.transform.k})`;
        }
        // Reposition floating menu only on user-driven pan/zoom — programmatic
        // transform restore (which fires every render) has no sourceEvent and
        // would otherwise loop with the parent's setSelectionBbox.
        if (ev.sourceEvent && selectedIdsRef.current.length > 0) {
          onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
        }
      });
    d3svg.call(zoom);
    zoomRef.current = zoom;

    const board = d3.select(svg).append('g');

    // Restore saved zoom transform
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      d3svg.call(zoom.transform as any, zoomTransformRef.current);
    }
    const boardNode = board.node()!;
    const nodes = buildNodes();
    nodesRef.current = nodes;

    // ── Compute screen-space bbox for current selection (tiles + text boxes) ──
    computeSelectionScreenBbox = (): { x: number; y: number; w: number; h: number } | null => {
      const ids = selectedIdsRef.current;
      if (!ids.length || !svgRef.current) return null;
      const idSet = new Set(ids);
      const sel = nodes.filter((n) => idSet.has(n.id));
      const selTbs = textBoxes.filter((tb) => idSet.has(`tb:${tb.id}`));
      if (sel.length + selTbs.length === 0) return null;
      const xs1 = [...sel.map((n) => n.x), ...selTbs.map((tb) => tb.x)];
      const ys1 = [...sel.map((n) => n.y), ...selTbs.map((tb) => tb.y)];
      const xs2 = [...sel.map((n) => n.x + TILE_W), ...selTbs.map((tb) => tb.x + tb.w)];
      const ys2 = [...sel.map((n) => n.y + TILE_H), ...selTbs.map((tb) => tb.y + tb.h)];
      const x1 = Math.min(...xs1), y1 = Math.min(...ys1);
      const x2 = Math.max(...xs2), y2 = Math.max(...ys2);
      const t = zoomTransformRef.current;
      const r = svgRef.current.getBoundingClientRect();
      return {
        x: r.left + t.x + x1 * t.k,
        y: r.top + t.y + y1 * t.k,
        w: (x2 - x1) * t.k,
        h: (y2 - y1) * t.k,
      };
    };

    // ── Selection rect (ctrl/cmd/shift + drag → multi-select) ──
    const selRect = board.append('rect').attr('fill', theme.accent).attr('fill-opacity', 0.1).attr('stroke', theme.accent).attr('stroke-width', 2).attr('stroke-dasharray', '4,3').attr('opacity', 0);
    let selStart: [number, number] | null = null;
    const isSelectModifier = (e: MouseEvent) => e.ctrlKey || e.metaKey || e.shiftKey;
    d3svg.on('mousedown.sel', (e: MouseEvent) => { if (!isSelectModifier(e) || e.button || e.target !== svg) return; e.preventDefault(); selStart = d3.pointer(e, boardNode) as [number, number]; selRect.attr('x', selStart[0]).attr('y', selStart[1]).attr('width', 0).attr('height', 0).attr('opacity', 1); });
    d3svg.on('mousemove.sel', (e: MouseEvent) => { if (!selStart) return; const [mx, my] = d3.pointer(e, boardNode); selRect.attr('x', Math.min(selStart[0], mx)).attr('y', Math.min(selStart[1], my)).attr('width', Math.abs(mx - selStart[0])).attr('height', Math.abs(my - selStart[1])); });
    d3svg.on('mouseup.sel', (e: MouseEvent) => {
      if (!selStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const [x1, y1] = [Math.min(selStart[0], mx), Math.min(selStart[1], my)];
      const [x2, y2] = [Math.max(selStart[0], mx), Math.max(selStart[1], my)];
      selStart = null; selRect.attr('opacity', 0);
      if (x2 - x1 < 20 || y2 - y1 < 20) return;
      const insideTiles = nodes.filter((n) => n.x + TILE_W / 2 >= x1 && n.x + TILE_W / 2 <= x2 && n.y + TILE_H / 2 >= y1 && n.y + TILE_H / 2 <= y2);
      const insideTbs = textBoxes.filter((tb) => tb.x + tb.w / 2 >= x1 && tb.x + tb.w / 2 <= x2 && tb.y + tb.h / 2 >= y1 && tb.y + tb.h / 2 <= y2);
      if (insideTiles.length + insideTbs.length < 1) return;
      const ids = [...insideTiles.map((n) => n.id), ...insideTbs.map((tb) => `tb:${tb.id}`)];
      selectedIdsRef.current = ids;
      onSelectionChangeRef.current?.(ids, computeSelectionScreenBbox());
    });

    // Clear selection on plain click on empty canvas
    d3svg.on('click.clearsel', (e: MouseEvent) => {
      if (e.target !== svg) return;
      if (isSelectModifier(e)) return;
      if (textModeRef.current || tileModeRef.current || imageModeRef.current) return;
      if (selectedIdsRef.current.length === 0) return;
      selectedIdsRef.current = [];
      onSelectionChangeRef.current?.([], null);
    });

    // ── Temp line for link drag ──
    const tempLine = board.append('line').attr('stroke', theme.accent).attr('stroke-width', 2).attr('stroke-dasharray', '6,3').attr('opacity', 0);

    // ── Common link drag handlers ──
    const startLink = (sourceId: string, px: number, py: number, port: string, ev: any) => {
      ev.sourceEvent.stopPropagation();
      linkSrc.current = { id: sourceId, px, py, port };
      dropTarget.current = null;
      tempLine.attr('x1', px).attr('y1', py).attr('x2', px).attr('y2', py).attr('opacity', 1);
    };
    // Find closest port on a target node or group. Returns "top"|"right"... for tile, "g:top"|"g:right"... for group
    const findClosestPort = (mx: number, my: number, targetId: string, groupId?: string): string => {
      if (groupId) {
        const grp = groupsRef.current.find((g) => g.id === groupId);
        if (grp) {
          const b = getGroupBounds(grp, nodes);
          if (b) {
            const gPts = [
              { key: 'g:top', x: b.x + b.w / 2, y: b.y - LABEL_H },
              { key: 'g:right', x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
              { key: 'g:bottom', x: b.x + b.w / 2, y: b.y + b.h },
              { key: 'g:left', x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
            ];
            let best = gPts[0], bestDist = Infinity;
            gPts.forEach((p) => { const d = (mx - p.x) ** 2 + (my - p.y) ** 2; if (d < bestDist) { bestDist = d; best = p; } });
            return best.key;
          }
        }
      }
      const nd = nodes.find((n) => n.id === targetId);
      if (nd) {
        const tPts = PORTS.map((p) => ({ key: p.key, x: nd.x + p.cx, y: nd.y + p.cy }));
        let best = tPts[0], bestDist = Infinity;
        tPts.forEach((p) => { const d = (mx - p.x) ** 2 + (my - p.y) ** 2; if (d < bestDist) { bestDist = d; best = p; } });
        return best.key;
      }
      return 'right';
    };

    const dragLink = (ev: any) => {
      if (!linkSrc.current) return;
      const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
      tempLine.attr('x2', mx).attr('y2', my);
      const fromGroup = linkSrc.current.port.startsWith('g:');
      const hit = hitTest(mx, my, linkSrc.current.id, fromGroup);
      if (hit) {
        const tp = findClosestPort(mx, my, hit.nodeId, hit.groupId);
        dropTarget.current = { ...hit, port: tp };
      } else {
        dropTarget.current = null;
      }
      // Reset all highlights
      nodeGrps.each(function (d) {
        const isDeadline = (d as CanvasNode).actionType === 'deadline';
        d3.select(this).select('.tile-bg')
          .attr('stroke', isDeadline ? '#E24B4A' : theme.border)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', isDeadline ? '4,3' : null);
      });
      groupsBg.selectAll('rect').attr('stroke', 'none');
      // Highlight target
      if (dropTarget.current) {
        if (dropTarget.current.groupId) {
          groupsBg.selectAll('g').each(function (_, i) {
            const grp = groupsRef.current[i];
            if (grp && grp.id === dropTarget.current!.groupId) {
              d3.select(this as SVGGElement).select('rect').attr('stroke', theme.accent).attr('stroke-width', 2.5);
            }
          });
        } else {
          nodeGrps.filter((d: any) => d.id === dropTarget.current!.nodeId).select('.tile-bg').attr('stroke', theme.accent).attr('stroke-width', 2.5);
        }
      }
    };
    const endLink = () => {
      tempLine.attr('opacity', 0);
      nodeGrps.each(function (d) {
        const isDeadline = (d as CanvasNode).actionType === 'deadline';
        d3.select(this).select('.tile-bg')
          .attr('stroke', isDeadline ? '#E24B4A' : theme.border)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', isDeadline ? '4,3' : null);
      });
      groupsBg.selectAll('rect').attr('stroke', 'none');
      if (!linkSrc.current) return;
      const sid = linkSrc.current.id;
      const sp = linkSrc.current.port;
      linkSrc.current = null;
      if (dropTarget.current && dropTarget.current.nodeId !== sid) {
        onAddEdgeRef.current(sid, dropTarget.current.nodeId, sp, dropTarget.current.port);
      }
      dropTarget.current = null;
    };

    // ── Draw groups (bg) ──
    const groupsBg = board.append('g').attr('class', 'gbg');
    const drawGroups = () => {
      groupsBg.selectAll('*').remove();
      groupsRef.current.forEach((grp) => {
        const b = getGroupBounds(grp, nodes);
        if (!b) return;
        const gw = groupsBg.append('g');
        gw.append('rect').attr('x', b.x).attr('y', b.y - LABEL_H).attr('width', b.w).attr('height', b.h + LABEL_H).attr('rx', 0)
          .attr('fill', theme.surface).attr('stroke', 'none')
          .style('cursor', moveRef.current ? 'grab' : 'default')
          .call((() => {
            let prev: [number, number] | null = null;
            return d3.drag<SVGRectElement, unknown>().filter(() => moveRef.current)
              .on('start', (ev) => { prev = d3.pointer(ev.sourceEvent, boardNode) as [number, number]; })
              .on('drag', (ev) => {
                const cur = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
                if (!prev) { prev = cur; return; }
                const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
                prev = cur;
                grp.nodeIds.forEach((id) => { const n = nodes.find((nn) => nn.id === id); if (n) { n.x += dx; n.y += dy; } });
                nodeGrps.filter((d: any) => grp.nodeIds.includes(d.id)).attr('transform', (d: any) => `translate(${d.x},${d.y})`);
                drawEdges(); drawGroups();
              })
              .on('end', () => { prev = null; onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y }))); });
          })());
        gw.append('text').attr('x', b.x + 8).attr('y', b.y - LABEL_H + 14).attr('fill', theme.ink3).attr('font-size', 11).attr('font-weight', 500)
          .text(grp.label || 'Gruppo').style('cursor', 'text')
          .on('click', (ev: MouseEvent) => { ev.stopPropagation(); const nl = prompt('Nome del gruppo:', grp.label || ''); if (nl !== null) onGroupsChange(groupsRef.current.map((g) => g.id === grp.id ? { ...g, label: nl } : g)); });
        // Group ports
        const gPorts: { key: PortKey; cx: number; cy: number }[] = [
          { key: 'top', cx: b.x + b.w / 2, cy: b.y - LABEL_H },
          { key: 'right', cx: b.x + b.w, cy: b.y + (b.h - LABEL_H) / 2 },
          { key: 'bottom', cx: b.x + b.w / 2, cy: b.y + b.h },
          { key: 'left', cx: b.x, cy: b.y + (b.h - LABEL_H) / 2 },
        ];
        gPorts.forEach(({ key: pk, cx, cy }) => {
          const pc = gw.append('circle').attr('cx', cx).attr('cy', cy).attr('r', PORT_R + 1).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2).attr('opacity', 0).style('pointer-events', 'none');
          const ha = gw.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 14).attr('fill', 'rgba(0,0,0,0.001)').style('cursor', 'crosshair');
          ha.on('mouseenter', () => { if (linkRef.current) pc.attr('opacity', 1); }).on('mouseleave', () => { if (!linkSrc.current) pc.attr('opacity', 0); });
          ha.call(d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
            .on('start', (ev) => { const fn = nodes.find((n) => grp.nodeIds.includes(n.id)); if (fn) startLink(fn.id, cx, cy, `g:${pk}`, ev); pc.attr('opacity', 1); })
            .on('drag', dragLink)
            .on('end', () => { endLink(); pc.attr('opacity', 0); }) as any);
        });
      });
    };

    // ── Draw edges ──
    const edgesG = board.append('g');
    // Get all ports for an endpoint (tile, group, or textbox)
    const getEndpointPorts = (nodeId: string, port: string | undefined): { x: number; y: number }[] => {
      // Text box ports
      if (nodeId.startsWith('tb:') || (port && port.startsWith('t:'))) {
        const tbId = nodeId.startsWith('tb:') ? nodeId.slice(3) : nodeId;
        const tb = textBoxes.find((t) => t.id === tbId);
        if (tb) {
          return [
            { x: tb.x + tb.w / 2, y: tb.y },
            { x: tb.x + tb.w, y: tb.y + tb.h / 2 },
            { x: tb.x + tb.w / 2, y: tb.y + tb.h },
            { x: tb.x, y: tb.y + tb.h / 2 },
          ];
        }
      }
      // Group ports
      if (port && port.startsWith('g:')) {
        const nd = nodes.find((n) => n.id === nodeId);
        if (nd) {
          const grp = groupsRef.current.find((g) => g.nodeIds.includes(nd.id));
          if (grp) {
            const b = getGroupBounds(grp, nodes);
            if (b) return [
              { x: b.x + b.w / 2, y: b.y - LABEL_H },
              { x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
              { x: b.x + b.w / 2, y: b.y + b.h },
              { x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
            ];
          }
        }
      }
      // Tile ports
      const nd = nodes.find((n) => n.id === nodeId);
      if (nd) return PORTS.map((p) => ({ x: nd.x + p.cx, y: nd.y + p.cy }));
      return [];
    };

    // Find best pair of ports between two endpoints
    const findBestPorts = (sId: string, tId: string, sp: string | undefined, tp: string | undefined): { sx: number; sy: number; tx: number; ty: number } => {
      const sPorts = getEndpointPorts(sId, sp);
      const tPorts = getEndpointPorts(tId, tp);
      let bestDist = Infinity, best = { sx: 0, sy: 0, tx: 0, ty: 0 };
      for (const s of sPorts) {
        for (const t of tPorts) {
          const d = (s.x - t.x) ** 2 + (s.y - t.y) ** 2;
          if (d < bestDist) { bestDist = d; best = { sx: s.x, sy: s.y, tx: t.x, ty: t.y }; }
        }
      }
      return best;
    };

    const drawEdges = () => {
      edgesG.selectAll('*').remove();
      edges.forEach((edge) => {
        // Check endpoints exist (could be tile or textbox)
        const sIsTb = edge.source_id.startsWith('tb:');
        const tIsTb = edge.target_id.startsWith('tb:');
        const s = sIsTb ? null : nodes.find((n) => n.id === edge.source_id);
        const t = tIsTb ? null : nodes.find((n) => n.id === edge.target_id);
        const sTb = sIsTb ? textBoxes.find((tb) => `tb:${tb.id}` === edge.source_id) : null;
        const tTb = tIsTb ? textBoxes.find((tb) => `tb:${tb.id}` === edge.target_id) : null;
        if (!s && !sTb) return;
        if (!t && !tTb) return;

        const { sx: x1, sy: y1, tx: x2, ty: y2 } = findBestPorts(edge.source_id, edge.target_id, edge.source_port, edge.target_port);

        const sColor = s ? getColor(s.actionType) : theme.border;
        const tColor = t ? getColor(t.actionType) : theme.border;
        const selIds = selectedIdsRef.current;
        const isSelectedEdge = selIds.length >= 2 && selIds.includes(edge.source_id) && selIds.includes(edge.target_id);
        const baseStroke = isSelectedEdge ? theme.accent : theme.border;
        const baseWidth = isSelectedEdge ? 2.5 : 1.5;
        const g = edgesG.append('g').attr('class', 'edge-node').attr('data-source', edge.source_id).attr('data-target', edge.target_id);
        g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'transparent').attr('stroke-width', 12).style('cursor', 'pointer');
        const vl = g.append('line').attr('class', 'edge-visible').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', baseStroke).attr('stroke-width', baseWidth).attr('stroke-dasharray', '4,3').style('pointer-events', 'none');
        // Anchor dots at port positions
        g.append('circle').attr('cx', x1).attr('cy', y1).attr('r', 3).attr('fill', sColor).style('pointer-events', 'none');
        g.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 3).attr('fill', tColor).style('pointer-events', 'none');
        g.on('mouseenter', () => vl.attr('stroke', '#E24B4A').attr('stroke-width', 2.5))
         .on('mouseleave', () => {
           // Restore selection-aware baseline (selection may have changed during hover)
           const sel = selectedIdsRef.current;
           const sel2 = sel.length >= 2 && sel.includes(edge.source_id) && sel.includes(edge.target_id);
           vl.attr('stroke', sel2 ? theme.accent : theme.border).attr('stroke-width', sel2 ? 2.5 : 1.5);
         });
        g.on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEdgeContextMenuRef.current({ x: ev.clientX, y: ev.clientY, edgeId: edge.id }); });
      });
    };
    drawEdges();

    // ── Nodes ──
    const nodesG = board.append('g');
    const nodeGrps = nodesG.selectAll('g').data(nodes, (d: any) => d.id).enter().append('g').attr('class', 'tile-node').attr('transform', (d) => `translate(${d.x},${d.y})`);
    // Subtle border slightly lighter than the bg. Action/type are communicated by footer icons.
    nodeGrps.append('rect').attr('class', 'tile-bg').attr('width', TILE_W).attr('height', TILE_H).attr('rx', 0)
      .attr('fill', (d) => d.typeColor ? d.typeColor + 'CC' : theme.surface)
      .attr('stroke', (d) => d.actionType === 'deadline' ? '#E24B4A' : theme.border)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => d.actionType === 'deadline' ? '4,3' : null)
      .style('cursor', moveRef.current ? 'grab' : 'default');
    // Status shape overlay (uses SVG <pattern> elements under the hood)
    let patIdx = 0;
    nodeGrps.each(function (d) {
      if (!d.statusShape || d.statusShape === 'solid') return;
      const g = d3.select(this);
      // For NOTES (action_type === 'none'), patterns use a visible neutral gray
      // so they stand out even without a colored action palette.
      const color = d.actionType === 'none' ? theme.ink : getColor(d.actionType);
      const o = 0.2;
      const pid = `cpat-${patIdx++}`;
      const clip = g.append('clipPath').attr('id', `${pid}-clip`);
      clip.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('rx', 0);
      const pg = g.append('g').attr('clip-path', `url(#${pid}-clip)`).style('pointer-events', 'none');
      switch (d.statusShape) {
        case 'diagonal_ltr':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 10).attr('height', 10).attr('patternTransform', 'rotate(60)')
            .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 10).attr('stroke', color).attr('stroke-width', 5).attr('stroke-opacity', o);
          pg.append('rect').attr('x', 5).attr('y', 5).attr('width', TILE_W - 10).attr('height', TILE_H - 10).attr('rx', 0).attr('fill', `url(#${pid})`);
          break;
        case 'diagonal_rtl':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 10).attr('height', 10).attr('patternTransform', 'rotate(-60)')
            .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 10).attr('stroke', color).attr('stroke-width', 5).attr('stroke-opacity', o);
          pg.append('rect').attr('x', 5).attr('y', 5).attr('width', TILE_W - 10).attr('height', TILE_H - 10).attr('rx', 0).attr('fill', `url(#${pid})`);
          break;
        case 'vertical':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 16).attr('height', 20)
            .append('line').attr('x1', 8).attr('y1', 0).attr('x2', 8).attr('y2', 20).attr('stroke', color).attr('stroke-width', 6).attr('stroke-opacity', o);
          pg.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('fill', `url(#${pid})`);
          break;
        case 'bubble': {
          // Scattered across the tile (padding 10, TILE_W=130 TILE_H=90), varied sizes.
          const bubbles: Array<[number, number, number, number]> = [
            [20, 20, 6, o + 0.05], [44, 16, 4, o], [68, 22, 7, o + 0.1], [94, 18, 5, o], [114, 24, 4, o - 0.02],
            [28, 45, 4, o], [54, 47, 6, o + 0.08], [80, 43, 5, o + 0.05], [104, 47, 4, o],
            [22, 70, 5, o + 0.05], [46, 72, 4, o], [70, 68, 6, o + 0.08], [96, 72, 4, o], [116, 68, 5, o + 0.05],
          ];
          bubbles.forEach(([cx, cy, r, op]) => {
            pg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r)
              .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-opacity', op);
          });
          break;
        }
        case 'cross':
          // 10-unit padding from edges (TILE_W=130, TILE_H=90), thicker stroke.
          pg.append('line').attr('x1', 10).attr('y1', 10).attr('x2', TILE_W - 10).attr('y2', TILE_H - 10).attr('stroke', color).attr('stroke-width', 12).attr('stroke-opacity', o * 0.9).attr('stroke-linecap', 'round');
          pg.append('line').attr('x1', TILE_W - 10).attr('y1', 10).attr('x2', 10).attr('y2', TILE_H - 10).attr('stroke', color).attr('stroke-width', 12).attr('stroke-opacity', o * 0.9).attr('stroke-linecap', 'round');
          break;
        case 'hourglass': {
          // Two triangles meeting at apex, centered. TILE_W=130, TILE_H=90.
          pg.append('path')
            .attr('d', 'M55,30 L75,30 L65,45 L75,60 L55,60 L65,45 Z')
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 4)
            .attr('stroke-opacity', o + 0.25).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round');
          break;
        }
        case 'pause_bars':
          pg.append('rect').attr('x', 57).attr('y', 26).attr('width', 6).attr('height', 38).attr('rx', 1).attr('fill', color).attr('fill-opacity', o + 0.15);
          pg.append('rect').attr('x', 67).attr('y', 26).attr('width', 6).attr('height', 38).attr('rx', 1).attr('fill', color).attr('fill-opacity', o + 0.15);
          break;
        case 'lock':
          pg.append('path')
            .attr('d', 'M58,41 V35 a7,7 0 0 1 14,0 V41')
            .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2)
            .attr('stroke-opacity', o + 0.15).attr('stroke-linecap', 'round');
          pg.append('rect').attr('x', 53).attr('y', 41).attr('width', 24).attr('height', 20).attr('rx', 0).attr('fill', color).attr('fill-opacity', o + 0.1);
          pg.append('circle').attr('cx', 65).attr('cy', 51).attr('r', 2).attr('fill', theme.bg1);
          break;
        case 'shade':
          // 50% dark overlay covering the whole tile — the "faded / done" treatment.
          pg.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('fill', '#000000').attr('opacity', 0.5);
          break;
      }
    });
    nodeGrps.each(function (d) {
      const g = d3.select(this);
      const fo = g.append('foreignObject').attr('x', 6).attr('y', 6).attr('width', TILE_W - 12).attr('height', TILE_H - 26);
      fo.append('xhtml:div')
        .attr('style', 'color:#D4D4D8;font-size:11px;font-weight:400;line-height:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;pointer-events:none;')
        .text(d.title);
    });
    // Footer: date info + checklist (LIST) + action badge + type icon badge
    const formatDate = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }); };
    const formatTime = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

    nodeGrps.each(function (d) {
      const g = d3.select(this);
      const hasDate = d.actionType === 'deadline' || d.actionType === 'event' || d.actionType === 'allday';
      if (!hasDate || (!d.startAt && !d.endAt)) return;
      // Date on row 1, time on row 2 — both centered horizontally between the
      // action (left) and type (right) badges in the bottom footer.
      let dateLine = '';
      let timeLine = '';
      if (d.actionType === 'deadline' && d.endAt) {
        dateLine = formatDate(d.endAt);
      } else if (d.allDay && d.startAt) {
        dateLine = formatDate(d.startAt);
      } else if (d.startAt) {
        dateLine = formatDate(d.startAt);
        timeLine = formatTime(d.startAt);
        if (d.endAt) timeLine += ` - ${formatTime(d.endAt)}`;
      }
      // Left-aligned just past the action badge (badge ends at x=22; pad 8px to x=30).
      const textX = 30;
      if (dateLine && timeLine) {
        g.append('text').attr('x', textX).attr('y', TILE_H - 16)
          .attr('fill', theme.ink).attr('font-size', 9).attr('font-weight', 400).text(dateLine);
        g.append('text').attr('x', textX).attr('y', TILE_H - 6)
          .attr('fill', theme.ink2).attr('font-size', 8).attr('font-weight', 400).text(timeLine);
      } else if (dateLine) {
        // Single line — center vertically between badges.
        g.append('text').attr('x', textX).attr('y', TILE_H - 11)
          .attr('fill', theme.ink).attr('font-size', 9).attr('font-weight', 400).text(dateLine);
      }
    });
    // Checklist bar (LIST) — sits between title and the badges row.
    nodeGrps.each(function (d) {
      const items = d.subtasks || [];
      if (items.length === 0) return;
      const g = d3.select(this);
      const innerX = 6;
      const innerW = TILE_W - 12;
      const y = TILE_H - 34;
      const h = 4;
      const gap = 2;
      const n = items.length;
      const itemW = n <= 10 ? 8 : Math.max(1, (innerW - (n - 1) * gap) / n);
      items.forEach((sub, i) => {
        g.append('rect')
          .attr('x', innerX + i * (itemW + gap))
          .attr('y', y)
          .attr('width', itemW)
          .attr('height', h)
          .attr('rx', 1)
          .attr('fill', sub.is_done ? '#20C933' : '#F82B60')
          .style('pointer-events', 'none');
      });
    });
    // Action badge (round colored circle + white icon) in bottom-left.
    // Notes (none) shows nothing.
    const ACTION_ICON_NAME: Record<string, string | null> = {
      none: null,
      anytime: 'IconArrowUp',
      deadline: 'IconBolt',
      event: 'IconClock',     // TIMED
      allday: 'IconCalendar',
    };
    nodeGrps.each(function (d) {
      const iconName = ACTION_ICON_NAME[d.actionType];
      if (!iconName) return;
      const IconComp = (TablerIcons as unknown as Record<string, any>)[iconName];
      if (!IconComp) return;
      const g = d3.select(this);
      const actionColor = getColor(d.actionType);
      g.append('circle').attr('cx', 14).attr('cy', TILE_H - 14).attr('r', 8).attr('fill', actionColor);
      const React = require('react');
      const { renderToString } = require('react-dom/server');
      const html = renderToString(React.createElement(IconComp, { size: 10, color: readableOn(actionColor) }));
      const fo = g.append('foreignObject').attr('x', 9).attr('y', TILE_H - 19).attr('width', 10).attr('height', 10).style('pointer-events', 'none');
      const container = document.createElement('div');
      container.style.cssText = 'display:flex;align-items:center;justify-content:center;width:10px;height:10px;';
      container.innerHTML = html;
      (fo.node() as SVGForeignObjectElement)?.appendChild(container);
    });
    // FLOW badge — clickable chip pinned to the top-right of the tile,
    // sticking out past the tile boundary so it reads as an external
    // "handle". Click opens the Flow modal for this tile (without selecting
    // the tile itself, hence the pointerdown stopPropagation).
    nodeGrps.each(function (d) {
      if (!tilesWithFlows?.has(d.id)) return;
      const g = d3.select(this);
      const w = 34;
      const h = 15;
      // Anchor: chip's right edge flush with the tile's right edge; vertically
      // it still floats above the tile so it reads as an external handle.
      const x = TILE_W - w - 8;
      const y = -h / 2 - 1;
      const badge = g.append('g').attr('class', 'flow-badge').style('cursor', 'pointer');
      badge.append('rect')
        .attr('x', x).attr('y', y)
        .attr('width', w).attr('height', h)
        .attr('fill', theme.accent)
        .attr('stroke', theme.border).attr('stroke-width', 2);
      badge.append('text')
        .attr('x', x + w / 2).attr('y', y + h / 2 + 3)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'var(--font-pixel-head), ui-monospace, monospace')
        .attr('font-size', 8).attr('font-weight', 700)
        .attr('fill', theme.onAccent)
        .style('letter-spacing', '0.08em')
        .style('text-transform', 'uppercase')
        .style('pointer-events', 'none')
        .text('FLOW');
      // Capture interaction at pointerdown to win the race with the tile's
      // own drag/select handlers, and on click to fire the modal-open hook.
      badge.on('pointerdown', (event: PointerEvent) => {
        event.stopPropagation();
      });
      badge.on('click', (event: PointerEvent) => {
        event.stopPropagation();
        onFlowBadgeClickRef.current?.(d.id);
      });
    });

    // Type icon — rounded-square colored badge + white icon in bottom-right.
    nodeGrps.each(function (d) {
      if (!d.typeIcon) return;
      const IconComp = (TablerIcons as unknown as Record<string, any>)[d.typeIcon];
      if (!IconComp) return;
      const g = d3.select(this);
      const typeBg = d.typeColor || theme.surfaceVariant;
      g.append('rect').attr('x', TILE_W - 22).attr('y', TILE_H - 22).attr('width', 16).attr('height', 16).attr('rx', 0).attr('fill', typeBg);
      const React = require('react');
      const { renderToString } = require('react-dom/server');
      const html = renderToString(React.createElement(IconComp, { size: 10, color: readableOn(typeBg) }));
      const fo = g.append('foreignObject').attr('x', TILE_W - 19).attr('y', TILE_H - 19).attr('width', 10).attr('height', 10).style('pointer-events', 'none');
      const container = document.createElement('div');
      container.style.cssText = 'display:flex;align-items:center;justify-content:center;width:10px;height:10px;';
      container.innerHTML = html;
      (fo.node() as SVGForeignObjectElement)?.appendChild(container);
    });

    // Selection ring (toggled per tile based on selectedIds)
    nodeGrps.append('rect').attr('class', 'sel-ring')
      .attr('x', -3).attr('y', -3).attr('width', TILE_W + 6).attr('height', TILE_H + 6).attr('rx', 0)
      .attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 3)
      .style('pointer-events', 'none')
      .attr('opacity', (d) => selectedIdsRef.current.includes((d as CanvasNode).id) ? 1 : 0);

    // Tile ports
    const portG = nodeGrps.append('g').attr('class', 'ports').attr('opacity', 0);
    PORTS.forEach(({ cx, cy }) => { portG.append('circle').attr('class', 'port').attr('cx', cx).attr('cy', cy).attr('r', PORT_R).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2).style('cursor', 'crosshair'); });
    nodeGrps.on('mouseenter', function () { if (linkRef.current) d3.select(this).select('.ports').attr('opacity', 1); })
      .on('mouseleave', function () { if (!linkSrc.current) d3.select(this).select('.ports').attr('opacity', 0); });

    // Tile port drag
    const portDrag = d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
      .on('start', function (ev) {
        const nd = d3.select((this.parentNode as SVGGElement).parentNode as SVGGElement).datum() as CanvasNode;
        const pcx = parseFloat(d3.select(this).attr('cx')), pcy = parseFloat(d3.select(this).attr('cy'));
        const pk = PORTS.find((p) => p.cx === pcx && p.cy === pcy)?.key as PortKey || 'right';
        startLink(nd.id, nd.x + pcx, nd.y + pcy, pk, ev);
      })
      .on('drag', dragLink)
      .on('end', () => { endLink(); nodeGrps.selectAll('.ports').attr('opacity', 0); });
    portG.selectAll('circle.port').call(portDrag as any);

    // Node drag (supports multi-drag including text boxes when the dragged tile is part of selectedIds).
    let dragMultiNodes: CanvasNode[] | null = null;
    let dragMultiSelection: d3.Selection<SVGGElement, CanvasNode, SVGGElement, unknown> | null = null;
    let dragMultiTbs: CanvasTextBox[] | null = null;
    let dragSuppressedBbox = false;
    nodeGrps.call(d3.drag<SVGGElement, CanvasNode>()
      .filter((ev) => !(ev.target as SVGElement).classList?.contains('port') && moveRef.current)
      // Allow tiny mouse jitter between mousedown/mouseup to still fire the
      // subsequent click handler (sidebar open). Without this, any sub-pixel
      // movement is interpreted as a drag and the click is suppressed.
      .clickDistance(5)
      .on('start', function (_, d) {
        const sel = selectedIdsRef.current;
        if (sel.length > 1 && sel.includes(d.id)) {
          const idSet = new Set(sel);
          dragMultiNodes = nodes.filter((n) => idSet.has(n.id));
          dragMultiSelection = nodeGrps.filter((dd: any) => idSet.has(dd.id));
          dragMultiTbs = textBoxes.filter((tb) => idSet.has(`tb:${tb.id}`));
          dragSuppressedBbox = true;
          onSelectionChangeRef.current?.(sel, null);
        } else {
          dragMultiNodes = null;
          dragMultiSelection = null;
          dragMultiTbs = null;
          dragSuppressedBbox = false;
        }
      })
      .on('drag', function (ev, d) {
        d3.select(this).raise();
        if (dragMultiNodes && dragMultiSelection) {
          const dx = ev.dx, dy = ev.dy;
          for (const n of dragMultiNodes) { n.x += dx; n.y += dy; }
          dragMultiSelection.attr('transform', (dd: any) => `translate(${dd.x},${dd.y})`);
          if (dragMultiTbs && dragMultiTbs.length > 0) {
            const tbIdSet = new Set(dragMultiTbs.map((tb) => tb.id));
            for (const tb of dragMultiTbs) { tb.x += dx; tb.y += dy; }
            tbG.selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
              const id = (this as SVGGElement).getAttribute('data-tb-id');
              if (!id || !tbIdSet.has(id)) return;
              const tb = dragMultiTbs!.find((t) => t.id === id);
              if (tb) d3.select(this).attr('transform', `translate(${tb.x},${tb.y})`);
            });
          }
        } else {
          d.x = ev.x; d.y = ev.y;
          d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        }
        drawEdges(); drawGroups();
        // Publish the live pointer position so the parent can highlight the
        // staging panel when the cursor enters it during the drag.
        const srcEv = ev?.sourceEvent as MouseEvent | PointerEvent | undefined;
        if (srcEv) onTileDragMoveRef.current?.(srcEv.clientX, srcEv.clientY);
      })
      .on('end', (ev, d) => {
        // Determine the drop zone. If the gesture ended over the staging
        // panel (hosted outside the SVG), drop the dragged tiles from the
        // canvas layout instead of saving their new position.
        const sourceEv = ev?.sourceEvent as MouseEvent | PointerEvent | undefined;
        const isStagingDrop = !!(
          sourceEv &&
          isOverStagingRef.current &&
          isOverStagingRef.current(sourceEv.clientX, sourceEv.clientY)
        );
        const draggedIds = dragMultiNodes ? dragMultiNodes.map((n) => n.id) : [d.id];

        if (isStagingDrop) {
          // Send the dragged tile(s) back to the staging panel. The parent
          // updates canvas_layout accordingly; we still write a stripped
          // position list so the visual matches the data immediately.
          const removedSet = new Set(draggedIds);
          onPositionChangeRef.current(
            nodes
              .filter((n) => !removedSet.has(n.id))
              .map((n) => ({ tile_id: n.id, x: n.x, y: n.y })),
          );
          onTilesRemovedFromCanvasRef.current?.(draggedIds);
        } else {
          onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
        }

        // Persist text-box positions if they moved as part of a multi-drag
        if (dragMultiTbs) {
          for (const tb of dragMultiTbs) {
            onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y });
          }
        }
        if (dragSuppressedBbox) {
          onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
        }
        // Drag ended — notify the parent so it can clear any drag-state UI
        // (e.g. the staging panel highlight). Fires regardless of drop zone.
        onTileDragEndRef.current?.();
        const wasMulti = !!dragMultiNodes;
        dragMultiNodes = null;
        dragMultiSelection = null;
        dragMultiTbs = null;
        dragSuppressedBbox = false;
        // Drop-into-group only for single-tile drag that didn't go to staging.
        if (wasMulti || isStagingDrop) return;
        const cx = d.x + TILE_W / 2, cy = d.y + TILE_H / 2;
        const currentGroups = groupsRef.current;
        const alreadyIn = currentGroups.find((g) => g.nodeIds.includes(d.id));
        if (!alreadyIn) {
          for (const g of currentGroups) {
            const b = getGroupBounds(g, nodes);
            if (!b) continue;
            if (cx >= b.x && cx <= b.x + b.w && cy >= b.y - LABEL_H && cy <= b.y + b.h) {
              const updated = currentGroups.map((grp) =>
                grp.id === g.id ? { ...grp, nodeIds: [...grp.nodeIds, d.id] } : grp
              );
              onGroupsChangeRef.current(updated);
              break;
            }
          }
        }
      }));

    // Click / context on tiles.
    // - CTRL/CMD/SHIFT + click → toggle the tile in the multi-selection (no sidebar open)
    // - Plain click → clear any active multi-selection and open the tile in the sidebar
    nodeGrps.on('click.sel', (ev: MouseEvent, d: CanvasNode) => {
      ev.stopPropagation();
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
        const cur = selectedIdsRef.current;
        const has = cur.includes(d.id);
        const next = has ? cur.filter((id) => id !== d.id) : [...cur, d.id];
        selectedIdsRef.current = next;
        onSelectionChangeRef.current?.(next, next.length ? computeSelectionScreenBbox() : null);
        return;
      }
      if (selectedIdsRef.current.length > 0) {
        selectedIdsRef.current = [];
        onSelectionChangeRef.current?.([], null);
      }
      onTileClickRef.current(d.id);
    });
    nodeGrps.on('contextmenu.ctx', (ev: MouseEvent, d: CanvasNode) => { ev.preventDefault(); ev.stopPropagation(); onTileContextMenuRef.current({ x: ev.clientX, y: ev.clientY, tileId: d.id, inGroup: groupsRef.current.some((g) => g.nodeIds.includes(d.id)) }); });

    // ── Text boxes ──
    const tbG = board.append('g').attr('class', 'textboxes');

    // Move the corresponding HTML overlay div in sync with a D3 drag/resize.
    // React only re-renders the overlay when textBoxes prop CHANGES (server
    // round-trip), so during drag we update style directly to keep the editor
    // glued to the D3-drawn box frame.
    const syncOverlayBox = (tb: CanvasTextBox) => {
      const el = overlayInnerRef.current?.querySelector(`[data-box-id="${tb.id}"]`) as HTMLElement | null;
      if (!el) return;
      el.style.left = `${tb.x + TB_PAD}px`;
      el.style.top = `${tb.y + TB_PAD}px`;
      el.style.width = `${tb.w - 2 * TB_PAD}px`;
      el.style.height = `${tb.h - 2 * TB_PAD}px`;
    };

    const drawTextBoxes = () => {
      // Text editors live in the HTML overlay below the SVG, so this redraw
      // only handles the SVG-side frame: background rect, selection ring,
      // ports, and (for image boxes) the foreignObject <img>. No React mount
      // here, so no unmount conflicts.
      tbG.selectAll('*').remove();
      textBoxes.forEach((tb) => {
        const tw = tb.w, th = tb.h;
        const g = tbG.append('g').attr('transform', `translate(${tb.x},${tb.y})`).attr('class', 'tb-node').attr('data-tb-id', tb.id);

        // Background
        g.append('rect')
          .attr('width', tw).attr('height', th).attr('rx', 0)
          .attr('fill', theme.surface).attr('stroke', theme.border).attr('stroke-width', 2);

        // Selection ring (toggled per text box based on selectedIds)
        g.append('rect').attr('class', 'sel-ring')
          .attr('x', -3).attr('y', -3).attr('width', tw + 6).attr('height', th + 6).attr('rx', 0)
          .attr('fill', 'none').attr('stroke', theme.accent).attr('stroke-width', 3)
          .style('pointer-events', 'none')
          .attr('opacity', selectedIdsRef.current.includes(`tb:${tb.id}`) ? 1 : 0);

        // Type-specific content. Image stays in SVG via foreignObject (lightweight,
        // no React state). Text editors are rendered in the HTML overlay (sibling
        // of <svg>) — see the JSX at the bottom of this component. The overlay
        // already covers the inner editor area; here we only need to leave the
        // box's TB_PAD margin clickable for D3 drag.
        if (tb.type === 'image') {
          // Image inset by IMG_PAD on every side for a thin frame around the
          // picture (the box border + a small breathing margin = a "polaroid"
          // look). page.tsx adds 2*IMG_PAD to the box dimensions so the inner
          // image area still matches the picture's natural aspect ratio.
          const IMG_PAD = 2;
          const fo = g.append('foreignObject')
            .attr('x', IMG_PAD).attr('y', IMG_PAD)
            .attr('width', tw - IMG_PAD * 2).attr('height', th - IMG_PAD * 2)
            .style('pointer-events', 'none');
          fo.append('xhtml:img')
            .attr('src', tb.content.src)
            .attr('alt', tb.content.alt || '')
            .attr('style', 'display:block;width:100%;height:100%;object-fit:fill;pointer-events:none;user-select:none;-webkit-user-drag:none;');
        }

        // Multi-selection toggle via CTRL/CMD/SHIFT + click on the box background
        // rect. Plain click is handled by TipTap (text) or no-op (image).
        g.on('click.select', (ev: MouseEvent) => {
          if (!ev.ctrlKey && !ev.metaKey && !ev.shiftKey) return;
          ev.stopPropagation();
          const tbId = `tb:${tb.id}`;
          const cur = selectedIdsRef.current;
          const has = cur.includes(tbId);
          const next = has ? cur.filter((id) => id !== tbId) : [...cur, tbId];
          selectedIdsRef.current = next;
          onSelectionChangeRef.current?.(next, next.length ? computeSelectionScreenBbox() : null);
        });

        // 4 ports
        const tbPorts = g.append('g').attr('class', 'tb-ports').attr('opacity', 0);
        const tbPortList = [
          { key: 'top', cx: tw / 2, cy: 0 },
          { key: 'right', cx: tw, cy: th / 2 },
          { key: 'bottom', cx: tw / 2, cy: th },
          { key: 'left', cx: 0, cy: th / 2 },
        ];
        tbPortList.forEach(({ key, cx, cy }) => {
          tbPorts.append('circle').attr('class', 'port').attr('cx', cx).attr('cy', cy)
            .attr('r', PORT_R).attr('fill', theme.accent).attr('stroke', theme.bg1).attr('stroke-width', 2)
            .style('cursor', 'crosshair');
        });

        g.on('mouseenter', () => { if (linkRef.current) tbPorts.attr('opacity', 1); });
        g.on('mouseleave', () => { if (!linkSrc.current) tbPorts.attr('opacity', 0); });

        // Port drag on text box
        const tbPortDrag = d3.drag<SVGCircleElement, unknown>().filter(() => linkRef.current)
          .on('start', function (ev) {
            const pcx = parseFloat(d3.select(this).attr('cx')), pcy = parseFloat(d3.select(this).attr('cy'));
            const pk = tbPortList.find((p) => p.cx === pcx && p.cy === pcy)?.key || 'right';
            startLink(`tb:${tb.id}`, tb.x + pcx, tb.y + pcy, `t:${pk}`, ev);
          })
          .on('drag', dragLink)
          .on('end', () => { endLink(); tbPorts.attr('opacity', 0); });
        tbPorts.selectAll('circle.port').call(tbPortDrag as any);

        // Drag to move (on background rect, not on ports/resize/text). Supports multi-drag
        // when this text box is part of selectedIds (moves all selected tiles + text boxes).
        g.select('rect').style('cursor', moveRef.current ? 'grab' : 'default');
        g.call((() => {
          let prev: [number, number] | null = null;
          let multi = false;
          let mTiles: CanvasNode[] = [];
          let mTbs: CanvasTextBox[] = [];
          return d3.drag<SVGGElement, unknown>()
            .filter((ev) => {
              const el = ev.target as SVGElement | HTMLElement;
              if (el.classList?.contains('port')) return false;
              if (el.classList?.contains('tb-resize')) return false;
              if ((el as HTMLElement)?.getAttribute?.('contenteditable')) return false;
              return moveRef.current;
            })
            .on('start', (ev) => {
              prev = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
              const sel = selectedIdsRef.current;
              const tbId = `tb:${tb.id}`;
              multi = sel.length > 1 && sel.includes(tbId);
              if (multi) {
                const idSet = new Set(sel);
                mTiles = nodes.filter((n) => idSet.has(n.id));
                mTbs = textBoxes.filter((t) => idSet.has(`tb:${t.id}`));
                onSelectionChangeRef.current?.(sel, null); // hide menu during drag
              } else {
                mTiles = []; mTbs = [];
              }
            })
            .on('drag', (ev) => {
              const cur = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
              if (!prev) { prev = cur; return; }
              const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
              prev = cur;
              if (multi) {
                for (const n of mTiles) { n.x += dx; n.y += dy; }
                for (const t of mTbs) { t.x += dx; t.y += dy; }
                const tIdSet = new Set(mTiles.map((n) => n.id));
                nodeGrps.filter((dd: any) => tIdSet.has(dd.id))
                  .attr('transform', (dd: any) => `translate(${dd.x},${dd.y})`);
                const tbIdSet = new Set(mTbs.map((t) => t.id));
                tbG.selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
                  const id = (this as SVGGElement).getAttribute('data-tb-id');
                  if (!id || !tbIdSet.has(id)) return;
                  const t = mTbs.find((tt) => tt.id === id);
                  if (t) d3.select(this).attr('transform', `translate(${t.x},${t.y})`);
                });
              } else {
                tb.x += dx; tb.y += dy;
                g.attr('transform', `translate(${tb.x},${tb.y})`);
              }
              drawEdges();
            })
            .on('end', () => {
              prev = null;
              if (multi) {
                onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
                for (const t of mTbs) {
                  onUpdateTextBoxRef.current(t.id, { x: t.x, y: t.y });
                }
                onSelectionChangeRef.current?.(selectedIdsRef.current, computeSelectionScreenBbox());
              } else {
                if (tb.type === 'text') {
                  // Latest HTML is kept in tb.content.html by TextEditor's onChange.
                  onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, content: { html: tb.content.html ?? '' } });
                } else {
                  onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y });
                }
              }
              multi = false; mTiles = []; mTbs = [];
            });
        })() as any);

        // Resize handles on edges (not on ports)
        const RESIZE_W = 6;
        const resizeEdges = [
          { key: 'right', x: tw - RESIZE_W / 2, y: PORT_R + 4, w: RESIZE_W, h: th - PORT_R * 2 - 8, cursor: 'ew-resize' },
          { key: 'bottom', x: PORT_R + 4, y: th - RESIZE_W / 2, w: tw - PORT_R * 2 - 8, h: RESIZE_W, cursor: 'ns-resize' },
          { key: 'left', x: -RESIZE_W / 2, y: PORT_R + 4, w: RESIZE_W, h: th - PORT_R * 2 - 8, cursor: 'ew-resize' },
          { key: 'top', x: PORT_R + 4, y: -RESIZE_W / 2, w: tw - PORT_R * 2 - 8, h: RESIZE_W, cursor: 'ns-resize' },
        ];
        resizeEdges.forEach(({ key: rk, x: rx, y: ry, w: rw, h: rh, cursor }) => {
          const handle = g.append('rect')
            .attr('class', 'tb-resize')
            .attr('x', rx).attr('y', ry).attr('width', rw).attr('height', rh)
            .attr('fill', 'transparent').style('cursor', cursor);

          let resizeStart: { mx: number; my: number; ow: number; oh: number; ox: number; oy: number } | null = null;

          handle.call(d3.drag<SVGRectElement, unknown>()
            .on('start', (ev) => {
              ev.sourceEvent.stopPropagation();
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              resizeStart = { mx, my, ow: tb.w, oh: tb.h, ox: tb.x, oy: tb.y };
            })
            .on('drag', (ev) => {
              if (!resizeStart) return;
              const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
              const dx = mx - resizeStart.mx, dy = my - resizeStart.my;
              if (rk === 'right') {
                tb.w = Math.max(TB_MIN_W, resizeStart.ow + dx);
              } else if (rk === 'bottom') {
                tb.h = Math.max(TB_MIN_H, resizeStart.oh + dy);
              } else if (rk === 'left') {
                const newW = Math.max(TB_MIN_W, resizeStart.ow - dx);
                tb.x = resizeStart.ox + resizeStart.ow - newW;
                tb.w = newW;
              } else if (rk === 'top') {
                const newH = Math.max(TB_MIN_H, resizeStart.oh - dy);
                tb.y = resizeStart.oy + resizeStart.oh - newH;
                tb.h = newH;
              }
              // Redraw this text box
              drawTextBoxes();
              drawEdges();
            })
            .on('end', () => {
              resizeStart = null;
              if (tb.type === 'text') {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h, content: { html: tb.content.html ?? '' } });
              } else {
                onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h });
              }
            }) as any);
        });

        // Corner resize (bottom-right)
        const cornerHandle = g.append('rect')
          .attr('class', 'tb-resize')
          .attr('x', tw - 8).attr('y', th - 8).attr('width', 8).attr('height', 8)
          .attr('fill', 'transparent').style('cursor', 'nwse-resize');

        let cornerStart: { mx: number; my: number; ow: number; oh: number; aspect: number } | null = null;
        cornerHandle.call(d3.drag<SVGRectElement, unknown>()
          .on('start', (ev) => {
            ev.sourceEvent.stopPropagation();
            const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
            let aspect = tb.w / tb.h;
            if (tb.type === 'image') {
              // Read the picture's natural aspect ratio from the rendered <img>.
              // This way a box that was previously stretched via edge handles
              // snaps back to the picture's true proportions on corner drag.
              const imgEl = (g.node() as SVGGElement | null)?.querySelector('img') as HTMLImageElement | null;
              if (imgEl && imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0) {
                aspect = imgEl.naturalWidth / imgEl.naturalHeight;
              }
              // Snap the box to the natural aspect immediately, anchoring on
              // current width so the visible size doesn't jump dramatically.
              tb.h = Math.max(TB_MIN_H, tb.w / aspect);
              drawTextBoxes();
              drawEdges();
            }
            cornerStart = { mx, my, ow: tb.w, oh: tb.h, aspect };
          })
          .on('drag', (ev) => {
            if (!cornerStart) return;
            const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
            const dx = mx - cornerStart.mx;
            const dy = my - cornerStart.my;
            if (tb.type === 'image') {
              // Uniform scale preserves the (now-snapped) natural aspect ratio.
              const scale = Math.max(
                (cornerStart.ow + dx) / cornerStart.ow,
                (cornerStart.oh + dy) / cornerStart.oh,
              );
              tb.w = Math.max(TB_MIN_W, cornerStart.ow * scale);
              tb.h = Math.max(TB_MIN_H, cornerStart.oh * scale);
            } else {
              tb.w = Math.max(TB_MIN_W, cornerStart.ow + dx);
              tb.h = Math.max(TB_MIN_H, cornerStart.oh + dy);
            }
            drawTextBoxes();
            drawEdges();
          })
          .on('end', () => {
            cornerStart = null;
            if (tb.type === 'text') {
              onUpdateTextBoxRef.current(tb.id, { w: tb.w, h: tb.h, content: { html: tb.content.html ?? '' } });
            } else {
              onUpdateTextBoxRef.current(tb.id, { w: tb.w, h: tb.h });
            }
          }) as any);

        // Context menu
        g.on('contextmenu', (ev: MouseEvent) => {
          ev.preventDefault(); ev.stopPropagation();
          onTextBoxContextMenuRef.current({ x: ev.clientX, y: ev.clientY, textBoxId: tb.id });
        });
      });
    };
    drawTextBoxes();

    // Drag on background to draw a new box in text/image mode. The same dashed
    // outline is reused for both modes; the mode active at mouseup decides
    // whether to insert a text box or open a file picker for an image box.
    const tbDrawRect = board.append('rect')
      .attr('fill', theme.surface).attr('fill-opacity', 0.6).attr('stroke', theme.accent).attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,3').attr('opacity', 0);
    let tbStart: [number, number] | null = null;
    let tbStartMode: 'text' | 'image' | null = null;

    d3svg.on('mousedown.tb', (e: MouseEvent) => {
      const isTxt = textModeRef.current;
      const isImg = imageModeRef.current;
      if ((!isTxt && !isImg) || e.button !== 0 || e.target !== svg) return;
      e.preventDefault();
      const [mx, my] = d3.pointer(e, boardNode);
      tbStart = [mx, my];
      tbStartMode = isTxt ? 'text' : 'image';
      tbDrawRect.attr('x', mx).attr('y', my).attr('width', 0).attr('height', 0).attr('opacity', 1);
    });
    d3svg.on('mousemove.tb', (e: MouseEvent) => {
      if (!tbStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      tbDrawRect
        .attr('x', Math.min(tbStart[0], mx)).attr('y', Math.min(tbStart[1], my))
        .attr('width', Math.abs(mx - tbStart[0])).attr('height', Math.abs(my - tbStart[1]));
    });
    d3svg.on('mouseup.tb', (e: MouseEvent) => {
      if (!tbStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const x = Math.min(tbStart[0], mx);
      const y = Math.min(tbStart[1], my);
      const w = Math.abs(mx - tbStart[0]);
      const h = Math.abs(my - tbStart[1]);
      const mode = tbStartMode;
      tbStart = null;
      tbStartMode = null;
      tbDrawRect.attr('opacity', 0);
      if (w < 30 || h < 20) return;
      if (mode === 'text') {
        onAddTextBoxRef.current(x, y, w, h);
      } else if (mode === 'image') {
        // Open file picker; on selection the parent uploads + inserts at (x,y,w,h).
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (file && onAddImageBoxRef.current) onAddImageBoxRef.current(file, x, y, w, h);
        };
        input.click();
      }
    });

    // Click on background to place a new tile
    d3svg.on('click.tile', (ev: MouseEvent) => {
      if (!tileModeRef.current) return;
      if (ev.target !== svg) return;
      const [mx, my] = d3.pointer(ev, boardNode);
      onAddTileAtRef.current(mx, my);
    });

    drawGroups();
    nodesG.raise();
    tbG.raise();
    tempLine.raise();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, edges, groups, textBoxes, buildNodes, getColor, hitTest, tilesWithFlows, theme]);

  useEffect(() => { render(); }, [render]);

  // Toggle the per-item selection ring (tiles + text boxes) without rebuilding the SVG.
  // Also refreshes connected-edge highlights.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ids = new Set(selectedIds || []);
    d3.select(svg).selectAll<SVGGElement, CanvasNode>('g.tile-node').each(function (d) {
      d3.select(this).select('.sel-ring').attr('opacity', ids.has(d.id) ? 1 : 0);
    });
    d3.select(svg).selectAll<SVGGElement, unknown>('g.tb-node').each(function () {
      const id = (this as SVGGElement).getAttribute('data-tb-id');
      d3.select(this).select('.sel-ring').attr('opacity', id && ids.has(`tb:${id}`) ? 1 : 0);
    });
    // Edges between two selected items
    d3.select(svg).selectAll<SVGGElement, unknown>('g.edge-node').each(function () {
      const el = this as SVGGElement;
      const src = el.getAttribute('data-source');
      const tgt = el.getAttribute('data-target');
      const isSel = !!(src && tgt && ids.has(src) && ids.has(tgt) && ids.size >= 2);
      d3.select(el).select('line.edge-visible').attr('stroke', isSel ? theme.accent : theme.border).attr('stroke-width', isSel ? 2.5 : 1.5);
    });
  }, [selectedIds, theme.accent, theme.border]);

  useEffect(() => {
    if (!fitTrigger) return;
    const svg = svgRef.current, z = zoomRef.current, ns = nodesRef.current;
    if (!svg || !z || !ns.length) return;
    const { width: w, height: h } = svg.getBoundingClientRect();
    const [x1, x2] = [Math.min(...ns.map((n) => n.x)), Math.max(...ns.map((n) => n.x)) + TILE_W];
    const [y1, y2] = [Math.min(...ns.map((n) => n.y)), Math.max(...ns.map((n) => n.y)) + TILE_H];
    const s = Math.min((w - 80) / (x2 - x1), (h - 80) / (y2 - y1), 1.5);
    d3.select(svg).transition().duration(300).call(z.transform as any, d3.zoomIdentity.translate((w - (x2 - x1) * s) / 2 - x1 * s, (h - (y2 - y1) * s) / 2 - y1 * s).scale(s));
  }, [fitTrigger]);

  // Zoom to 100% (1:1)
  useEffect(() => {
    if (!zoom100Trigger) return;
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z) return;
    const { width: w, height: h } = svg.getBoundingClientRect();
    const t = zoomTransformRef.current;
    // Zoom to scale=1, keeping center of viewport
    const cx = w / 2, cy = h / 2;
    const newT = d3.zoomIdentity.translate(cx - (cx - t.x) / t.k, cy - (cy - t.y) / t.k).scale(1);
    d3.select(svg).transition().duration(300).call(z.transform as any, newT);
  }, [zoom100Trigger]);

  return (
    <div className="relative w-full h-full" style={{ background: theme.bg1 }}>
      <svg ref={svgRef} className="absolute inset-0 w-full h-full" />
      {/* HTML overlay: hosts TipTap editors as positioned divs OUTSIDE the SVG.
          A single inner wrapper takes the SVG's pan/zoom transform, so editors
          stay aligned with their D3-drawn box frames. Editors live in the React
          tree (no D3 mount/unmount), so TipTap state survives box redraws. */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden">
        <div ref={overlayInnerRef} style={{ transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
          {textBoxes.filter((b) => b.type === 'text').map((tb) => (
            <div
              key={tb.id}
              data-box-id={tb.id}
              className="absolute pointer-events-auto"
              style={{
                left: tb.x + TB_PAD,
                top: tb.y + TB_PAD,
                width: tb.w - 2 * TB_PAD,
                height: tb.h - 2 * TB_PAD,
              }}
            >
              <TextEditor
                initialHtml={(tb as { type: 'text'; content: { html: string } }).content.html}
                onChange={(html) => {
                  // Keep local box in sync so D3 drag-end save uses the latest HTML.
                  if (tb.type === 'text') tb.content = { html };
                  const prev = editorSaveTimersRef.current.get(tb.id);
                  if (prev) clearTimeout(prev);
                  const t = setTimeout(() => {
                    onUpdateTextBoxRef.current(tb.id, { content: { html } });
                    editorSaveTimersRef.current.delete(tb.id);
                  }, 600);
                  editorSaveTimersRef.current.set(tb.id, t);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
