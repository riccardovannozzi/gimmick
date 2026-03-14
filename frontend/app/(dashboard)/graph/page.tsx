'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as d3 from 'd3';
import { Header } from '@/components/layout/header';
import { sparksApi, tilesApi, tagsApi, uploadApi } from '@/lib/api';
import {
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Tag as TagIcon,
  Plus,
  X,
  Trash2,
  Link as LinkIcon,
  Pencil,
  Eye,
  Settings2,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TagNode, TagEdge } from '@/types';

// ─── Content filter types ───
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

const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#22C55E', '#06B6D4', '#F97316',
];

// ─── Node / Link types ───
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'root' | 'tile' | 'spark' | 'tag';
  label: string;
  sparkType?: string;
  tags?: string[];
  summary?: string;
  sparkCount?: number;
  color?: string;
  tileCount?: number;
  storagePath?: string;
  tagId?: string;
  usageCount?: number;
  isRoot?: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  linkType?: 'root-tag' | 'tag-tile' | 'tile-spark' | 'root-tile' | 'root-spark' | 'co-occurrence' | 'root-content';
  weight?: number;
  edgeId?: string;
  relationType?: string;
}

export default function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const queryClient = useQueryClient();

  // ─── State ───
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'spark' | 'tile';
    id: string;
    label: string;
  } | null>(null);

  // Toolbar mode
  const [toolbarMode, setToolbarMode] = useState<'navigate' | 'edit'>('navigate');

  // Content filters
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set(filterConfig.map((f) => f.key))
  );
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  // Tag management
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{
    tagFrom: string;
    tagTo: string;
    weight: number;
    relationType?: string;
    fromName: string;
    toName: string;
    x: number;
    y: number;
  } | null>(null);
  const [edgeEditLabel, setEdgeEditLabel] = useState('');

  const linkModeRef = useRef(linkMode);
  const linkSourceRef = useRef(linkSource);
  linkModeRef.current = linkMode;
  linkSourceRef.current = linkSource;

  // ─── Queries (both always active) ───
  const { data: contentData, isLoading: contentLoading } = useQuery({
    queryKey: ['graph-data'],
    queryFn: () => tilesApi.graph(),
  });
  const graphData = contentData?.data;

  const { data: tagGraphResult, isLoading: tagGraphLoading } = useQuery({
    queryKey: ['tag-graph'],
    queryFn: () => tagsApi.graph(),
  });
  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });
  const tagGraph = tagGraphResult?.data;
  const allTags = tagsResult?.data || [];

  // ─── Tag mutations ───
  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
      queryClient.invalidateQueries({ queryKey: ['graph-data'] });
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
      queryClient.invalidateQueries({ queryKey: ['graph-data'] });
      setSelectedNodeId(null);
      setSelectedTagId(null);
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

  // ─── Date range ───
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

  // ─── Callbacks ───
  const toggleFilter = useCallback((key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleTimelineDrag = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!trackRef.current || !draggingRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, 100 - ((e.clientY - rect.top) / rect.height) * 100));
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

  const handleCreateTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name) return;
    createMutation.mutate({ name, color: newTagColor });
  }, [newTagName, newTagColor, createMutation]);

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

  // ─── D3: Unified graph ───
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (!graphData && !tagGraph) return;

    const { tiles = [], sparks = [], tags: graphTags = [] } = graphData || { tiles: [], sparks: [], tags: [] };
    const tagNodes: TagNode[] = tagGraph ? (tagGraph.nodes as TagNode[]) : [];
    const tagEdges: TagEdge[] = tagGraph ? (tagGraph.edges as TagEdge[]) : [];

    const showTiles = activeFilters.has('tiles');

    const inTimeRange = (dateStr: string) => {
      if (!timeFilter) return true;
      const t = new Date(dateStr).getTime();
      return t >= timeFilter.from && t <= timeFilter.to;
    };

    const timeTiles = tiles.filter((t) => inTimeRange(t.created_at));
    const timeSparks = sparks.filter((m) => inTimeRange(m.created_at));
    const filteredSparks = timeSparks.filter((m) => activeFilters.has(m.type as FilterKey));

    const sparkCounts = new Map<string, number>();
    filteredSparks.forEach((m) => {
      if (m.tile_id) sparkCounts.set(m.tile_id, (sparkCounts.get(m.tile_id) || 0) + 1);
    });

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const selectedTag = selectedTagId
      ? graphTags.find((t) => t.id === selectedTagId)
      : null;

    if (selectedTag) {
      // ─── Focused tag mode ───
      const tagTileIdSet = new Set(selectedTag.tile_ids || []);
      const centerNode: GraphNode = {
        id: `tag-${selectedTag.id}`,
        type: 'tag',
        label: selectedTag.name,
        color: selectedTag.color || '#3B82F6',
        fx: width / 2,
        fy: height / 2,
        tileCount: selectedTag.tile_ids.length,
        tagId: selectedTag.id,
        usageCount: tagNodes.find((t) => t.id === selectedTag.id)?.usage_count || 0,
      };
      nodes.push(centerNode);

      // Connected tags via co-occurrence
      const connectedTagIds = new Set<string>();
      const seenPairs = new Set<string>();
      for (const edge of tagEdges) {
        if (edge.relation_type === 'root-link') continue;
        const key = [edge.tag_from, edge.tag_to].sort().join('-');
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        let otherTagId: string | null = null;
        if (edge.tag_from === selectedTag.id) otherTagId = edge.tag_to;
        else if (edge.tag_to === selectedTag.id) otherTagId = edge.tag_from;
        if (!otherTagId) continue;
        const otherTag = tagNodes.find((t) => t.id === otherTagId);
        if (!otherTag || otherTag.is_root) continue;
        connectedTagIds.add(otherTagId);
        nodes.push({
          id: `tag-${otherTagId}`,
          type: 'tag',
          label: otherTag.name,
          color: otherTag.color || '#3B82F6',
          tagId: otherTagId,
          usageCount: otherTag.usage_count || 0,
          tileCount: graphTags.find((gt) => gt.id === otherTagId)?.tile_ids.length || 0,
        });
        links.push({
          source: `tag-${selectedTag.id}`,
          target: `tag-${otherTagId}`,
          linkType: 'co-occurrence',
          weight: edge.weight,
          edgeId: edge.id,
          relationType: edge.relation_type,
        });
      }

      const connectedTiles = timeTiles.filter((t) => tagTileIdSet.has(t.id));
      connectedTiles.forEach((tile) => {
        nodes.push({
          id: `tile-${tile.id}`,
          type: 'tile',
          label: tile.title || 'Tile senza titolo',
          sparkCount: sparkCounts.get(tile.id) || 0,
        });
        links.push({ source: `tag-${selectedTag.id}`, target: `tile-${tile.id}`, linkType: 'tag-tile' });
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
            storagePath: (spark as any).storage_path || undefined,
          });
          links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}`, linkType: 'tile-spark' });
        }
      });
    } else {
      // ─── Full graph mode ───
      if (tagNodes.length === 0 && filteredSparks.length === 0 && (!showTiles || timeTiles.length === 0)) return;

      const rootNode: GraphNode = {
        id: 'root',
        type: 'root',
        label: 'Gimmick',
        fx: width / 2,
        fy: height / 2,
      };
      nodes.push(rootNode);

      // Tag nodes from tagGraph (skip GIMMICK root)
      const tagNodeMap = new Map<string, GraphNode>();
      for (const t of tagNodes) {
        if (t.is_root) continue;
        const node: GraphNode = {
          id: `tag-${t.id}`,
          type: 'tag',
          label: t.name,
          color: t.color || '#3B82F6',
          tagId: t.id,
          usageCount: t.usage_count || 0,
          isRoot: false,
          tileCount: 0,
        };
        tagNodeMap.set(t.id, node);
        nodes.push(node);
        links.push({ source: 'root', target: `tag-${t.id}`, linkType: 'root-tag' });
      }

      // Also add tags from content data that might not be in tagGraph
      for (const tag of graphTags) {
        if (!tagNodeMap.has(tag.id)) {
          const node: GraphNode = {
            id: `tag-${tag.id}`,
            type: 'tag',
            label: tag.name,
            color: tag.color || '#3B82F6',
            tagId: tag.id,
            tileCount: tag.tile_ids.length,
          };
          tagNodeMap.set(tag.id, node);
          nodes.push(node);
          links.push({ source: 'root', target: `tag-${tag.id}`, linkType: 'root-tag' });
        }
      }

      // Update tileCount from content data
      for (const tag of graphTags) {
        const node = tagNodeMap.get(tag.id);
        if (node) node.tileCount = tag.tile_ids.length;
      }

      // Tag-to-tag co-occurrence edges
      const seenPairs = new Set<string>();
      for (const edge of tagEdges) {
        if (edge.relation_type === 'root-link') continue;
        const key = [edge.tag_from, edge.tag_to].sort().join('-');
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        if (tagNodeMap.has(edge.tag_from) && tagNodeMap.has(edge.tag_to)) {
          links.push({
            source: `tag-${edge.tag_from}`,
            target: `tag-${edge.tag_to}`,
            linkType: 'co-occurrence',
            weight: edge.weight,
            edgeId: edge.id,
            relationType: edge.relation_type,
          });
        }
      }

      // Tile nodes
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

      // Tag→tile links
      const tilesLinkedByTag = new Set<string>();
      if (showTiles) {
        for (const tag of graphTags) {
          if (!tagNodeMap.has(tag.id)) continue;
          const validTileIds = tag.tile_ids.filter((tid) => tileNodeIds.has(`tile-${tid}`));
          validTileIds.forEach((tileId) => {
            links.push({ source: `tag-${tag.id}`, target: `tile-${tileId}`, linkType: 'tag-tile' });
            tilesLinkedByTag.add(`tile-${tileId}`);
          });
        }
        // Tiles without tags → root
        timeTiles.forEach((tile) => {
          if (!tilesLinkedByTag.has(`tile-${tile.id}`))
            links.push({ source: 'root', target: `tile-${tile.id}`, linkType: 'root-tile' });
        });
      }

      // Spark nodes
      filteredSparks.forEach((spark) => {
        nodes.push({
          id: `spark-${spark.id}`,
          type: 'spark',
          label: spark.label,
          sparkType: spark.type,
          tags: spark.tags,
          summary: spark.summary || undefined,
          storagePath: (spark as any).storage_path || undefined,
        });
        if (showTiles && spark.tile_id)
          links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}`, linkType: 'tile-spark' });
        else
          links.push({ source: 'root', target: `spark-${spark.id}`, linkType: 'root-spark' });
      });
    }

    // ─── SVG setup ───
    svg.attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
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

    // ─── Simulation ───
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .alphaDecay(0.03)
      .velocityDecay(0.4)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const lt = l.linkType;
            if (lt === 'co-occurrence') {
              const w = l.weight || 1;
              return Math.max(100, 220 - w * 15);
            }
            if (lt === 'root-tag' || lt === 'root-tile' || lt === 'root-spark') return 160;
            if (lt === 'tag-tile') return 120;
            return 90;
          })
          .strength((l) => {
            if (l.linkType === 'co-occurrence') return 0.7;
            return 0.5;
          })
      )
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(600))
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d) => {
          if (d.type === 'root') return 50;
          if (d.type === 'tag') return 24 + Math.min((d.usageCount || 0) * 3, 20) + 12;
          if (d.type === 'tile') return 40;
          return 22;
        }).strength(0.8)
      );

    // ─── Links rendering ───
    const coLinks = links.filter((l) => l.linkType === 'co-occurrence');
    const otherLinks = links.filter((l) => l.linkType !== 'co-occurrence');

    // Regular links
    const linkOther = g
      .append('g')
      .selectAll('line')
      .data(otherLinks)
      .join('line')
      .attr('stroke', (l) => {
        if (l.linkType === 'root-tag') return '#528BFF';
        if (l.linkType === 'tag-tile') return '#6B7280';
        if (l.linkType === 'tile-spark') return '#4B5563';
        return '#3E3E42';
      })
      .attr('stroke-width', (l) => {
        if (l.linkType === 'root-tag') return 1.5;
        if (l.linkType === 'tag-tile') return 2;
        return 1.5;
      })
      .attr('stroke-opacity', (l) => {
        if (l.linkType === 'root-tag') return 0.4;
        if (l.linkType === 'tag-tile') return 0.7;
        return 0.6;
      })
      .attr('stroke-dasharray', (l) => {
        if (l.linkType === 'root-tag') return '6,4';
        return 'none';
      });

    // Co-occurrence hit areas
    const linkCoHit = g
      .append('g')
      .selectAll('line')
      .data(coLinks)
      .join('line')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .style('cursor', 'pointer');

    // Co-occurrence visible links
    const linkCo = g
      .append('g')
      .selectAll('line')
      .data(coLinks)
      .join('line')
      .attr('stroke', (l) => {
        // Color based on source tag color
        const src = typeof l.source === 'string'
          ? nodes.find((n) => n.id === l.source)
          : (l.source as GraphNode);
        return src?.color || '#8B5CF6';
      })
      .attr('stroke-width', (l) => Math.max(2, Math.min((l.weight || 1) * 2, 10)))
      .attr('stroke-opacity', 0.5)
      .style('pointer-events', 'none');

    // Co-occurrence weight labels
    const linkCoLabel = g
      .append('g')
      .selectAll('text')
      .data(coLinks)
      .join('text')
      .text((l) => (l.weight || 0) > 0 ? (l.weight || 0).toFixed(0) : '')
      .attr('text-anchor', 'middle')
      .attr('fill', '#9CA3AF')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .style('pointer-events', 'none');

    // Edge click → edit popover
    linkCoHit.on('click', (event, d) => {
      event.stopPropagation();
      const src = d.source as GraphNode;
      const tgt = d.target as GraphNode;
      const [px, py] = d3.pointer(event, containerRef.current);
      setSelectedEdge({
        tagFrom: src.tagId!,
        tagTo: tgt.tagId!,
        weight: d.weight || 0,
        relationType: d.relationType,
        fromName: src.label,
        toName: tgt.label,
        x: px,
        y: py,
      });
      setEdgeEditLabel(d.relationType || '');
    });

    // ─── Nodes rendering ───
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

    // Root node (hexagon + Bot icon)
    const hexPoints = (r: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i;
        return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
      }).join(' ');

    const rootNodes = node.filter((d) => d.type === 'root');
    rootNodes.append('polygon')
      .attr('points', hexPoints(24))
      .attr('fill', '#528BFF').attr('fill-opacity', 0.15)
      .attr('stroke', '#FFFFFF').attr('stroke-width', 1.5)
      .style('filter', 'url(#glow)');
    rootNodes.each(function () {
      const iconG = d3.select(this).append('g')
        .attr('transform', 'translate(-10,-10) scale(0.85)')
        .style('pointer-events', 'none');
      const svgNS = 'http://www.w3.org/2000/svg';
      const paths = ['M12 8V4H8', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'];
      paths.forEach((d) => {
        const p = document.createElementNS(svgNS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', '#FFFFFF');
        p.setAttribute('stroke-width', '2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        iconG.node()!.appendChild(p);
      });
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('width', '16'); rect.setAttribute('height', '12');
      rect.setAttribute('x', '4'); rect.setAttribute('y', '8'); rect.setAttribute('rx', '2');
      rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', '#FFFFFF');
      rect.setAttribute('stroke-width', '2'); rect.setAttribute('stroke-linecap', 'round');
      rect.setAttribute('stroke-linejoin', 'round');
      iconG.node()!.appendChild(rect);
    });
    rootNodes.append('text')
      .text('GIMMICK')
      .attr('text-anchor', 'middle').attr('dy', 38).attr('fill', '#4B5563')
      .attr('font-size', '10px').attr('font-weight', '700').style('pointer-events', 'none');

    // Tag nodes (circle with usage-based radius)
    const tagNodesG = node.filter((d) => d.type === 'tag');
    tagNodesG.append('circle')
      .attr('r', (d) => 24 + Math.min((d.usageCount || 0) * 3, 20))
      .attr('fill', (d) => d.color || '#3B82F6').attr('fill-opacity', 0.15)
      .attr('stroke', (d) => d.color || '#3B82F6').attr('stroke-width', 2.5)
      .style('filter', 'url(#glow)').style('cursor', 'pointer');
    tagNodesG.append('text')
      .text((d) => d.label.length > 14 ? d.label.slice(0, 12) + '...' : d.label)
      .attr('text-anchor', 'middle').attr('dy', '-0.2em').attr('fill', '#F5F5F5')
      .attr('font-size', '11px').attr('font-weight', '700').style('pointer-events', 'none');
    tagNodesG.append('text')
      .text((d) => `${d.usageCount || d.tileCount || 0} tile`)
      .attr('text-anchor', 'middle').attr('dy', '1.2em').attr('fill', '#6B7280')
      .attr('font-size', '9px').style('pointer-events', 'none');

    // Tile nodes (square shape)
    const tileSize = (d: GraphNode) => 2 * (18 + Math.min((d.sparkCount || 0) * 2, 16));
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

    // ─── Interactions ───

    // Tag click: link mode or focus
    tagNodesG.on('click', (event, d) => {
      event.stopPropagation();
      const tagId = d.tagId || d.id.replace('tag-', '');
      if (linkModeRef.current) {
        if (!linkSourceRef.current) {
          setLinkSource(tagId);
          toast.info(`Seleziona il tag di destinazione per collegare "${d.label}"`);
        } else if (linkSourceRef.current !== tagId) {
          tagsApi.updateRelation(linkSourceRef.current, tagId, 1).then(() => {
            queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
            queryClient.invalidateQueries({ queryKey: ['graph-data'] });
            toast.success('Relazione creata');
          }).catch(() => toast.error("Errore nell'aggiornamento relazione"));
          setLinkSource(null);
          setLinkMode(false);
        }
      } else {
        setSelectedTagId((prev) => (prev === tagId ? null : tagId));
        setSelectedNodeId((prev) => (prev === tagId ? null : tagId));
      }
    });

    // Right-click context menu on sparks and tiles
    node.filter((d) => d.type === 'spark' || d.type === 'tile')
      .on('contextmenu', (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        const [px, py] = d3.pointer(event, containerRef.current);
        const rawId = d.type === 'spark' ? d.id.replace('spark-', '') : d.id.replace('tile-', '');
        setContextMenu({ x: px, y: py, type: d.type as 'spark' | 'tile', id: rawId, label: d.label });
      });

    // Hover: tooltip + highlight
    node.on('mouseenter', function (event, d) {
      const [x, y] = d3.pointer(event, containerRef.current);
      const isImage = d.type === 'spark' && (d.sparkType === 'photo' || d.sparkType === 'image') && d.storagePath;

      const buildTooltip = (imageUrl?: string) => ({
        x, y,
        content: (
          <>
            {imageUrl && (
              <img src={imageUrl} alt="" className="rounded-md mb-2 max-w-[180px] max-h-[140px] object-cover" />
            )}
            {d.type === 'tag' ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <p className="text-white text-sm font-semibold">{d.label}</p>
                </div>
                <p className="text-zinc-400 text-xs">{d.usageCount || d.tileCount || 0} tile associati</p>
                <p className="text-zinc-500 text-[10px] mt-1">Clicca per centrare</p>
              </>
            ) : (
              <>
                <p className="text-white text-sm font-medium mb-1">
                  {d.type === 'root' ? 'Root' : d.type === 'tile' ? 'Tile' : typeLabels[d.sparkType || ''] || 'Spark'}
                </p>
                <p className="text-zinc-300 text-xs">{d.label}</p>
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
            )}
          </>
        ),
      });

      setTooltip(buildTooltip());

      if (isImage) {
        uploadApi.getSignedUrl(d.storagePath!).then((res) => {
          if (res.success && res.data) {
            setTooltip(buildTooltip(res.data.url));
          }
        }).catch(() => {});
      }

      // Highlight connected
      node.style('opacity', 0.2);
      linkOther.attr('stroke-opacity', 0.05);
      linkCo.attr('stroke-opacity', 0.05);
      linkCoLabel.attr('fill-opacity', 0.05);
      const connectedIds = new Set<string>();
      connectedIds.add(d.id);
      links.forEach((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        if (src === d.id) connectedIds.add(tgt);
        if (tgt === d.id) connectedIds.add(src);
      });
      node.filter((n) => connectedIds.has(n.id)).style('opacity', 1);
      linkOther.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return src === d.id || tgt === d.id;
      }).attr('stroke-opacity', 0.8).attr('stroke', d.type === 'tag' ? (d.color || '#528BFF') : '#528BFF').attr('stroke-width', 2);
      linkCo.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return src === d.id || tgt === d.id;
      }).attr('stroke-opacity', 0.9).attr('stroke', d.color || '#528BFF')
        .attr('stroke-width', (l) => Math.max(2, Math.min((l.weight || 1) * 2, 10)));
      linkCoLabel.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return src === d.id || tgt === d.id;
      }).attr('fill-opacity', 1).attr('fill', '#F5F5F5');
    });

    node.on('mouseleave', function () {
      setTooltip(null);
      node.style('opacity', 1);
      linkOther
        .attr('stroke', (l) => {
          if (l.linkType === 'root-tag') return '#528BFF';
          if (l.linkType === 'tag-tile') return '#6B7280';
          if (l.linkType === 'tile-spark') return '#4B5563';
          return '#3E3E42';
        })
        .attr('stroke-width', (l) => {
          if (l.linkType === 'root-tag') return 1.5;
          if (l.linkType === 'tag-tile') return 2;
          return 1.5;
        })
        .attr('stroke-opacity', (l) => {
          if (l.linkType === 'root-tag') return 0.4;
          if (l.linkType === 'tag-tile') return 0.7;
          return 0.6;
        });
      linkCo
        .attr('stroke', (l) => {
          const src = typeof l.source === 'string'
            ? nodes.find((n) => n.id === (l.source as string))
            : (l.source as GraphNode);
          return src?.color || '#8B5CF6';
        })
        .attr('stroke-width', (l) => Math.max(2, Math.min((l.weight || 1) * 2, 10)))
        .attr('stroke-opacity', 0.5);
      linkCoLabel.attr('fill-opacity', 1).attr('fill', '#9CA3AF');
    });

    // ─── Tick ───
    simulation.on('tick', () => {
      linkOther
        .attr('x1', (d) => ((d.source as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GraphNode).y ?? 0));
      linkCoHit
        .attr('x1', (d) => ((d.source as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GraphNode).y ?? 0));
      linkCo
        .attr('x1', (d) => ((d.source as GraphNode).x ?? 0))
        .attr('y1', (d) => ((d.source as GraphNode).y ?? 0))
        .attr('x2', (d) => ((d.target as GraphNode).x ?? 0))
        .attr('y2', (d) => ((d.target as GraphNode).y ?? 0));
      linkCoLabel
        .attr('x', (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2 - 6);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    svg.on('click', () => {
      setContextMenu(null);
      setSelectedEdge(null);
      setFilterDropdownOpen(false);
      setTagDropdownOpen(false);
      if (linkModeRef.current) { setLinkSource(null); setLinkMode(false); }
      // Reset all highlights
      node.style('opacity', 1);
      linkOther
        .attr('stroke', (l) => {
          if (l.linkType === 'root-tag') return '#528BFF';
          if (l.linkType === 'tag-tile') return '#6B7280';
          if (l.linkType === 'tile-spark') return '#4B5563';
          return '#3E3E42';
        })
        .attr('stroke-width', (l) => {
          if (l.linkType === 'root-tag') return 1.5;
          if (l.linkType === 'tag-tile') return 2;
          return 1.5;
        })
        .attr('stroke-opacity', (l) => {
          if (l.linkType === 'root-tag') return 0.4;
          if (l.linkType === 'tag-tile') return 0.7;
          return 0.6;
        });
      linkCo
        .attr('stroke', (l) => {
          const src = typeof l.source === 'string'
            ? nodes.find((n) => n.id === (l.source as string))
            : (l.source as GraphNode);
          return src?.color || '#8B5CF6';
        })
        .attr('stroke-width', (l) => Math.max(2, Math.min((l.weight || 1) * 2, 10)))
        .attr('stroke-opacity', 0.5);
      linkCoLabel.attr('fill-opacity', 1).attr('fill', '#9CA3AF');
    });

    return () => { simulation.stop(); };
  }, [graphData, tagGraph, activeFilters, timeFilter, selectedTagId, queryClient]);

  // ─── Derived state ───
  const isLoading = contentLoading || tagGraphLoading;
  const selectedTagForDelete = selectedNodeId ? allTags.find((t) => t.id === selectedNodeId) : null;
  const isEmpty = (!graphData || (graphData.tiles.length === 0 && graphData.sparks.length === 0))
    && (!tagGraph || (tagGraph.nodes as TagNode[]).length === 0);

  return (
    <div className="flex flex-col h-full">
      <Header title="Graph" />

      {/* Toolbar */}
      <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        {/* Mode toggle */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => { setToolbarMode('navigate'); setLinkMode(false); setLinkSource(null); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              toolbarMode === 'navigate'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Navigate
          </button>
          <button
            onClick={() => setToolbarMode('edit')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              toolbarMode === 'edit'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-300'
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Edit Tag
          </button>
        </div>

        <div className="w-px h-6 bg-zinc-700" />

        {toolbarMode === 'navigate' ? (
          <>
            {/* Filter dropdown */}
            <div className="relative">
              <button
                onClick={() => { setFilterDropdownOpen((p) => !p); setTagDropdownOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-750 transition-all h-8"
              >
                <Filter className="h-3.5 w-3.5" />
                Filtri
                {activeFilters.size < filterConfig.length && (
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 rounded-full">{activeFilters.size}</span>
                )}
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
              {filterDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                  {filterConfig.map((f) => {
                    const active = activeFilters.has(f.key);
                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleFilter(f.key)}
                        className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-zinc-700/50 transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded-full border-2 flex items-center justify-center"
                          style={{ borderColor: f.color, backgroundColor: active ? f.color : 'transparent' }}
                        />
                        <span className={active ? 'text-white' : 'text-zinc-500'}>{f.label}</span>
                      </button>
                    );
                  })}
                  <div className="border-t border-zinc-700 mt-1 pt-1">
                    <button
                      onClick={() => setActiveFilters(new Set(filterConfig.map((f) => f.key)))}
                      className="w-full px-3 py-1.5 text-left text-xs text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                    >
                      Mostra tutti
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tag dropdown */}
            <div className="relative">
              <button
                onClick={() => { setTagDropdownOpen((p) => !p); setFilterDropdownOpen(false); }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all h-8',
                  selectedTagId
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
                )}
              >
                <TagIcon className="h-3.5 w-3.5" />
                {selectedTagId
                  ? graphData?.tags?.find((t) => t.id === selectedTagId)?.name || 'Tag'
                  : 'Tag'}
                <ChevronDown className="h-3 w-3 ml-1" />
              </button>
              {tagDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[300px] overflow-y-auto">
                  <button
                    onClick={() => { setSelectedTagId(null); setTagDropdownOpen(false); }}
                    className={cn(
                      'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-zinc-700/50 transition-colors',
                      !selectedTagId ? 'text-white bg-zinc-700/30' : 'text-zinc-400'
                    )}
                  >
                    Tutti i tag
                  </button>
                  <div className="border-t border-zinc-700 my-1" />
                  {graphData?.tags?.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => { setSelectedTagId(tag.id); setTagDropdownOpen(false); }}
                      className={cn(
                        'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-zinc-700/50 transition-colors',
                        selectedTagId === tag.id ? 'text-white bg-zinc-700/30' : 'text-zinc-400'
                      )}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                      {tag.name}
                      <span className="ml-auto text-[10px] text-zinc-600">{tag.tile_ids.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear tag selection */}
            {selectedTagId && (
              <button
                onClick={() => setSelectedTagId(null)}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </>
        ) : (
          <>
            {/* Edit mode: create tag */}
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

            <div className="w-px h-6 bg-zinc-700" />

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

            {/* Delete selected tag */}
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
          </>
        )}

        <div className="flex-1" />

        {/* Stats */}
        <span className="text-xs text-zinc-500">
          {tagGraph?.nodes ? (tagGraph.nodes as TagNode[]).filter((t) => !t.is_root).length : 0} tag
          {' '}&middot;{' '}
          {tagGraph?.edges ? Math.floor((tagGraph.edges as TagEdge[]).filter((e) => e.relation_type !== 'root-link').length / 2) : 0} relazioni
        </span>
      </div>

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden bg-zinc-950" ref={containerRef}>
        {/* Timeline slider (right side) */}
        {dateExtent && (
          <div className="absolute right-0 top-0 bottom-0 z-10 w-12 flex flex-col items-center py-4">
            {[1, 2, 7, 30].map((days) => {
              const totalRange = dateExtent.max - dateExtent.min;
              const daysMs = days * 24 * 60 * 60 * 1000;
              const startPct = totalRange > 0 ? Math.max(0, ((totalRange - daysMs) / totalRange) * 100) : 0;
              const isActive = Math.abs(timeRange[0] - startPct) < 1 && Math.abs(timeRange[1] - 100) < 1;
              return (
                <button
                  key={days}
                  onClick={() => setTimeRange([startPct, 100])}
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded mb-1 transition-colors ${
                    isActive ? 'bg-blue-500/30 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/30'
                  }`}
                >
                  {days}gg
                </button>
              );
            })}
            <div className="h-8" />
            <span className="text-[10px] text-zinc-400 mb-2 leading-tight text-center">
              {new Date(dateExtent.min + (timeRange[1] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
            <div className="flex-1 relative w-6 flex justify-center">
              <div
                ref={trackRef}
                className="h-full w-2.5 bg-zinc-700/15 rounded-full relative cursor-pointer"
                onClick={(e) => {
                  if (!trackRef.current) return;
                  const rect = trackRef.current.getBoundingClientRect();
                  const pct = 100 - ((e.clientY - rect.top) / rect.height) * 100;
                  setTimeRange((prev) => {
                    const distStart = Math.abs(pct - prev[0]);
                    const distEnd = Math.abs(pct - prev[1]);
                    if (distStart < distEnd) return [Math.min(pct, prev[1] - 2), prev[1]];
                    return [prev[0], Math.max(pct, prev[0] + 2)];
                  });
                }}
              >
                <div
                  className="absolute w-full bg-blue-500/12 rounded-full"
                  style={{ top: `${100 - timeRange[1]}%`, height: `${timeRange[1] - timeRange[0]}%` }}
                />
                <div
                  className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-zinc-900 cursor-grab active:cursor-grabbing shadow-lg"
                  style={{ top: `${100 - timeRange[1]}%`, left: '50%', transform: 'translate(-50%, -50%)' }}
                  onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'end'; }}
                />
                <div
                  className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-zinc-900 cursor-grab active:cursor-grabbing shadow-lg"
                  style={{ top: `${100 - timeRange[0]}%`, left: '50%', transform: 'translate(-50%, -50%)' }}
                  onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'start'; }}
                />
              </div>
            </div>
            <span className="text-[10px] text-zinc-400 mt-2 leading-tight text-center">
              {new Date(dateExtent.min + (timeRange[0] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-400 text-lg">Nessun dato da visualizzare</p>
            <p className="text-zinc-500 text-sm mt-2">
              Crea dei tile e spark per vedere il grafo delle connessioni
            </p>
          </div>
        ) : (
          <>
            {/* Link mode indicator */}
            {linkMode && (
              <div className="absolute top-4 left-4 z-20 bg-blue-600/20 border border-blue-500/40 rounded-lg px-4 py-2 text-sm text-blue-300 flex items-center gap-2">
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
            <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
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

            {/* Context menu (right-click on spark/tile) */}
            {contextMenu && (
              <div
                className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl py-1 min-w-[160px]"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="px-3 py-1.5 text-xs text-zinc-400 truncate border-b border-zinc-700">
                  {contextMenu.type === 'tile' ? 'Tile' : 'Spark'}: {contextMenu.label}
                </p>
                <button
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/50 flex items-center gap-2"
                  onClick={async () => {
                    try {
                      if (contextMenu.type === 'spark') {
                        await sparksApi.delete(contextMenu.id);
                      } else {
                        await tilesApi.delete(contextMenu.id);
                      }
                      queryClient.invalidateQueries({ queryKey: ['graph-data'] });
                      toast.success(`${contextMenu.type === 'tile' ? 'Tile' : 'Spark'} eliminato`);
                    } catch {
                      toast.error('Errore durante l\'eliminazione');
                    }
                    setContextMenu(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Elimina
                </button>
              </div>
            )}

            {/* Edge edit popover */}
            {selectedEdge && (
              <div
                className="absolute z-50 bg-zinc-800 border border-zinc-600 rounded-lg p-3 shadow-xl w-64"
                style={{ left: selectedEdge.x + 16, top: selectedEdge.y - 10 }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-xs text-zinc-400 mb-2 truncate">
                  {selectedEdge.fromName} &harr; {selectedEdge.toName}
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={edgeEditLabel}
                    onChange={(e) => setEdgeEditLabel(e.target.value)}
                    placeholder="Tipo relazione..."
                    className="h-7 text-xs bg-zinc-900 border-zinc-700 text-white flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        tagsApi.updateRelation(selectedEdge.tagFrom, selectedEdge.tagTo, selectedEdge.weight, edgeEditLabel || undefined).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                          toast.success('Relazione aggiornata');
                          setSelectedEdge(null);
                        }).catch(() => toast.error('Errore'));
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                      tagsApi.updateRelation(selectedEdge.tagFrom, selectedEdge.tagTo, selectedEdge.weight, edgeEditLabel || undefined).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                        toast.success('Relazione aggiornata');
                        setSelectedEdge(null);
                      }).catch(() => toast.error('Errore'));
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950 px-2"
                    onClick={() => {
                      tagsApi.deleteRelation(selectedEdge.tagFrom, selectedEdge.tagTo).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                        toast.success('Relazione eliminata');
                        setSelectedEdge(null);
                      }).catch(() => toast.error('Errore'));
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Elimina
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-zinc-400 hover:text-zinc-300 px-2"
                    onClick={() => setSelectedEdge(null)}
                  >
                    Chiudi
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
