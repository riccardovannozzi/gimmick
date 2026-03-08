'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as d3 from 'd3';
import { Header } from '@/components/layout/header';
import { tilesApi, tagsApi } from '@/lib/api';
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  Tag as TagIcon,
  Plus,
  X,
  Trash2,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TagNode, TagEdge } from '@/types';

// ─── View mode ───
type ViewMode = 'content' | 'tags';

// ─── Content view types ───
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

// ─── Tag view types ───
const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#22C55E', '#06B6D4', '#F97316',
];

// ─── Shared node types ───
interface ContentGraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'root' | 'tile' | 'spark' | 'tag';
  label: string;
  sparkType?: string;
  tags?: string[];
  summary?: string;
  sparkCount?: number;
  color?: string;
  tileCount?: number;
}

interface ContentGraphLink extends d3.SimulationLinkDatum<ContentGraphNode> {
  source: string | ContentGraphNode;
  target: string | ContentGraphNode;
}

interface TagGraphNodeDatum extends d3.SimulationNodeDatum {
  id: string;
  tagId: string;
  label: string;
  color: string;
  radius: number;
  usageCount: number;
}

interface TagGraphLinkDatum extends d3.SimulationLinkDatum<TagGraphNodeDatum> {
  source: string | TagGraphNodeDatum;
  target: string | TagGraphNodeDatum;
  weight: number;
  edgeId: string;
  relationType?: string;
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const queryClient = useQueryClient();

  // ─── Shared state ───
  const [viewMode, setViewMode] = useState<ViewMode>('content');
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);

  // ─── Content view state ───
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set(filterConfig.map((f) => f.key))
  );
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  // ─── Tag view state ───
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);

  // Refs to access current link state inside D3 callbacks without causing re-render
  const linkModeRef = useRef(linkMode);
  const linkSourceRef = useRef(linkSource);
  linkModeRef.current = linkMode;
  linkSourceRef.current = linkSource;

  // ─── Content view query ───
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['graph-data'],
    queryFn: () => tilesApi.graph(),
    enabled: viewMode === 'content',
  });
  const graphData = contentData?.data;

  // ─── Tag view queries ───
  const { data: tagGraphResult, isLoading: tagGraphLoading } = useQuery({
    queryKey: ['tag-graph'],
    queryFn: () => tagsApi.graph(),
    enabled: viewMode === 'tags',
  });
  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    enabled: viewMode === 'tags',
  });
  const tagGraph = tagGraphResult?.data;
  const allTags = tagsResult?.data || [];

  // ─── Tag mutations ───
  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
      setNewTagName('');
      toast.success('Tag creato');
    },
    onError: () => toast.error('Errore nella creazione'),
  });

  const deleteMutation = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
      setSelectedNodeId(null);
      toast.success('Tag eliminato');
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  const linkMutation = useMutation({
    mutationFn: ({ from, to, weight }: { from: string; to: string; weight: number }) =>
      tagsApi.updateRelation(from, to, weight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
      toast.success('Relazione aggiornata');
    },
    onError: () => toast.error("Errore nell'aggiornamento relazione"),
  });

  // ─── Content view: date range ───
  const dateExtent = useMemo(() => {
    if (!graphData) return null;
    const allDates = [
      ...graphData.tiles.map((t) => new Date(t.created_at).getTime()),
      ...graphData.sparks.map((m) => new Date(m.created_at).getTime()),
    ];
    if (allDates.length === 0) return null;
    const min = Math.min(...allDates);
    const max = Math.max(...allDates);
    return { min, max: max === min ? max + 86400000 : max };
  }, [graphData]);

  const timeFilter = useMemo(() => {
    if (!dateExtent) return null;
    const span = dateExtent.max - dateExtent.min;
    return {
      from: dateExtent.min + (timeRange[0] / 100) * span,
      to: dateExtent.min + (timeRange[1] / 100) * span,
    };
  }, [dateExtent, timeRange]);

  // ─── Content view: filters ───
  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ─── Timeline drag ───
  const handleTimelineDrag = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || !draggingRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      setTimeRange((prev) => {
        if (draggingRef.current === 'start') return [Math.min(pct, prev[1] - 2), prev[1]];
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

  // ─── Tag view: create handler ───
  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name) return;
    createMutation.mutate({ name, color: newTagColor });
  }, [newTagName, newTagColor, createMutation]);

  // ─── Shared zoom controls ───
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const handleFit = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // ─── D3: Content view ───
  useEffect(() => {
    if (viewMode !== 'content') return;
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const { tiles, sparks, tags: graphTags } = graphData;
    const showTiles = activeFilters.has('tiles');

    const inTimeRange = (dateStr: string) => {
      if (!timeFilter) return true;
      const t = new Date(dateStr).getTime();
      return t >= timeFilter.from && t <= timeFilter.to;
    };

    const timeTiles = tiles.filter((t) => inTimeRange(t.created_at));
    const timeSparks = sparks.filter((m) => inTimeRange(m.created_at));
    const filteredSparks = timeSparks.filter((m) => activeFilters.has(m.type as FilterKey));

    const nodes: ContentGraphNode[] = [];
    const links: ContentGraphLink[] = [];

    const sparkCounts = new Map<string, number>();
    filteredSparks.forEach((m) => {
      if (m.tile_id) sparkCounts.set(m.tile_id, (sparkCounts.get(m.tile_id) || 0) + 1);
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const selectedTag = selectedTagId
      ? (graphTags || []).find((t) => t.id === selectedTagId)
      : null;

    if (selectedTag) {
      const tagTileIdSet = new Set(selectedTag.tile_ids || []);
      const centerNode: ContentGraphNode = {
        id: `tag-${selectedTag.id}`,
        type: 'tag',
        label: selectedTag.name,
        color: selectedTag.color || '#3B82F6',
        fx: width / 2,
        fy: height / 2,
        tileCount: selectedTag.tile_ids.length,
      };
      nodes.push(centerNode);

      const connectedTiles = timeTiles.filter((t) => tagTileIdSet.has(t.id));
      connectedTiles.forEach((tile) => {
        nodes.push({
          id: `tile-${tile.id}`,
          type: 'tile',
          label: tile.title || 'Tile senza titolo',
          sparkCount: sparkCounts.get(tile.id) || 0,
        });
        links.push({ source: `tag-${selectedTag.id}`, target: `tile-${tile.id}` });
      });

      const connectedTileIds = new Set(connectedTiles.map((t) => t.id));
      filteredSparks.forEach((spark) => {
        if (spark.tile_id && connectedTileIds.has(spark.tile_id)) {
          nodes.push({
            id: `spark-${spark.id}`,
            type: 'spark',
            label: spark.label,
            sparkType: spark.type,
            tags: spark.tags,
            summary: spark.summary || undefined,
          });
          links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}` });
        }
      });
    } else {
      if (filteredSparks.length === 0 && (!showTiles || timeTiles.length === 0)) return;

      const rootNode: ContentGraphNode = {
        id: 'root',
        type: 'root',
        label: 'Gimmick',
        fx: width / 2,
        fy: height / 2,
      };
      nodes.push(rootNode);

      const tileNodeIds = new Set<string>();
      if (showTiles) {
        timeTiles.forEach((tile) => {
          const nodeId = `tile-${tile.id}`;
          nodes.push({
            id: nodeId,
            type: 'tile',
            label: tile.title || 'Tile senza titolo',
            sparkCount: sparkCounts.get(tile.id) || 0,
          });
          tileNodeIds.add(nodeId);
        });
      }

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

      if (showTiles) {
        timeTiles.forEach((tile) => {
          if (!tilesLinkedByTag.has(`tile-${tile.id}`))
            links.push({ source: 'root', target: `tile-${tile.id}` });
        });
      }

      filteredSparks.forEach((spark) => {
        nodes.push({
          id: `spark-${spark.id}`,
          type: 'spark',
          label: spark.label,
          sparkType: spark.type,
          tags: spark.tags,
          summary: spark.summary || undefined,
        });
        if (showTiles && spark.tile_id)
          links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}` });
        else
          links.push({ source: 'root', target: `spark-${spark.id}` });
      });
    }

    svg.attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTooltip(null);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const simulation = d3
      .forceSimulation<ContentGraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<ContentGraphNode, ContentGraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
            if (src === 'root') return 160;
            if (src.startsWith('tag-')) return 120;
            return 90;
          })
      )
      .force('charge', d3.forceManyBody().strength(-250))
      .force('collision', d3.forceCollide<ContentGraphNode>().radius((d) =>
        d.type === 'root' ? 50 : d.type === 'tag' ? 45 : d.type === 'tile' ? 40 : 22
      ));

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
        return src === 'root' ? '#528BFF' : '#3E3E42';
      })
      .attr('stroke-width', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
        return src === 'root' ? 2 : 1.5;
      })
      .attr('stroke-opacity', (l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
        return src === 'root' ? 0.3 : 0.6;
      });

    const node = g
      .append('g')
      .selectAll<SVGGElement, ContentGraphNode>('g')
      .data(nodes)
      .join('g')
      .call(
        d3
          .drag<SVGGElement, ContentGraphNode>()
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
    node.filter((d) => d.type === 'root')
      .append('circle').attr('r', 30).attr('fill', '#528BFF').attr('fill-opacity', 0.15)
      .attr('stroke', '#528BFF').attr('stroke-width', 3).style('filter', 'url(#glow)');
    node.filter((d) => d.type === 'root')
      .append('text').text('Gimmick').attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('fill', '#528BFF').attr('font-size', '12px').attr('font-weight', '700')
      .style('pointer-events', 'none');

    // Tile nodes (square shape)
    const tileSize = (d: ContentGraphNode) => 2 * (18 + Math.min((d.sparkCount || 0) * 2, 16));
    node.filter((d) => d.type === 'tile')
      .append('rect')
      .attr('width', tileSize).attr('height', tileSize)
      .attr('x', (d) => -tileSize(d) / 2).attr('y', (d) => -tileSize(d) / 2)
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', '#528BFF').attr('fill-opacity', 0.2).attr('stroke', '#528BFF')
      .attr('stroke-width', 2).style('filter', 'url(#glow)').style('cursor', 'pointer');
    node.filter((d) => d.type === 'tile')
      .append('text').text((d) => d.label.length > 16 ? d.label.slice(0, 14) + '...' : d.label)
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', '#F5F5F5')
      .attr('font-size', '11px').attr('font-weight', '600').style('pointer-events', 'none');

    // Spark nodes
    node.filter((d) => d.type === 'spark')
      .append('circle').attr('r', 12)
      .attr('fill', (d) => typeColors[d.sparkType || ''] || '#6B7280').attr('fill-opacity', 0.3)
      .attr('stroke', (d) => typeColors[d.sparkType || ''] || '#6B7280')
      .attr('stroke-width', 1.5).style('cursor', 'pointer');
    node.filter((d) => d.type === 'spark')
      .append('text')
      .text((d) => {
        const icons: Record<string, string> = {
          photo: '\u{1F4F7}', image: '\u{1F5BC}', video: '\u{1F3AC}',
          audio_recording: '\u{1F3A4}', text: '\u{1F4DD}', file: '\u{1F4C1}',
        };
        return icons[d.sparkType || ''] || '\u{2B55}';
      })
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Tag nodes
    node.filter((d) => d.type === 'tag')
      .append('circle').attr('r', (d) => 22 + Math.min((d.tileCount || 0) * 2, 12))
      .attr('fill', (d) => d.color || '#3B82F6').attr('fill-opacity', 0.2)
      .attr('stroke', (d) => d.color || '#3B82F6').attr('stroke-width', 2.5)
      .style('filter', 'url(#glow)').style('cursor', 'pointer');
    node.filter((d) => d.type === 'tag')
      .append('text').text((d) => d.label.length > 14 ? d.label.slice(0, 12) + '...' : d.label)
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', '#F5F5F5')
      .attr('font-size', '11px').attr('font-weight', '700').style('pointer-events', 'none');

    // Click tag to center
    node.filter((d) => d.type === 'tag')
      .on('click', (event, d) => {
        event.stopPropagation();
        const tagId = d.id.replace('tag-', '');
        setSelectedTagId((prev) => (prev === tagId ? null : tagId));
      });

    // Hover: tooltip + highlight (using mouseenter/mouseleave to avoid bubbling flicker)
    node.on('mouseenter', function (event, d) {
      // Tooltip
      const [x, y] = d3.pointer(event, containerRef.current);
      setTooltip({
        x, y,
        content: (
          <>
            <p className="text-white text-sm font-medium mb-1">
              {d.type === 'root' ? 'Root' : d.type === 'tag' ? 'Tag' : d.type === 'tile' ? 'Tile' : typeLabels[d.sparkType || ''] || 'Spark'}
            </p>
            <p className="text-zinc-300 text-xs">{d.label}</p>
            {d.type === 'tag' && d.tileCount != null && (
              <p className="text-zinc-400 text-xs mt-1">{d.tileCount} tile collegati — clicca per centrare</p>
            )}
            {d.type === 'tile' && d.sparkCount != null && (
              <p className="text-zinc-400 text-xs mt-1">{d.sparkCount} spark collegati</p>
            )}
            {d.summary && (
              <p className="text-zinc-400 text-xs mt-1 italic">
                {d.summary.slice(0, 120)}{d.summary.length > 120 ? '...' : ''}
              </p>
            )}
            {d.tags && d.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {d.tags.slice(0, 5).map((tag) => (
                  <span key={tag} className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{tag}</span>
                ))}
              </div>
            )}
          </>
        ),
      });

      // Highlight connected
      node.style('opacity', 0.2);
      link.style('opacity', 0.05);
      const connectedIds = new Set<string>();
      connectedIds.add(d.id);
      links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as ContentGraphNode).id;
        if (src === d.id) connectedIds.add(tgt);
        if (tgt === d.id) connectedIds.add(src);
      });
      node.filter((n) => connectedIds.has(n.id)).style('opacity', 1);
      link.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as ContentGraphNode).id;
        return src === d.id || tgt === d.id;
      }).style('opacity', 0.8).attr('stroke', '#528BFF').attr('stroke-width', 2);
    });

    node.on('mouseleave', function () {
      setTooltip(null);
      node.style('opacity', 1);
      link.style('opacity', 1)
        .attr('stroke', (l) => {
          const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
          return src === 'root' ? '#528BFF' : '#3E3E42';
        })
        .attr('stroke-width', (l) => {
          const src = typeof l.source === 'string' ? l.source : (l.source as ContentGraphNode).id;
          return src === 'root' ? 2 : 1.5;
        });
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => ((d.source as ContentGraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as ContentGraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as ContentGraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as ContentGraphNode).y ?? 0));
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [viewMode, graphData, activeFilters, timeFilter, selectedTagId]);

  // ─── D3: Tag view ───
  useEffect(() => {
    if (viewMode !== 'tags') return;
    if (!tagGraph || !svgRef.current || !containerRef.current) return;

    const { nodes: tagNodes, edges: tagEdges } = tagGraph as { nodes: TagNode[]; edges: TagEdge[] };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    svg.attr('width', width).attr('height', height);

    const nodes: TagGraphNodeDatum[] = tagNodes.map((t) => ({
      id: `tag-${t.id}`,
      tagId: t.id,
      label: t.name,
      color: t.color || '#3B82F6',
      radius: 24 + Math.min((t.usage_count || 0) * 3, 20),
      usageCount: t.usage_count || 0,
    }));

    const seenPairs = new Set<string>();
    const links: TagGraphLinkDatum[] = [];
    for (const edge of tagEdges) {
      const key = [edge.tag_from, edge.tag_to].sort().join('-');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      if (nodes.some((n) => n.tagId === edge.tag_from) && nodes.some((n) => n.tagId === edge.tag_to)) {
        links.push({
          source: `tag-${edge.tag_from}`,
          target: `tag-${edge.tag_to}`,
          weight: edge.weight,
          edgeId: edge.id,
          relationType: edge.relation_type,
        });
      }
    }

    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'tag-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setTooltip(null);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    const simulation = d3
      .forceSimulation<TagGraphNodeDatum>(nodes)
      .alphaDecay(0.05)
      .velocityDecay(0.4)
      .force(
        'link',
        d3
          .forceLink<TagGraphNodeDatum, TagGraphLinkDatum>(links)
          .id((d) => d.id)
          .distance((l) => {
            const w = (l as TagGraphLinkDatum).weight || 1;
            return Math.max(100, 220 - w * 15);
          })
          .strength(0.7)
      )
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force('collision', d3.forceCollide<TagGraphNodeDatum>().radius((d) => d.radius + 12).strength(0.8));

    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', (d) => d.relationType === 'root-link' ? '#528BFF' : '#3E3E42')
      .attr('stroke-width', (d) => d.relationType === 'root-link' ? 1 : Math.max(1.5, Math.min(d.weight * 1.5, 8)))
      .attr('stroke-opacity', (d) => d.relationType === 'root-link' ? 0.3 : 0.6)
      .attr('stroke-dasharray', (d) => d.relationType === 'root-link' ? '4,4' : 'none');

    const linkLabel = g
      .append('g')
      .selectAll('text')
      .data(links.filter((d) => d.weight > 0))
      .join('text')
      .text((d) => d.weight.toFixed(0))
      .attr('text-anchor', 'middle')
      .attr('fill', '#6B7280')
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    const node = g
      .append('g')
      .selectAll<SVGGElement, TagGraphNodeDatum>('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, TagGraphNodeDatum>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.1).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node.append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color).attr('fill-opacity', 0.15)
      .attr('stroke', (d) => d.color).attr('stroke-width', 2.5)
      .style('filter', 'url(#tag-glow)');

    node.append('text')
      .text((d) => (d.label.length > 14 ? d.label.slice(0, 12) + '...' : d.label))
      .attr('text-anchor', 'middle').attr('dy', '-0.2em').attr('fill', '#F5F5F5')
      .attr('font-size', '12px').attr('font-weight', '700').style('pointer-events', 'none');

    node.append('text')
      .text((d) => `${d.usageCount} tile`)
      .attr('text-anchor', 'middle').attr('dy', '1.2em').attr('fill', '#6B7280')
      .attr('font-size', '9px').style('pointer-events', 'none');

    // Click to select / link (uses refs to avoid re-creating graph)
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (linkModeRef.current) {
        if (!linkSourceRef.current) {
          setLinkSource(d.tagId);
          toast.info(`Seleziona il tag di destinazione per collegare "${d.label}"`);
        } else if (linkSourceRef.current !== d.tagId) {
          tagsApi.updateRelation(linkSourceRef.current, d.tagId, 1).then(() => {
            queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
            toast.success('Relazione aggiornata');
          }).catch(() => toast.error("Errore nell'aggiornamento relazione"));
          setLinkSource(null);
          setLinkMode(false);
        }
      } else {
        setSelectedNodeId((prev) => (prev === d.tagId ? null : d.tagId));
      }
    });

    svg.on('click', () => {
      setSelectedNodeId(null);
      if (linkModeRef.current) { setLinkSource(null); setLinkMode(false); }
    });

    // Hover: tooltip + highlight (using mouseenter/mouseleave to avoid bubbling flicker)
    node.on('mouseenter', function (event, d) {
      // Tooltip
      const [x, y] = d3.pointer(event, containerRef.current);
      setTooltip({
        x, y,
        content: (
          <>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <p className="text-white text-sm font-semibold">{d.label}</p>
            </div>
            <p className="text-zinc-400 text-xs">{d.usageCount} tile associati</p>
          </>
        ),
      });

      // Highlight connected
      node.style('opacity', 0.2);
      link.style('opacity', 0.05);
      linkLabel.style('opacity', 0.05);
      const connectedIds = new Set<string>();
      connectedIds.add(d.id);
      links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as TagGraphNodeDatum).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as TagGraphNodeDatum).id;
        if (src === d.id) connectedIds.add(tgt);
        if (tgt === d.id) connectedIds.add(src);
      });
      node.filter((n) => connectedIds.has(n.id)).style('opacity', 1);
      link.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as TagGraphNodeDatum).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as TagGraphNodeDatum).id;
        return src === d.id || tgt === d.id;
      }).style('opacity', 0.9).attr('stroke', d.color)
        .attr('stroke-width', (l) => Math.max(2, Math.min((l as TagGraphLinkDatum).weight * 2, 10)));
      linkLabel.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as TagGraphNodeDatum).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as TagGraphNodeDatum).id;
        return src === d.id || tgt === d.id;
      }).style('opacity', 1).attr('fill', '#F5F5F5');
    });

    node.on('mouseleave', function () {
      setTooltip(null);
      node.style('opacity', 1);
      link.style('opacity', 0.6).attr('stroke', '#3E3E42')
        .attr('stroke-width', (d) => Math.max(1.5, Math.min((d as TagGraphLinkDatum).weight * 1.5, 8)));
      linkLabel.style('opacity', 1).attr('fill', '#6B7280');
    });

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => ((d.source as TagGraphNodeDatum).x ?? 0))
        .attr('y1', (d) => ((d.source as TagGraphNodeDatum).y ?? 0))
        .attr('x2', (d) => ((d.target as TagGraphNodeDatum).x ?? 0))
        .attr('y2', (d) => ((d.target as TagGraphNodeDatum).y ?? 0));
      linkLabel
        .attr('x', (d) => (((d.source as TagGraphNodeDatum).x ?? 0) + ((d.target as TagGraphNodeDatum).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as TagGraphNodeDatum).y ?? 0) + ((d.target as TagGraphNodeDatum).y ?? 0)) / 2 - 6);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [viewMode, tagGraph, queryClient]);

  const isLoading = viewMode === 'content' ? contentLoading : tagGraphLoading;
  const selectedTagForDelete = selectedNodeId ? allTags.find((t) => t.id === selectedNodeId) : null;

  const isEmpty = viewMode === 'content'
    ? !graphData || (graphData.tiles.length === 0 && graphData.sparks.length === 0)
    : !tagGraph || (tagGraph.nodes as TagNode[]).length === 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Graph" />

      {/* View mode toggle + toolbar */}
      <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        {/* Toggle pills */}
        <div className="flex bg-zinc-800 rounded-full p-0.5">
          <button
            onClick={() => setViewMode('content')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
              viewMode === 'content'
                ? 'bg-zinc-600 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            Contenuti
          </button>
          <button
            onClick={() => setViewMode('tags')}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-all',
              viewMode === 'tags'
                ? 'bg-zinc-600 text-white'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            Tag
          </button>
        </div>

        {/* Tag view: toolbar */}
        {viewMode === 'tags' && (
          <>
            <div className="w-px h-6 bg-zinc-700" />

            {/* Quick create */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nuovo tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                className="h-8 w-40 bg-zinc-800 border-zinc-700 text-white text-xs placeholder:text-zinc-500"
              />
              <div className="flex gap-1">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className="w-4 h-4 rounded-full transition-transform"
                    style={{
                      backgroundColor: color,
                      transform: newTagColor === color ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: newTagColor === color ? `0 0 0 2px ${color}50` : 'none',
                    }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Crea
              </Button>
            </div>

            <div className="flex-1" />

            {/* Link mode toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setLinkMode((p) => !p); setLinkSource(null); }}
              className={cn(
                'text-xs h-8',
                linkMode
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              )}
            >
              <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
              {linkMode ? 'Collegamento attivo' : 'Collega tag'}
            </Button>

            {/* Delete selected */}
            {selectedTagForDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteMutation.mutate(selectedTagForDelete.id)}
                className="text-xs h-8 text-red-400 border-red-900 hover:bg-red-950"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Elimina &quot;{selectedTagForDelete.name}&quot;
              </Button>
            )}

            {/* Stats */}
            <span className="text-xs text-zinc-500">
              {tagGraph?.nodes?.length || 0} tag &middot; {tagGraph?.edges ? Math.floor((tagGraph.edges as TagEdge[]).length / 2) : 0} relazioni
            </span>
          </>
        )}
      </div>

      {/* Content view: timeline slider */}
      {viewMode === 'content' && dateExtent && (
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
                setTimeRange((prev) => {
                  const distStart = Math.abs(pct - prev[0]);
                  const distEnd = Math.abs(pct - prev[1]);
                  if (distStart < distEnd) return [Math.min(pct, prev[1] - 2), prev[1]];
                  return [prev[0], Math.max(pct, prev[0] + 2)];
                });
              }}
            >
              <div
                className="absolute h-full bg-blue-500/50 rounded-full"
                style={{ left: `${timeRange[0]}%`, width: `${timeRange[1] - timeRange[0]}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-zinc-900 cursor-grab active:cursor-grabbing shadow-lg"
                style={{ left: `${timeRange[0]}%`, transform: `translate(-50%, -50%)` }}
                onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'start'; }}
              />
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

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden bg-zinc-950" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-400 text-lg">
              {viewMode === 'content' ? 'Nessun dato da visualizzare' : 'Nessun tag creato'}
            </p>
            <p className="text-zinc-500 text-sm mt-2">
              {viewMode === 'content'
                ? 'Crea dei tile e memo per vedere il grafo delle connessioni'
                : 'Crea dei tag dalla barra in alto per visualizzare il grafo'}
            </p>
          </div>
        ) : (
          <>
            {/* Content view: filter bar */}
            {viewMode === 'content' && (
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
                        style={{ backgroundColor: f.color, opacity: active ? 1 : 0.3 }}
                      />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content view: tag selector */}
            {viewMode === 'content' && graphData?.tags && graphData.tags.length > 0 && (
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
                      {isSelected && <span className="ml-1 text-[10px] opacity-60">&times;</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tag view: link mode indicator */}
            {viewMode === 'tags' && linkMode && (
              <div className="absolute top-4 left-4 z-10 bg-blue-600/20 border border-blue-500/40 rounded-lg px-4 py-2 text-sm text-blue-300 flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                {linkSource ? 'Clicca il tag di destinazione' : 'Clicca il primo tag da collegare'}
                <button
                  onClick={() => { setLinkMode(false); setLinkSource(null); }}
                  className="ml-2 text-blue-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <svg ref={svgRef} className="w-full h-full" />

            {/* Zoom controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button variant="outline" size="icon" onClick={handleZoomIn}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleZoomOut}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleFit}
                className="bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 text-zinc-300 h-9 w-9">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none bg-zinc-800 border border-zinc-600 rounded-lg p-3 shadow-xl max-w-[280px] z-50"
                style={{ left: tooltip.x + 16, top: tooltip.y - 10 }}
              >
                {tooltip.content}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
