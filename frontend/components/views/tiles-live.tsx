'use client';

/**
 * Gimmick · Obsidian — Tiles view collegata ai dati reali (Fase 3).
 *
 * Avvolge la presentazione `TilesView` collegandola a:
 *   - `useInfiniteQuery(['tiles'])` (50/pagina) con sentinella IntersectionObserver
 *   - mapping `Tile` → `TileRow` (azione, schedule, tag, sparks)
 *   - filtro AI seedato dalla chat (`useFilterStore`) con banner
 *   - selezione riga → dettaglio nell'Inspector dello shell (`useTileSelectionStore`)
 *   - "Add tile" → crea tile + tag root GIMMICK + apre il dettaglio
 *
 * Read + selezione + creazione. L'EDITING avviene nel `TileSidebar` (Inspector):
 * gli editor inline di azione/tipo/stato/tag della tabella arcade NON sono
 * ancora portati qui (vedi MIGRATION_PLAN.md, gap noti di Fase 3).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/primitives';
import { Icon } from '@/components/shell';
import { TilesView, type TileRow } from '@/components/views/tiles';
import { useFilterStore } from '@/store/filter-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { useStatuses } from '@/store/statuses-store';
import { statusMeta } from '@/lib/status-meta';
import { tileActionKind, tileSchedule } from '@/lib/tile-action';
import { tilesApi, tagsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import type { Spark, Status, Tile } from '@/types';
import { OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

/** Tipi reali → i 4 accenti spark supportati dalla TileRow Obsidian. */
const SPARK_KIND: Record<string, 'photo' | 'voice' | 'text' | 'file'> = {
  photo: 'photo',
  image: 'photo',
  video: 'photo',
  audio_recording: 'voice',
  text: 'text',
  file: 'file',
};

function toTileRow(t: Tile, statusById: Map<string, Status>): TileRow {
  // Stessa scelta del TileSidebar: il primo tag non-root, e se il tile ha SOLO
  // il root si mostra quello. Il fallback deve restare l'ultimo tag disponibile,
  // non una stringa fissa, altrimenti la riga mente sul tag del tile.
  const tileTags = t.tags ?? [];
  const tag = tileTags.find((tg) => !tg.is_root) ?? tileTags[0];
  // 'active' è lo stato di default/prevalente → non si segnala (colonna vuota).
  const st = t.status_id ? statusById.get(t.status_id) : undefined;
  const showStatus = st && st.name !== 'active';
  const stMeta = showStatus ? statusMeta(st.name) : undefined;
  return {
    id: t.id,
    title: t.title || 'Senza titolo',
    action: tileActionKind(t),
    ...tileSchedule(t),
    done: !!t.is_completed,
    status: st && stMeta ? { label: stMeta.label, color: stMeta.color, shape: st.shape } : undefined,
    tags: tag?.name ?? '—',
    sparks: (t.sparks ?? []).map((s: Spark) => {
      const kind = SPARK_KIND[s.type] ?? 'file';
      const x = kind === 'text' ? s.content?.slice(0, 40) : kind === 'file' ? s.file_name : undefined;
      return { t: kind, x };
    }),
  };
}

export function TilesLive() {
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { tileIds: aiFilterIds, clearFilter } = useFilterStore();
  const { statuses } = useStatuses();
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const selectTile = useTileSelectionStore((s) => s.select);
  const clearInspector = useTileSelectionStore((s) => s.clear);

  // Multi-selezione per azioni bulk (es. eliminazione). Set di tile id spuntati.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Menu contestuale (tasto destro su una riga).
  const [menu, setMenu] = useState<{ x: number; y: number; tileId: string } | null>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['tiles'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tilesApi.list({ page: pageParam, limit: 50 });
      // L'API client ritorna {success:false} invece di lanciare: senza questo
      // throw React Query tratterebbe l'errore come successo (lista vuota, niente retry).
      if (!res.success) throw new Error('Errore caricamento tiles');
      return res;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page: p, totalPages } = lastPage.pagination;
      return p < totalPages ? p + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const { data: tagsResult } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const allTiles = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const total = data?.pages[0]?.pagination?.total;

  /**
   * Id del filtro AI che NON sono fra le pagine già caricate.
   *
   * La lista parte dalle 50 tile più recenti, mentre una ricerca pesca
   * volentieri roba vecchia: il filtro, che lavorava per sola intersezione,
   * lasciava fuori proprio quelle. Da quando la chat disegna le tile trovate
   * come card, il caso si vede subito — si clicca una card e la vista si apre
   * VUOTA mentre la sidebar mostra il tile giusto.
   */
  const missingIds = useMemo(() => {
    if (!aiFilterIds?.length) return [];
    const loaded = new Set(allTiles.map((t) => t.id));
    return aiFilterIds.filter((id) => !loaded.has(id));
  }, [aiFilterIds, allTiles]);

  // Si chiedono uno a uno invece di rincorrere le pagine: gli id sono pochi (i
  // tool di ricerca ne restituiscono al massimo una ventina) e `GET /tiles/:id`
  // porta sparks e tags, quindi la riga esce identica a quelle della lista.
  const { data: recoveredTiles } = useQuery({
    queryKey: ['tiles-by-id', missingIds],
    queryFn: async () => {
      const results = await Promise.all(missingIds.map((id) => tilesApi.get(id)));
      return results.filter((r) => r.success && r.data).map((r) => r.data!);
    },
    enabled: missingIds.length > 0,
  });

  const visibleTiles = useMemo(() => {
    if (!aiFilterIds) return allTiles;
    const idSet = new Set(aiFilterIds);
    const byId = new Map<string, Tile>();
    for (const t of allTiles) if (idSet.has(t.id)) byId.set(t.id, t);
    for (const t of recoveredTiles ?? []) byId.set(t.id, t);
    // Nell'ordine in cui l'AI le ha elencate — che è rilevanza, non data.
    // Riordinarle per created_at butterebbe via il senso della risposta.
    return aiFilterIds.map((id) => byId.get(id)).filter((t): t is Tile => !!t);
  }, [allTiles, aiFilterIds, recoveredTiles]);

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const rows = useMemo(() => visibleTiles.map((t) => toTileRow(t, statusById)), [visibleTiles, statusById]);

  const toggleRow = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCheckedIds((prev) => {
      const ids = visibleTiles.map((t) => t.id);
      const allChecked = ids.length > 0 && ids.every((id) => prev.has(id));
      return allChecked ? new Set() : new Set(ids);
    });
  }, [visibleTiles]);

  const clearSelection = useCallback(() => setCheckedIds(new Set()), []);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => tilesApi.delete(id)));
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = ids.length - ok;
    // Se il tile aperto nell'Inspector è stato eliminato, chiudi il dettaglio.
    if (selectedTileId && checkedIds.has(selectedTileId)) clearInspector();
    setCheckedIds(new Set());
    invalidateTileCaches(queryClient, ['tags', 'flow-hub']);
    if (ok > 0) toast.success(`${ok} tile eliminat${ok === 1 ? 'a' : 'e'}`);
    if (failed > 0) toast.error(`Errore su ${failed} tile`);
  }, [checkedIds, selectedTileId, clearInspector, queryClient]);

  const deleteTile = useCallback(async (id: string) => {
    try {
      const res = await tilesApi.delete(id);
      if (!res.success) { toast.error('Errore eliminazione'); return; }
      if (selectedTileId === id) clearInspector();
      setCheckedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev); next.delete(id); return next;
      });
      invalidateTileCaches(queryClient, ['tags', 'flow-hub']);
      toast.success('Tile eliminata');
    } catch {
      toast.error('Errore eliminazione');
    }
  }, [selectedTileId, clearInspector, queryClient]);

  const openRowMenu = useCallback((e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, tileId });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  // Chiusura del menu con Escape.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  // Infinite scroll: osserva la sentinella in coda alla lista.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const handleAddTile = useCallback(async () => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newTile = res.data;
      const rootTag = (tagsResult?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newTile.id]);
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newTile.id);
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsResult, selectTile]);

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ob-subtle)',
          fontSize: OB_TEXT.control,
          fontFamily: 'var(--ob-font-sans)',
        }}
      >
        Caricamento…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {aiFilterIds && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 20px',
            background: 'var(--ob-accent-soft)',
            borderBottom: '1px solid var(--ob-line)',
            color: 'var(--ob-accent-text)',
            fontFamily: 'var(--ob-font-mono)',
            fontSize: OB_TEXT.card,
            fontWeight: OB_WEIGHT.emphasis,
            letterSpacing: '0.04em',
          }}
        >
          <span>Filtro AI attivo — {rows.length} tile trovati</span>
          <Button variant="ghost" size="sm" icon={<Icon name="chevL" size={13} />} onClick={clearFilter}>
            Rimuovi filtro
          </Button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <TilesView
          rows={rows}
          count={rows.length}
          total={total ?? rows.length}
          selectedId={selectedTileId ?? undefined}
          onRowClick={(id) => selectTile(id)}
          onAddTile={handleAddTile}
          checkedIds={checkedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onClearSelection={clearSelection}
          onDeleteSelected={deleteSelected}
          onRowContextMenu={openRowMenu}
          footer={
            <div ref={loadMoreRef} style={{ height: 1 }} aria-hidden>
              {isFetchingNextPage && (
                <div
                  style={{
                    padding: '12px 0',
                    textAlign: 'center',
                    color: 'var(--ob-subtle)',
                    fontSize: OB_TEXT.card,
                    fontFamily: 'var(--ob-font-sans)',
                  }}
                >
                  Carico altri tile…
                </div>
              )}
            </div>
          }
        />
      </div>

      {menu && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop: click o tasto destro fuori → chiude. */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
          />
          <div
            className="ob-ctx"
            style={{
              top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 9999) - 80),
              left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 196),
            }}
          >
            <button
              type="button"
              className="ob-ctx__item ob-ctx__item--danger"
              onClick={() => { const id = menu.tileId; setMenu(null); deleteTile(id); }}
            >
              <Icon name="trash" size={14} /> Elimina
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
