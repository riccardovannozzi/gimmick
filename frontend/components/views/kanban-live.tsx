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
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
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

/** I due assi della board. */
type Which = 'column' | 'lane';
/** Una preferenza per asse E per modalita': vedi `hiddenOf`. */
type PerAxis<T> = Partial<Record<Which, Partial<Record<AxisMode, T>>>>;

/**
 * Come l'utente ha conciato la board. Tutto qui dentro e' una scelta di VISTA,
 * non un dato: sta nelle impostazioni utente e non nelle tabelle, perche'
 * cambiare modalita' non deve creare ne' distruggere righe.
 *
 * Ogni preferenza e' ricordata per asse E per modalita': le larghezze che hai
 * dato alle colonne-status non hanno senso sulle colonne-data, e tornando a
 * Status le ritrovi come le avevi lasciate.
 */
type AxesSetting = {
  column?: AxisMode;
  lane?: AxisMode;
  /** Voci spente (id). */
  hidden?: PerAxis<string[]>;
  /** Misure fissate a mano: id della voce → px. Le assenti si adattano. */
  size?: PerAxis<Record<string, number>>;
  /** Ordine deciso a mano: elenco di id. */
  order?: PerAxis<string[]>;
};
import { kanbanApi, tilesApi, tagsApi, settingsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { tileMatchesFilters, sortTiles, dateRangeKind } from '@/lib/kanban-helpers';
import { applyOrder } from '@/lib/kanban-layout';
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

/**
 * Le date di un tile spostato sul giorno `key` (`YYYY-MM-DD`).
 *
 * L'ORA E LA DURATA RESTANO: si sposta il giorno, non l'appuntamento. Un incontro
 * delle 15 trascinato di due colonne resta delle 15, e se durava due ore continua
 * a durarne due — la stessa regola del drag-and-drop di CHRONO.
 *
 * `null` quando non c'e' niente da spostare: note e to-do non hanno un campo
 * data, e nella colonna del giorno ci finiscono per la data di CREAZIONE, che
 * non e' modificabile. Restituire una data li' significherebbe trasformare
 * silenziosamente una nota in un evento perche' l'hai trascinata.
 */
function datesForDay(tile: Tile, action: string, key: string): Record<string, string> | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  if (action === 'none' || action === 'anytime') return null;
  const at = (h: number, min: number) => {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(h, min, 0, 0);
    return d;
  };
  // Il riferimento e' lo stesso di `eventRefIso`: la scadenza vive sulla fine,
  // tutto il resto sull'inizio.
  const refIso = action === 'deadline' ? (tile.end_at || tile.start_at) : (tile.start_at || tile.end_at);
  const ref = refIso ? new Date(refIso) : null;
  if (action === 'deadline') {
    // Una scadenza nuova senza ora scade a fine giornata lavorativa, non a
    // mezzanotte: mezzanotte e' il giorno dopo per chiunque la legga.
    return { end_at: at(ref ? ref.getHours() : 18, ref ? ref.getMinutes() : 0).toISOString() };
  }
  const start = at(ref ? ref.getHours() : 9, ref ? ref.getMinutes() : 0);
  const span = tile.start_at && tile.end_at
    ? Math.max(0, new Date(tile.end_at).getTime() - new Date(tile.start_at).getTime())
    : 3600_000;
  return { start_at: start.toISOString(), end_at: new Date(start.getTime() + span).toISOString() };
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
  const assignIcon = useTypeIcons((s) => s.assignIcon);
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
  /**
   * Il tag della board NON e' uno stato locale della vista: e' quello dello
   * SHELL (`tag-filter-store`), lo stesso che la sidebar dei tag accende e da
   * cui la sidebar prende la propria evidenziazione.
   *
   * Era uno `useState` qui dentro, e le due cose vivevano separate: scegliendo
   * un tag nella sidebar la board continuava a mostrare TUTTI i tile, e la
   * linguetta accesa in toolbar poteva dire un tag diverso da quello acceso a
   * sinistra. Con una sorgente sola le due strade — linguetta e sidebar —
   * portano allo stesso posto, e c'e' sempre UNA sola cosa evidenziata perche'
   * c'e' un solo valore da cui entrambe leggono.
   *
   * Essendo persistita, la board che ritrovi riaprendo l'app e' l'ultima che
   * stavi guardando, non "tutti i tile".
   */
  const selectedTagIds = useTagFilterStore((s) => s.selectedTagIds);
  const selectOnlyTag = useTagFilterStore((s) => s.selectOnly);
  const toggleTag = useTagFilterStore((s) => s.toggle);
  const clearTagFilter = useTagFilterStore((s) => s.clear);
  /** Insieme VUOTO = nessun tag scelto: la board non e' ristretta a niente. */
  const activeTags = useMemo(() => [...selectedTagIds], [selectedTagIds]);
  /**
   * Click semplice = solo quel tag; se era gia' l'unico acceso, si spegne e la
   * board torna senza filtro (e' il gesto che qui fa da "Tutti").
   * Ctrl/cmd+click = aggiunge o toglie, per guardare piu' tag insieme.
   */
  const handleTagChange = useCallback((id: string, additive: boolean) => {
    if (additive) { toggleTag(id); return; }
    if (selectedTagIds.size === 1 && selectedTagIds.has(id)) clearTagFilter();
    else selectOnlyTag(id);
  }, [selectedTagIds, toggleTag, clearTagFilter, selectOnlyTag]);
  /**
   * Evidenziazione verde dei COMPLETATI — lo stesso pulsante della topbar del
   * canvas. Default SPENTO e init a `false` per non sfasare l'idratazione: il
   * ripristino gira in layout-effect, prima del paint, quindi il verde non
   * "lampeggia" al rimonto della vista. La scelta resta su questo dispositivo
   * (localStorage), come la vista del calendario di Chrono.
   */
  const [doneHl, setDoneHl] = useState(false);
  useIsomorphicLayoutEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('kanban-done-hl') === '1') setDoneHl(true);
  }, []);
  const toggleDoneHl = useCallback(() => {
    setDoneHl((v) => {
      const next = !v;
      try { window.localStorage.setItem('kanban-done-hl', next ? '1' : '0'); } catch { /* storage non disponibile */ }
      return next;
    });
  }, []);
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
  // Con piu' tag accesi e' l'UNIONE: un tile basta che ne abbia uno.
  const visibleTiles = useMemo(
    () => (selectedTagIds.size === 0
      ? allTiles
      : allTiles.filter((t) => (t.tags ?? []).some((tg) => selectedTagIds.has(tg.id)))),
    [allTiles, selectedTagIds],
  );

  const iconList = useTypeIcons((s) => s.icons);

  /**
   * Le voci dell'asse COLONNE, derivate dalla modalita' scelta e poi rimesse
   * nell'ordine deciso a mano. L'ordine si applica PRIMA di togliere le voci
   * spente: riaccendendone una la ritrovi al suo posto e non in fondo.
   */
  const colAll = useMemo(
    () => applyOrder(axisItems(colMode, {
      statuses,
      icons: iconList,
      tags,
      custom: columns.map((c) => ({ id: c.id, title: c.title, filters: c.filters })),
      dateWindow: colDays,
    }), axes.order?.column?.[colMode]),
    [colMode, statuses, iconList, tags, columns, colDays, axes],
  );
  const colItems = useMemo(() => colAll.filter((i) => !colHidden.has(i.id)), [colAll, colHidden]);

  /** Le voci dell'asse CORSIE. `none` = nessuna fascia, board a una dimensione. */
  const laneAll = useMemo(
    () => applyOrder(axisItems(laneMode, {
      statuses,
      icons: iconList,
      tags,
      custom: laneRows.map((c) => ({ id: c.id, title: c.title, filters: c.filters })),
      dateWindow: laneDays,
    }), axes.order?.lane?.[laneMode]),
    [laneMode, statuses, iconList, tags, laneRows, laneDays, axes],
  );
  const laneItems = useMemo(() => laneAll.filter((i) => !laneHidden.has(i.id)), [laneAll, laneHidden]);

  // ── Misure e ordine decisi a mano ──────────────────────────────────────────
  const colSize = useMemo(() => axes.size?.column?.[colMode] ?? {}, [axes, colMode]);
  const rowSize = useMemo(() => axes.size?.lane?.[laneMode] ?? {}, [axes, laneMode]);

  /**
   * Fine del trascinamento di un bordo: una scrittura per gesto.
   *
   * `rail` finisce nel ripiano delle CORSIE benche' sia una larghezza: e' la
   * colonna dei nomi di corsia, quindi cambia con l'asse orizzontale — passando
   * da corsie-status a corsie-data la misura buona e' un'altra.
   */
  const resizeAxis = useCallback((kind: 'col' | 'row' | 'rail', id: string, px: number) => {
    const which: Which = kind === 'col' ? 'column' : 'lane';
    const m = which === 'column' ? colMode : laneMode;
    const cur = which === 'column' ? colSize : rowSize;
    saveAxes({
      ...axes,
      size: { ...axes.size, [which]: { ...axes.size?.[which], [m]: { ...cur, [id]: px } } },
    });
  }, [axes, colMode, laneMode, colSize, rowSize, saveAxes]);

  /**
   * La voce presa si inserisce al posto di quella lasciata.
   *
   * L'ordine sta nelle impostazioni e non in `sort_order`, perche' quattro
   * modalita' su cinque non hanno righe in tabella da riordinare. Con le voci
   * PERSONALIZZATE lo si scrive anche in tabella: li' una riga c'e', ed e' da
   * quella che la modale legge l'elenco — senza, board e modale mostrerebbero
   * lo stesso asse in due ordini diversi.
   */
  const reorderAxis = useCallback((which: Which, fromId: string, toId: string) => {
    const m = which === 'column' ? colMode : laneMode;
    const ids = (which === 'column' ? colAll : laneAll).map((i) => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    saveAxes({
      ...axes,
      order: { ...axes.order, [which]: { ...axes.order?.[which], [m]: ids } },
    });
    if (m !== 'custom') return;
    const payload = ids.map((id, k) => ({ id, sort_order: k }));
    const key = which === 'column' ? 'kanban-columns' : 'kanban-lanes';
    (which === 'column' ? kanbanApi.reorderColumns(payload) : kanbanApi.reorderLanes(payload))
      .then(() => queryClient.invalidateQueries({ queryKey: [key] }))
      .catch(() => toast.error('Errore riordino'));
  }, [axes, colMode, laneMode, colAll, laneAll, saveAxes, queryClient]);

  /** Sposta di una posizione — il "sposta a sinistra/destra" del menu. */
  const nudgeAxis = useCallback((which: Which, id: string, delta: -1 | 1) => {
    const all = which === 'column' ? colAll : laneAll;
    const i = all.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= all.length) return;
    reorderAxis(which, id, all[j].id);
  }, [colAll, laneAll, reorderAxis]);

  /**
   * «Adatta»: cancella misure e ordine fissati a mano SULLE MODALITA' IN USO, e
   * la board torna a calcolarsi da sola. Non tocca le altre modalita': quelle
   * non sono in vista, e cancellarle sarebbe distruggere lavoro che non stai
   * guardando.
   */
  const resetView = useCallback(() => {
    const drop = <T,>(rec: Partial<Record<AxisMode, T>> | undefined, m: AxisMode) => {
      const next = { ...(rec ?? {}) };
      delete next[m];
      return next;
    };
    saveAxes({
      ...axes,
      size: { column: drop(axes.size?.column, colMode), lane: drop(axes.size?.lane, laneMode) },
      order: { column: drop(axes.order?.column, colMode), lane: drop(axes.order?.lane, laneMode) },
    });
  }, [axes, colMode, laneMode, saveAxes]);

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

  const tileMutation = useMutation({
    mutationFn: (params: { id: string; updates: Record<string, unknown> }) =>
      tilesApi.update(params.id, params.updates),
    onSuccess: () => invalidateTileCaches(queryClient, ['kanban-columns']),
    onError: () => toast.error('Errore spostamento tile'),
  });

  /**
   * Drop di un tile in una cella.
   *
   * Spostare un tile SIGNIFICA cambiargli la proprieta' che lo teneva dov'era: la
   * cella e' l'incrocio di due filtri, e il drop li applica ENTRAMBI. Prima
   * leggeva solo `columns`, cioe' funzionava sulle sole colonne personalizzate:
   * nelle altre quattro modalita' il tile tornava al suo posto senza spiegazioni.
   *
   * Le date si risolvono DOPO il ciclo e non dentro: quando la colonna dice
   * l'azione e la corsia dice il giorno (o viceversa), i due filtri parlano degli
   * stessi campi, e l'azione azzera proprio le date che il giorno deve scrivere.
   * Applicati in ordine di arrivo, l'esito dipendeva da quale asse capitava
   * prima.
   */
  const handleMoveTile = useCallback(
    async (tileId: string, colId: string, rowId?: string) => {
      const tile = allTiles.find((t) => t.id === tileId);
      if (!tile) return;
      const filters = [
        ...(colAll.find((i) => i.id === colId)?.filters ?? []),
        ...(rowId ? laneAll.find((i) => i.id === rowId)?.filters ?? [] : []),
      ];
      if (!filters.length) return;

      const updates: Record<string, unknown> = {};
      let tagChanged = false;
      let iconChanged = false;
      let action: string | null = null;
      let day: string | null = null;

      for (const f of filters) {
        switch (f.type) {
          case 'action_type':
            action = f.value;
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
          case 'type_icon':
            // Il tipo non e' un campo del tile: e' un'associazione a parte, e
            // vive nel suo store con la sua chiamata.
            if (typeTileIcons[tile.id] !== f.value) { assignIcon(tile.id, f.value); iconChanged = true; }
            break;
          case 'date_range':
            // Solo un giorno preciso si puo' applicare. `last:7` e `next:30` sono
            // finestre relative: "spostare un tile negli ultimi 7 giorni" non
            // indica una data, e il drop non ha niente da scrivere.
            if (dateRangeKind(f.value) === 'absolute') day = f.value.split('|')[0] || null;
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

      if (day) {
        const dates = datesForDay(tile, action ?? tile.action_type ?? 'none', day);
        if (!dates) {
          // Note e to-do non hanno un campo data: stanno nella colonna del giorno
          // in cui li hai creati, e quella non si sposta. Va detto, altrimenti il
          // tile torna indietro e sembra un movimento non riuscito.
          toast.error('Note e to-do non hanno una data da spostare: passa prima a scadenza o evento.');
          return;
        }
        Object.assign(updates, dates);
      }

      if (Object.keys(updates).length > 0) tileMutation.mutate({ id: tile.id, updates });
      if (tagChanged || iconChanged) invalidateTileCaches(queryClient, ['tags', 'kanban-columns']);
    },
    [allTiles, colAll, laneAll, typeTileIcons, assignIcon, queryClient, tileMutation],
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
        activeTags={activeTags}
        onTagChange={handleTagChange}
        onAddColumn={() => setAxisOpen('column')}
        onAddLane={() => setAxisOpen('lane')}
        bands={bands}
        dateAxis={{ column: colMode === 'date', lane: laneMode === 'date' }}
        onGrowDates={growDays}
        onReorder={(from, to) => reorderAxis('column', from, to)}
        onReorderRow={(from, to) => reorderAxis('lane', from, to)}
        colSize={colSize}
        rowSize={rowSize}
        onResize={resizeAxis}
        onReset={resetView}
        doneHighlight={doneHl}
        onToggleDoneHighlight={toggleDoneHl}
        // Rinomina ed elimina hanno senso solo dove c'e' una riga da rinominare
        // o eliminare. Nelle quattro modalita' derivate le voci non esistono in
        // tabella: il menu apriva comandi che scrivevano su un id inesistente.
        onLaneMenu={colMode === 'custom' ? (e, laneId) => {
          e.stopPropagation();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setLaneMenu({ x: r.left, y: r.bottom + 4, laneId });
        } : undefined}
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
            {/* I limiti si leggono su `colAll` e non su `columns`: e' l'elenco
                che la board disegna davvero, gia' nell'ordine deciso a mano. */}
            <button
              type="button"
              className="ob-ctx__item"
              disabled={colAll.findIndex((c) => c.id === laneMenu.laneId) <= 0}
              onClick={() => { nudgeAxis('column', laneMenu.laneId, -1); setLaneMenu(null); }}
            >Sposta a sinistra</button>
            <button
              type="button"
              className="ob-ctx__item"
              disabled={colAll.findIndex((c) => c.id === laneMenu.laneId) >= colAll.length - 1}
              onClick={() => { nudgeAxis('column', laneMenu.laneId, 1); setLaneMenu(null); }}
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
