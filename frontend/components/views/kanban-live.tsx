'use client';

/**
 * Gimmick · Obsidian — Kanban view collegata ai dati reali (Fase 4).
 *
 * Avvolge la presentazione `KanbanView` collegandola a:
 *   - colonne utente (`kanbanApi.listColumns`) → lane; i tile vengono distribuiti
 *     nelle colonne via `tileMatchesFilters` (stessa semantica dell'arcade) e
 *     ordinati/raggruppati per giorno
 *   - selezione card → dettaglio nell'Inspector (`useTileSelectionStore`, Fase 3)
 *   - "Tile" → crea tile + tag root + apre il dettaglio
 *   - drag-drop di un tile su una colonna → applica i filtri colonna come update
 *
 * GAP (vedi MIGRATION_PLAN.md): riordino colonne, CRUD colonne ed editor filtri
 * NON sono portati qui — restano nella pagina arcade. La toolbar (raggruppa/tag
 * pills/oggi/colonna) è decorativa in questa fase.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KanbanView, type Lane, type CardData } from '@/components/views/kanban';
import { kanbanApi, tilesApi, tagsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { tileMatchesFilters, sortTiles, tileDateField } from '@/lib/kanban-helpers';
import { getDayKey, formatDay } from '@/lib/tile-helpers';
import { useStatuses } from '@/store/statuses-store';
import { statusMeta } from '@/lib/status-meta';
import type { Tile, Tag, KanbanColumn, Status } from '@/types';

/** Status "di attenzione" (non active/done) reso come swatch sulla card. */
function cardStatus(t: Tile, statusById: Map<string, Status>) {
  const st = t.status_id ? statusById.get(t.status_id) : undefined;
  if (!st || st.name === 'active' || st.name === 'done') return undefined;
  const meta = statusMeta(st.name);
  return { label: meta.label, color: meta.color, shape: st.shape };
}

const CAP_FROM: Record<string, 'photo' | 'file' | 'voice' | 'doc' | 'text'> = {
  photo: 'photo',
  image: 'photo',
  video: 'photo',
  audio_recording: 'voice',
  file: 'file',
  text: 'text',
};

function toCard(t: Tile, rootTagId: string | undefined, statusById: Map<string, Status>): CardData {
  const tileTag = (t.tags ?? []).find((tg) => tg.id !== rootTagId) ?? t.tags?.[0];
  const caps = Array.from(new Set((t.sparks ?? []).map((s) => CAP_FROM[s.type] ?? 'file')));
  const checklist = (t.subtasks ?? []).map((s) => s.is_done);
  return {
    id: t.id,
    title: t.title || 'Senza titolo',
    tag: tileTag?.name ?? 'Gimmick',
    amber: t.action_type === 'deadline',
    caps: caps.length ? caps : undefined,
    checklist: checklist.length ? checklist : undefined,
    done: !!t.is_completed,
    status: cardStatus(t, statusById),
  };
}

function groupByDay(tiles: Tile[], sortBy: KanbanColumn['sort_by'], rootTagId: string | undefined, statusById: Map<string, Status>): Lane['groups'] {
  const todayKey = getDayKey(new Date().toISOString());
  const groups: Lane['groups'] = [];
  let lastKey: string | null | undefined = undefined;
  for (const t of tiles) {
    const iso = tileDateField(t, sortBy ?? null);
    const key = iso ? getDayKey(iso) : null;
    if (key !== lastKey) {
      groups.push({
        noDate: key === null,
        today: key !== null && key === todayKey,
        date: iso ? formatDay(iso) : undefined,
        tiles: [],
      });
      lastKey = key;
    }
    groups[groups.length - 1].tiles.push(toCard(t, rootTagId, statusById));
  }
  return groups;
}

export function KanbanLive() {
  const queryClient = useQueryClient();
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const { statuses } = useStatuses();
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const selectTile = useTileSelectionStore((s) => s.select);

  const { data: columnsData } = useQuery({ queryKey: ['kanban-columns'], queryFn: () => kanbanApi.listColumns() });
  const { data: tilesData, isLoading } = useQuery({
    queryKey: ['tiles-kanban'],
    queryFn: async () => {
      const res = await tilesApi.list({ limit: 100 });
      if (!res.success) throw new Error('Errore caricamento tiles');
      return res;
    },
  });
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const columns = useMemo<KanbanColumn[]>(() => columnsData?.data ?? [], [columnsData]);
  const allTiles = useMemo<Tile[]>(() => tilesData?.data ?? [], [tilesData]);
  const tags = useMemo<Tag[]>(() => tagsData?.data ?? [], [tagsData]);
  const rootTagId = useMemo(() => tags.find((t) => t.is_root)?.id, [tags]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  const lanes = useMemo<Lane[]>(
    () =>
      columns.map((col) => {
        const matched = allTiles.filter((t) => tileMatchesFilters(t, col.filters, typeTileIcons));
        const sorted = sortTiles(matched, col.sort_by ?? null, col.sort_dir ?? 'asc');
        return {
          id: col.id,
          label: col.title,
          color: col.bg_color || 'var(--ob-muted)',
          groups: groupByDay(sorted, col.sort_by, rootTagId, statusById),
        };
      }),
    [columns, allTiles, typeTileIcons, rootTagId, statusById],
  );

  const tileMutation = useMutation({
    mutationFn: (params: { id: string; updates: Record<string, unknown> }) =>
      tilesApi.update(params.id, params.updates),
    onSuccess: () => invalidateTileCaches(queryClient, ['kanban-columns']),
    onError: () => toast.error('Errore spostamento tile'),
  });

  const handleMoveTile = useCallback(
    async (tileId: string, targetColId: string) => {
      const tile = allTiles.find((t) => t.id === tileId);
      const col = columns.find((c) => c.id === targetColId);
      if (!tile || !col) return;

      const updates: Record<string, unknown> = {};
      let tagChanged = false;
      for (const f of col.filters) {
        switch (f.type) {
          case 'action_type':
            if (f.value === 'allday') {
              updates.action_type = 'event'; updates.is_event = true; updates.all_day = true;
            } else if (f.value === 'event') {
              updates.action_type = 'event'; updates.is_event = true; updates.all_day = false;
            } else if (f.value === 'deadline') {
              updates.action_type = 'deadline'; updates.is_event = false; updates.all_day = false; updates.start_at = null;
            } else if (f.value === 'none' || f.value === 'anytime') {
              updates.action_type = f.value; updates.is_event = false; updates.all_day = false; updates.start_at = null; updates.end_at = null;
            } else {
              updates.action_type = f.value;
            }
            break;
          case 'completion':
            updates.is_completed = f.value === 'completed';
            break;
          case 'status':
            updates.status_id = f.value;
            break;
          case 'tag':
            if (!tile.tags?.some((t) => t.id === f.value)) {
              // Transazionale: se il tagging fallisce non spostiamo la card,
              // così non "salta" colonna senza che il tag sia stato applicato.
              const r = await tagsApi.tagTiles(f.value, [tile.id]);
              if (!r.success) { toast.error('Errore applicazione tag'); return; }
              tagChanged = true;
            }
            break;
        }
      }
      if (Object.keys(updates).length > 0) tileMutation.mutate({ id: tile.id, updates });
      if (tagChanged) invalidateTileCaches(queryClient, ['tags', 'kanban-columns']);
    },
    [allTiles, columns, queryClient, tileMutation],
  );

  const handleAddTile = useCallback(async () => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newTile = res.data;
      if (rootTagId) await tagsApi.tagTiles(rootTagId, [newTile.id]);
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newTile.id);
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, rootTagId, selectTile]);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ob-subtle)',
          fontSize: 13,
          fontFamily: 'var(--ob-font-sans)',
        }}
      >
        Caricamento…
      </div>
    );
  }

  return (
    <KanbanView
      lanes={lanes}
      selectedId={selectedTileId ?? undefined}
      onCardClick={(id) => selectTile(id)}
      onAddTile={handleAddTile}
      onMoveTile={handleMoveTile}
    />
  );
}
