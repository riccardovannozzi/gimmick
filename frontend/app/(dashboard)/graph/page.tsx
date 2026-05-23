'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as d3 from 'd3';
import { Header } from '@/components/layout/header';
import { sparksApi, tilesApi, tagsApi, uploadApi, settingsApi } from '@/lib/api';
import { IconLoader2, IconZoomIn, IconZoomOut, IconMaximize, IconTag, IconPlus, IconX, IconTrash, IconLink, IconPencil, IconEye, IconSettings2, IconChevronDown, IconFilter, IconAdjustmentsHorizontal, IconPalette } from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { useActionColors } from '@/store/action-colors-store';
import { useTagTypes } from '@/store/tag-types-store';
import type { TagNode, TagEdge, ActionType } from '@/types';

// ─── Content filter types ───
type FilterKey = 'tiles' | 'photo' | 'image' | 'video' | 'audio_recording' | 'text' | 'file';

// Filter list (chip labels). Colors are resolved at runtime against theme.cap
// — see filterColor() inside the component so they react to palette changes.
const filterConfig: { key: FilterKey; label: string }[] = [
  { key: 'tiles', label: 'Tiles' },
  { key: 'photo', label: 'Foto' },
  { key: 'image', label: 'Galleria' },
  { key: 'video', label: 'Video' },
  { key: 'audio_recording', label: 'Voce' },
  { key: 'text', label: 'Testo' },
  { key: 'file', label: 'File' },
];

const typeLabels: Record<string, string> = {
  photo: 'Foto',
  image: 'Immagine',
  video: 'Video',
  audio_recording: 'Audio',
  text: 'Testo',
  file: 'File',
};

// ─── Physics defaults ───
const defaultPhysics = {
  showTagClusters: 0, // 0 = off, 1 = on (number for uniform slider handling)
  chargeTag: -400,
  chargeTile: -250,
  chargeSpark: -100,
  chargeMax: 800,
  linkCoDist: 250,
  linkTagTile: 140,
  linkTileSpark: 80,
  linkCoStrength: 0.3,
  linkTagTileStrength: 0.4,
  collisionTag: 50,
  collisionTile: 50,
  collisionSpark: 24,
  centerStrength: 0.02,
  tagClusterStrength: 0.12,
  velocityDecay: 0.3,
  linkWidth: 2,
};

// ─── Node / Link types ───
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'tile' | 'spark' | 'tag';
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
  actionType?: string;
  tagType?: string;
}

// ACTION_TYPE_COLORS is now dynamic — loaded from useActionColors() hook inside the component

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  linkType?: 'tag-tile' | 'tile-spark' | 'co-occurrence';
  weight?: number;
  edgeId?: string;
  relationType?: string;
}

export default function GraphPage() {
  const theme = usePixelTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const queryClient = useQueryClient();
  const markRead = useTileNotificationStore((s) => s.markRead);
  const ACTION_TYPE_COLORS = useActionColors();
  const { tagTypes: tagTypeEntities, getEmoji: getTagTypeEmoji, getColor: getTagTypeColor } = useTagTypes();

  // Theme-aware spark type colors (sourced from theme.cap so capture/spark
  // chrome remains in sync with the rest of the app's palette).
  const typeColors: Record<string, string> = useMemo(() => ({
    photo: theme.cap.photo,
    image: theme.cap.gallery,
    video: theme.cap.video,
    audio_recording: theme.cap.voice,
    text: theme.cap.text,
    file: theme.cap.file,
  }), [theme.cap]);
  const filterColor = useCallback((key: FilterKey) => {
    if (key === 'tiles') return theme.accent;
    return typeColors[key] || theme.ink3;
  }, [typeColors, theme.accent, theme.ink3]);
  const TAG_NODE_COLOR_THEME = theme.ink3;

  // ─── State ───
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: React.ReactNode;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'spark' | 'tile' | 'tag';
    id: string;
    label: string;
    color?: string;
  } | null>(null);
  const [tagRenameValue, setTagRenameValue] = useState('');
  const [tagRenaming, setTagRenaming] = useState(false);

  // Physics console
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false);
  const [physics, setPhysics] = useState(defaultPhysics);
  const physicsRef = useRef(physics);
  physicsRef.current = physics;

  // Load saved physics from settings
  useEffect(() => {
    settingsApi.get<typeof defaultPhysics>('graph_physics').then((res) => {
      if (res.data) setPhysics({ ...defaultPhysics, ...res.data });
    }).catch(() => {});
  }, []);

  // Toolbar mode
  const [toolbarMode, setToolbarMode] = useState<'navigate' | 'edit'>('navigate');

  // Content filters
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set(filterConfig.map((f) => f.key))
  );
  const searchParams = useSearchParams();
  const tagParam = searchParams.get('tag');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Sync from URL param
  useEffect(() => {
    if (tagParam) setSelectedTagId(tagParam);
  }, [tagParam]);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 100]);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);

  // Tag management
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor] = useState(TAG_NODE_COLOR_THEME);
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

  const updateTagMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; color?: string } }) =>
      tagsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
      queryClient.invalidateQueries({ queryKey: ['graph-data'] });
      setContextMenu(null);
      setTagRenaming(false);
      toast.success('Tag aggiornato');
    },
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
    createMutation.mutate({ name });
  }, [newTagName, createMutation]);

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

    const isEditMode = toolbarMode === 'edit';

    if (selectedTag && !isEditMode) {
      // ─── Focused tag mode ───
      const tagTileIdSet = new Set(selectedTag.tile_ids || []);
      const tagTypeOf = (tagId: string): string =>
        allTags.find((tg) => tg.id === tagId)?.tag_type || 'topic';
      const colorFor = (tagId: string): string =>
        getTagTypeColor(tagTypeOf(tagId)) || TAG_NODE_COLOR_THEME;
      const centerNode: GraphNode = {
        id: `tag-${selectedTag.id}`,
        type: 'tag',
        label: selectedTag.name,
        color: colorFor(selectedTag.id),
        fx: width / 2,
        fy: height / 2,
        tileCount: selectedTag.tile_ids.length,
        tagId: selectedTag.id,
        usageCount: tagNodes.find((t) => t.id === selectedTag.id)?.usage_count || 0,
        tagType: tagTypeOf(selectedTag.id),
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
          color: colorFor(otherTagId),
          tagId: otherTagId,
          usageCount: otherTag.usage_count || 0,
          tileCount: graphTags.find((gt) => gt.id === otherTagId)?.tile_ids.length || 0,
          tagType: tagTypeOf(otherTagId),
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
          actionType: tile.action_type || 'none',
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
            storagePath: (spark as Record<string, unknown>).storage_path as string || undefined,
          });
          links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}`, linkType: 'tile-spark' });
        }
      });
    } else {
      // ─── Full graph mode ───
      if (isEditMode) {
        if (tagNodes.length === 0) return;
      } else {
        if (tagNodes.length === 0 && filteredSparks.length === 0 && (!showTiles || timeTiles.length === 0)) return;
      }

      // Build tag_type lookup from allTags
      const tagTypeMap = new Map<string, string>();
      for (const tag of allTags) {
        tagTypeMap.set(tag.id, tag.tag_type || 'topic');
      }

      // Tag nodes from tagGraph (include GIMMICK root as a regular tag node)
      const tagNodeMap = new Map<string, GraphNode>();
      let gimmickNodeId: string | null = null;
      const colorForTagType = (tt: string): string => getTagTypeColor(tt) || TAG_NODE_COLOR_THEME;
      for (const t of tagNodes) {
        const tt = tagTypeMap.get(t.id) || 'topic';
        const node: GraphNode = {
          id: `tag-${t.id}`,
          type: 'tag',
          label: t.name,
          color: colorForTagType(tt),
          tagId: t.id,
          usageCount: t.usage_count || 0,
          isRoot: t.is_root || false,
          tileCount: 0,
          tagType: tt,
        };
        tagNodeMap.set(t.id, node);
        nodes.push(node);
        if (t.is_root) gimmickNodeId = `tag-${t.id}`;
      }

      // Also add tags from content data that might not be in tagGraph
      for (const tag of graphTags) {
        if (!tagNodeMap.has(tag.id)) {
          const tt = tagTypeMap.get(tag.id) || 'topic';
          const node: GraphNode = {
            id: `tag-${tag.id}`,
            type: 'tag',
            label: tag.name,
            color: colorForTagType(tt),
            tagId: tag.id,
            tileCount: tag.tile_ids.length,
            tagType: tt,
          };
          tagNodeMap.set(tag.id, node);
          nodes.push(node);
        }
      }

      // Update tileCount from content data
      for (const tag of graphTags) {
        const node = tagNodeMap.get(tag.id);
        if (node) node.tileCount = tag.tile_ids.length;
      }

      // Tag-to-tag co-occurrence edges (skip root-link type)
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

      // Tile nodes (skip in edit mode)
      const tileNodeIds = new Set<string>();
      if (showTiles && !isEditMode) {
        timeTiles.forEach((tile) => {
          const nodeId = `tile-${tile.id}`;
          nodes.push({
            id: nodeId,
            type: 'tile',
            label: tile.title || 'Tile senza titolo',
            sparkCount: sparkCounts.get(tile.id) || 0,
            actionType: tile.action_type || 'none',
          });
          tileNodeIds.add(nodeId);
        });
      }

      // Tag→tile links (skip in edit mode)
      const tilesLinkedByTag = new Set<string>();
      if (showTiles && !isEditMode) {
        for (const tag of graphTags) {
          if (!tagNodeMap.has(tag.id)) continue;
          const validTileIds = tag.tile_ids.filter((tid) => tileNodeIds.has(`tile-${tid}`));
          validTileIds.forEach((tileId) => {
            links.push({ source: `tag-${tag.id}`, target: `tile-${tileId}`, linkType: 'tag-tile' });
            tilesLinkedByTag.add(`tile-${tileId}`);
          });
        }
        // Tiles without tags → connect to GIMMICK node
        if (gimmickNodeId) {
          timeTiles.forEach((tile) => {
            if (!tilesLinkedByTag.has(`tile-${tile.id}`))
              links.push({ source: gimmickNodeId!, target: `tile-${tile.id}`, linkType: 'tag-tile' });
          });
        }
      }

      // Spark nodes (skip in edit mode)
      if (!isEditMode) {
        filteredSparks.forEach((spark) => {
          nodes.push({
            id: `spark-${spark.id}`,
            type: 'spark',
            label: spark.label,
            sparkType: spark.type,
            tags: spark.tags,
            summary: spark.summary || undefined,
            storagePath: (spark as Record<string, unknown>).storage_path as string || undefined,
          });
          if (showTiles && spark.tile_id)
            links.push({ source: `tile-${spark.tile_id}`, target: `spark-${spark.id}`, linkType: 'tile-spark' });
          else if (gimmickNodeId)
            links.push({ source: gimmickNodeId, target: `spark-${spark.id}`, linkType: 'tile-spark' });
        });
      }
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
    // Tag cluster hull layer (rendered first so it sits behind everything else)
    const hullLayer = g.append('g').attr('class', 'tag-cluster-hulls').attr('pointer-events', 'none');

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
    const p = physicsRef.current;
    const areaDensity = Math.sqrt((width * height) / Math.max(nodes.length, 1));

    // Connection count per node (for connection-aware repulsion)
    const connectionCount = new Map<string, number>();
    links.forEach((l) => {
      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      connectionCount.set(src, (connectionCount.get(src) || 0) + 1);
      connectionCount.set(tgt, (connectionCount.get(tgt) || 0) + 1);
    });

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .alphaDecay(0.03)
      .velocityDecay(p.velocityDecay)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => {
            const lt = l.linkType;
            const scale = Math.max(0.6, areaDensity / 120);
            if (lt === 'co-occurrence') {
              const w = l.weight || 1;
              return Math.max(100, p.linkCoDist - w * 15) * scale;
            }
            if (lt === 'tag-tile') return p.linkTagTile * scale;
            return p.linkTileSpark * scale;
          })
          .strength((l) => {
            if (l.linkType === 'co-occurrence') return p.linkCoStrength;
            if (l.linkType === 'tag-tile') return p.linkTagTileStrength;
            return 0.5;
          })
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength((d) => {
        const conns = connectionCount.get(d.id) || 0;
        const connBoost = Math.min(conns * 30, 200);
        if (d.type === 'tag' && d.isRoot) return -500 - connBoost;
        if (d.type === 'tag') return p.chargeTag - connBoost;
        if (d.type === 'tile') return p.chargeTile;
        return p.chargeSpark;
      }).distanceMax(p.chargeMax))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(p.centerStrength))
      .force(
        'collision',
        d3.forceCollide<GraphNode>().radius((d) => {
          if (d.type === 'tag' && d.isRoot) return 50;
          if (d.type === 'tag') return p.collisionTag + Math.min((d.usageCount || 0) * 3, 20);
          if (d.type === 'tile') return p.collisionTile;
          return p.collisionSpark;
        }).strength(0.8)
      );

    // ─── Tag-type cluster force ───
    // Gathers tag nodes of the same tag_type around a shared center, so the
    // view visually groups tags by type without adding extra nodes. The centers
    // are laid out on a circle around the canvas center; non-tag nodes are
    // unaffected. Adjustable via physics.tagClusterStrength.
    const tagTypesPresent = Array.from(new Set(
      nodes.filter((n) => n.type === 'tag' && n.tagType).map((n) => n.tagType as string),
    ));
    const typeCenters = new Map<string, { cx: number; cy: number }>();
    if (tagTypesPresent.length > 0) {
      const cx0 = width / 2, cy0 = height / 2;
      const radius = Math.min(width, height) * 0.28;
      tagTypesPresent.forEach((tt, i) => {
        const angle = (i / tagTypesPresent.length) * Math.PI * 2 - Math.PI / 2;
        typeCenters.set(tt, {
          cx: cx0 + Math.cos(angle) * radius,
          cy: cy0 + Math.sin(angle) * radius,
        });
      });
    }
    simulation.force('tagCluster', (alpha: number) => {
      const s = p.tagClusterStrength;
      if (s <= 0 || typeCenters.size === 0) return;
      for (const node of nodes) {
        if (node.type !== 'tag' || node.isRoot || !node.tagType) continue;
        const center = typeCenters.get(node.tagType);
        if (!center) continue;
        const k = s * alpha;
        node.vx = (node.vx || 0) + (center.cx - (node.x ?? center.cx)) * k;
        node.vy = (node.vy || 0) + (center.cy - (node.y ?? center.cy)) * k;
      }
    });

    // Pre-bind hull group per tag type (updated on tick). One group = one type.
    const hullGroups = hullLayer
      .selectAll<SVGGElement, string>('g')
      .data(tagTypesPresent, (d) => d as string)
      .join((enter) => {
        const grp = enter.append('g').attr('class', 'tag-cluster');
        grp.append('circle').attr('class', 'hull-bg').attr('fill-opacity', 0.1).attr('stroke-opacity', 0.4).attr('stroke-dasharray', '6,4').attr('stroke-width', 1.5);
        grp.append('text').attr('class', 'hull-label').attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('letter-spacing', 0.5);
        return grp;
      });
    const getTypeName = (slug: string): string => {
      const te = tagTypeEntities.find((t) => t.slug === slug);
      return te?.name || slug.toUpperCase();
    };
    hullGroups.select<SVGCircleElement>('circle.hull-bg')
      .attr('fill', (d) => getTagTypeColor(d) || TAG_NODE_COLOR_THEME)
      .attr('stroke', (d) => getTagTypeColor(d) || TAG_NODE_COLOR_THEME);
    hullGroups.select<SVGTextElement>('text.hull-label')
      .attr('fill', (d) => getTagTypeColor(d) || TAG_NODE_COLOR_THEME)
      .text((d) => getTypeName(d));

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
        if (l.linkType === 'tag-tile') return theme.ink3;
        if (l.linkType === 'tile-spark') return theme.border;
        return theme.border;
      })
      .attr('stroke-width', (l) => {
        if (l.linkType === 'tag-tile') return 2;
        return 1.5;
      })
      .attr('stroke-opacity', (l) => {
        if (l.linkType === 'tag-tile') return 0.7;
        return 0.6;
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
        return src?.color || theme.accent;
      })
      .attr('stroke-width', (l) => Math.max(p.linkWidth, Math.min((l.weight || 1) * p.linkWidth, p.linkWidth * 5)))
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
      .attr('fill', theme.ink3)
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
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            if (d.type === 'tag') {
              // Threshold for tags to prevent "escape" on click
              (this as SVGGElement & { __dragStart: { x: number; y: number }; __dragged: boolean }).__dragStart = { x: event.x, y: event.y };
              (this as SVGGElement & { __dragged: boolean }).__dragged = false;
            }
          })
          .on('drag', function (event, d) {
            if (d.type === 'tag') {
              const start = (this as SVGGElement & { __dragStart: { x: number; y: number } }).__dragStart;
              const dist = Math.sqrt((event.x - start.x) ** 2 + (event.y - start.y) ** 2);
              if (dist > 5) {
                (this as SVGGElement & { __dragged: boolean }).__dragged = true;
                d.fx = event.x;
                d.fy = event.y;
              }
            } else {
              d.fx = event.x;
              d.fy = event.y;
            }
          })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            if (d.type === 'tag' && !(this as SVGGElement & { __dragged: boolean }).__dragged) {
              // Was just a click, not a drag — release pin
              d.fx = null;
              d.fy = null;
            } else {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Hexagon helper
    const hexPoints = (r: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i;
        return `${r * Math.cos(angle)},${r * Math.sin(angle)}`;
      }).join(' ');

    // Tag nodes — GIMMICK (isRoot) gets hexagon+bot icon, others get circle
    const tagNodesG = node.filter((d) => d.type === 'tag');

    // GIMMICK root tag → hexagon + bot icon
    const gimmickNodes = tagNodesG.filter((d) => d.isRoot === true);
    // Opaque background for GIMMICK to hide edges
    gimmickNodes.append('polygon')
      .attr('points', hexPoints(24))
      .attr('fill', theme.bg1);
    gimmickNodes.append('polygon')
      .attr('points', hexPoints(24))
      .attr('fill', theme.accent).attr('fill-opacity', 0.15)
      .attr('stroke', theme.border).attr('stroke-width', 1)
      .style('filter', 'url(#glow)').style('cursor', 'pointer');
    gimmickNodes.each(function () {
      const iconG = d3.select(this).append('g')
        .attr('transform', 'translate(-10,-10) scale(0.85)')
        .style('pointer-events', 'none');
      const svgNS = 'http://www.w3.org/2000/svg';
      const paths = ['M12 8V4H8', 'M2 14h2', 'M20 14h2', 'M15 13v2', 'M9 13v2'];
      paths.forEach((pd) => {
        const p = document.createElementNS(svgNS, 'path');
        p.setAttribute('d', pd);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', theme.border);
        p.setAttribute('stroke-width', '2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        iconG.node()!.appendChild(p);
      });
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('width', '16'); rect.setAttribute('height', '12');
      rect.setAttribute('x', '4'); rect.setAttribute('y', '8'); rect.setAttribute('rx', '2');
      rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', theme.border);
      rect.setAttribute('stroke-width', '2'); rect.setAttribute('stroke-linecap', 'round');
      rect.setAttribute('stroke-linejoin', 'round');
      iconG.node()!.appendChild(rect);
    });
    gimmickNodes.append('text')
      .text('GIMMICK')
      .attr('text-anchor', 'middle').attr('dy', 38).attr('fill', theme.border)
      .attr('font-size', '10px').attr('font-weight', '700').style('pointer-events', 'none');

    // Build tag type emoji lookup from fetched tag type entities
    const tagTypeEmojiMap: Record<string, string> = {};
    for (const tt of tagTypeEntities) {
      tagTypeEmojiMap[tt.slug] = tt.emoji;
    }

    // Regular tag nodes → circle with usage-based radius + tag type icon
    const regularTagsG = tagNodesG.filter((d) => d.isRoot !== true);
    // Background circle (opaque) to hide edges passing under
    regularTagsG.append('circle')
      .attr('r', (d) => 24 + Math.min((d.usageCount || 0) * 3, 20))
      .attr('fill', theme.bg1)
      .style('cursor', 'pointer');
    // Visible circle
    regularTagsG.append('circle')
      .attr('r', (d) => 24 + Math.min((d.usageCount || 0) * 3, 20))
      .attr('fill', (d) => d.color || theme.accent).attr('fill-opacity', 0.15)
      .attr('stroke', (d) => d.color || theme.accent).attr('stroke-width', 1)
      .style('filter', 'url(#glow)').style('cursor', 'pointer');
    // Tag type icon via foreignObject (renders Tabler icon or emoji)
    regularTagsG.each(function (d) {
      const emoji = tagTypeEmojiMap[d.tagType || 'topic'] || '';
      const g = d3.select(this);
      const iconSize = 20;
      if (emoji && emoji.startsWith('Icon')) {
        // Render Tabler SVG icon via foreignObject + ReactDOM
        const fo = g.append('foreignObject')
          .attr('x', -iconSize / 2).attr('y', -iconSize - 2).attr('width', iconSize).attr('height', iconSize)
          .style('pointer-events', 'none').style('overflow', 'visible');
        const container = fo.append('xhtml:div')
          .style('width', `${iconSize}px`).style('height', `${iconSize}px`)
          .style('display', 'flex').style('align-items', 'center').style('justify-content', 'center');
        // Dynamically render the Tabler icon
        const TablerIcons = require('@tabler/icons-react');
        const IconComp = TablerIcons[emoji];
        if (IconComp) {
          const React = require('react');
          const { createRoot } = require('react-dom/client');
          const root = createRoot(container.node());
          root.render(React.createElement(IconComp, { size: iconSize, color: theme.ink, strokeWidth: 1.5 }));
        }
      } else if (emoji) {
        g.append('text')
          .text(emoji)
          .attr('text-anchor', 'middle').attr('dy', '-0.6em')
          .attr('font-size', '16px').style('pointer-events', 'none');
      }
    });
    // Tag name label
    regularTagsG.append('text')
      .text((d) => d.label.length > 14 ? d.label.slice(0, 12) + '...' : d.label)
      .attr('text-anchor', 'middle').attr('dy', '1em').attr('fill', theme.ink)
      .attr('font-size', '11px').attr('font-weight', '700').style('pointer-events', 'none');

    // Tile nodes (square shape)
    const tileSize = (d: GraphNode) => 2 * (18 + Math.min((d.sparkCount || 0) * 2, 16));
    // Opaque background to hide edges
    node.filter((d) => d.type === 'tile')
      .append('rect')
      .attr('width', tileSize).attr('height', tileSize)
      .attr('x', (d) => -tileSize(d) / 2).attr('y', (d) => -tileSize(d) / 2)
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', theme.bg1);
    node.filter((d) => d.type === 'tile')
      .append('rect')
      .attr('width', tileSize).attr('height', tileSize)
      .attr('x', (d) => -tileSize(d) / 2).attr('y', (d) => -tileSize(d) / 2)
      .attr('rx', 6).attr('ry', 6)
      .attr('fill', (d) => ACTION_TYPE_COLORS[(d.actionType || 'none') as ActionType] || theme.accent).attr('fill-opacity', 0.2)
      .attr('stroke', (d) => ACTION_TYPE_COLORS[(d.actionType || 'none') as ActionType] || theme.accent)
      .attr('stroke-width', 1).style('filter', 'url(#glow)').style('cursor', 'pointer');
    node.filter((d) => d.type === 'tile')
      .append('text').text((d) => d.label.length > 16 ? d.label.slice(0, 14) + '...' : d.label)
      .attr('text-anchor', 'middle').attr('dy', '0.35em').attr('fill', theme.ink)
      .attr('font-size', '11px').attr('font-weight', '600').style('pointer-events', 'none');

    // Spark nodes — opaque background + visible circle
    node.filter((d) => d.type === 'spark')
      .append('circle').attr('r', 12)
      .attr('fill', theme.bg1);
    node.filter((d) => d.type === 'spark')
      .append('circle').attr('r', 12)
      .attr('fill', (d) => typeColors[d.sparkType || ''] || theme.ink3).attr('fill-opacity', 0.3)
      .attr('stroke', (d) => typeColors[d.sparkType || ''] || theme.ink3)
      .attr('stroke-width', 0.8).style('cursor', 'pointer');
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

    // Click on tile nodes → mark as read in notification store
    node.filter((d) => d.type === 'tile')
      .on('click', (event, d) => {
        event.stopPropagation();
        const tileId = d.id.replace('tile-', '');
        markRead(tileId);
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

    // Right-click context menu on tags
    tagNodesG.on('contextmenu', (event, d) => {
      event.preventDefault();
      event.stopPropagation();
      const [px, py] = d3.pointer(event, containerRef.current);
      const rawId = d.tagId || d.id.replace('tag-', '');
      setContextMenu({ x: px, y: py, type: 'tag', id: rawId, label: d.label, color: d.color });
      setTagRenameValue(d.label);
      setTagRenaming(false);
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
                  {d.type === 'tile' ? 'Tile' : typeLabels[d.sparkType || ''] || 'Spark'}
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
      }).attr('stroke-opacity', 0.8).attr('stroke', d.type === 'tag' ? (d.color || theme.accent) : theme.accent).attr('stroke-width', 1.5);
      linkCo.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return src === d.id || tgt === d.id;
      }).attr('stroke-opacity', 0.9).attr('stroke', d.color || theme.accent)
        .attr('stroke-width', (l) => Math.max(p.linkWidth, Math.min((l.weight || 1) * p.linkWidth, p.linkWidth * 5)));
      linkCoLabel.filter((l) => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return src === d.id || tgt === d.id;
      }).attr('fill-opacity', 1).attr('fill', theme.ink);
    });

    // ─── Reset link styles helper ───
    const resetLinkStyles = () => {
      node.style('opacity', 1);
      linkOther
        .attr('stroke', (l) => {
          if (l.linkType === 'tag-tile') return theme.ink3;
          if (l.linkType === 'tile-spark') return theme.border;
          return theme.border;
        })
        .attr('stroke-width', (l) => {
          if (l.linkType === 'tag-tile') return 2;
          return 1.5;
        })
        .attr('stroke-opacity', (l) => {
          if (l.linkType === 'tag-tile') return 0.7;
          return 0.6;
        });
      linkCo
        .attr('stroke', (l) => {
          const src = typeof l.source === 'string'
            ? nodes.find((n) => n.id === (l.source as string))
            : (l.source as GraphNode);
          return src?.color || theme.accent;
        })
        .attr('stroke-width', (l) => Math.max(p.linkWidth, Math.min((l.weight || 1) * p.linkWidth, p.linkWidth * 5)))
        .attr('stroke-opacity', 0.5);
      linkCoLabel.attr('fill-opacity', 1).attr('fill', theme.ink3);
    };

    node.on('mouseleave', function () {
      setTooltip(null);
      resetLinkStyles();
    });

    // ─── Tick ───
    simulation.on('tick', () => {
      // Tag cluster hulls: compute centroid + max radius from tag nodes of each type
      const showHulls = (p.showTagClusters || 0) > 0 && tagTypesPresent.length > 0;
      hullLayer.style('display', showHulls ? '' : 'none');
      if (showHulls) {
        const byType = new Map<string, GraphNode[]>();
        for (const n of nodes) {
          if (n.type !== 'tag' || n.isRoot || !n.tagType) continue;
          const list = byType.get(n.tagType) || [];
          list.push(n);
          byType.set(n.tagType, list);
        }
        hullGroups.each(function (tt) {
          const grp = d3.select(this);
          const members = byType.get(tt) || [];
          if (members.length === 0) { grp.style('display', 'none'); return; }
          grp.style('display', '');
          const avgX = members.reduce((s, n) => s + (n.x ?? 0), 0) / members.length;
          const avgY = members.reduce((s, n) => s + (n.y ?? 0), 0) / members.length;
          const maxDist = members.reduce((m, n) => {
            const dx = (n.x ?? 0) - avgX, dy = (n.y ?? 0) - avgY;
            return Math.max(m, Math.sqrt(dx * dx + dy * dy));
          }, 0);
          const r = Math.max(40, maxDist + 36);
          grp.select<SVGCircleElement>('circle.hull-bg').attr('cx', avgX).attr('cy', avgY).attr('r', r);
          grp.select<SVGTextElement>('text.hull-label').attr('x', avgX).attr('y', avgY - r - 4);
        });
      }
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
      resetLinkStyles();
    });

    return () => { simulation.stop(); };
  }, [graphData, tagGraph, activeFilters, timeFilter, selectedTagId, toolbarMode, physics, queryClient, ACTION_TYPE_COLORS, allTags, tagTypeEntities, theme, typeColors, TAG_NODE_COLOR_THEME]);

  // ─── Derived state ───
  const isLoading = contentLoading || tagGraphLoading;
  const selectedTagForDelete = selectedNodeId ? allTags.find((t) => t.id === selectedNodeId) : null;
  const isEmpty = (!graphData || (graphData.tiles.length === 0 && graphData.sparks.length === 0))
    && (!tagGraph || (tagGraph.nodes as TagNode[]).length === 0);

  const pillBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 28,
    padding: '0 10px',
    background: active ? theme.accent : theme.surfaceVariant,
    color: active ? theme.onAccent : theme.ink2,
    border: `2px solid ${theme.border}`,
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
  });
  const popupContainer: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    zIndex: 50,
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 4,
  };
  const popupItem = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    background: active ? theme.surfaceVariant : 'transparent',
    border: `2px solid ${active ? theme.border : 'transparent'}`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    cursor: 'pointer',
  });

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg1 }}>
      <Header title="Panopticon" />

      {/* Toolbar */}
      <div
        style={{
          padding: '8px 16px',
          background: theme.bg2,
          borderBottom: `2px solid ${theme.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Mode toggle (segmented) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: theme.surfaceVariant,
            border: `2px solid ${theme.border}`,
            padding: 2,
          }}
        >
          <button
            onClick={() => { setToolbarMode('navigate'); setLinkMode(false); setLinkSource(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              height: 22,
              background: toolbarMode === 'navigate' ? theme.accent : 'transparent',
              color: toolbarMode === 'navigate' ? theme.onAccent : theme.ink2,
              border: 'none',
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <IconEye size={12} />
            Navigate
          </button>
          <button
            onClick={() => setToolbarMode('edit')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 10px',
              height: 22,
              background: toolbarMode === 'edit' ? theme.accent : 'transparent',
              color: toolbarMode === 'edit' ? theme.onAccent : theme.ink2,
              border: 'none',
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <IconSettings2 size={12} />
            Edit Tag
          </button>
        </div>

        <div style={{ width: 2, height: 20, background: theme.border }} />

        {toolbarMode === 'navigate' ? (
          <>
            {/* Filter dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setFilterDropdownOpen((p) => !p); setTagDropdownOpen(false); }}
                className="px-press"
                style={pillBtn(false)}
              >
                <IconFilter size={12} />
                Filtri
                {activeFilters.size < filterConfig.length && (
                  <span
                    style={{
                      background: theme.accent,
                      color: theme.onAccent,
                      border: `2px solid ${theme.border}`,
                      padding: '1px 5px',
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 8,
                    }}
                  >
                    {activeFilters.size}
                  </span>
                )}
                <IconChevronDown size={11} style={{ marginLeft: 2 }} />
              </button>
              {filterDropdownOpen && (
                <div style={{ ...popupContainer, minWidth: 180 }}>
                  {filterConfig.map((f) => {
                    const active = activeFilters.has(f.key);
                    const clr = filterColor(f.key);
                    return (
                      <button
                        key={f.key}
                        onClick={() => toggleFilter(f.key)}
                        style={popupItem(active)}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            border: `2px solid ${clr}`,
                            background: active ? clr : 'transparent',
                          }}
                        />
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                  <div style={{ borderTop: `2px solid ${theme.border}`, marginTop: 4, paddingTop: 4 }}>
                    <button
                      onClick={() => setActiveFilters(new Set(filterConfig.map((f) => f.key)))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: theme.accent,
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Mostra tutti
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tag dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setTagDropdownOpen((p) => !p); setFilterDropdownOpen(false); }}
                className="px-press"
                style={pillBtn(!!selectedTagId)}
              >
                <IconTag size={12} />
                {selectedTagId
                  ? graphData?.tags?.find((t) => t.id === selectedTagId)?.name || 'Tag'
                  : 'Tag'}
                <IconChevronDown size={11} style={{ marginLeft: 2 }} />
              </button>
              {tagDropdownOpen && (
                <div style={{ ...popupContainer, minWidth: 200, maxHeight: 320, overflowY: 'auto' }}>
                  <button
                    onClick={() => { setSelectedTagId(null); setTagDropdownOpen(false); }}
                    style={popupItem(!selectedTagId)}
                  >
                    Tutti i tag
                  </button>
                  <div style={{ borderTop: `2px solid ${theme.border}`, margin: '4px 0' }} />
                  {graphData?.tags?.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => { setSelectedTagId(tag.id); setTagDropdownOpen(false); }}
                      style={popupItem(selectedTagId === tag.id)}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          background: TAG_NODE_COLOR_THEME,
                          border: `2px solid ${theme.border}`,
                          flexShrink: 0,
                        }}
                      />
                      {tag.name}
                      <span style={{ marginLeft: 'auto', color: theme.ink3, fontFamily: 'var(--font-pixel-head)', fontSize: 9 }}>
                        {tag.tile_ids.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clear tag selection */}
            {selectedTagId && (
              <button
                onClick={() => setSelectedTagId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.ink3,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: 0,
                }}
              >
                <IconX size={12} />
              </button>
            )}
          </>
        ) : (
          <>
            {/* Edit mode: create tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                placeholder="Nuovo tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
                style={{
                  width: 160,
                  height: 28,
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  padding: '0 8px',
                  color: theme.ink,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || createMutation.isPending}
                className="px-press"
                style={{
                  ...pillBtn(true),
                  cursor: (!newTagName.trim() || createMutation.isPending) ? 'not-allowed' : 'pointer',
                  opacity: (!newTagName.trim() || createMutation.isPending) ? 0.5 : 1,
                }}
              >
                <IconPlus size={12} />
                Crea
              </button>
            </div>

            <div style={{ width: 2, height: 20, background: theme.border }} />

            {/* Link mode toggle */}
            <button
              onClick={() => { setLinkMode((p) => !p); setLinkSource(null); }}
              className="px-press"
              style={pillBtn(linkMode)}
            >
              <IconLink size={12} />
              {linkMode ? 'Collegamento attivo' : 'Collega tag'}
            </button>

            {/* Delete selected tag */}
            {selectedTagForDelete && (
              <button
                onClick={() => deleteMutation.mutate(selectedTagForDelete.id)}
                className="px-press"
                style={{
                  ...pillBtn(false),
                  color: '#E24B4A',
                  border: `2px solid #E24B4A`,
                }}
              >
                <IconTrash size={12} />
                Elimina &quot;{selectedTagForDelete.name}&quot;
              </button>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* Stats */}
        <span
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink3,
          }}
        >
          {tagGraph?.nodes ? (tagGraph.nodes as TagNode[]).filter((t) => !t.is_root).length : 0} tag
          {' '}&middot;{' '}
          {tagGraph?.edges ? Math.floor((tagGraph.edges as TagEdge[]).filter((e) => e.relation_type !== 'root-link').length / 2) : 0} relazioni
        </span>
      </div>

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: theme.bg1 }} ref={containerRef}>
        {/* Timeline slider (right side) */}
        {dateExtent && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              zIndex: 10,
              width: 48,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 0',
              background: theme.bg2,
              borderLeft: `2px solid ${theme.border}`,
            }}
          >
            {[1, 2, 7, 30].map((days) => {
              const totalRange = dateExtent.max - dateExtent.min;
              const daysMs = days * 24 * 60 * 60 * 1000;
              const startPct = totalRange > 0 ? Math.max(0, ((totalRange - daysMs) / totalRange) * 100) : 0;
              const isActive = Math.abs(timeRange[0] - startPct) < 1 && Math.abs(timeRange[1] - 100) < 1;
              return (
                <button
                  key={days}
                  onClick={() => setTimeRange([startPct, 100])}
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 8,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    marginBottom: 4,
                    background: isActive ? theme.accent : theme.surfaceVariant,
                    color: isActive ? theme.onAccent : theme.ink2,
                    border: `2px solid ${theme.border}`,
                    cursor: 'pointer',
                  }}
                >
                  {days}gg
                </button>
              );
            })}
            <div style={{ height: 24 }} />
            <span
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 8,
                color: theme.ink2,
                marginBottom: 8,
                textAlign: 'center',
                letterSpacing: '0.04em',
              }}
            >
              {new Date(dateExtent.min + (timeRange[1] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
            <div style={{ flex: 1, position: 'relative', width: 24, display: 'flex', justifyContent: 'center' }}>
              <div
                ref={trackRef}
                style={{
                  height: '100%',
                  width: 10,
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  position: 'relative',
                  cursor: 'pointer',
                }}
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
                  style={{
                    position: 'absolute',
                    width: '100%',
                    background: theme.accent,
                    opacity: 0.35,
                    top: `${100 - timeRange[1]}%`,
                    height: `${timeRange[1] - timeRange[0]}%`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    background: theme.accent,
                    border: `2px solid ${theme.border}`,
                    cursor: 'grab',
                    top: `${100 - timeRange[1]}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'end'; }}
                />
                <div
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    background: theme.accent,
                    border: `2px solid ${theme.border}`,
                    cursor: 'grab',
                    top: `${100 - timeRange[0]}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  onMouseDown={(e) => { e.stopPropagation(); draggingRef.current = 'start'; }}
                />
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 8,
                color: theme.ink2,
                marginTop: 8,
                textAlign: 'center',
                letterSpacing: '0.04em',
              }}
            >
              {new Date(dateExtent.min + (timeRange[0] / 100) * (dateExtent.max - dateExtent.min)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 size={32} className="animate-spin" style={{ color: theme.ink3 }} />
          </div>
        ) : isEmpty ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 8 }}>
            <p
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink2,
                margin: 0,
              }}
            >
              Nessun dato da visualizzare
            </p>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, margin: 0 }}>
              Crea dei tile e spark per vedere il grafo delle connessioni
            </p>
          </div>
        ) : (
          <>
            {/* Link mode indicator */}
            {linkMode && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  zIndex: 20,
                  background: theme.accent,
                  color: theme.onAccent,
                  border: `2px solid ${theme.border}`,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <IconLink size={14} />
                {linkSource ? 'Clicca il tag di destinazione' : 'Clicca il primo tag da collegare'}
                <button
                  onClick={() => { setLinkMode(false); setLinkSource(null); }}
                  style={{ marginLeft: 8, color: theme.onAccent, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
                >
                  <IconX size={14} />
                </button>
              </div>
            )}

            <svg ref={svgRef} className="w-full h-full" />

            {/* Zoom controls + physics toggle */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
              {[
                { Icon: IconZoomIn, onClick: handleZoomIn, active: false, title: 'Zoom in' },
                { Icon: IconZoomOut, onClick: handleZoomOut, active: false, title: 'Zoom out' },
                { Icon: IconMaximize, onClick: handleFit, active: false, title: 'Fit' },
                { Icon: IconAdjustmentsHorizontal, onClick: () => setShowPhysicsPanel((p) => !p), active: showPhysicsPanel, title: 'Physics' },
              ].map(({ Icon, onClick, active, title }, idx) => (
                <button
                  key={idx}
                  onClick={onClick}
                  title={title}
                  className="px-press"
                  style={{
                    width: 32,
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? theme.accent : theme.surface,
                    color: active ? theme.onAccent : theme.ink2,
                    border: `2px solid ${theme.border}`,
                    cursor: 'pointer',
                    boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Physics console panel */}
            {showPhysicsPanel && (() => {
              const sectionLabel: React.CSSProperties = {
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink3,
                marginBottom: 6,
                margin: 0,
                paddingBottom: 6,
              };
              const fieldLabel: React.CSSProperties = {
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: theme.ink2,
                width: 56,
                flexShrink: 0,
              };
              const fieldValue: React.CSSProperties = {
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 11,
                color: theme.ink3,
                width: 44,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              };
              const sectionWrap: React.CSSProperties = {
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `2px solid ${theme.border}`,
              };
              const rangeStyle: React.CSSProperties = {
                flex: 1,
                height: 4,
                accentColor: theme.accent,
              };
              return (
              <div
                style={{
                  position: 'absolute',
                  bottom: 16,
                  left: 64,
                  zIndex: 20,
                  background: theme.surface,
                  border: `2px solid ${theme.border}`,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  padding: 14,
                  width: 304,
                  maxHeight: 'calc(100% - 32px)',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: theme.ink,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <IconAdjustmentsHorizontal size={14} style={{ color: theme.accent }} />
                    Physics Console
                  </h3>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => {
                        settingsApi.set('graph_physics', physics).then(() => {
                          toast.success('Configurazione salvata');
                        }).catch(() => toast.error('Errore nel salvataggio'));
                      }}
                      style={{
                        background: theme.accent,
                        color: theme.onAccent,
                        border: `2px solid ${theme.border}`,
                        padding: '2px 8px',
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Salva
                    </button>
                    <button
                      onClick={() => setPhysics(defaultPhysics)}
                      style={{
                        background: theme.surfaceVariant,
                        color: theme.ink2,
                        border: `2px solid ${theme.border}`,
                        padding: '2px 8px',
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 8,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Charge */}
                <div style={sectionWrap}>
                  <p style={sectionLabel}>Repulsione</p>
                  {([
                    ['chargeTag', 'Tag', -800, 0],
                    ['chargeTile', 'Tile', -600, 0],
                    ['chargeSpark', 'Spark', -400, 100],
                    ['chargeMax', 'Max dist', 200, 1500],
                  ] as const).map(([key, label, min, max]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={fieldLabel}>{label}</span>
                      <input
                        type="range"
                        min={min} max={max} step={key === 'chargeMax' ? 50 : 10}
                        value={physics[key]}
                        onChange={(e) => setPhysics((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={rangeStyle}
                      />
                      <span style={fieldValue}>{physics[key]}</span>
                    </div>
                  ))}
                </div>

                {/* Links */}
                <div style={sectionWrap}>
                  <p style={sectionLabel}>Link distance</p>
                  {([
                    ['linkCoDist', 'Co-occ', 50, 500],
                    ['linkTagTile', 'Tag→Tile', 40, 300],
                    ['linkTileSpark', 'Tile→Spark', 0, 200],
                  ] as const).map(([key, label, min, max]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={fieldLabel}>{label}</span>
                      <input
                        type="range"
                        min={min} max={max} step={5}
                        value={physics[key]}
                        onChange={(e) => setPhysics((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={rangeStyle}
                      />
                      <span style={fieldValue}>{physics[key]}</span>
                    </div>
                  ))}
                </div>

                {/* Link strength */}
                <div style={sectionWrap}>
                  <p style={sectionLabel}>Link strength</p>
                  {([
                    ['linkCoStrength', 'Co-occ', 0, 1],
                    ['linkTagTileStrength', 'Tag→Tile', 0, 1],
                  ] as const).map(([key, label, min, max]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={fieldLabel}>{label}</span>
                      <input
                        type="range"
                        min={min} max={max} step={0.05}
                        value={physics[key]}
                        onChange={(e) => setPhysics((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={rangeStyle}
                      />
                      <span style={fieldValue}>{physics[key].toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Collision */}
                <div style={sectionWrap}>
                  <p style={sectionLabel}>Collisione</p>
                  {([
                    ['collisionTag', 'Tag', 10, 100],
                    ['collisionTile', 'Tile', 10, 100],
                    ['collisionSpark', 'Spark', 0, 60],
                  ] as const).map(([key, label, min, max]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={fieldLabel}>{label}</span>
                      <input
                        type="range"
                        min={min} max={max} step={2}
                        value={physics[key]}
                        onChange={(e) => setPhysics((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={rangeStyle}
                      />
                      <span style={fieldValue}>{physics[key]}</span>
                    </div>
                  ))}
                </div>

                {/* General */}
                <div>
                  <p style={sectionLabel}>Generale</p>
                  {([
                    ['centerStrength', 'Centro', 0, 0.1],
                    ['tagClusterStrength', 'Tag cluster', 0, 0.5],
                    ['velocityDecay', 'Friction', 0.1, 0.8],
                    ['linkWidth', 'Archi', 0.5, 6],
                  ] as const).map(([key, label, min, max]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={fieldLabel}>{label}</span>
                      <input
                        type="range"
                        min={min} max={max} step={0.01}
                        value={physics[key]}
                        onChange={(e) => setPhysics((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                        style={rangeStyle}
                      />
                      <span style={fieldValue}>{physics[key].toFixed(2)}</span>
                    </div>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={(physics.showTagClusters || 0) > 0}
                      onChange={(e) => setPhysics((prev) => ({ ...prev, showTagClusters: e.target.checked ? 1 : 0 }))}
                      style={{ accentColor: theme.accent }}
                    />
                    <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink2 }}>
                      Evidenzia tag cluster
                    </span>
                  </label>
                </div>
              </div>
              );
            })()}

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: tooltip.x + 16,
                  top: tooltip.y - 10,
                  background: theme.surface,
                  border: `2px solid ${theme.border}`,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  padding: 10,
                  maxWidth: 280,
                  zIndex: 50,
                  color: theme.ink,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                }}
              >
                {tooltip.content}
              </div>
            )}

            {/* Context menu (right-click on spark/tile/tag) */}
            {contextMenu && (
              <div
                className="absolute"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                  zIndex: 50,
                  background: theme.surface,
                  border: `2px solid ${theme.border}`,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  padding: 4,
                  minWidth: 200,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p
                  style={{
                    padding: '6px 10px',
                    margin: 0,
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.ink3,
                    borderBottom: `2px solid ${theme.border}`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {contextMenu.type === 'tag' ? 'Tag' : contextMenu.type === 'tile' ? 'Tile' : 'Spark'}: {contextMenu.label}
                </p>

                {contextMenu.type === 'tag' ? (
                  <>
                    {/* Rename */}
                    {tagRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px' }}>
                        <input
                          value={tagRenameValue}
                          onChange={(e) => setTagRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tagRenameValue.trim()) {
                              updateTagMutation.mutate({ id: contextMenu.id, updates: { name: tagRenameValue.trim() } });
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            height: 28,
                            background: theme.surfaceVariant,
                            border: `2px solid ${theme.border}`,
                            padding: '0 8px',
                            color: theme.ink,
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={() => {
                            if (tagRenameValue.trim()) {
                              updateTagMutation.mutate({ id: contextMenu.id, updates: { name: tagRenameValue.trim() } });
                            }
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: theme.accent,
                            color: theme.onAccent,
                            border: `2px solid ${theme.border}`,
                            cursor: 'pointer',
                          }}
                        >
                          <IconPencil size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setTagRenaming(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '6px 10px',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          color: theme.ink2,
                          fontFamily: 'var(--font-pixel-body)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        <IconPencil size={14} />
                        Rinomina
                      </button>
                    )}

                    <div style={{ borderTop: `2px solid ${theme.border}`, margin: '4px 0' }} />

                    {/* Delete */}
                    <button
                      onClick={() => {
                        deleteMutation.mutate(contextMenu.id);
                        setContextMenu(null);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 10px',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#E24B4A',
                        fontFamily: 'var(--font-pixel-body)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      <IconTrash size={14} />
                      Elimina tag
                    </button>
                  </>
                ) : (
                  <button
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: '#E24B4A',
                      fontFamily: 'var(--font-pixel-body)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <IconTrash size={14} />
                    Elimina
                  </button>
                )}
              </div>
            )}

            {/* Edge edit popover */}
            {selectedEdge && (
              <div
                className="absolute"
                style={{
                  left: selectedEdge.x + 16,
                  top: selectedEdge.y - 10,
                  zIndex: 50,
                  background: theme.surface,
                  border: `2px solid ${theme.border}`,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  padding: 12,
                  width: 280,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.ink3,
                    marginBottom: 8,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedEdge.fromName} &harr; {selectedEdge.toName}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 8 }}>
                  <input
                    value={edgeEditLabel}
                    onChange={(e) => setEdgeEditLabel(e.target.value)}
                    placeholder="Tipo relazione..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        tagsApi.updateRelation(selectedEdge.tagFrom, selectedEdge.tagTo, selectedEdge.weight, edgeEditLabel || undefined).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                          toast.success('Relazione aggiornata');
                          setSelectedEdge(null);
                        }).catch(() => toast.error('Errore'));
                      }
                    }}
                    style={{
                      flex: 1,
                      height: 28,
                      background: theme.surfaceVariant,
                      border: `2px solid ${theme.border}`,
                      padding: '0 8px',
                      color: theme.ink,
                      fontFamily: 'var(--font-pixel-body)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => {
                      tagsApi.updateRelation(selectedEdge.tagFrom, selectedEdge.tagTo, selectedEdge.weight, edgeEditLabel || undefined).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                        toast.success('Relazione aggiornata');
                        setSelectedEdge(null);
                      }).catch(() => toast.error('Errore'));
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: theme.accent,
                      color: theme.onAccent,
                      border: `2px solid ${theme.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <IconPencil size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => {
                      tagsApi.deleteRelation(selectedEdge.tagFrom, selectedEdge.tagTo).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['tag-graph'] });
                        toast.success('Relazione eliminata');
                        setSelectedEdge(null);
                      }).catch(() => toast.error('Errore'));
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      background: 'transparent',
                      color: '#E24B4A',
                      border: `2px solid #E24B4A`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <IconTrash size={11} />
                    Elimina
                  </button>
                  <button
                    onClick={() => setSelectedEdge(null)}
                    style={{
                      padding: '4px 8px',
                      background: theme.surfaceVariant,
                      color: theme.ink2,
                      border: `2px solid ${theme.border}`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Chiudi
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
