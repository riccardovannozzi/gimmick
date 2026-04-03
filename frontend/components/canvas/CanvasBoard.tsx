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
export interface CanvasEdge { id: string; source_id: string; target_id: string; source_port?: PortKey; target_port?: PortKey; }
export interface CanvasGroup { id: string; label: string; nodeIds: string[]; }

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
  moveEnabled: boolean;
  linkEnabled: boolean;
  onPositionChange: (positions: { tile_id: string; x: number; y: number }[]) => void;
  onAddEdge: (source_id: string, target_id: string, source_port?: PortKey, target_port?: PortKey) => void;
  onDeleteEdge: (id: string) => void;
  onEdgeContextMenu: (e: { x: number; y: number; edgeId: string }) => void;
  onTileContextMenu: (e: { x: number; y: number; tileId: string; inGroup: boolean }) => void;
  onTileClick: (tileId: string) => void;
  onGroupsChange: (groups: CanvasGroup[]) => void;
  fitTrigger: number;
  resetTrigger: number;
}

export function CanvasBoard({
  tiles, layout, edges, groups,
  moveEnabled, linkEnabled,
  onPositionChange, onAddEdge, onDeleteEdge,
  onEdgeContextMenu, onTileContextMenu, onTileClick,
  onGroupsChange, fitTrigger, resetTrigger,
}: CanvasBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const groupsRef = useRef(groups); groupsRef.current = groups;
  const actionColors = useActionColors();
  const moveRef = useRef(moveEnabled); moveRef.current = moveEnabled;
  const linkRef = useRef(linkEnabled); linkRef.current = linkEnabled;

  // Link drag state
  const linkSrc = useRef<{ id: string; px: number; py: number; port: PortKey } | null>(null);
  const dropTarget = useRef<{ nodeId: string; groupId?: string; port?: PortKey } | null>(null);

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
  interface HitResult { nodeId: string; groupId?: string; }
  const hitTest = useCallback((bx: number, by: number, excludeId: string): HitResult | null => {
    const ns = nodesRef.current;
    const gs = groupsRef.current;
    const TOL = 8;

    const groupedIds = new Set<string>();
    let sourceGroupId: string | null = null;
    gs.forEach((g) => {
      g.nodeIds.forEach((id) => {
        groupedIds.add(id);
        if (id === excludeId) sourceGroupId = g.id;
      });
    });

    // 1. Group containers
    for (const g of gs) {
      if (g.id === sourceGroupId) continue;
      const b = getGroupBounds(g, ns);
      if (!b) continue;
      if (bx >= b.x - TOL && bx <= b.x + b.w + TOL && by >= b.y - LABEL_H - TOL && by <= b.y + b.h + TOL) {
        const first = ns.find((n) => g.nodeIds.includes(n.id) && n.id !== excludeId);
        if (first) return { nodeId: first.id, groupId: g.id };
      }
    }

    // 2. Ungrouped tiles only
    const tile = ns.find((n) => n.id !== excludeId && !groupedIds.has(n.id) && bx >= n.x && bx <= n.x + TILE_W && by >= n.y && by <= n.y + TILE_H);
    if (tile) return { nodeId: tile.id };

    return null;
  }, []);


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
    const startLink = (sourceId: string, px: number, py: number, port: PortKey, ev: any) => {
      ev.sourceEvent.stopPropagation();
      linkSrc.current = { id: sourceId, px, py, port };
      dropTarget.current = null;
      tempLine.attr('x1', px).attr('y1', py).attr('x2', px).attr('y2', py).attr('opacity', 1);
    };
    // Find closest port on a target node or group
    const findClosestPort = (mx: number, my: number, targetId: string, groupId?: string): PortKey => {
      if (groupId) {
        const grp = groupsRef.current.find((g) => g.id === groupId);
        if (grp) {
          const b = getGroupBounds(grp, nodes);
          if (b) {
            const gPts: { key: PortKey; x: number; y: number }[] = [
              { key: 'top', x: b.x + b.w / 2, y: b.y - LABEL_H },
              { key: 'right', x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
              { key: 'bottom', x: b.x + b.w / 2, y: b.y + b.h },
              { key: 'left', x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
            ];
            let best = gPts[0], bestDist = Infinity;
            gPts.forEach((p) => { const d = (mx - p.x) ** 2 + (my - p.y) ** 2; if (d < bestDist) { bestDist = d; best = p; } });
            return best.key;
          }
        }
      }
      const nd = nodes.find((n) => n.id === targetId);
      if (nd) {
        const tPts = PORTS.map((p) => ({ key: p.key as PortKey, x: nd.x + p.cx, y: nd.y + p.cy }));
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
      const hit = hitTest(mx, my, linkSrc.current.id);
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
            .on('start', (ev) => { const fn = nodes.find((n) => grp.nodeIds.includes(n.id)); if (fn) startLink(fn.id, cx, cy, pk, ev); pc.attr('opacity', 1); })
            .on('drag', dragLink)
            .on('end', () => { endLink(); pc.attr('opacity', 0); }) as any);
        });
      });
    };

    // ── Draw edges ──
    const edgesG = board.append('g');
    const nodeGroupMap = () => { const m = new Map<string, CanvasGroup>(); groupsRef.current.forEach((g) => g.nodeIds.forEach((id) => m.set(id, g))); return m; };
    // Get port position for a node (tile or group)
    // Get all 4 port positions for a node (tile or group container)
    const getNodePorts = (nd: CanvasNode, gm: Map<string, CanvasGroup>): { key: PortKey; x: number; y: number }[] => {
      const grp = gm.get(nd.id);
      if (grp) {
        const b = getGroupBounds(grp, nodes);
        if (b) return [
          { key: 'top', x: b.x + b.w / 2, y: b.y - LABEL_H },
          { key: 'right', x: b.x + b.w, y: b.y + (b.h - LABEL_H) / 2 },
          { key: 'bottom', x: b.x + b.w / 2, y: b.y + b.h },
          { key: 'left', x: b.x, y: b.y + (b.h - LABEL_H) / 2 },
        ];
      }
      return PORTS.map((p) => ({ key: p.key as PortKey, x: nd.x + p.cx, y: nd.y + p.cy }));
    };

    // Find the closest pair of ports between two nodes
    const findBestPorts = (snd: CanvasNode, tnd: CanvasNode, gm: Map<string, CanvasGroup>): { sx: number; sy: number; tx: number; ty: number } => {
      const sPorts = getNodePorts(snd, gm);
      const tPorts = getNodePorts(tnd, gm);
      let bestDist = Infinity, best = { sx: 0, sy: 0, tx: 0, ty: 0 };
      for (const sp of sPorts) {
        for (const tp of tPorts) {
          const d = (sp.x - tp.x) ** 2 + (sp.y - tp.y) ** 2;
          if (d < bestDist) { bestDist = d; best = { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y }; }
        }
      }
      return best;
    };

    const drawEdges = () => {
      edgesG.selectAll('*').remove();
      const gm = nodeGroupMap();
      edges.forEach((edge) => {
        const s = nodes.find((n) => n.id === edge.source_id), t = nodes.find((n) => n.id === edge.target_id);
        if (!s || !t) return;
        const sg = gm.get(s.id), tg = gm.get(t.id);
        const sameGroup = sg && tg && sg.id === tg.id;

        // Always compute best ports dynamically
        const { sx: x1, sy: y1, tx: x2, ty: y2 } = findBestPorts(s, t, sameGroup ? new Map() : gm);

        const sColor = getColor(s.actionType);
        const tColor = getColor(t.actionType);
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

    drawGroups();
    // Raise nodes above group bg
    nodesG.raise();
    // Raise temp line to top
    tempLine.raise();
  }, [tiles, layout, edges, groups, buildNodes, getColor, onPositionChange, onAddEdge, onDeleteEdge, onEdgeContextMenu, onTileContextMenu, onTileClick, onGroupsChange, hitTest]);

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
