'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconComponents, IconTrash } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { tagsApi, canvasApi, tilesApi } from '@/lib/api';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasBoard, type CanvasEdge, type CanvasGroup, type CanvasTextBox } from '@/components/canvas/CanvasBoard';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import type { Tag, Tile } from '@/types';

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const tagId = searchParams.get('tag');
  const queryClient = useQueryClient();

  const [textMode, setTextMode] = useState(false);
  const [tileMode, setTileMode] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch tag
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });
  const tags: Tag[] = tagsData?.data || [];
  const tag = tagId ? tags.find((t) => t.id === tagId) || null : null;

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

  // Save positions (debounced)
  const handlePositionChange = useCallback((positions: { tile_id: string; x: number; y: number }[]) => {
    if (!tagId) return;
    // Don't update cache (would cause re-render and zoom reset)
    // Just debounce save to DB
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      canvasApi.saveLayout(tagId, positions);
    }, 800);
  }, [tagId]);

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
  const handleUpdateTextBox = useCallback((id: string, updates: { content?: string; x?: number; y?: number }) => {
    if (!tagId) return;
    queryClient.setQueryData(['canvas-textboxes', tagId], (old: any) => ({
      data: (old?.data || []).map((tb: any) => tb.id === id ? { ...tb, ...updates } : tb),
    }));
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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const handleReset = useCallback(() => {
    setShowResetConfirm(true);
  }, []);
  const confirmReset = useCallback(async () => {
    setResetTrigger((n) => n + 1);
    setShowResetConfirm(false);
    if (!tagId) return;
    // Delete all edges
    const currentEdges = (queryClient.getQueryData(['canvas-edges', tagId]) as any)?.data || [];
    queryClient.setQueryData(['canvas-edges', tagId], { data: [] });
    for (const edge of currentEdges) {
      try { await canvasApi.deleteEdge(edge.id); } catch { /* ignore */ }
    }
  }, [tagId, queryClient]);

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
            onReset={handleReset}
            onFit={handleFit}
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
                // Optimistic: pre-fill cache with tile data + canvas tag
                const t = tiles.find((tile) => tile.id === id);
                if (t) {
                  const canvasTag = tag ? { id: tag.id, name: tag.name, tag_type: tag.tag_type } : null;
                  const tileWithTag = { ...t, tags: canvasTag ? [canvasTag] : (t.tags || []) };
                  queryClient.setQueryData(['tile-detail', id], { data: tileWithTag });
                }
                setSelectedTileId(id);
                setSidebarOpen(true);
              }}
              onGroupsChange={handleGroupsChange}
              onAddTextBox={handleAddTextBox}
              onUpdateTextBox={handleUpdateTextBox}
              onTextBoxContextMenu={(e) => setTbCtx(e)}
              fitTrigger={fitTrigger}
              resetTrigger={resetTrigger}
            />
          </div>
        </div>

          {/* 5 — SIDEBAR DESTRA */}
          <TileSidebar
            tileId={selectedTileId}
            open={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            invalidateKeys={['canvas-tiles', 'canvas-layout', 'canvas-edges', 'tags']}
          />

          {/* Tile context menu */}
          {tileCtx && createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setTileCtx(null)} onContextMenu={(e) => { e.preventDefault(); setTileCtx(null); }} />
              <div
                className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-40 z-[9999]"
                style={{ top: tileCtx.y, left: tileCtx.x }}
              >
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
                  onClick={handleConfirmDeleteTile}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>,
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

          {/* Reset confirm */}
          {showResetConfirm && createPortal(
            <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60" onClick={() => setShowResetConfirm(false)}>
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-white mb-2">Reset Canvas</h3>
                <p className="text-xs text-zinc-400 mb-4">Tutti i nodi torneranno alla posizione iniziale. Gruppi e collegamenti verranno eliminati. Le note di testo verranno mantenute. Questa azione non è reversibile.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 rounded text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors">Annulla</button>
                  <button onClick={confirmReset} className="px-3 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-500 transition-colors">Reset</button>
                </div>
              </div>
            </div>,
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
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <IconComponents size={32} strokeWidth={1} />
          <p className="text-sm">Seleziona un tag dalla sidebar per aprire la lavagna</p>
        </div>
      )}
    </div>
  );
}
