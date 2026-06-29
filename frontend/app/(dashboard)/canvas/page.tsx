'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IconComponents, IconTrash, IconCopy, IconBoxMultiple, IconRoute, IconInbox } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { usePixelTheme } from '@/components/pixel';
import { tagsApi, canvasApi, tilesApi, uploadApi } from '@/lib/api';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasBoard, type CanvasEdge, type CanvasGroup, type CanvasTextBox } from '@/components/canvas/CanvasBoard';
import { StagingPanel } from '@/components/canvas/StagingPanel';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { MultiTileSidebar } from '@/components/tileview/MultiTileSidebar';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import { useFlowOpenRequest } from '@/lib/hooks/useFlowOpenRequest';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import type { Tag, Tile } from '@/types';

export default function CanvasPage() {
  const theme = usePixelTheme();
  // Migrazione Obsidian (Fase 8): dentro lo shell la pagina vive nel
  // ViewContainer → niente <Header/> di pagina (lo shell ne ha già uno) e il
  // root cresce nel body flex. Il restyle dei token D3 interni è rimandato.
  const inShell = isObsidianShellEnabled();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagId = searchParams.get('tag');
  // Deep-link params (typically arriving from /flows FlowHub): tile picks a
  // specific tile to focus, flow opens FlowTrack with that node pre-selected.
  // They're consumed once and stripped from the URL to keep history clean.
  const tileParam = searchParams.get('tile');
  const flowParam = searchParams.get('flow');
  const queryClient = useQueryClient();

  const [textMode, setTextMode] = useState(false);
  const [tileMode, setTileMode] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string | null>(null);
  const openFlow = useFlowOpenStore((s) => s.open);
  // Subscribes to the global FLOW-badge signal: when any badge anywhere
  // (canvas, calendar, kanban, hub) calls `openFlow(tileId)`, this hook
  // selects the tile, opens the sidebar, and bumps `forceFlowTab` so the
  // sidebar's active tab jumps to Flow.
  const forceFlowTab = useFlowOpenRequest(setSelectedTileId, setSidebarOpen);
  const [fitTrigger, setFitTrigger] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tag — same queryKey as the Chrono page so they share the cache.
  // Tags change rarely; 5 min staleTime makes Chrono↔Canvas navigation skip
  // the network round-trip entirely.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const tags: Tag[] = tagsData?.data || [];
  const tag = tagId ? tags.find((t) => t.id === tagId) || null : null;

  // Persist last opened tag to localStorage
  useEffect(() => {
    if (tagId) {
      try { localStorage.setItem('canvas_last_tag', tagId); } catch { /* */ }
    }
  }, [tagId]);

  // Auto-redirect to last used tag if mounted without ?tag= query
  useEffect(() => {
    if (tagId) return;
    if (tileParam) return; // tile-deep-link effect will pick the tag
    if (tags.length === 0) return; // wait for tags to load
    try {
      const last = localStorage.getItem('canvas_last_tag');
      if (last && tags.some((t) => t.id === last)) {
        router.replace(`/canvas?tag=${last}`);
      }
    } catch { /* */ }
  }, [tagId, tileParam, tags, router]);

  // Deep-link resolver — if we arrived with ?tile= but no ?tag=, fetch the
  // tile to discover a tag to open the canvas under, then redirect preserving
  // ?tile= and ?flow= so the secondary effect below picks them up.
  //
  // Tag choice priority:
  //   1) the LAST visited canvas tag (localStorage) — keeps context when the
  //      user clicks "Apri tile" from the Flow modal on the current canvas
  //   2) the first non-root tag returned by the API
  useEffect(() => {
    if (!tileParam) return;
    if (tagId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await tilesApi.get(tileParam);
        if (cancelled) return;
        const tileTags = res.data?.tags ?? [];
        const nonRoot = tileTags.filter((t) => !t.is_root && t.name !== 'GIMMICK');
        let lastTag: string | null = null;
        try { lastTag = localStorage.getItem('canvas_last_tag'); } catch { /* */ }
        const preferred = lastTag ? nonRoot.find((t) => t.id === lastTag) : undefined;
        const candidate = preferred ?? nonRoot[0] ?? tileTags[0];
        if (candidate) {
          const flowQs = flowParam ? `&flow=${flowParam}` : '';
          router.replace(`/canvas?tag=${candidate.id}&tile=${tileParam}${flowQs}`);
        } else {
          // Tile has no tag besides GIMMICK root — nothing to anchor canvas on.
          router.replace('/tiles');
        }
      } catch {
        router.replace('/tiles');
      }
    })();
    return () => { cancelled = true; };
  }, [tileParam, tagId, flowParam, router]);

  // Fetch tiles for tag
  const { data: tilesData } = useQuery({
    queryKey: ['canvas-tiles', tagId],
    queryFn: () => tagsApi.getTiles(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const allTagTiles: Tile[] = useMemo(() => tilesData?.data || [], [tilesData]);
  // Set of tile ids that own at least one Flow node — drives the FLOW badge.
  const tilesWithFlows = useTilesWithFlows();

  // Deep-link applier — once tag is resolved AND the tile exists in the loaded
  // set, select it. When ?flow= is also present (arriving from the FlowHub),
  // pre-select that flow node in the sidebar; `TileSidebar.flowNodeId`'s
  // existing auto-switch effect then jumps to the Flow tab. A plain ?tile=
  // just selects the tile and leaves the sidebar on its default tab.
  useEffect(() => {
    if (!tileParam) return;
    if (!tagId) return;
    if (allTagTiles.length === 0) return;
    const t = allTagTiles.find((tile) => tile.id === tileParam);
    if (!t) return;
    setSelectedTileId(tileParam);
    setSidebarOpen(true);
    if (flowParam) {
      setSelectedFlowNodeId(flowParam);
    }
    router.replace(`/canvas?tag=${tagId}`);
  }, [tileParam, flowParam, tagId, allTagTiles, router]);

  // Fetch layout
  const { data: layoutData } = useQuery({
    queryKey: ['canvas-layout', tagId],
    queryFn: () => canvasApi.getLayout(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const layout = useMemo(() => layoutData?.data || [], [layoutData]);

  // Split tag tiles into "positioned" (have a layout entry → render on canvas)
  // and "staging" (no entry → render in the left staging panel until the user
  // drags them onto the canvas). Avoids cluttering the canvas with new tiles
  // at default coordinates.
  const positionedTileIds = useMemo(
    () => new Set(layout.map((l: { tile_id: string }) => l.tile_id)),
    [layout],
  );
  const tiles = useMemo(
    () => allTagTiles.filter((t) => positionedTileIds.has(t.id)),
    [allTagTiles, positionedTileIds],
  );
  const stagingTiles = useMemo(
    () => allTagTiles.filter((t) => !positionedTileIds.has(t.id)),
    [allTagTiles, positionedTileIds],
  );

  // Refs + state for drag-and-drop between staging and canvas.
  const stagingPanelRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  // Resizable splitter between StagingPanel and the canvas column. The width
  // is persisted to localStorage so it survives reloads; default mirrors the
  // previous `w-44` (176px) value.
  const STAGING_MIN_W = 146;
  const STAGING_MAX_W = 700;
  const [stagingWidth, setStagingWidth] = useState<number>(176);
  const [stagingOpen, setStagingOpen] = useState<boolean>(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('canvas_staging_width');
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) {
          setStagingWidth(Math.min(STAGING_MAX_W, Math.max(STAGING_MIN_W, n)));
        }
      }
      const openRaw = localStorage.getItem('canvas_staging_open');
      if (openRaw === '0') setStagingOpen(false);
    } catch { /* */ }
  }, []);
  const toggleStagingOpen = useCallback(() => {
    setStagingOpen((v) => {
      const next = !v;
      try { localStorage.setItem('canvas_staging_open', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);
  const handleStagingResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = stagingWidth;
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(STAGING_MAX_W, Math.max(STAGING_MIN_W, startW + (ev.clientX - startX)));
      lastW = w;
      setStagingWidth(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('canvas_staging_width', String(Math.round(lastW))); } catch { /* */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [stagingWidth]);
  // Populated by CanvasBoard once its zoom system is ready. Converts viewport
  // (clientX/Y) coords to canvas-local coords accounting for current pan/zoom.
  // Used when dropping a staged tile so it lands under the cursor.
  const canvasScreenToLocalRef = useRef<((clientX: number, clientY: number) => { x: number; y: number }) | null>(null);
  // Drag-back highlight: true while a canvas tile is being dragged AND the
  // cursor is currently over the staging panel.
  const [stagingDropHover, setStagingDropHover] = useState(false);

  // Fetch edges
  const { data: edgesData } = useQuery({
    queryKey: ['canvas-edges', tagId],
    queryFn: () => canvasApi.getEdges(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const edges = useMemo(() => (edgesData?.data || []) as CanvasEdge[], [edgesData]);

  // Groups — persisted via backend API
  const { data: groupsData } = useQuery({
    queryKey: ['canvas-groups', tagId],
    queryFn: () => canvasApi.getGroups(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const canvasGroups: CanvasGroup[] = useMemo(() => (groupsData?.data || []).map((g: any) => ({
    id: g.id,
    label: g.label || '',
    nodeIds: g.node_ids || [],
  })), [groupsData]);

  const saveGroupsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleGroupsChange = useCallback((newGroups: CanvasGroup[]) => {
    if (!tagId) return;
    // Optimistic update
    queryClient.setQueryData(['canvas-groups', tagId], {
      data: newGroups.map((g) => ({ id: g.id, label: g.label, node_ids: g.nodeIds })),
    });
    // Debounce save
    if (saveGroupsTimer.current) clearTimeout(saveGroupsTimer.current);
    saveGroupsTimer.current = setTimeout(() => {
      canvasApi.saveGroups(tagId, newGroups.map((g) => ({ id: g.id, label: g.label, node_ids: g.nodeIds })));
    }, 800);
  }, [tagId, queryClient]);

  // Save positions (debounced) + optimistic cache update
  const handlePositionChange = useCallback((positions: { tile_id: string; x: number; y: number }[]) => {
    if (!tagId) return;
    // Optimistic: keep layout cache in sync with current visual positions
    // so that any re-render uses the latest values, not stale DB data.
    queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: positions });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      canvasApi.saveLayout(tagId, positions);
    }, 800);
  }, [tagId, queryClient]);

  // Add edge
  const handleAddEdge = useCallback(async (source_id: string, target_id: string, source_port?: string, target_port?: string) => {
    if (!tagId) return;
    const tempId = `temp-${Date.now()}`;
    // Optimistic: add with temp ID
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, source_id, target_id, source_port, target_port }],
    }));
    try {
      const res = await canvasApi.addEdge(tagId, source_id, target_id, source_port, target_port);
      // Replace temp with real data from server, preserving port info
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
          data: (old?.data || []).map((e: any) => e.id === tempId ? {
            ...d,
            source_port: d.source_port || source_port,
            target_port: d.target_port || target_port,
          } : e),
        }));
      }
    } catch {
      // Revert optimistic on error
      queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
        data: (old?.data || []).filter((e: any) => e.id !== tempId),
      }));
    }
  }, [tagId, queryClient]);

  // Delete edge
  const handleDeleteEdge = useCallback(async (id: string) => {
    if (!tagId) return;
    // Optimistic
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: (old?.data || []).filter((e: CanvasEdge) => e.id !== id),
    }));
    await canvasApi.deleteEdge(id);
  }, [tagId, queryClient]);

  // ── Boxes (text/image, polymorphic) ──
  const { data: boxesData } = useQuery({
    queryKey: ['canvas-boxes', tagId],
    queryFn: () => canvasApi.getBoxes(tagId!),
    enabled: !!tagId,
    staleTime: 60 * 1000,
  });
  const textBoxes = useMemo(() => (boxesData?.data || []) as unknown as CanvasTextBox[], [boxesData]);

  const handleAddTextBox = useCallback(async (x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setTextMode(false);
    const tempId = `temp-tb-${Date.now()}`;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, type: 'text', content: { html: '' }, x, y, w, h }],
    }));
    try {
      const res = await canvasApi.addBox(tagId, { type: 'text', content: { html: '' }, x, y, w, h });
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
          data: (old?.data || []).map((tb: any) => tb.id === tempId ? d : tb),
        }));
      }
    } catch {
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).filter((tb: any) => tb.id !== tempId),
      }));
    }
  }, [tagId, queryClient]);

  const tbUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUpdateTextBox = useCallback((id: string, updates: { type?: 'text' | 'image'; content?: Record<string, unknown>; x?: number; y?: number; w?: number; h?: number }) => {
    if (!tagId) return;
    // For content-only updates, skip cache write: the contenteditable DOM already reflects
    // the typed text and updating the cache would trigger a re-render that rebuilds the SVG,
    // losing focus and dropping in-flight keystrokes.
    const isContentOnly = 'content' in updates && !('x' in updates) && !('y' in updates) && !('w' in updates) && !('h' in updates);
    if (!isContentOnly) {
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, ...updates } : tb),
      }));
    }
    if (tbUpdateTimer.current) clearTimeout(tbUpdateTimer.current);
    tbUpdateTimer.current = setTimeout(() => { canvasApi.updateBox(id, updates); }, 800);
  }, [tagId, queryClient]);

  const handleDeleteTextBox = useCallback(async (id: string) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
      data: (old?.data || []).filter((tb: any) => tb.id !== id),
    }));
    await canvasApi.deleteBox(id);
  }, [tagId, queryClient]);

  // Image box: drag a rectangle (w,h) → file picker → measure the image LOCALLY
  // from the File (so CORS / CDN delays can't cause a fallback) → upload to
  // canvas-assets → fit the box to the picture's aspect ratio so the frame
  // matches the image (no empty letterbox bands).
  const handleAddImageBox = useCallback(async (file: File, x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setImageMode(false);
    if (!file.type.startsWith('image/')) {
      toast.error('Il file deve essere un\'immagine');
      return;
    }
    try {
      // Measure natural dimensions from the local file via a blob URL.
      const blobUrl = URL.createObjectURL(file);
      const dims = await new Promise<{ nw: number; nh: number } | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ nw: img.naturalWidth, nh: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = blobUrl;
      });
      URL.revokeObjectURL(blobUrl);
      // CanvasBoard insets the image by IMG_PAD (2px) on every side. So the
      // box dimensions = inner image area + 2*IMG_PAD. Compute the inner area
      // from drawn rect (minus padding), fit aspect ratio, then add padding
      // back to get the final box size.
      const PAD_TOTAL = 4; // 2 * IMG_PAD
      const innerW = Math.max(40, w - PAD_TOTAL);
      const innerH = Math.max(40, h - PAD_TOTAL);
      let finalW = w;
      let finalH = h;
      if (dims && dims.nw > 0 && dims.nh > 0) {
        const aspect = dims.nw / dims.nh;
        const innerAspect = innerW / innerH;
        let fitW = innerW;
        let fitH = innerH;
        if (aspect > innerAspect) {
          // Picture is wider than the inner rect → keep width, shrink height.
          fitH = Math.max(40, Math.round(innerW / aspect));
        } else {
          // Picture is taller than the inner rect → keep height, shrink width.
          fitW = Math.max(40, Math.round(innerH * aspect));
        }
        finalW = fitW + PAD_TOTAL;
        finalH = fitH + PAD_TOTAL;
      }
      const upRes = await uploadApi.uploadFile(file, 'canvas', 'canvas-assets');
      if (!upRes.success || !upRes.data) {
        toast.error(upRes.error || 'Upload fallito');
        return;
      }
      const src = upRes.data.url;
      const tempId = `temp-img-${Date.now()}`;
      queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
        data: [...(old?.data || []), { id: tempId, type: 'image', content: { src }, x, y, w: finalW, h: finalH }],
      }));
      const res = await canvasApi.addBox(tagId, { type: 'image', content: { src }, x, y, w: finalW, h: finalH });
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-boxes', tagId], (old: any) => ({
          data: (old?.data || []).map((tb: any) => tb.id === tempId ? d : tb),
        }));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Errore inserimento immagine');
    }
  }, [tagId, queryClient]);

  // Text box context menu
  const [tbCtx, setTbCtx] = useState<{ x: number; y: number; textBoxId: string } | null>(null);

  // Add new tile at position
  const handleAddTileAt = useCallback(async (x: number, y: number) => {
    if (!tagId) return;
    setTileMode(false);
    try {
      const res = await tilesApi.create({ title: 'Nuovo tile' });
      const newId = res?.data?.id;
      if (newId) {
        // Assign tag
        const tag = tags.find((t: Tag) => t.id === tagId);
        if (tag) await tagsApi.tagTiles(tag.id, [newId]);
        // Save position
        const currentLayout = (queryClient.getQueryData(['canvas-layout', tagId]) as any)?.data || [];
        const newLayout = [...currentLayout, { tile_id: newId, x, y }];
        queryClient.setQueryData(['canvas-layout', tagId], { data: newLayout });
        canvasApi.saveLayout(tagId, newLayout);
        // Refresh tiles + tags (sidebar count)
        queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
        queryClient.invalidateQueries({ queryKey: ['tags'] });
        // Open sidebar
        setSelectedTileId(newId);
        setSidebarOpen(true);
      }
    } catch { /* ignore */ }
  }, [tagId, tags, queryClient]);

  const handleFit = useCallback(() => {
    setFitTrigger((n) => n + 1);
  }, []);

  const [zoom100Trigger, setZoom100Trigger] = useState(0);
  const handleZoom100 = useCallback(() => {
    setZoom100Trigger((n) => n + 1);
  }, []);

  // Pinned tags ordering (Canvas topbar breadcrumb chips, drag-reorderable).
  const pinnedTags = useMemo(
    () => tags
      .filter((t) => t.is_pinned && !t.is_archived)
      .sort((a, b) => (a.pin_order ?? 0) - (b.pin_order ?? 0)),
    [tags]
  );

  const handleReorderPinned = useCallback(async (orderedIds: string[]) => {
    // Snapshot for rollback if the API call fails.
    const prev = queryClient.getQueryData(['tags']);
    // Optimistic: reorder locally so UI updates immediately
    queryClient.setQueryData(['tags'], (old: any) => {
      if (!old?.data) return old;
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        ...old,
        data: old.data.map((t: Tag) =>
          indexMap.has(t.id) ? { ...t, pin_order: indexMap.get(t.id)! } : t
        ),
      };
    });
    const res = await tagsApi.reorderPinned(orderedIds);
    if (!res.success) {
      // Rollback + tell the user — usually means migration 018 not applied
      // or backend not restarted.
      queryClient.setQueryData(['tags'], prev);
      toast.error(res.error || 'Riordinamento non riuscito');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['tags'] });
  }, [queryClient]);

  // Edge context menu
  const [edgeCtx, setEdgeCtx] = useState<{ x: number; y: number; edgeId: string } | null>(null);

  useEffect(() => {
    if (!edgeCtx) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEdgeCtx(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [edgeCtx]);

  const handleEdgeContextMenu = useCallback((e: { x: number; y: number; edgeId: string }) => {
    setEdgeCtx(e);
  }, []);

  const handleConfirmDeleteEdge = useCallback(() => {
    if (!edgeCtx) return;
    handleDeleteEdge(edgeCtx.edgeId);
    setEdgeCtx(null);
  }, [edgeCtx, handleDeleteEdge]);

  // Multi-selection state (CTRL/SHIFT + drag/click in CanvasBoard).
  // IDs are mixed: bare UUID = tile, "tb:<uuid>" = text box.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBbox, setSelectionBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Derived splits
  const selectedTileIds = useMemo(() => selectedIds.filter((id) => !id.startsWith('tb:')), [selectedIds]);
  const selectedTextBoxIds = useMemo(() => selectedIds.filter((id) => id.startsWith('tb:')).map((id) => id.slice(3)), [selectedIds]);

  const handleSelectionChange = useCallback((ids: string[], bbox: { x: number; y: number; w: number; h: number } | null) => {
    setSelectedIds(ids);
    setSelectionBbox(bbox);
    // Auto-open sidebar on multi-selection so the bulk editor is immediately visible
    if (ids.length >= 2) setSidebarOpen(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionBbox(null);
  }, []);

  // Esc clears selection
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedIds.length, clearSelection]);

  const handleBulkDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0 || !tagId) return;
    const tileIds = selectedTileIds;
    const tbIds = selectedTextBoxIds;
    // Edges connected to any deleted endpoint must also go (avoid orphans).
    // edge.source_id/target_id are stored bare for tiles and "tb:<uuid>" for text boxes.
    const allEndpoints = new Set([...tileIds, ...tbIds.map((id) => `tb:${id}`)]);
    const currentEdges = ((queryClient.getQueryData(['canvas-edges', tagId]) as any)?.data || []) as CanvasEdge[];
    const edgesToDelete = currentEdges.filter((e) => allEndpoints.has(e.source_id) || allEndpoints.has(e.target_id));

    clearSelection();
    try {
      await Promise.all([
        ...tileIds.map((id) => tilesApi.delete(id).catch(() => null)),
        ...tbIds.map((id) => canvasApi.deleteBox(id).catch(() => null)),
        ...edgesToDelete.map((e) => canvasApi.deleteEdge(e.id).catch(() => null)),
      ]);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-boxes', tagId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch { /* ignore */ }
  }, [selectedIds, selectedTileIds, selectedTextBoxIds, tagId, queryClient, clearSelection]);

  const handleCreateGroupFromSelection = useCallback(() => {
    // Groups are tile-only; require ≥2 tiles AND no text boxes in selection.
    if (selectedTileIds.length < 2 || selectedTextBoxIds.length > 0) return;
    const ids = selectedTileIds;
    const ng = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => !ids.includes(nid)) }))
      .filter((g) => g.nodeIds.length >= 2);
    ng.push({ id: `grp-${Date.now()}`, label: '', nodeIds: ids });
    handleGroupsChange(ng);
    clearSelection();
  }, [selectedTileIds, selectedTextBoxIds, canvasGroups, handleGroupsChange, clearSelection]);

  // Tile context menu
  const [tileCtx, setTileCtx] = useState<{ x: number; y: number; tileId: string; inGroup: boolean } | null>(null);

  const handleTileContextMenu = useCallback((e: { x: number; y: number; tileId: string; inGroup: boolean }) => {
    setTileCtx(e);
  }, []);

  const handleUngroupTile = useCallback(() => {
    if (!tileCtx) return;
    const id = tileCtx.tileId;
    setTileCtx(null);
    const newGroups = canvasGroups
      .map((g) => ({ ...g, nodeIds: g.nodeIds.filter((nid) => nid !== id) }))
      .filter((g) => g.nodeIds.length >= 2);
    handleGroupsChange(newGroups);
  }, [tileCtx, canvasGroups, handleGroupsChange]);

  const handleConfirmDeleteTile = useCallback(async () => {
    if (!tileCtx) return;
    const id = tileCtx.tileId;
    setTileCtx(null);
    try {
      await tilesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
    } catch { /* ignore */ }
  }, [tileCtx, tagId, queryClient]);

  const handleDuplicateTile = useCallback(async () => {
    if (!tileCtx || !tagId) return;
    const sourceId = tileCtx.tileId;
    setTileCtx(null);
    const source = tiles.find((t) => t.id === sourceId);
    if (!source) return;
    try {
      const res = await tilesApi.create({ title: source.title });
      const newId = res?.data?.id;
      if (!newId) return;
      // Copy metadata (except scheduling/event fields — a duplicate shouldn't clone a calendar slot)
      const updates: Parameters<typeof tilesApi.update>[1] = {};
      if (source.action_type) updates.action_type = source.action_type;
      if (source.is_cta !== undefined) updates.is_cta = source.is_cta;
      if (source.status_id) updates.status_id = source.status_id;
      if (Object.keys(updates).length > 0) {
        try { await tilesApi.update(newId, updates); } catch { /* ignore */ }
      }
      // Assign same tag as current canvas
      await tagsApi.tagTiles(tagId, [newId]);
      // Place near the original (offset so it's visible but not overlapping)
      const currentLayout = (queryClient.getQueryData(['canvas-layout', tagId]) as any)?.data || [];
      const sourcePos = currentLayout.find((p: { tile_id: string; x: number; y: number }) => p.tile_id === sourceId);
      const offsetX = (sourcePos?.x ?? 0) + 40;
      const offsetY = (sourcePos?.y ?? 0) + 40;
      const newLayout = [...currentLayout, { tile_id: newId, x: offsetX, y: offsetY }];
      queryClient.setQueryData(['canvas-layout', tagId], { data: newLayout });
      canvasApi.saveLayout(tagId, newLayout);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setSelectedTileId(newId);
      setSidebarOpen(true);
    } catch { /* ignore */ }
  }, [tileCtx, tagId, tiles, queryClient]);

  return (
    <div className={`flex flex-col h-full${inShell ? ' flex-1 min-w-0' : ''}`} style={{ background: theme.bg1 }}>
      {!inShell && <Header title="Canvas" />}

      {tagId && tag ? (
        <div className="flex flex-1 overflow-hidden">
        <StagingPanel
          tiles={stagingTiles}
          panelRef={stagingPanelRef}
          selectedTileId={selectedTileId}
          isDropTargetHover={stagingDropHover}
          width={stagingWidth}
          open={stagingOpen}
          onToggle={toggleStagingOpen}
          onTileClick={(id) => { setSelectedTileId(id); setSidebarOpen(true); }}
        />
        {/* Resizable splitter between Staging and Canvas. The handle is 4px
            wide with a transparent hit area that widens via padding so the
            grab zone is comfortable. Hidden when staging is collapsed — the
            thin strip has a fixed width and there's nothing to resize. */}
        {stagingOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleStagingResizeStart}
            style={{ position: 'relative', width: 4, marginLeft: -2, marginRight: -2, flexShrink: 0, cursor: 'col-resize', background: 'transparent', zIndex: 10 }}
            title="Trascina per ridimensionare"
            onMouseEnter={(e) => (e.currentTarget.style.background = `${theme.accent}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 6,
                height: 40,
                background: theme.border,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasTopbar
            tag={tag}
            textMode={textMode}
            tileMode={tileMode}
            imageMode={imageMode}
            onToggleTextMode={() => { setTextMode((v) => !v); setTileMode(false); setImageMode(false); }}
            onToggleTileMode={() => { setTileMode((v) => !v); setTextMode(false); setImageMode(false); }}
            onToggleImageMode={() => { setImageMode((v) => !v); setTextMode(false); setTileMode(false); }}
            onFit={handleFit}
            onZoom100={handleZoom100}
            pinnedTags={pinnedTags}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onReorderPinned={handleReorderPinned}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div
            ref={canvasWrapperRef}
            className="flex-1 relative overflow-hidden"
            style={{ cursor: (textMode || tileMode || imageMode) ? 'crosshair' : undefined }}
            onDragOver={(e) => {
              // Allow drops only when a staging tile is being dragged.
              if (!e.dataTransfer.types.includes('text/x-canvas-tile-id')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              const tileId = e.dataTransfer.getData('text/x-canvas-tile-id');
              if (!tileId || !tagId) return;
              e.preventDefault();
              // Compute drop coords relative to the canvas wrapper, then
              // invert by the current zoom transform so the tile lands under
              // the cursor regardless of pan/zoom. The transform is exposed
              // by CanvasBoard via the screen-to-canvas converter ref below.
              const screen = canvasScreenToLocalRef.current;
              const wrapper = canvasWrapperRef.current;
              if (!wrapper) return;
              const rect = wrapper.getBoundingClientRect();
              const localXY = screen
                ? screen(e.clientX, e.clientY)
                : { x: e.clientX - rect.left, y: e.clientY - rect.top };
              const newEntry = { tile_id: tileId, x: localXY.x, y: localXY.y };
              const next = [...layout.filter((l: { tile_id: string }) => l.tile_id !== tileId), newEntry];
              queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
              canvasApi.saveLayout(tagId, next);
            }}
          >
            <CanvasBoard
              tiles={tiles}
              layout={layout}
              edges={edges}
              groups={canvasGroups}
              textBoxes={textBoxes}
              moveEnabled={true}
              linkEnabled={true}
              textMode={textMode}
              tileMode={tileMode}
              imageMode={imageMode}
              onAddImageBox={handleAddImageBox}
              onAddTileAt={handleAddTileAt}
              onPositionChange={handlePositionChange}
              onAddEdge={handleAddEdge}
              onDeleteEdge={handleDeleteEdge}
              onEdgeContextMenu={handleEdgeContextMenu}
              onTileContextMenu={handleTileContextMenu}
              onTileClick={(id) => {
                // Merge with cached tile to preserve sparks already fetched
                const t = tiles.find((tile) => tile.id === id);
                if (t) {
                  const canvasTag = tag ? { id: tag.id, name: tag.name, tag_type: tag.tag_type } : null;
                  const tileWithTag = { ...t, tags: canvasTag ? [canvasTag] : (t.tags || []) };
                  queryClient.setQueryData(['tile-detail', id], (old: any) => ({
                    data: { ...tileWithTag, sparks: old?.data?.sparks }
                  }));
                  queryClient.invalidateQueries({ queryKey: ['tile-detail', id] });
                }
                setSelectedTileId(id);
                setSidebarOpen(true);
              }}
              onGroupsChange={handleGroupsChange}
              onAddTextBox={handleAddTextBox}
              onUpdateTextBox={handleUpdateTextBox}
              onTextBoxContextMenu={(e) => setTbCtx(e)}
              selectedIds={selectedTileIds}
              onSelectionChange={handleSelectionChange}
              fitTrigger={fitTrigger}
              zoom100Trigger={zoom100Trigger}
              tilesWithFlows={tilesWithFlows}
              onFlowBadgeClick={(id) => {
                openFlow(id);
              }}
              screenToLocalRef={canvasScreenToLocalRef}
              isOverStaging={(clientX, clientY) => {
                const el = stagingPanelRef.current;
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return (
                  clientX >= r.left &&
                  clientX <= r.right &&
                  clientY >= r.top &&
                  clientY <= r.bottom
                );
              }}
              onTilesRemovedFromCanvas={(ids) => {
                if (!tagId || ids.length === 0) return;
                const removed = new Set(ids);
                const next = layout.filter((l: { tile_id: string }) => !removed.has(l.tile_id));
                // Optimistic cache update so the tile jumps to the staging
                // panel immediately. saveLayout is upsert-only; DELETE is
                // needed for each removed tile to make the change persistent.
                queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
                Promise.all(ids.map((id) => canvasApi.removeFromLayout(tagId, id))).catch(() => {
                  // On failure, refetch to resync with the server.
                  queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
                });
              }}
              onTileDragMove={(clientX, clientY) => {
                const el = stagingPanelRef.current;
                if (!el) {
                  if (stagingDropHover) setStagingDropHover(false);
                  return;
                }
                const r = el.getBoundingClientRect();
                const inside =
                  clientX >= r.left && clientX <= r.right &&
                  clientY >= r.top && clientY <= r.bottom;
                if (inside !== stagingDropHover) setStagingDropHover(inside);
              }}
              onTileDragEnd={() => setStagingDropHover(false)}
            />
          </div>
        </div>

          {/* 5 — SIDEBAR DESTRA. MultiTileSidebar solo per multi-selezioni di SOLI tile (≥2);
              le note (text box) non hanno proprietà strutturate da bulk-editare. */}
          {selectedTileIds.length >= 2 && selectedTextBoxIds.length === 0 ? (
            <MultiTileSidebar
              tiles={tiles.filter((t) => selectedTileIds.includes(t.id))}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              invalidateKeys={['canvas-tiles', 'canvas-layout', 'canvas-edges', 'tags']}
              onClearSelection={clearSelection}
            />
          ) : (
            <TileSidebar
              tileId={selectedTileId}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              invalidateKeys={['canvas-tiles', 'canvas-layout', 'canvas-edges', 'tags']}
              flowNodeId={selectedFlowNodeId}
              onSelectFlowNode={setSelectedFlowNodeId}
              forceFlowTab={forceFlowTab}
            />
          )}

          {/* Selection action menu (CTRL/SHIFT + drag/click → multi-select).
              Selection may include tiles and text boxes; "Crea gruppo" is gated to tiles-only. */}
          {selectedIds.length > 0 && selectionBbox && createPortal(
            (() => {
              const menuW = 200;
              const margin = 8;
              const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
              const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
              let left = selectionBbox.x + selectionBbox.w / 2 - menuW / 2;
              left = Math.max(margin, Math.min(left, vw - menuW - margin));
              let top = selectionBbox.y + selectionBbox.h + margin;
              const estH = 80;
              if (top + estH > vh - margin) top = Math.max(margin, selectionBbox.y - estH - margin);
              const tileCount = selectedTileIds.length;
              const tbCount = selectedTextBoxIds.length;
              const groupAllowed = tileCount >= 2 && tbCount === 0;
              return (
                <div
                  className="fixed"
                  style={{
                    top, left, width: menuW,
                    zIndex: 9999,
                    background: theme.surface,
                    border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                    boxShadow: inShell ? 'var(--ob-shadow-card)' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                    borderRadius: inShell ? 12 : 0,
                    padding: 4,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      padding: '6px 10px',
                      fontFamily: inShell ? 'var(--ob-font-mono)' : 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: theme.ink3,
                      borderBottom: `${inShell ? 1 : 2}px solid ${theme.border}`,
                    }}
                  >
                    {selectedIds.length} elementi
                    {tbCount > 0 && tileCount > 0 && (
                      <span style={{ marginLeft: 4, textTransform: 'none', color: theme.ink3, fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'), fontSize: 10 }}>({tileCount} tile · {tbCount} note)</span>
                    )}
                  </div>
                  <button
                    onClick={handleCreateGroupFromSelection}
                    disabled={!groupAllowed}
                    title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: groupAllowed ? 'pointer' : 'not-allowed',
                      color: groupAllowed ? theme.ink2 : theme.ink3,
                      opacity: groupAllowed ? 1 : 0.4,
                      fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'),
                      fontSize: 12,
                    }}
                  >
                    <IconBoxMultiple size={14} />
                    Crea gruppo
                  </button>
                  <button
                    onClick={handleBulkDeleteSelected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '6px 10px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#E24B4A',
                      fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'),
                      fontSize: 12,
                    }}
                  >
                    <IconTrash size={14} />
                    Elimina elementi
                  </button>
                </div>
              );
            })(),
            document.body
          )}

          {/* Tile context menu */}
          {tileCtx && createPortal(
            (() => {
              const inMultiSel = selectedIds.length > 1 && selectedTileIds.includes(tileCtx.tileId);
              const groupAllowed = selectedTileIds.length >= 2 && selectedTextBoxIds.length === 0;
              const menuItem: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.ink2,
                fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'),
                fontSize: 12,
              };
              const dangerItem: React.CSSProperties = { ...menuItem, color: '#E24B4A' };
              return (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setTileCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTileCtx(null); }} />
                  <div
                    className="fixed"
                    style={{
                      top: tileCtx.y,
                      left: tileCtx.x,
                      zIndex: 9999,
                      width: 184,
                      background: theme.surface,
                      border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                      boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                      padding: 4,
                    }}
                  >
                    {inMultiSel && (
                      <>
                        <div
                          style={{
                            padding: '6px 10px',
                            fontFamily: inShell ? 'var(--ob-font-mono)' : 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: theme.ink3,
                            borderBottom: `${inShell ? 1 : 2}px solid ${theme.border}`,
                          }}
                        >
                          {selectedIds.length} selezionati
                        </div>
                        <button
                          onClick={() => { setTileCtx(null); handleCreateGroupFromSelection(); }}
                          disabled={!groupAllowed}
                          title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                          style={{ ...menuItem, cursor: groupAllowed ? 'pointer' : 'not-allowed', color: groupAllowed ? theme.ink2 : theme.ink3, opacity: groupAllowed ? 1 : 0.4 }}
                        >
                          <IconBoxMultiple size={14} />
                          Crea gruppo
                        </button>
                        <button onClick={() => { setTileCtx(null); handleBulkDeleteSelected(); }} style={dangerItem}>
                          <IconTrash size={14} />
                          Elimina {selectedIds.length} elementi
                        </button>
                        <div style={{ margin: '4px 0', borderTop: `${inShell ? 1 : 2}px solid ${theme.border}` }} />
                      </>
                    )}
                    {tileCtx.inGroup && (
                      <button onClick={handleUngroupTile} style={menuItem}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        Ungroup
                      </button>
                    )}
                    <button onClick={handleDuplicateTile} style={menuItem}>
                      <IconCopy size={14} />
                      Duplica
                    </button>
                    <button
                      onClick={() => {
                        if (!tileCtx) return;
                        const id = tileCtx.tileId;
                        setTileCtx(null);
                        openFlow(id);
                      }}
                      style={menuItem}
                    >
                      <IconRoute size={14} />
                      Apri Flow
                    </button>
                    <button
                      onClick={() => {
                        if (!tileCtx || !tagId) return;
                        const id = tileCtx.tileId;
                        setTileCtx(null);
                        const next = layout.filter((l: { tile_id: string }) => l.tile_id !== id);
                        queryClient.setQueryData(['canvas-layout', tagId], { success: true, data: next });
                        canvasApi.removeFromLayout(tagId, id).catch(() => {
                          queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
                        });
                      }}
                      style={menuItem}
                    >
                      <IconInbox size={14} />
                      Rimuovi dal canvas
                    </button>
                    <button onClick={handleConfirmDeleteTile} style={dangerItem}>
                      <IconTrash size={14} />
                      Delete
                    </button>
                  </div>
                </>
              );
            })(),
            document.body
          )}

          {/* Text box context menu */}
          {tbCtx && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setTbCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTbCtx(null); }} />
              <div
                className="fixed"
                style={{
                  top: tbCtx.y,
                  left: tbCtx.x,
                  zIndex: 9999,
                  width: 168,
                  background: theme.surface,
                  border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                  boxShadow: inShell ? 'var(--ob-shadow-card)' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  borderRadius: inShell ? 12 : 0,
                  padding: 4,
                }}
              >
                <button
                  onClick={() => { handleDeleteTextBox(tbCtx.textBoxId); setTbCtx(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#E24B4A',
                    fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'),
                    fontSize: 12,
                  }}
                >
                  <IconTrash size={14} />
                  Delete
                </button>
              </div>
            </>,
            document.body
          )}

          {/* Edge context menu */}
          {edgeCtx && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setEdgeCtx(null)} onContextMenu={(e) => { e.preventDefault(); setEdgeCtx(null); }} />
              <div
                className="fixed"
                style={{
                  top: edgeCtx.y,
                  left: edgeCtx.x,
                  zIndex: 9999,
                  width: 168,
                  background: theme.surface,
                  border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                  boxShadow: inShell ? 'var(--ob-shadow-card)' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                  borderRadius: inShell ? 12 : 0,
                  padding: 4,
                }}
              >
                <button
                  onClick={handleConfirmDeleteEdge}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#E24B4A',
                    fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'),
                    fontSize: 12,
                  }}
                >
                  <IconTrash size={14} />
                  Delete
                </button>
              </div>
            </>,
            document.body
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasTopbar
            tag={null}
            textMode={false}
            tileMode={false}
            imageMode={false}
            onToggleTextMode={() => {}}
            onToggleTileMode={() => {}}
            onToggleImageMode={() => {}}
            onFit={() => {}}
            onZoom100={() => {}}
            pinnedTags={pinnedTags}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onReorderPinned={handleReorderPinned}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                background: theme.surfaceVariant,
                border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                borderRadius: inShell ? 14 : 0,
                color: theme.ink3,
              }}
            >
              <IconComponents size={28} strokeWidth={2} />
            </div>
            <p
              style={{
                fontFamily: inShell ? 'var(--ob-font-mono)' : 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
                margin: 0,
              }}
            >
              Seleziona un tag dalla sidebar
            </p>
            <p style={{ fontFamily: (inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)'), fontSize: 11, color: theme.ink3, margin: 0 }}>
              per aprire la lavagna
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
