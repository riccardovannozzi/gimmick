'use client';

import { useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconComponents } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { tagsApi, canvasApi } from '@/lib/api';
import { CanvasTopbar } from '@/components/canvas/CanvasTopbar';
import { CanvasBoard, type CanvasEdge } from '@/components/canvas/CanvasBoard';
import type { Tag, Tile } from '@/types';

type CanvasMode = 'move' | 'link';

export default function CanvasPage() {
  const searchParams = useSearchParams();
  const tagId = searchParams.get('tag');
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<CanvasMode>('move');
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
  const tiles: Tile[] = tilesData?.data || [];

  // Fetch layout
  const { data: layoutData } = useQuery({
    queryKey: ['canvas-layout', tagId],
    queryFn: () => canvasApi.getLayout(tagId!),
    enabled: !!tagId,
  });
  const layout = layoutData?.data || [];

  // Fetch edges
  const { data: edgesData } = useQuery({
    queryKey: ['canvas-edges', tagId],
    queryFn: () => canvasApi.getEdges(tagId!),
    enabled: !!tagId,
  });
  const edges: CanvasEdge[] = edgesData?.data || [];

  // Save positions (debounced)
  const handlePositionChange = useCallback((positions: { tile_id: string; x: number; y: number }[]) => {
    if (!tagId) return;
    // Optimistic update
    queryClient.setQueryData(['canvas-layout', tagId], { data: positions });
    // Debounce save to DB
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      canvasApi.saveLayout(tagId, positions);
    }, 800);
  }, [tagId, queryClient]);

  // Add edge
  const handleAddEdge = useCallback(async (source_id: string, target_id: string) => {
    if (!tagId) return;
    // Optimistic
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(['canvas-edges', tagId], (old: any) => ({
      data: [...(old?.data || []), { id: tempId, source_id, target_id }],
    }));
    await canvasApi.addEdge(tagId, source_id, target_id);
    queryClient.invalidateQueries({ queryKey: ['canvas-edges', tagId] });
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

  const handleReset = useCallback(() => {
    setResetTrigger((n) => n + 1);
  }, []);

  const handleFit = useCallback(() => {
    setFitTrigger((n) => n + 1);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Canvas" />

      {tagId && tag ? (
        <>
          <CanvasTopbar
            tag={tag}
            tileCount={tiles.length}
            mode={mode}
            onModeChange={setMode}
            onReset={handleReset}
            onFit={handleFit}
          />
          <div className="flex-1 relative overflow-hidden">
            <CanvasBoard
              tiles={tiles}
              layout={layout}
              edges={edges}
              mode={mode}
              onPositionChange={handlePositionChange}
              onAddEdge={handleAddEdge}
              onDeleteEdge={handleDeleteEdge}
              fitTrigger={fitTrigger}
              resetTrigger={resetTrigger}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <IconComponents size={32} strokeWidth={1} />
          <p className="text-sm">Seleziona un tag dalla sidebar per aprire la lavagna</p>
        </div>
      )}
    </div>
  );
}
