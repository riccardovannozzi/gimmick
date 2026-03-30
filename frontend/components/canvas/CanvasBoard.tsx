'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { Tile } from '@/types';
import { useActionColors } from '@/store/action-colors-store';

const TILE_W = 148;
const TILE_H = 52;
const TILE_GAP = 8;
const OFFSET_X = 24;
const OFFSET_Y = 24;

export interface CanvasNode {
  id: string;
  title: string;
  actionType: string;
  x: number;
  y: number;
}

export interface CanvasEdge {
  id: string;
  source_id: string;
  target_id: string;
}

type CanvasMode = 'move' | 'link';

interface CanvasBoardProps {
  tiles: Tile[];
  layout: { tile_id: string; x: number; y: number }[];
  edges: CanvasEdge[];
  mode: CanvasMode;
  onPositionChange: (positions: { tile_id: string; x: number; y: number }[]) => void;
  onAddEdge: (source_id: string, target_id: string) => void;
  onDeleteEdge: (id: string) => void;
  fitTrigger: number;
  resetTrigger: number;
}

export function CanvasBoard({
  tiles,
  layout,
  edges,
  mode,
  onPositionChange,
  onAddEdge,
  onDeleteEdge,
  fitTrigger,
  resetTrigger,
}: CanvasBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boardRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const linkSourceRef = useRef<string | null>(null);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const actionColors = useActionColors();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const getColor = useCallback((actionType: string) => {
    return (actionColors as Record<string, string>)[actionType] || actionColors.none || '#888780';
  }, [actionColors]);

  // Build nodes from tiles + layout
  const buildNodes = useCallback((): CanvasNode[] => {
    const posMap = new Map(layout.map((p) => [p.tile_id, { x: p.x, y: p.y }]));
    return tiles.map((t, i) => {
      const saved = posMap.get(t.id);
      return {
        id: t.id,
        title: t.title || 'Senza titolo',
        actionType: t.action_type || 'none',
        x: saved?.x ?? OFFSET_X,
        y: saved?.y ?? OFFSET_Y + i * (TILE_H + TILE_GAP),
      };
    });
  }, [tiles, layout]);

  // Render / update the board
  const render = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2])
      .filter((event) => {
        // Allow zoom on wheel and middle button; allow pan on background only
        if (event.type === 'wheel') return true;
        if (event.type === 'mousedown' && event.button === 1) return true;
        // For touchstart/touchmove allow
        if (event.type?.startsWith('touch')) return true;
        // Left click on background for pan
        if (event.type === 'mousedown' && event.button === 0) {
          return event.target === svg;
        }
        return false;
      })
      .on('zoom', (event) => {
        board.attr('transform', event.transform);
      });

    d3svg.call(zoom);
    zoomRef.current = zoom;

    const board = d3svg.append('g');
    boardRef.current = board;

    const nodes = buildNodes();
    nodesRef.current = nodes;

    // Edges layer
    const edgesLayer = board.append('g').attr('class', 'edges-layer');

    // Draw edges
    const drawEdges = () => {
      edgesLayer.selectAll('line').remove();
      edges.forEach((edge) => {
        const s = nodes.find((n) => n.id === edge.source_id);
        const t = nodes.find((n) => n.id === edge.target_id);
        if (!s || !t) return;
        edgesLayer.append('line')
          .attr('x1', s.x + TILE_W / 2).attr('y1', s.y + TILE_H / 2)
          .attr('x2', t.x + TILE_W / 2).attr('y2', t.y + TILE_H / 2)
          .attr('stroke', '#444')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3')
          .attr('data-edge-id', edge.id)
          .style('cursor', 'pointer')
          .on('click', (event) => {
            event.stopPropagation();
            onDeleteEdge(edge.id);
          });
      });
    };

    drawEdges();

    // Nodes layer
    const nodesLayer = board.append('g').attr('class', 'nodes-layer');

    const nodeGroups = nodesLayer.selectAll('g.tile-node')
      .data(nodes, (d: any) => d.id)
      .enter()
      .append('g')
      .attr('class', 'tile-node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Main rect
    nodeGroups.append('rect')
      .attr('width', TILE_W).attr('height', TILE_H).attr('rx', 8)
      .attr('fill', '#1C1C1E')
      .attr('stroke', (d) => getColor(d.actionType) + '60')
      .attr('stroke-width', 1);

    // Accent strip
    nodeGroups.append('rect')
      .attr('width', 4).attr('height', TILE_H).attr('rx', 2)
      .attr('fill', (d) => getColor(d.actionType));

    // Title
    nodeGroups.append('text')
      .attr('x', 12).attr('y', 22)
      .attr('fill', '#D4D4D8')
      .attr('font-size', 12).attr('font-weight', 500)
      .text((d) => d.title.length > 16 ? d.title.slice(0, 15) + '...' : d.title);

    // Action type label
    nodeGroups.append('text')
      .attr('x', 12).attr('y', 38)
      .attr('fill', '#71717A')
      .attr('font-size', 10)
      .text((d) => d.actionType);

    // Highlight for link mode
    const updateHighlight = () => {
      nodeGroups.select('rect:first-child')
        .attr('stroke', (d: any) => {
          if (linkSourceRef.current === d.id) return '#3B82F6';
          return getColor(d.actionType) + '60';
        })
        .attr('stroke-width', (d: any) => linkSourceRef.current === d.id ? 2 : 1);
    };

    // Drag
    const drag = d3.drag<SVGGElement, CanvasNode>()
      .filter(() => modeRef.current === 'move')
      .on('start', function () { d3.select(this).raise(); })
      .on('drag', function (event, d) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
        drawEdges();
      })
      .on('end', () => {
        onPositionChange(nodes.map((n) => ({ tile_id: n.id, x: n.x, y: n.y })));
      });

    nodeGroups.call(drag);

    // Click — link mode
    nodeGroups.on('click', (event, d) => {
      event.stopPropagation();
      if (modeRef.current !== 'link') return;
      if (!linkSourceRef.current) {
        linkSourceRef.current = d.id;
        setLinkSourceId(d.id);
        updateHighlight();
      } else {
        if (linkSourceRef.current !== d.id) {
          onAddEdge(linkSourceRef.current, d.id);
        }
        linkSourceRef.current = null;
        setLinkSourceId(null);
        updateHighlight();
      }
    });

    // Click background to cancel link
    d3svg.on('click', () => {
      if (linkSourceRef.current) {
        linkSourceRef.current = null;
        setLinkSourceId(null);
        updateHighlight();
      }
    });
  }, [tiles, layout, edges, buildNodes, getColor, onPositionChange, onAddEdge, onDeleteEdge]);

  useEffect(() => {
    render();
  }, [render]);

  // Fit view
  useEffect(() => {
    if (fitTrigger === 0) return;
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    const nodes = nodesRef.current;
    if (!svg || !zoom || !nodes.length) return;

    const { width, height } = svg.getBoundingClientRect();
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + TILE_W;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + TILE_H;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const padding = 40;
    const scale = Math.min((width - padding * 2) / bw, (height - padding * 2) / bh, 1.5);
    const tx = (width - bw * scale) / 2 - minX * scale;
    const ty = (height - bh * scale) / 2 - minY * scale;

    d3.select(svg).transition().duration(300).call(
      zoom.transform as any,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }, [fitTrigger]);

  // Reset layout
  useEffect(() => {
    if (resetTrigger === 0) return;
    const defaultPositions = tiles.map((t, i) => ({
      tile_id: t.id,
      x: OFFSET_X,
      y: OFFSET_Y + i * (TILE_H + TILE_GAP),
    }));
    onPositionChange(defaultPositions);
  }, [resetTrigger]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-zinc-950"
      style={{ cursor: mode === 'link' ? 'crosshair' : 'default' }}
    />
  );
}
