'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { Tile } from '@/types';
import { useActionColors } from '@/store/action-colors-store';

const TILE_W = 148;
const TILE_H = 52;
const TILE_GAP = 8;
const OFFSET_X = 24;
const OFFSET_Y = 24;
const PORT_R = 5;
const GROUP_PAD = 12;
const LABEL_H = 20;

export interface CanvasNode { id: string; title: string; actionType: string; x: number; y: number; }
export type PortKey = 'top' | 'right' | 'bottom' | 'left';
// port format: "top"|"right"|"bottom"|"left" for tile, "g:top"|"g:right"|"g:bottom"|"g:left" for group
export interface CanvasEdge { id: string; source_id: string; target_id: string; source_port?: string; target_port?: string; }
export interface CanvasGroup { id: string; label: string; nodeIds: string[]; }
export interface CanvasTextBox { id: string; content: string; x: number; y: number; }

const TB_W = 200; // text box width
const TB_FONT = 11;
const TB_LINE_H = 16;
const TB_PAD = 8;
const TB_EXTRA_LINES = 2; // extra empty lines below text

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
  onPositionChange: (positions: { tile_id: string; x: number; y: number }[]) => void;
  onAddEdge: (source_id: string, target_id: string, source_port?: string, target_port?: string) => void;
  onDeleteEdge: (id: string) => void;
  onEdgeContextMenu: (e: { x: number; y: number; edgeId: string }) => void;
  onTileContextMenu: (e: { x: number; y: number; tileId: string; inGroup: boolean }) => void;
  onTileClick: (tileId: string) => void;
  onGroupsChange: (groups: CanvasGroup[]) => void;
  onAddTextBox: (x: number, y: number) => void;
  onUpdateTextBox: (id: string, updates: { content?: string; x?: number; y?: number }) => void;
  onTextBoxContextMenu: (e: { x: number; y: number; textBoxId: string }) => void;
  fitTrigger: number;
  resetTrigger: number;
}

export function CanvasBoard({
  tiles, layout, edges, groups, textBoxes,
  moveEnabled, linkEnabled, textMode,
  onPositionChange, onAddEdge, onDeleteEdge,
  onEdgeContextMenu, onTileContextMenu, onTileClick,
  onGroupsChange, onAddTextBox, onUpdateTextBox, onTextBoxContextMenu,
  fitTrigger, resetTrigger,
}: CanvasBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const actionColors = useActionColors();
  const moveRef = useRef(moveEnabled); moveRef.current = moveEnabled;
  const linkRef = useRef(linkEnabled); linkRef.current = linkEnabled;
  const textModeRef = useRef(textMode); textModeRef.current = textMode;

  // Link drag state
  const linkSrc = useRef<{ id: string; px: number; py: number; port: string } | null>(null);
  const dropTarget = useRef<{ nodeId: string; groupId?: string; port?: string } | null>(null);

  const getColor = useCallback((at: string) => (actionColors as Record<string, string>)[at] || actionColors.none || '#888780', [actionColors]);

  const buildNodes = useCallback((): CanvasNode[] => {
    const pm = new Map(layout.map((p) => [p.tile_id, p]));
    return tiles.map((t, i) => {
      const s = pm.get(t.id);
      return { id: t.id, title: t.title || 'Senza titolo', actionType: t.action_type || 'none', x: s?.x ?? OFFSET_X, y: s?.y ?? OFFSET_Y + i * (TILE_H + TILE_GAP) };
    });
  }, [tiles, layout]);

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
        const h = Math.max(TB_LINE_H * 3, ((tb.content || '').split('\n').length + TB_EXTRA_LINES) * TB_LINE_H + TB_PAD * 2);
        if (bx >= tb.x && bx <= tb.x + TB_W && by >= tb.y && by <= tb.y + h) {
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
      .filter((ev) => ev.type === 'wheel' || ev.type?.startsWith('touch') || (ev.type === 'mousedown' && ev.button === 0 && !ev.shiftKey && ev.target === svg))
      .on('zoom', (ev) => board.attr('transform', ev.transform));
    d3svg.call(zoom);
    zoomRef.current = zoom;

    const board = d3.select(svg).append('g');
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
      onGroupsChange(ng);
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
        onAddEdge(sid, dropTarget.current.nodeId, sp, dropTarget.current.port);
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
              .on('end', () => { prev = null; onPositionChange(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y }))); });
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
          const h = Math.max(TB_LINE_H * 3, ((tb.content || '').split('\n').length + TB_EXTRA_LINES) * TB_LINE_H + TB_PAD * 2);
          return [
            { x: tb.x + TB_W / 2, y: tb.y },
            { x: tb.x + TB_W, y: tb.y + h / 2 },
            { x: tb.x + TB_W / 2, y: tb.y + h },
            { x: tb.x, y: tb.y + h / 2 },
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
        g.on('contextmenu', (ev: MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEdgeContextMenu({ x: ev.clientX, y: ev.clientY, edgeId: edge.id }); });
      });
    };
    drawEdges();

    // ── Nodes ──
    const nodesG = board.append('g');
    const nodeGrps = nodesG.selectAll('g').data(nodes, (d: any) => d.id).enter().append('g').attr('transform', (d) => `translate(${d.x},${d.y})`);
    nodeGrps.append('rect').attr('class', 'tile-bg').attr('width', TILE_W).attr('height', TILE_H).attr('rx', 8).attr('fill', '#1C1C1E').attr('stroke', (d) => getColor(d.actionType) + '60').attr('stroke-width', 1);
    nodeGrps.append('rect').attr('width', 4).attr('height', TILE_H).attr('rx', 2).attr('fill', (d) => getColor(d.actionType));
    nodeGrps.append('text').attr('x', 12).attr('y', 22).attr('fill', '#D4D4D8').attr('font-size', 12).attr('font-weight', 500).text((d) => d.title.length > 16 ? d.title.slice(0, 15) + '…' : d.title);
    nodeGrps.append('text').attr('x', 12).attr('y', 38).attr('fill', '#71717A').attr('font-size', 10).text((d) => d.actionType);

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
      .on('start', function () { d3.select(this).raise(); })
      .on('drag', function (ev, d) { d.x = ev.x; d.y = ev.y; d3.select(this).attr('transform', `translate(${d.x},${d.y})`); drawEdges(); drawGroups(); })
      .on('end', () => onPositionChange(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })))));

    // Click / context on tiles
    nodeGrps.on('click.sel', (ev: MouseEvent, d: CanvasNode) => { ev.stopPropagation(); onTileClick(d.id); });
    nodeGrps.on('contextmenu.ctx', (ev: MouseEvent, d: CanvasNode) => { ev.preventDefault(); ev.stopPropagation(); onTileContextMenu({ x: ev.clientX, y: ev.clientY, tileId: d.id, inGroup: groupsRef.current.some((g) => g.nodeIds.includes(d.id)) }); });

    // ── Text boxes ──
    const tbG = board.append('g').attr('class', 'textboxes');

    const calcTbHeight = (content: string) => {
      const lines = (content || '').split('\n').length + TB_EXTRA_LINES;
      return Math.max(TB_LINE_H * 3, lines * TB_LINE_H + TB_PAD * 2);
    };

    const drawTextBoxes = () => {
      tbG.selectAll('*').remove();
      textBoxes.forEach((tb) => {
        const h = calcTbHeight(tb.content);
        const g = tbG.append('g').attr('transform', `translate(${tb.x},${tb.y})`).attr('class', 'tb-node');

        // Background
        g.append('rect')
          .attr('width', TB_W).attr('height', h).attr('rx', 6)
          .attr('fill', '#0C0C0E').attr('stroke', '#3F3F46').attr('stroke-width', 0.5);

        // Text editing via foreignObject
        const fo = g.append('foreignObject')
          .attr('x', TB_PAD).attr('y', TB_PAD)
          .attr('width', TB_W - TB_PAD * 2).attr('height', h - TB_PAD * 2);

        const div = fo.append('xhtml:div')
          .attr('contenteditable', 'true')
          .attr('style', `color:#A1A1AA;font-size:${TB_FONT}px;line-height:${TB_LINE_H}px;outline:none;white-space:pre-wrap;word-break:break-word;min-height:${TB_LINE_H}px;`)
          .text(tb.content || '');

        // Save on blur / input
        let saveTimer: ReturnType<typeof setTimeout> | null = null;
        (div.node() as HTMLElement)?.addEventListener('input', () => {
          const text = (div.node() as HTMLElement)?.innerText || '';
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => onUpdateTextBox(tb.id, { content: text }), 600);
          // Resize
          const newH = calcTbHeight(text);
          g.select('rect').attr('height', newH);
          fo.attr('height', newH - TB_PAD * 2);
        });

        // Stop propagation on text editing clicks
        (div.node() as HTMLElement)?.addEventListener('mousedown', (e) => e.stopPropagation());

        // 4 ports
        const tbPorts = g.append('g').attr('class', 'tb-ports').attr('opacity', 0);
        const tbPortList = [
          { key: 'top', cx: TB_W / 2, cy: 0 },
          { key: 'right', cx: TB_W, cy: h / 2 },
          { key: 'bottom', cx: TB_W / 2, cy: h },
          { key: 'left', cx: 0, cy: h / 2 },
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

        // Drag to move
        g.call(d3.drag<SVGGElement, unknown>()
          .filter((ev) => {
            if ((ev.target as SVGElement).classList?.contains('port')) return false;
            if ((ev.target as HTMLElement)?.getAttribute?.('contenteditable')) return false;
            return moveRef.current;
          })
          .on('drag', (ev) => {
            tb.x += ev.dx; tb.y += ev.dy;
            g.attr('transform', `translate(${tb.x},${tb.y})`);
            drawEdges();
          })
          .on('end', () => { onUpdateTextBox(tb.id, { x: tb.x, y: tb.y }); }) as any);

        // Context menu
        g.on('contextmenu', (ev: MouseEvent) => {
          ev.preventDefault(); ev.stopPropagation();
          onTextBoxContextMenu({ x: ev.clientX, y: ev.clientY, textBoxId: tb.id });
        });
      });
    };
    drawTextBoxes();

    // Click on background to create text box in text mode
    d3svg.on('click.tb', (ev: MouseEvent) => {
      if (!textModeRef.current) return;
      if (ev.target !== svg) return;
      const [mx, my] = d3.pointer(ev, boardNode);
      onAddTextBox(mx, my);
    });

    drawGroups();
    nodesG.raise();
    tbG.raise();
    tempLine.raise();
  }, [tiles, layout, edges, groups, textBoxes, buildNodes, getColor, onPositionChange, onAddEdge, onDeleteEdge, onEdgeContextMenu, onTileContextMenu, onTileClick, onGroupsChange, onAddTextBox, onUpdateTextBox, onTextBoxContextMenu, hitTest]);

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

  useEffect(() => {
    if (!resetTrigger) return;
    onPositionChange(tiles.map((t, i) => ({ tile_id: t.id, x: OFFSET_X, y: OFFSET_Y + i * (TILE_H + TILE_GAP) })));
    onGroupsChange([]);
  }, [resetTrigger]);

  return <svg ref={svgRef} className="w-full h-full bg-zinc-950" />;
}
