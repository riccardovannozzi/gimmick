'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Tile } from '@/types';
import { useActionColors, useActionBorders, type BorderStyle } from '@/store/action-colors-store';
import { usePatterns } from '@/store/patterns-store';
import { useStatusIcons } from '@/store/status-icons-store';
import * as TablerIcons from '@tabler/icons-react';

const TILE_W = 128;
const TILE_H = 79;
const TILE_GAP = 8;
const OFFSET_X = 24;
const OFFSET_Y = 24;
const PORT_R = 5;
const GROUP_PAD = 12;
const LABEL_H = 20;

export interface CanvasNode { id: string; title: string; actionType: string; patternShape?: string; statusIcon?: string; statusColor?: string; startAt?: string; endAt?: string; allDay?: boolean; x: number; y: number; }
export type PortKey = 'top' | 'right' | 'bottom' | 'left';
// port format: "top"|"right"|"bottom"|"left" for tile, "g:top"|"g:right"|"g:bottom"|"g:left" for group
export interface CanvasEdge { id: string; source_id: string; target_id: string; source_port?: string; target_port?: string; }
export interface CanvasGroup { id: string; label: string; nodeIds: string[]; }
export interface CanvasTextBox { id: string; content: string; x: number; y: number; w: number; h: number; }

const TB_MIN_W = 100;
const TB_MIN_H = 40;
const TB_FONT = 11;
const TB_LINE_H = 16;
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
  onUpdateTextBox: (id: string, updates: { content?: string; x?: number; y?: number; w?: number; h?: number }) => void;
  onTextBoxContextMenu: (e: { x: number; y: number; textBoxId: string }) => void;
  fitTrigger: number;
  resetTrigger: number;
  zoom100Trigger?: number;
}

export const CanvasBoard = React.memo(function CanvasBoard({
  tiles, layout, edges, groups, textBoxes,
  moveEnabled, linkEnabled, textMode, tileMode, onAddTileAt,
  onPositionChange, onAddEdge, onDeleteEdge,
  onEdgeContextMenu, onTileContextMenu, onTileClick,
  onGroupsChange, onAddTextBox, onUpdateTextBox, onTextBoxContextMenu,
  fitTrigger, resetTrigger, zoom100Trigger,
}: CanvasBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<CanvasNode[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const actionColors = useActionColors();
  const actionBorders = useActionBorders();
  const { customPatterns, doneShape, getActionTypeShape } = usePatterns();
  const statusIcons = useStatusIcons((s) => s.icons);
  const statusTileIcons = useStatusIcons((s) => s.tileIcons);
  const moveRef = useRef(moveEnabled); moveRef.current = moveEnabled;
  const linkRef = useRef(linkEnabled); linkRef.current = linkEnabled;
  const textModeRef = useRef(textMode); textModeRef.current = textMode;
  const tileModeRef = useRef(tileMode); tileModeRef.current = tileMode;

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

  // Link drag state
  const linkSrc = useRef<{ id: string; px: number; py: number; port: string } | null>(null);
  const dropTarget = useRef<{ nodeId: string; groupId?: string; port?: string } | null>(null);

  const getColor = useCallback((at: string) => (actionColors as Record<string, string>)[at] || actionColors.none || '#888780', [actionColors]);

  const buildNodes = useCallback((): CanvasNode[] => {
    const pm = new Map(layout.map((p) => [p.tile_id, p]));
    // Use current in-memory positions if available (from drag), fallback to layout cache
    const currentPosMap = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));
    return tiles.map((t, i) => {
      const cur = currentPosMap.get(t.id);
      const s = pm.get(t.id);
      const x = cur?.x ?? s?.x ?? OFFSET_X;
      const y = cur?.y ?? s?.y ?? (OFFSET_Y + i * (TILE_H + TILE_GAP));
      // Resolve pattern shape
      let shape = 'solid';
      if (t.pattern_id) {
        const cp = customPatterns.find((p) => p.id === t.pattern_id);
        if (cp) shape = cp.shape;
      } else if (t.is_completed) {
        shape = doneShape;
      } else {
        shape = getActionTypeShape(t.action_type || 'none');
      }
      // Status icon
      const siId = statusTileIcons[t.id];
      const si = siId ? statusIcons.find((ic) => ic.id === siId) : null;
      return { id: t.id, title: t.title || 'Senza titolo', actionType: t.action_type || 'none', patternShape: shape, statusIcon: si?.icon, statusColor: si?.color, startAt: t.start_at, endAt: t.end_at, allDay: t.all_day, x, y };
    });
  }, [tiles, layout, customPatterns, doneShape, getActionTypeShape, statusIcons, statusTileIcons]);

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

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .filter((ev) => {
        if ((textModeRef.current || tileModeRef.current) && ev.type === 'mousedown') return false; // block pan in text/tile mode
        return ev.type === 'wheel' || ev.type?.startsWith('touch') || (ev.type === 'mousedown' && ev.button === 0 && !ev.shiftKey && ev.target === svg);
      })
      .on('zoom', (ev) => { zoomTransformRef.current = ev.transform; board.attr('transform', ev.transform); });
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

    // ── Selection rect (shift+drag) ──
    const selRect = board.append('rect').attr('fill', 'rgba(59,130,246,0.1)').attr('stroke', '#3B82F6').attr('stroke-width', 1).attr('stroke-dasharray', '4,3').attr('rx', 4).attr('opacity', 0);
    let selStart: [number, number] | null = null;
    d3svg.on('mousedown.sel', (e: MouseEvent) => { if (!e.shiftKey || e.button || e.target !== svg) return; e.preventDefault(); selStart = d3.pointer(e, boardNode) as [number, number]; selRect.attr('x', selStart[0]).attr('y', selStart[1]).attr('width', 0).attr('height', 0).attr('opacity', 1); });
    d3svg.on('mousemove.sel', (e: MouseEvent) => { if (!selStart) return; const [mx, my] = d3.pointer(e, boardNode); selRect.attr('x', Math.min(selStart[0], mx)).attr('y', Math.min(selStart[1], my)).attr('width', Math.abs(mx - selStart[0])).attr('height', Math.abs(my - selStart[1])); });
    d3svg.on('mouseup.sel', (e: MouseEvent) => {
      if (!selStart) return;
      const [mx, my] = d3.pointer(e, boardNode);
      const [x1, y1] = [Math.min(selStart[0], mx), Math.min(selStart[1], my)];
      const [x2, y2] = [Math.max(selStart[0], mx), Math.max(selStart[1], my)];
      selStart = null; selRect.attr('opacity', 0);
      if (x2 - x1 < 20 || y2 - y1 < 20) return;
      const inside = nodes.filter((n) => n.x >= x1 && n.x + TILE_W <= x2 && n.y >= y1 && n.y + TILE_H <= y2);
      if (inside.length < 2) return;
      const ids = inside.map((n) => n.id);
      let ng = groupsRef.current.map((g) => ({ ...g, nodeIds: g.nodeIds.filter((id) => !ids.includes(id)) })).filter((g) => g.nodeIds.length >= 2);
      ng.push({ id: `grp-${Date.now()}`, label: '', nodeIds: ids });
      onGroupsChangeRef.current(ng);
    });

    // ── Temp line for link drag ──
    const tempLine = board.append('line').attr('stroke', '#3B82F6').attr('stroke-width', 2).attr('stroke-dasharray', '6,3').attr('opacity', 0);

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
      nodeGrps.each(function (d: any) { d3.select(this).select('.tile-bg').attr('stroke', getColor(d.actionType) + '60').attr('stroke-width', 1); });
      groupsBg.selectAll('rect').attr('stroke', '#3B82F650').attr('stroke-width', 1);
      // Highlight target
      if (dropTarget.current) {
        if (dropTarget.current.groupId) {
          groupsBg.selectAll('g').each(function (_, i) {
            const grp = groupsRef.current[i];
            if (grp && grp.id === dropTarget.current!.groupId) {
              d3.select(this as SVGGElement).select('rect').attr('stroke', '#3B82F6').attr('stroke-width', 2.5);
            }
          });
        } else {
          nodeGrps.filter((d: any) => d.id === dropTarget.current!.nodeId).select('.tile-bg').attr('stroke', '#3B82F6').attr('stroke-width', 2.5);
        }
      }
    };
    const endLink = () => {
      tempLine.attr('opacity', 0);
      nodeGrps.each(function (d: any) { d3.select(this).select('.tile-bg').attr('stroke', getColor(d.actionType) + '60').attr('stroke-width', 1); });
      groupsBg.selectAll('rect').attr('stroke', '#3B82F650').attr('stroke-width', 1);
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
        gw.append('rect').attr('x', b.x).attr('y', b.y - LABEL_H).attr('width', b.w).attr('height', b.h + LABEL_H).attr('rx', 8)
          .attr('fill', 'rgba(59,130,246,0.04)').attr('stroke', '#3B82F650').attr('stroke-width', 1).attr('stroke-dasharray', '6,4')
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
        gw.append('text').attr('x', b.x + 8).attr('y', b.y - LABEL_H + 14).attr('fill', '#71717A').attr('font-size', 11).attr('font-weight', 500)
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
          const pc = gw.append('circle').attr('cx', cx).attr('cy', cy).attr('r', PORT_R + 1).attr('fill', '#3B82F6').attr('stroke', '#1C1C1E').attr('stroke-width', 2).attr('opacity', 0).style('pointer-events', 'none');
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

        const sColor = s ? getColor(s.actionType) : '#3F3F46';
        const tColor = t ? getColor(t.actionType) : '#3F3F46';
        const g = edgesG.append('g');
        g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', 'transparent').attr('stroke-width', 12).style('cursor', 'pointer');
        const vl = g.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2).attr('stroke', '#444').attr('stroke-width', 1.5).attr('stroke-dasharray', '4,3').style('pointer-events', 'none');
        // Anchor dots at port positions
        g.append('circle').attr('cx', x1).attr('cy', y1).attr('r', 3).attr('fill', sColor).style('pointer-events', 'none');
        g.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 3).attr('fill', tColor).style('pointer-events', 'none');
        g.on('mouseenter', () => vl.attr('stroke', '#EF4444').attr('stroke-width', 2.5)).on('mouseleave', () => vl.attr('stroke', '#444').attr('stroke-width', 1.5));
        g.on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEdgeContextMenuRef.current({ x: ev.clientX, y: ev.clientY, edgeId: edge.id }); });
      });
    };
    drawEdges();

    // ── Nodes ──
    const nodesG = board.append('g');
    const nodeGrps = nodesG.selectAll('g').data(nodes, (d: any) => d.id).enter().append('g').attr('transform', (d) => `translate(${d.x},${d.y})`);
    // Apply border style per action type
    const getBorderAttrs = (at: string): { sw: number; sd: string } => {
      const bs = (actionBorders as Record<string, string>)[at] as BorderStyle || 'solid';
      switch (bs) {
        case 'solid': return { sw: 1, sd: '' };
        case 'dashed': return { sw: 1.5, sd: '6,3' };
        case 'dotted': return { sw: 1.5, sd: '2,3' };
        case 'thick': return { sw: 3, sd: '' };
        case 'double': return { sw: 3, sd: '' };
        case 'none': return { sw: 0, sd: '' };
        default: return { sw: 1, sd: '' };
      }
    };
    nodeGrps.append('rect').attr('class', 'tile-bg').attr('width', TILE_W).attr('height', TILE_H).attr('rx', 4)
      .attr('fill', (d) => d.statusColor ? d.statusColor + '80' : '#1C1C1E')
      .attr('stroke', (d) => getColor(d.actionType))
      .attr('stroke-width', (d) => getBorderAttrs(d.actionType).sw)
      .attr('stroke-dasharray', (d) => getBorderAttrs(d.actionType).sd)
      .style('cursor', moveRef.current ? 'grab' : 'default');
    // Double border: add inner rect
    nodeGrps.each(function (d) {
      const bs = (actionBorders as Record<string, string>)[d.actionType] as BorderStyle;
      if (bs === 'double') {
        d3.select(this).append('rect').attr('class', 'tile-inner-border')
          .attr('x', 4).attr('y', 4).attr('width', TILE_W - 8).attr('height', TILE_H - 8).attr('rx', 3)
          .attr('fill', 'none').attr('stroke', getColor(d.actionType)).attr('stroke-width', 1)
          .style('pointer-events', 'none');
      }
    });
    // Pattern overlay
    let patIdx = 0;
    nodeGrps.each(function (d) {
      if (!d.patternShape || d.patternShape === 'solid') return;
      const g = d3.select(this);
      const color = getColor(d.actionType);
      const o = 0.2;
      const pid = `cpat-${patIdx++}`;
      const clip = g.append('clipPath').attr('id', `${pid}-clip`);
      clip.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('rx', 4);
      const pg = g.append('g').attr('clip-path', `url(#${pid}-clip)`).style('pointer-events', 'none');
      switch (d.patternShape) {
        case 'diagonal_ltr':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 10).attr('height', 10).attr('patternTransform', 'rotate(60)')
            .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 10).attr('stroke', color).attr('stroke-width', 5).attr('stroke-opacity', o);
          pg.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('fill', `url(#${pid})`);
          break;
        case 'diagonal_rtl':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 10).attr('height', 10).attr('patternTransform', 'rotate(-60)')
            .append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 10).attr('stroke', color).attr('stroke-width', 5).attr('stroke-opacity', o);
          pg.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('fill', `url(#${pid})`);
          break;
        case 'vertical':
          pg.append('defs').append('pattern').attr('id', pid).attr('patternUnits', 'userSpaceOnUse').attr('width', 16).attr('height', 20)
            .append('line').attr('x1', 8).attr('y1', 0).attr('x2', 8).attr('y2', 20).attr('stroke', color).attr('stroke-width', 6).attr('stroke-opacity', o);
          pg.append('rect').attr('width', TILE_W).attr('height', TILE_H).attr('fill', `url(#${pid})`);
          break;
        case 'bubble':
          pg.append('circle').attr('cx', 18).attr('cy', 14).attr('r', 8).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-opacity', o);
          pg.append('circle').attr('cx', 58).attr('cy', 10).attr('r', 5).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-opacity', o);
          pg.append('circle').attr('cx', 40).attr('cy', 30).attr('r', 11).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-opacity', o);
          pg.append('circle').attr('cx', TILE_W - 20).attr('cy', TILE_H - 15).attr('r', 9).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).attr('stroke-opacity', o);
          break;
        case 'cross':
          pg.append('line').attr('x1', 0).attr('y1', 0).attr('x2', TILE_W).attr('y2', TILE_H).attr('stroke', color).attr('stroke-width', 8).attr('stroke-opacity', o * 0.7).attr('stroke-linecap', 'round');
          pg.append('line').attr('x1', TILE_W).attr('y1', 0).attr('x2', 0).attr('y2', TILE_H).attr('stroke', color).attr('stroke-width', 8).attr('stroke-opacity', o * 0.7).attr('stroke-linecap', 'round');
          break;
      }
    });
    nodeGrps.each(function (d) {
      const g = d3.select(this);
      const fo = g.append('foreignObject').attr('x', 6).attr('y', 6).attr('width', TILE_W - 12).attr('height', TILE_H - 26);
      fo.append('xhtml:div')
        .attr('style', 'color:#D4D4D8;font-size:11px;font-weight:500;line-height:14px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word;pointer-events:none;')
        .text(d.title);
    });
    // Footer: date info + type label + status icon
    const typeLabels: Record<string, string> = { none: 'NOTES', anytime: 'TO DO', deadline: 'DEADLINE', event: 'TIMED', allday: 'ALL DAY' };
    const formatDate = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }); };
    const formatTime = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

    nodeGrps.each(function (d) {
      const g = d3.select(this);
      const hasDate = d.actionType === 'deadline' || d.actionType === 'event' || d.actionType === 'allday';
      if (hasDate && (d.startAt || d.endAt)) {
        let dateStr = '';
        if (d.actionType === 'deadline' && d.endAt) {
          dateStr = formatDate(d.endAt);
        } else if (d.allDay && d.startAt) {
          dateStr = formatDate(d.startAt);
        } else if (d.startAt) {
          dateStr = `${formatDate(d.startAt)} ${formatTime(d.startAt)}`;
          if (d.endAt) dateStr += ` - ${formatTime(d.endAt)}`;
        }
        if (dateStr) {
          g.append('text').attr('x', 6).attr('y', TILE_H - 19).attr('fill', '#71717A').attr('font-size', 10).text(dateStr);
        }
      }
    });
    nodeGrps.append('text').attr('x', 6).attr('y', TILE_H - 6).attr('fill', '#71717A').attr('font-size', 9).text((d) => typeLabels[d.actionType] || d.actionType.toUpperCase());
    // Status icon as SVG directly (no React rendering needed)
    nodeGrps.each(function (d) {
      if (!d.statusIcon) return;
      const g = d3.select(this);
      // Render a placeholder icon using a foreignObject + innerHTML from a temporary DOM element
      const IconComp = (TablerIcons as unknown as Record<string, any>)[d.statusIcon];
      if (!IconComp) return;
      // Create a temporary container, use React createElement + renderToString
      const React = require('react');
      const { renderToString } = require('react-dom/server');
      const html = renderToString(React.createElement(IconComp, { size: 20, color: '#FFFFFF' }));
      const fo = g.append('foreignObject').attr('x', TILE_W - 26).attr('y', TILE_H - 24).attr('width', 20).attr('height', 20).style('pointer-events', 'none');
      const container = document.createElement('div');
      container.style.cssText = 'display:flex;align-items:center;justify-content:center;width:20px;height:20px;';
      container.innerHTML = html;
      (fo.node() as SVGForeignObjectElement)?.appendChild(container);
    });

    // Tile ports
    const portG = nodeGrps.append('g').attr('class', 'ports').attr('opacity', 0);
    PORTS.forEach(({ cx, cy }) => { portG.append('circle').attr('class', 'port').attr('cx', cx).attr('cy', cy).attr('r', PORT_R).attr('fill', '#3B82F6').attr('stroke', '#1C1C1E').attr('stroke-width', 2).style('cursor', 'crosshair'); });
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

    // Node drag
    nodeGrps.call(d3.drag<SVGGElement, CanvasNode>()
      .filter((ev) => !(ev.target as SVGElement).classList?.contains('port') && moveRef.current)
      .on('start', function () {})
      .on('drag', function (ev, d) { d3.select(this).raise(); d.x = ev.x; d.y = ev.y; d3.select(this).attr('transform', `translate(${d.x},${d.y})`); drawEdges(); drawGroups(); })
      .on('end', (_, d) => {
        onPositionChangeRef.current(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
        // Check if tile was dropped inside a group it doesn't belong to → add it
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

    // Click / context on tiles
    nodeGrps.on('click.sel', (ev: MouseEvent, d: CanvasNode) => { ev.stopPropagation(); onTileClickRef.current(d.id); });
    nodeGrps.on('contextmenu.ctx', (ev: MouseEvent, d: CanvasNode) => { ev.preventDefault(); ev.stopPropagation(); onTileContextMenuRef.current({ x: ev.clientX, y: ev.clientY, tileId: d.id, inGroup: groupsRef.current.some((g) => g.nodeIds.includes(d.id)) }); });

    // ── Text boxes ──
    const tbG = board.append('g').attr('class', 'textboxes');

    const drawTextBoxes = () => {
      tbG.selectAll('*').remove();
      textBoxes.forEach((tb) => {
        const tw = tb.w, th = tb.h;
        const g = tbG.append('g').attr('transform', `translate(${tb.x},${tb.y})`).attr('class', 'tb-node');

        // Background
        g.append('rect')
          .attr('width', tw).attr('height', th).attr('rx', 6)
          .attr('fill', '#0C0C0E').attr('stroke', '#3F3F46').attr('stroke-width', 0.5);

        // Text editing via foreignObject
        const fo = g.append('foreignObject')
          .attr('x', TB_PAD).attr('y', TB_PAD)
          .attr('width', tw - TB_PAD * 2).attr('height', th - TB_PAD * 2)
          .style('pointer-events', 'none').style('cursor', 'grab');

        const div = fo.append('xhtml:div')
          .attr('contenteditable', 'false')
          .attr('style', `color:#A1A1AA;font-size:${TB_FONT}px;line-height:${TB_LINE_H}px;outline:none;white-space:pre-wrap;word-break:break-word;overflow:auto;width:100%;height:100%;pointer-events:none;user-select:none;cursor:grab;`)
          .text(tb.content || '');

        const divEl = div.node() as HTMLElement;

        // Click to enter edit mode
        g.on('click.edit', (ev: MouseEvent) => {
          ev.stopPropagation();
          if (!divEl) return;
          divEl.setAttribute('contenteditable', 'true');
          divEl.style.pointerEvents = 'auto';
          divEl.style.userSelect = 'auto';
          divEl.style.cursor = 'text';
          fo.style('pointer-events', 'auto').style('cursor', 'text');
          divEl.focus();
        });

        // Blur to exit edit mode
        if (divEl) {
          divEl.addEventListener('blur', () => {
            divEl.setAttribute('contenteditable', 'false');
            divEl.style.pointerEvents = 'none';
            divEl.style.userSelect = 'none';
            divEl.style.cursor = 'grab';
            fo.style('pointer-events', 'none').style('cursor', 'grab');
          });

          // Save on input
          let saveTimer: ReturnType<typeof setTimeout> | null = null;
          divEl.addEventListener('input', () => {
            const text = divEl.innerText || '';
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => onUpdateTextBoxRef.current(tb.id, { content: text }), 600);
          });

          // Stop propagation only when editing
          divEl.addEventListener('mousedown', (e) => {
            if (divEl.getAttribute('contenteditable') === 'true') {
              e.stopPropagation();
            }
          });
        }

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
            .attr('r', PORT_R).attr('fill', '#3B82F6').attr('stroke', '#1C1C1E').attr('stroke-width', 2)
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

        // Drag to move (on background rect, not on ports/resize/text)
        g.select('rect').style('cursor', moveRef.current ? 'grab' : 'default');
        g.call((() => {
          let prev: [number, number] | null = null;
          return d3.drag<SVGGElement, unknown>()
            .filter((ev) => {
              const el = ev.target as SVGElement | HTMLElement;
              if (el.classList?.contains('port')) return false;
              if (el.classList?.contains('tb-resize')) return false;
              if ((el as HTMLElement)?.getAttribute?.('contenteditable')) return false;
              return moveRef.current;
            })
            .on('start', (ev) => { prev = d3.pointer(ev.sourceEvent, boardNode) as [number, number]; })
            .on('drag', (ev) => {
              const cur = d3.pointer(ev.sourceEvent, boardNode) as [number, number];
              if (!prev) { prev = cur; return; }
              tb.x += cur[0] - prev[0]; tb.y += cur[1] - prev[1];
              prev = cur;
              g.attr('transform', `translate(${tb.x},${tb.y})`);
              drawEdges();
            })
            .on('end', () => { prev = null; onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y }); });
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
              onUpdateTextBoxRef.current(tb.id, { x: tb.x, y: tb.y, w: tb.w, h: tb.h });
            }) as any);
        });

        // Corner resize (bottom-right)
        const cornerHandle = g.append('rect')
          .attr('class', 'tb-resize')
          .attr('x', tw - 8).attr('y', th - 8).attr('width', 8).attr('height', 8)
          .attr('fill', 'transparent').style('cursor', 'nwse-resize');

        let cornerStart: { mx: number; my: number; ow: number; oh: number } | null = null;
        cornerHandle.call(d3.drag<SVGRectElement, unknown>()
          .on('start', (ev) => {
            ev.sourceEvent.stopPropagation();
            const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
            cornerStart = { mx, my, ow: tb.w, oh: tb.h };
          })
          .on('drag', (ev) => {
            if (!cornerStart) return;
            const [mx, my] = d3.pointer(ev.sourceEvent, boardNode);
            tb.w = Math.max(TB_MIN_W, cornerStart.ow + (mx - cornerStart.mx));
            tb.h = Math.max(TB_MIN_H, cornerStart.oh + (my - cornerStart.my));
            drawTextBoxes();
            drawEdges();
          })
          .on('end', () => {
            cornerStart = null;
            onUpdateTextBoxRef.current(tb.id, { w: tb.w, h: tb.h });
          }) as any);

        // Context menu
        g.on('contextmenu', (ev: MouseEvent) => {
          ev.preventDefault(); ev.stopPropagation();
          onTextBoxContextMenuRef.current({ x: ev.clientX, y: ev.clientY, textBoxId: tb.id });
        });
      });
    };
    drawTextBoxes();

    // Drag on background to draw text box in text mode
    const tbDrawRect = board.append('rect')
      .attr('fill', 'rgba(12,12,14,0.8)').attr('stroke', '#3F3F46').attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '4,3').attr('rx', 6).attr('opacity', 0);
    let tbStart: [number, number] | null = null;

    d3svg.on('mousedown.tb', (e: MouseEvent) => {
      if (!textModeRef.current || e.button !== 0 || e.target !== svg) return;
      e.preventDefault();
      const [mx, my] = d3.pointer(e, boardNode);
      tbStart = [mx, my];
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
      tbStart = null;
      tbDrawRect.attr('opacity', 0);
      if (w < 30 || h < 20) return;
      onAddTextBoxRef.current(x, y, w, h);
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
  }, [tiles, edges, groups, textBoxes, buildNodes, getColor, hitTest]);

  useEffect(() => { render(); }, [render]);

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

  useEffect(() => {
    if (!resetTrigger) return;
    onPositionChangeRef.current(tiles.map((t, i) => ({ tile_id: t.id, x: OFFSET_X, y: OFFSET_Y + i * (TILE_H + TILE_GAP) })));
    onGroupsChangeRef.current([]);
  }, [resetTrigger]);

  return <svg ref={svgRef} className="w-full h-full bg-zinc-950" />;
});
