'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as d3 from 'd3';
import { Header } from '@/components/layout/header';
import { tilesApi } from '@/lib/api';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Calendar, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

// All filterable categories
type FilterKey = 'tiles' | 'photo' | 'image' | 'video' | 'audio_recording' | 'text' | 'file';

const filterConfig: { key: FilterKey; label: string; color: string }[] = [
  { key: 'tiles', label: 'Tiles', color: '#528BFF' },
  { key: 'photo', label: 'Foto', color: '#3B82F6' },
  { key: 'image', label: 'Galleria', color: '#22C55E' },
  { key: 'video', label: 'Video', color: '#F97316' },
  { key: 'audio_recording', label: 'Voce', color: '#EF4444' },
  { key: 'text', label: 'Testo', color: '#A855F7' },
  { key: 'file', label: 'File', color: '#EAB308' },
];

// Color map for memo types
const typeColors: Record<string, string> = {
  photo: '#3B82F6',
  image: '#22C55E',
  video: '#F97316',
  audio_recording: '#EF4444',
  text: '#A855F7',
  file: '#EAB308',
};

const typeLabels: Record<string, string> = {
  photo: 'Foto',
  image: 'Immagine',
  video: 'Video',
  audio_recording: 'Audio',
  text: 'Testo',
  file: 'File',
};

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'root' | 'tile' | 'memo' | 'tag';
  label: string;
  memoType?: string;
  tags?: string[];
  summary?: string;
  memoCount?: number;
  color?: string;
  tileCount?: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    node: GraphNode;
  } | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set(filterConfig.map((f) => f.key))
  );
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Timeline range (0-100 percentage of date range)
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['graph-data'],
    queryFn: () => tilesApi.graph(),
  });

  const graphData = data?.data;

  // Compute global date range from all data
  const dateExtent = useMemo(() => {
    if (!graphData) return null;
    const allDates = [
      ...graphData.tiles.map((t) => new Date(t.created_at).getTime()),
      ...graphData.memos.map((m) => new Date(m.created_at).getTime()),
    ];
    if (allDates.length === 0) return null;
    const min = Math.min(...allDates);
    const max = Math.max(...allDates);
    // Add 1 day padding so single-day data still works
    return { min, max: max === min ? max + 86400000 : max };
  }, [graphData]);

  // Convert percentage range to actual timestamps
  const timeFilter = useMemo(() => {
    if (!dateExtent) return null;
    const span = dateExtent.max - dateExtent.min;
    return {
      from: dateExtent.min + (timeRange[0] / 100) * span,
      to: dateExtent.min + (timeRange[1] / 100) * span,
    };
  }, [dateExtent, timeRange]);

  // Drag handler for timeline slider
  const handleTimelineDrag = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || !draggingRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      setTimeRange((prev) => {
        if (draggingRef.current === 'start') {
          return [Math.min(pct, prev[1] - 2), prev[1]];
        }
        return [prev[0], Math.max(pct, prev[0] + 2)];
      });
    },
    []
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleTimelineDrag(e);
    const onUp = () => { draggingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [handleTimelineDrag]);

  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const { tiles, memos, tags: graphTags } = graphData;
    const showTiles = activeFilters.has('tiles');

    // Filter by time range
    const inTimeRange = (dateStr: string) => {
      if (!timeFilter) return true;
      const t = new Date(dateStr).getTime();
      return t >= timeFilter.from && t <= timeFilter.to;
    };

    const timeTiles = tiles.filter((t) => inTimeRange(t.created_at));
    const timeMemos = memos.filter((m) => inTimeRange(m.created_at));

    // Filter memos by active type filters
    const filteredMemos = timeMemos.filter((m) => activeFilters.has(m.type as FilterKey));

    // Build nodes and links
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Count filtered memos per tile
    const memoCounts = new Map<string, number>();
    filteredMemos.forEach((m) => {
      if (m.tile_id) {
        memoCounts.set(m.tile_id, (memoCounts.get(m.tile_id) || 0) + 1);
      }
    });

    // Clear previous
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Find the selected tag
    const selectedTag = selectedTagId
      ? (graphTags || []).find((t) => t.id === selectedTagId)
      : null;

    if (selectedTag) {
      // === TAG-CENTERED VIEW ===
      const tagTileIdSet = new Set(selectedTag.tile_ids || []);

      // Center node is the tag
      const centerNode: GraphNode = {
        id: `tag-${selectedTag.id}`,
        type: 'tag',
        label: selectedTag.name,
        color: selectedTag.color || '#3B82F6',
        fx: width / 2,
        fy: height / 2,
        tileCount: selectedTag.tile_ids.length,
      };
      nodes.push(centerNode);

      // Only show tiles connected to this tag
      const connectedTiles = timeTiles.filter((t) => tagTileIdSet.has(t.id));
      connectedTiles.forEach((tile) => {
        nodes.push({
          id: `tile-${tile.id}`,
          type: 'tile',
          label: tile.title || 'Tile senza titolo',
          memoCount: memoCounts.get(tile.id) || 0,
        });
        links.push({ source: `tag-${selectedTag.id}`, target: `tile-${tile.id}` });
      });

      // Show memos connected to those tiles
      const connectedTileIds = new Set(connectedTiles.map((t) => t.id));
      filteredMemos.forEach((memo) => {
        if (memo.tile_id && connectedTileIds.has(memo.tile_id)) {
          nodes.push({
            id: `memo-${memo.id}`,
            type: 'memo',
            label: memo.label,
            memoType: memo.type,
            tags: memo.tags,
            summary: memo.summary || undefined,
          });
          links.push({
            source: `tile-${memo.tile_id}`,
            target: `memo-${memo.id}`,
          });
        }
      });

      if (nodes.length === 1) {
        // Only the tag node, no connections
        // Still render it
      }
    } else {
      // === DEFAULT VIEW (root-centered) ===
      if (filteredMemos.length === 0 && (!showTiles || timeTiles.length === 0)) {
        return;
      }

      // Root node (fixed at center)
      const rootNode: GraphNode = {
        id: 'root',
        type: 'root',
        label: 'Gimmick',
        fx: width / 2,
        fy: height / 2,
      };
      nodes.push(rootNode);

      // Add tile nodes first (so tag links can reference them)
      const tileNodeIds = new Set<string>();
      if (showTiles) {
        timeTiles.forEach((tile) => {
          const nodeId = `tile-${tile.id}`;
          nodes.push({
            id: nodeId,
            type: 'tile',
            label: tile.title || 'Tile senza titolo',
            memoCount: memoCounts.get(tile.id) || 0,
          });
          tileNodeIds.add(nodeId);
        });
      }

      // Add tag nodes connected to root, with links to existing tile nodes
      const tilesLinkedByTag = new Set<string>();
      if (graphTags && graphTags.length > 0 && showTiles) {
        graphTags.forEach((tag) => {
          const validTileIds = tag.tile_ids.filter((tid) => tileNodeIds.has(`tile-${tid}`));
          if (validTileIds.length === 0) return;
          nodes.push({
            id: `tag-${tag.id}`,
            type: 'tag',
            label: tag.name,
            color: tag.color || '#3B82F6',
            tileCount: validTileIds.length,
          });
          links.push({ source: 'root', target: `tag-${tag.id}` });

          validTileIds.forEach((tileId) => {
            links.push({ source: `tag-${tag.id}`, target: `tile-${tileId}` });
            tilesLinkedByTag.add(`tile-${tileId}`);
          });
        });
      }

      // Connect untagged tiles directly to root
      if (showTiles) {
        timeTiles.forEach((tile) => {
          if (!tilesLinkedByTag.has(`tile-${tile.id}`)) {
            links.push({ source: 'root', target: `tile-${tile.id}` });
          }
        });
      }

      // Add memo nodes and links
      filteredMemos.forEach((memo) => {
        nodes.push({
          id: `memo-${memo.id}`,
          type: 'memo',
          label: memo.label,
          memoType: memo.type,
          tags: memo.tags,
          summary: memo.summary || undefined,
        });

        if (showTiles && memo.tile_id) {
          links.push({
            source: `tile-${memo.tile_id}`,
            target: `memo-${memo.id}`,
          });
        } else {
          links.push({
            source: 'root',
            target: `memo-${memo.id}`,
          });
        }
      });
    }

    svg.attr('width', width).attr('height', height);

    // Defs for glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Container group for zoom
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTooltip(null);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
            if (src === 'root') return 160;
            if (src.startsWith('tag-')) return 120;
            return 90;
          })
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('collision', d3.forceCollide().radius((d: any) =>
        d.type === 'root' ? 50 : d.type === 'tag' ? 45 : d.type === 'tile' ? 40 : 22
      ));

    simulationRef.current = simulation;

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        return src === 'root' ? '#528BFF' : '#3E3E42';
      })
      .attr('stroke-width', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        return src === 'root' ? 2 : 1.5;
      })
      .attr('stroke-opacity', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        return src === 'root' ? 0.3 : 0.6;
      });

    // Node groups
    const node = g
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (d.type === 'root') return;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            if (d.type === 'root') return;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (d.type === 'root') return;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Root node
    node
      .filter((d) => d.type === 'root')
      .append('circle')
      .attr('r', 30)
      .attr('fill', '#528BFF')
      .attr('fill-opacity', 0.15)
      .attr('stroke', '#528BFF')
      .attr('stroke-width', 3)
      .style('filter', 'url(#glow)');

    node
      .filter((d) => d.type === 'root')
      .append('text')
      .text('Gimmick')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#528BFF')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .style('pointer-events', 'none');

    // Tile nodes (larger circles)
    node
      .filter((d) => d.type === 'tile')
      .append('circle')
      .attr('r', (d) => 18 + Math.min((d.memoCount || 0) * 2, 16))
      .attr('fill', '#528BFF')
      .attr('fill-opacity', 0.2)
      .attr('stroke', '#528BFF')
      .attr('stroke-width', 2)
      .style('filter', 'url(#glow)')
      .style('cursor', 'pointer');

    // Tile labels
    node
      .filter((d) => d.type === 'tile')
      .append('text')
      .text((d) => d.label.length > 16 ? d.label.slice(0, 14) + '...' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#F5F5F5')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none');

    // Memo nodes (smaller colored circles)
    node
      .filter((d) => d.type === 'memo')
      .append('circle')
      .attr('r', 12)
      .attr('fill', (d) => typeColors[d.memoType || ''] || '#6B7280')
      .attr('fill-opacity', 0.3)
      .attr('stroke', (d) => typeColors[d.memoType || ''] || '#6B7280')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer');

    // Memo type icon text
    node
      .filter((d) => d.type === 'memo')
      .append('text')
      .text((d) => {
        const t = d.memoType || '';
        const icons: Record<string, string> = {
          photo: '\u{1F4F7}',
          image: '\u{1F5BC}',
          video: '\u{1F3AC}',
          audio_recording: '\u{1F3A4}',
          text: '\u{1F4DD}',
          file: '\u{1F4C1}',
        };
        return icons[t] || '\u{2B55}';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Tag nodes
    node
      .filter((d) => d.type === 'tag')
      .append('circle')
      .attr('r', (d) => 22 + Math.min((d.tileCount || 0) * 2, 12))
      .attr('fill', (d) => d.color || '#3B82F6')
      .attr('fill-opacity', 0.2)
      .attr('stroke', (d) => d.color || '#3B82F6')
      .attr('stroke-width', 2.5)
      .style('filter', 'url(#glow)')
      .style('cursor', 'pointer');

    node
      .filter((d) => d.type === 'tag')
      .append('text')
      .text((d) => d.label.length > 14 ? d.label.slice(0, 12) + '...' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#F5F5F5')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .style('pointer-events', 'none');

    // Click tag node to center it
    node
      .filter((d) => d.type === 'tag')
      .on('click', (event, d) => {
        event.stopPropagation();
        const tagId = d.id.replace('tag-', '');
        setSelectedTagId((prev) => (prev === tagId ? null : tagId));
      });

    // Hover interaction
    node.on('mouseenter', (event, d) => {
      const [x, y] = d3.pointer(event, containerRef.current);
      setTooltip({ x, y, node: d });
    });

    node.on('mouseleave', () => {
      setTooltip(null);
    });

    // Highlight on hover
    node.on('mouseover', function (_, d) {
      // Dim all
      node.style('opacity', 0.2);
      link.style('opacity', 0.05);

      // Highlight connected
      const connectedIds = new Set<string>();
      connectedIds.add(d.id);
      links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        if (src === d.id) connectedIds.add(tgt);
        if (tgt === d.id) connectedIds.add(src);
      });

      node.filter((n) => connectedIds.has(n.id)).style('opacity', 1);
      link
        .filter((l) => {
          const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          return src === d.id || tgt === d.id;
        })
        .style('opacity', 0.8)
        .attr('stroke', '#528BFF')
        .attr('stroke-width', 2);
    });

    node.on('mouseout', function () {
      node.style('opacity', 1);
      link.style('opacity', 1)
        .attr('stroke', (l) => {
          const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          return src === 'root' ? '#528BFF' : '#3E3E42';
        })
        .attr('stroke-width', (l) => {
          const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          return src === 'root' ? 2 : 1.5;
        });
    });

    // Tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, activeFilters, timeFilter, selectedTagId]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Graph" />

      {/* Timeline slider */}
      {dateExtent && (
        <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4">
          <Calendar className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 w-20 shrink-0">
            {new Date(dateExtent.min + (timeRange[0] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
          </span>
          <div className="flex-1 relative h-6 flex items-center">
            <div
              ref={trackRef}
              className="w-full h-1.5 bg-zinc-700 rounded-full relative cursor-pointer"
              onClick={(e) => {
                if (!trackRef.current) return;
                const rect = trackRef.current.getBoundingClientRect();
                const pct = ((e.clientX - rect.left) / rect.width) * 100;
                // Move the closest handle
                setTimeRange((prev) => {
                  const distStart = Math.abs(pct - prev[0]);
                  const distEnd = Math.abs(pct - prev[1]);
                  if (distStart < distEnd) {
                    return [Math.min(pct, prev[1] - 2), prev[1]];
                  }
                  return [prev[0], Math.max(pct, prev[0] + 2)];
                });
              }}
            >
              {/* Active range */}
              <div
                className="absolute h-full bg-blue-500/50 rounded-full"
                style={{ left: `${timeRange[0]}%`, width: `${timeRange[1] - timeRange[0]}%` }}
              />
              {/* Start handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-zinc-900 cursor-grab active:cursor-grabbing shadow-lg"
                style={{ left: `${timeRange[0]}%`, transform: `translate(-50%, -50%)` }}
                onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'start'; }}
              />
              {/* End handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-zinc-900 cursor-grab active:cursor-grabbing shadow-lg"
                style={{ left: `${timeRange[1]}%`, transform: `translate(-50%, -50%)` }}
                onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'end'; }}
              />
            </div>
          </div>
          <span className="text-xs text-zinc-400 w-20 shrink-0 text-right">
            {new Date(dateExtent.min + (timeRange[1] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden bg-zinc-950" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : !graphData || (graphData.tiles.length === 0 && graphData.memos.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-400 text-lg">Nessun dato da visualizzare</p>
            <p className="text-zinc-500 text-sm mt-2">
              Crea dei tile e memo per vedere il grafo delle connessioni
            </p>
          </div>
        ) : (
          <>
            {/* Filter bar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5">
              {filterConfig.map((f) => {
                const active = activeFilters.has(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      active
                        ? 'bg-zinc-800 border-zinc-600 text-white'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
                    )}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full transition-opacity"
                      style={{
                        backgroundColor: f.color,
                        opacity: active ? 1 : 0.3,
                      }}
                    />
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Tag selector */}
            {graphData?.tags && graphData.tags.length > 0 && (
              <div className="absolute top-14 left-4 z-10 flex flex-wrap gap-1.5">
                {graphData.tags.map((tag) => {
                  const isSelected = selectedTagId === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagId(isSelected ? null : tag.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                        isSelected
                          ? 'border-opacity-60 text-white'
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      )}
                      style={isSelected ? {
                        backgroundColor: `${tag.color || '#3B82F6'}20`,
                        borderColor: `${tag.color || '#3B82F6'}60`,
                      } : undefined}
                    >
                      <TagIcon className="h-3 w-3" style={{ color: tag.color || '#3B82F6' }} />
                      {tag.name}
                      {isSelected && (
                        <span className="ml-1 text-[10px] opacity-60">✕</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <svg ref={svgRef} className="w-full h-full" />

            {/* Zoom controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomIn}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleZoomOut}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleFit}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none bg-zinc-800 border border-zinc-600 rounded-lg p-3 shadow-xl max-w-[280px] z-50"
                style={{
                  left: tooltip.x + 16,
                  top: tooltip.y - 10,
                }}
              >
                <p className="text-white text-sm font-medium mb-1">
                  {tooltip.node.type === 'root' ? 'Root' : tooltip.node.type === 'tag' ? 'Tag' : tooltip.node.type === 'tile' ? 'Tile' : typeLabels[tooltip.node.memoType || ''] || 'Memo'}
                </p>
                <p className="text-zinc-300 text-xs">
                  {tooltip.node.label}
                </p>
                {tooltip.node.type === 'tag' && tooltip.node.tileCount != null && (
                  <p className="text-zinc-400 text-xs mt-1">
                    {tooltip.node.tileCount} tile collegati — clicca per centrare
                  </p>
                )}
                {tooltip.node.type === 'tile' && tooltip.node.memoCount != null && (
                  <p className="text-zinc-400 text-xs mt-1">
                    {tooltip.node.memoCount} memo collegati
                  </p>
                )}
                {tooltip.node.summary && (
                  <p className="text-zinc-400 text-xs mt-1 italic">
                    {tooltip.node.summary.slice(0, 120)}
                    {tooltip.node.summary.length > 120 ? '...' : ''}
                  </p>
                )}
                {tooltip.node.tags && tooltip.node.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tooltip.node.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
