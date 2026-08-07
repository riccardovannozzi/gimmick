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
import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KanbanView, type Lane, type CardData } from '@/components/views/kanban';
import { AxisModal } from '@/components/kanban/AxisModal';
import {
  axisItems, DEFAULT_DATE_WINDOW, DATE_WINDOW_STEP,
  type AxisItem, type AxisMode, type DateWindow,
} from '@/lib/kanban-axis';

/** Chiave in `user_settings` che ricorda la configurazione dei due assi. */
const AXES_KEY = 'kanban_axes';

/** Modalita' dei due assi + le voci spente, per asse e per modalita'. */
type AxesSetting = {
  column?: AxisMode;
  lane?: AxisMode;
  hidden?: Partial<Record<'column' | 'lane', Partial<Record<AxisMode, string[]>>>>;
};
import { kanbanApi, tilesApi, tagsApi, settingsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { tileMatchesFilters, sortTiles } from '@/lib/kanban-helpers';
import { useStatuses } from '@/store/statuses-store';
import { tileVisualKey, TILE_VISUAL, type TileStatus, type TileVisualKey } from '@/lib/tile-visual';
import type { Tile, Tag, KanbanColumn, KanbanLane, KanbanFilter, Status } from '@/types';
import { OB_TEXT } from '@/lib/theme/ob-typography';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Metadato del footer destro: quello che il tipo prevede, già formattato. */
function cardMeta(t: Tile, key: TileVisualKey): string | undefined {
  const kind = TILE_VISUAL[key].meta;
  if (kind === 'none') return undefined;
  if (kind === 'progress') {
    const subs = t.subtasks ?? [];
    return subs.length ? `${subs.filter((s) => s.is_done).length} di ${subs.length}` : undefined;
  }
  // `deadline` vive su end_at, gli eventi su start_at — come `eventRefIso`.
  const iso = key === 'deadline' ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
  if (!iso) return undefined;
  if (kind === 'time') {
    return t.start_at && t.end_at ? `${fmtTime(t.start_at)}–${fmtTime(t.end_at)}` : fmtTime(iso);
  }
  return fmtDate(iso);
}

type IconOf = (tileId: string) => { icon: string; color?: string } | null;

function toCard(t: Tile, rootTagId: string | undefined, statusById: Map<string, Status>, iconOf: IconOf): CardData {
  const tileTag = (t.tags ?? []).find((tg) => tg.id !== rootTagId) ?? t.tags?.[0];
  const checklist = (t.subtasks ?? []).map((s) => s.is_done);
  const ti = iconOf(t.id);
  const key = tileVisualKey({ action_type: t.action_type, all_day: t.all_day });
  const st = t.status_id ? statusById.get(t.status_id) : undefined;
  return {
    id: t.id,
    title: t.title || 'Senza titolo',
    tag: tileTag?.name ?? 'Gimmick',
    checklist: checklist.length ? checklist : undefined,
    done: !!t.is_completed,
    visualKey: key,
    statusName: st?.name as TileStatus | undefined,
    meta: cardMeta(t, key),
    // Stessa regola di canvas e staging: tinge il colore del TIPO, con ricaduta
    // sull'AZIONE quando il tipo manca — così una scadenza senza tipo resta
    // rossa invece di ridursi a una hairline.
    accent: ti?.color || undefined,
  };
}

export function KanbanLive() {
  const queryClient = useQueryClient();
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const getIconForTile = useTypeIcons((s) => s.getIconForTile);
  const { statuses } = useStatuses();
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const selectTile = useTileSelectionStore((s) => s.select);

  const { data: columnsData } = useQuery({ queryKey: ['kanban-columns'], queryFn: () => kanbanApi.listColumns() });
  const { data: lanesData } = useQuery({ queryKey: ['kanban-lanes'], queryFn: () => kanbanApi.listLanes() });
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
  const laneRows = useMemo<KanbanLane[]>(() => lanesData?.data ?? [], [lanesData]);
  const allTiles = useMemo<Tile[]>(() => tilesData?.data ?? [], [tilesData]);
  const tags = useMemo<Tag[]>(() => tagsData?.data ?? [], [tagsData]);
  const rootTagId = useMemo(() => tags.find((t) => t.is_root)?.id, [tags]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  // ── Comandi della toolbar ──────────────────────────────────────────────────
  const [activeTag, setActiveTag] = useState('all');
  const [laneMenu, setLaneMenu] = useState<{ x: number; y: number; laneId: string } | null>(null);
  const [axisOpen, setAxisOpen] = useState<'column' | 'lane' | null>(null);

  /**
   * La MODALITA' dei due assi vive nelle impostazioni utente, non in una
   * tabella: e' una scelta di vista, non un dato. Cambiarla non crea ne'
   * distrugge righe, e le voci personalizzate restano dove sono.
   *
   * Default: colonne personalizzate (cioe' quello che c'era gia' in tabella) e
   * nessuna corsia — la board che avevi prima, invariata.
   */
  const { data: axesData } = useQuery({
    queryKey: ['settings', AXES_KEY],
    queryFn: () => settingsApi.get<AxesSetting>(AXES_KEY),
    staleTime: 5 * 60 * 1000,
  });
  const axes: AxesSetting = useMemo(() => axesData?.data ?? {}, [axesData]);
  const colMode: AxisMode = axes.column ?? 'custom';
  const laneMode: AxisMode = axes.lane ?? 'none';

  /**
   * Le voci spente sono ricordate PER ASSE E PER MODALITA': spegnere due status
   * e poi passare a Tipo non deve portarsi dietro quelle scelte, e tornando a
   * Status le si ritrova come le si era lasciate.
   */
  const hiddenOf = useCallback(
    (which: 'column' | 'lane', m: AxisMode) => new Set(axes.hidden?.[which]?.[m] ?? []),
    [axes],
  );
  const colHidden = useMemo(() => hiddenOf('column', colMode), [hiddenOf, colMode]);
  const laneHidden = useMemo(() => hiddenOf('lane', laneMode), [hiddenOf, laneMode]);

  const saveAxes = useCallback((next: AxesSetting) => {
    queryClient.setQueryData(['settings', AXES_KEY], { success: true, data: next });
    settingsApi.set(AXES_KEY, next)
      .then(() => queryClient.invalidateQueries({ queryKey: ['settings', AXES_KEY] }))
      .catch(() => toast.error('Errore salvataggio vista'));
  }, [queryClient]);

  const setAxisMode = useCallback((which: 'column' | 'lane', m: AxisMode) => {
    saveAxes({ ...axes, [which]: m });
  }, [axes, saveAxes]);

  const toggleHidden = useCallback((which: 'column' | 'lane', m: AxisMode, id: string) => {
    const cur = new Set(axes.hidden?.[which]?.[m] ?? []);
    if (cur.has(id)) cur.delete(id); else cur.add(id);
    saveAxes({
      ...axes,
      hidden: { ...axes.hidden, [which]: { ...axes.hidden?.[which], [m]: [...cur] } },
    });
  }, [axes, saveAxes]);

  const showAll = useCallback((which: 'column' | 'lane', m: AxisMode) => {
    saveAxes({
      ...axes,
      hidden: { ...axes.hidden, [which]: { ...axes.hidden?.[which], [m]: [] } },
    });
  }, [axes, saveAxes]);

  // Finestra dei giorni, una per asse: i giorni non finiscono, quindi l'asse ne
  // mostra un tratto che si allarga quando arrivi al bordo.
  const [colDays, setColDays] = useState<DateWindow>(DEFAULT_DATE_WINDOW);
  const [laneDays, setLaneDays] = useState<DateWindow>(DEFAULT_DATE_WINDOW);
  const growDays = useCallback((which: 'column' | 'lane', side: 'start' | 'end') => {
    const set = which === 'column' ? setColDays : setLaneDays;
    set((w) => (side === 'start'
      ? { offset: w.offset - DATE_WINDOW_STEP, count: w.count + DATE_WINDOW_STEP }
      : { offset: w.offset, count: w.count + DATE_WINDOW_STEP }));
  }, []);
  /**
   * Le linguette: SOLO i tag pinnati, come nella topbar del canvas.
   *
   * Prima erano i sei tag piu' usati, il che riempiva la barra di roba che non
   * avevi scelto tu — e con un tag molto usato ma irrilevante finiva in vista
   * per sempre. Il pin e' una decisione esplicita: se non ne hai pinnato
   * nessuno la striscia non compare, e va bene cosi'.
   */
  const tagPills = useMemo(
    () => tags
      .filter((t) => t.is_pinned && !t.is_root)
      .map((t) => ({ id: t.id, label: t.name })),
    [tags],
  );

  // Il filtro per tag si applica PRIMA dei filtri di colonna: restringe l'insieme
  // su cui la board lavora, non compete con le regole che hai dato alle colonne.
  const visibleTiles = useMemo(
    () => (activeTag === 'all' ? allTiles : allTiles.filter((t) => (t.tags ?? []).some((tg) => tg.id === activeTag))),
    [allTiles, activeTag],
  );

  const iconList = useTypeIcons((s) => s.icons);

  /** Le voci dell'asse COLONNE, derivate dalla modalita' scelta. */
  const colAll = useMemo(
    () => axisItems(colMode, {
      statuses,
      icons: iconList,
      tags,
      custom: columns.map((c) => ({ id: c.id, title: c.title, filters: c.filters })),
      dateWindow: colDays,
    }),
    [colMode, statuses, iconList, tags, columns, colDays],
  );
  const colItems = useMemo(() => colAll.filter((i) => !colHidden.has(i.id)), [colAll, colHidden]);

  /** Le voci dell'asse CORSIE. `none` = nessuna fascia, board a una dimensione. */
  const laneAll = useMemo(
    () => axisItems(laneMode, {
      statuses,
      icons: iconList,
      tags,
      custom: laneRows.map((c) => ({ id: c.id, title: c.title, filters: c.filters })),
      dateWindow: laneDays,
    }),
    [laneMode, statuses, iconList, tags, laneRows, laneDays],
  );
  const laneItems = useMemo(() => laneAll.filter((i) => !laneHidden.has(i.id)), [laneAll, laneHidden]);

  /**
   * L'ordinamento dentro una cella. In modalita' `custom` lo porta la colonna
   * (`sort_by`/`sort_dir`); nelle modalita' derivate non c'e' una riga da cui
   * leggerlo, e resta l'ordine naturale della lista.
   */
  const sortOf = useCallback((itemId: string) => {
    const col = columns.find((c) => c.id === itemId);
    return { by: col?.sort_by ?? null, dir: col?.sort_dir ?? ('asc' as const) };
  }, [columns]);

  const buildLane = useCallback(
    (item: AxisItem, extra?: KanbanFilter[]): Lane => {
      const matched = visibleTiles.filter(
        (t) => tileMatchesFilters(t, item.filters, typeTileIcons)
          && (!extra || tileMatchesFilters(t, extra, typeTileIcons)),
      );
      const { by, dir } = sortOf(item.id);
      return {
        id: item.id,
        label: item.title,
        color: 'var(--ob-muted)',
        tiles: sortTiles(matched, by, dir).map((t) => toCard(t, rootTagId, statusById, getIconForTile)),
      };
    },
    [visibleTiles, typeTileIcons, sortOf, rootTagId, statusById, getIconForTile],
  );

  const lanes = useMemo<Lane[]>(() => colItems.map((c) => buildLane(c)), [colItems, buildLane]);

  /**
   * Le fasce: una per corsia, ciascuna con la stessa fila di colonne ma vista
   * attraverso i filtri della corsia. La cella e' l'intersezione dei due assi.
   * Con `laneMode = 'none'` l'array e' vuoto e la board resta a una dimensione.
   */
  const bands = useMemo(
    () => laneItems.map((row) => ({
      id: row.id,
      label: row.title,
      lanes: colItems.map((col) => buildLane(col, row.filters)),
    })),
    [laneItems, colItems, buildLane],
  );

  const columnMutation = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['kanban-columns'] }),
    onError: () => toast.error('Errore sulla colonna'),
  });

  /**
   * Crea in blocco. Le chiamate partono in SEQUENZA e non in parallelo: il
   * `sort_order` di ciascuna dipende da quante ce ne sono gia', e mandandole
   * insieme si accavallerebbero sullo stesso numero.
   */
  const deleteColumn = useCallback((id: string) => {
    const col = columns.find((c) => c.id === id);
    // Elimina la COLONNA, non i tile: vale la pena dirlo, perche' una board e'
    // fatta di tile e la domanda che uno si fa e' proprio quella.
    if (!window.confirm(`Eliminare la colonna "${col?.title ?? ''}"? I tile restano al loro posto.`)) return;
    columnMutation.mutate(() => kanbanApi.deleteColumn(id));
  }, [columns, columnMutation]);

  const createAxis = useCallback(async (items: { title: string; filters: KanbanFilter[] }[]) => {
    const isCol = axisOpen !== 'lane';
    let order = (isCol ? columns : laneRows).length;
    for (const c of items) {
      const res = isCol
        ? await kanbanApi.createColumn({ title: c.title, filters: c.filters, sort_order: order++ })
        : await kanbanApi.createLane({ title: c.title, filters: c.filters, sort_order: order++ });
      if (!res.success) { toast.error(`Errore su "${c.title}"`); break; }
    }
    queryClient.invalidateQueries({ queryKey: [isCol ? 'kanban-columns' : 'kanban-lanes'] });
  }, [axisOpen, columns, laneRows, queryClient]);

  const deleteAxis = useCallback((id: string) => {
    const isCol = axisOpen !== 'lane';
    if (isCol) { deleteColumn(id); return; }
    const row = laneRows.find((l) => l.id === id);
    if (!window.confirm(`Eliminare la corsia "${row?.title ?? ''}"? I tile restano al loro posto.`)) return;
    kanbanApi.deleteLane(id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['kanban-lanes'] }))
      .catch(() => toast.error('Errore sulla corsia'));
  }, [axisOpen, laneRows, queryClient, deleteColumn]);

  const renameColumn = useCallback((id: string) => {
    const col = columns.find((c) => c.id === id);
    const title = window.prompt('Nuovo nome della colonna', col?.title ?? '');
    if (!title?.trim() || title.trim() === col?.title) return;
    columnMutation.mutate(() => kanbanApi.updateColumn(id, { title: title.trim() }));
  }, [columns, columnMutation]);

  /** Trascinamento: la colonna presa si inserisce al posto di quella lasciata. */
  const reorderColumn = useCallback((fromId: string, toId: string) => {
    const from = columns.findIndex((c) => c.id === fromId);
    const to = columns.findIndex((c) => c.id === toId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...columns];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    columnMutation.mutate(() => kanbanApi.reorderColumns(next.map((c, k) => ({ id: c.id, sort_order: k }))));
  }, [columns, columnMutation]);

  const moveColumn = useCallback((id: string, delta: -1 | 1) => {
    const i = columns.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    columnMutation.mutate(() => kanbanApi.reorderColumns(next.map((c, k) => ({ id: c.id, sort_order: k }))));
  }, [columns, columnMutation]);

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
          fontSize: OB_TEXT.control,
          fontFamily: 'var(--ob-font-sans)',
        }}
      >
        Caricamento…
      </div>
    );
  }

  return (
    <>
      <KanbanView
        lanes={lanes}
        selectedId={selectedTileId ?? undefined}
        onCardClick={(id) => selectTile(id)}
        onAddTile={handleAddTile}
        onMoveTile={handleMoveTile}
        tagPills={tagPills}
        activeTag={activeTag}
        onTagChange={setActiveTag}
        onAddColumn={() => setAxisOpen('column')}
        onAddLane={() => setAxisOpen('lane')}
        bands={bands}
        dateAxis={{ column: colMode === 'date', lane: laneMode === 'date' }}
        onGrowDates={growDays}
        onReorder={reorderColumn}
        onLaneMenu={(e, laneId) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setLaneMenu({ x: r.left, y: r.bottom + 4, laneId });
        }}
      />
      <AxisModal
        open={axisOpen !== null}
        onClose={() => setAxisOpen(null)}
        axis={axisOpen ?? 'column'}
        mode={axisOpen === 'lane' ? laneMode : colMode}
        otherMode={axisOpen === 'lane' ? colMode : laneMode}
        onModeChange={(m) => setAxisMode(axisOpen ?? 'column', m)}
        entries={axisOpen === 'lane' ? laneRows : columns}
        items={axisOpen === 'lane' ? laneAll : colAll}
        hidden={axisOpen === 'lane' ? laneHidden : colHidden}
        onToggleHidden={(id) => toggleHidden(axisOpen ?? 'column', axisOpen === 'lane' ? laneMode : colMode, id)}
        onShowAll={() => showAll(axisOpen ?? 'column', axisOpen === 'lane' ? laneMode : colMode)}
        tags={tags}
        onCreate={createAxis}
        onDelete={deleteAxis}
      />
      {laneMenu && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onMouseDown={() => setLaneMenu(null)} />
          <div className="ob-ctx" style={{ left: laneMenu.x, top: laneMenu.y }}>
            <button type="button" className="ob-ctx__item" onClick={() => { renameColumn(laneMenu.laneId); setLaneMenu(null); }}>Rinomina</button>
            <button
              type="button"
              className="ob-ctx__item"
              disabled={columns.findIndex((c) => c.id === laneMenu.laneId) <= 0}
              onClick={() => { moveColumn(laneMenu.laneId, -1); setLaneMenu(null); }}
            >Sposta a sinistra</button>
            <button
              type="button"
              className="ob-ctx__item"
              disabled={columns.findIndex((c) => c.id === laneMenu.laneId) >= columns.length - 1}
              onClick={() => { moveColumn(laneMenu.laneId, 1); setLaneMenu(null); }}
            >Sposta a destra</button>
            <div className="ob-ctx__sep" />
            <button type="button" className="ob-ctx__item ob-ctx__item--danger" onClick={() => { deleteColumn(laneMenu.laneId); setLaneMenu(null); }}>Elimina colonna</button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
