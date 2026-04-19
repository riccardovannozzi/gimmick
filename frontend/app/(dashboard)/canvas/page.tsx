'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconComponents, IconTrash, IconCopy, IconBoxMultiple } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { tagsApi, canvasApi, tilesApi } from '@/lib/api';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasBoard, type CanvasEdge, type CanvasGroup, type CanvasTextBox } from '@/components/canvas/CanvasBoard';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { MultiTileSidebar } from '@/components/tileview/MultiTileSidebar';
import type { Tag, Tile } from '@/types';

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tagId = searchParams.get('tag');
  const queryClient = useQueryClient();

  const [textMode, setTextMode] = useState(false);
  const [tileMode, setTileMode] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tag
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
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
    if (tags.length === 0) return; // wait for tags to load
    try {
      const last = localStorage.getItem('canvas_last_tag');
      if (last && tags.some((t) => t.id === last)) {
        router.replace(`/canvas?tag=${last}`);
      }
    } catch { /* */ }
  }, [tagId, tags, router]);

  // Fetch tiles for tag
  const { data: tilesData } = useQuery({
    queryKey: ['canvas-tiles', tagId],
    queryFn: () => tagsApi.getTiles(tagId!),
    enabled: !!tagId,
  });
  const tiles: Tile[] = useMemo(() => tilesData?.data || [], [tilesData]);

  // Fetch layout
  const { data: layoutData } = useQuery({
    queryKey: ['canvas-layout', tagId],
    queryFn: () => canvasApi.getLayout(tagId!),
    enabled: !!tagId,
  });
  const layout = useMemo(() => layoutData?.data || [], [layoutData]);

  // Fetch edges
  const { data: edgesData } = useQuery({
    queryKey: ['canvas-edges', tagId],
    queryFn: () => canvasApi.getEdges(tagId!),
    enabled: !!tagId,
  });
  const edges = useMemo(() => (edgesData?.data || []) as CanvasEdge[], [edgesData]);

  // Groups — persisted via backend API
  const { data: groupsData } = useQuery({
    queryKey: ['canvas-groups', tagId],
    queryFn: () => canvasApi.getGroups(tagId!),
    enabled: !!tagId,
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

  // ── Text boxes ──
  const { data: textBoxesData } = useQuery({
    queryKey: ['canvas-textboxes', tagId],
    queryFn: () => canvasApi.getTextBoxes(tagId!),
    enabled: !!tagId,
  });
  const textBoxes = useMemo(() => (textBoxesData?.data || []) as CanvasTextBox[], [textBoxesData]);

  const handleAddTextBox = useCallback(async (x: number, y: number, w: number, h: number) => {
    if (!tagId) return;
    setTextMode(false);
    const tempId = `temp-tb-${Date.now()}`;
    queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, content: '', x, y, w, h }],
    }));
    try {
      const res = await canvasApi.addTextBox(tagId, { content: '', x, y, w, h });
      if (res?.data) {
        const d = res.data as any;
        queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
          data: (old?.data || []).map((tb: any) => tb.id === tempId ? d : tb),
        }));
      }
    } catch {
      queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
        data: (old?.data || []).filter((tb: any) => tb.id !== tempId),
      }));
    }
  }, [tagId, queryClient]);

  const tbUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleUpdateTextBox = useCallback((id: string, updates: { content?: string; x?: number; y?: number; w?: number; h?: number }) => {
    if (!tagId) return;
    // For content-only updates, skip cache write: the contenteditable DOM already reflects
    // the typed text and updating the cache would trigger a re-render that rebuilds the SVG,
    // losing focus and dropping in-flight keystrokes.
    const isContentOnly = 'content' in updates && !('x' in updates) && !('y' in updates) && !('w' in updates) && !('h' in updates);
    if (!isContentOnly) {
      queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
        data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, ...updates } : tb),
      }));
    }
    if (tbUpdateTimer.current) clearTimeout(tbUpdateTimer.current);
    tbUpdateTimer.current = setTimeout(() => { canvasApi.updateTextBox(id, updates); }, 800);
  }, [tagId, queryClient]);

  const handleDeleteTextBox = useCallback(async (id: string) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
      data: (old?.data || []).filter((tb: any) => tb.id !== id),
    }));
    await canvasApi.deleteTextBox(id);
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
        ...tbIds.map((id) => canvasApi.deleteTextBox(id).catch(() => null)),
        ...edgesToDelete.map((e) => canvasApi.deleteEdge(e.id).catch(() => null)),
      ]);
      queryClient.invalidateQueries({ queryKey: ['canvas-tiles', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-layout', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-textboxes', tagId] });
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
      if (source.pattern_id) updates.pattern_id = source.pattern_id;
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
    <div className="flex flex-col h-full">
      <Header title="Canvas" />

      {tagId && tag ? (
        <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <CanvasTopbar
            tag={tag}
            tileCount={tiles.length}
            textMode={textMode}
            tileMode={tileMode}
            onToggleTextMode={() => setTextMode((v) => !v)}
            onToggleTileMode={() => setTileMode((v) => !v)}
            onFit={handleFit}
            onZoom100={handleZoom100}
            pinnedTags={tags.filter((t) => t.is_pinned && !t.is_archived)}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div className="flex-1 relative overflow-hidden" style={{ cursor: (textMode || tileMode) ? 'crosshair' : undefined }}>
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
                  className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-[9999]"
                  style={{ top, left, width: menuW }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-700/60">
                    {selectedIds.length} elementi
                    {tbCount > 0 && tileCount > 0 && (
                      <span className="ml-1 normal-case text-zinc-600">({tileCount} tile · {tbCount} note)</span>
                    )}
                  </div>
                  <button
                    onClick={handleCreateGroupFromSelection}
                    disabled={!groupAllowed}
                    title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <IconBoxMultiple className="h-3.5 w-3.5" />
                    Crea gruppo
                  </button>
                  <button
                    onClick={handleBulkDeleteSelected}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
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
              return (
                <>
                  <div className="fixed inset-0 z-[9998]" onClick={() => setTileCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTileCtx(null); }} />
                  <div
                    className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-44 z-[9999]"
                    style={{ top: tileCtx.y, left: tileCtx.x }}
                  >
                    {inMultiSel && (
                      <>
                        <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-700/60">
                          {selectedIds.length} selezionati
                        </div>
                        <button
                          onClick={() => { setTileCtx(null); handleCreateGroupFromSelection(); }}
                          disabled={!groupAllowed}
                          title={!groupAllowed ? 'I gruppi possono contenere solo tile' : undefined}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                        >
                          <IconBoxMultiple className="h-3.5 w-3.5" />
                          Crea gruppo
                        </button>
                        <button
                          onClick={() => { setTileCtx(null); handleBulkDeleteSelected(); }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          Elimina {selectedIds.length} elementi
                        </button>
                        <div className="my-1 border-t border-zinc-700/60" />
                      </>
                    )}
                    {tileCtx.inGroup && (
                      <button
                        onClick={handleUngroupTile}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        Ungroup
                      </button>
                    )}
                    <button
                      onClick={handleDuplicateTile}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                    >
                      <IconCopy className="h-3.5 w-3.5" />
                      Duplica
                    </button>
                    <button
                      onClick={handleConfirmDeleteTile}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
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
                className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-40 z-[9999]"
                style={{ top: tbCtx.y, left: tbCtx.x }}
              >
                <button
                  onClick={() => { handleDeleteTextBox(tbCtx.textBoxId); setTbCtx(null); }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <IconTrash className="h-3.5 w-3.5" />
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
                className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-40 z-[9999]"
                style={{ top: edgeCtx.y, left: edgeCtx.x }}
              >
                <button
                  onClick={handleConfirmDeleteEdge}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <IconTrash className="h-3.5 w-3.5" />
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
            tileCount={0}
            textMode={false}
            tileMode={false}
            onToggleTextMode={() => {}}
            onToggleTileMode={() => {}}
            onFit={() => {}}
            onZoom100={() => {}}
            pinnedTags={tags.filter((t) => t.is_pinned && !t.is_archived)}
            onPinnedTagClick={(id) => router.push(`/canvas?tag=${id}`)}
            onUnpinTag={async (id) => {
              queryClient.setQueryData(['tags'], (old: any) => {
                if (!old?.data) return old;
                return { ...old, data: old.data.map((t: Tag) => t.id === id ? { ...t, is_pinned: false } : t) };
              });
              try { await tagsApi.update(id, { is_pinned: false }); }
              finally { queryClient.invalidateQueries({ queryKey: ['tags'] }); }
            }}
          />
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
            <IconComponents size={32} strokeWidth={1} />
            <p className="text-sm">Seleziona un tag dalla sidebar per aprire la lavagna</p>
          </div>
        </div>
      )}
    </div>
  );
}
