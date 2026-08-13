'use client';

/**
 * Gimmick · Obsidian — Chrono view collegata ai dati reali (Fase 5).
 *
 * Collega la `ChronoView`:
 *   - colonne NOTES/TODO/FLOW ← `tilesApi.list` splittato per action_type
 *     ('none' → Notes, 'anytime' → Todo, 'flow' → Flow)
 *   - griglia settimanale ← `calendarApi.events(range)` (Tile schedulati):
 *     timed nel time-grid, all-day/deadline nella lane "tutto il dì"
 *   - navigazione settimana (prec/oggi/succ), click card/evento → Inspector
 *   - "Tile" → crea + apre dettaglio
 *
 * Drag-drop: trascina un evento timed per spostarlo (giorno + ora, snap 15');
 * trascina una card Notes/Todo su uno slot per schedularla come evento (1h).
 * GAP rimanenti: vista mese, creazione evento da slot vuoto (click), resize
 * evento, sort/filter colonne. Griglia 07–20 (eventi fuori range clampati).
 * Editing nel TileSidebar (Inspector).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChronoView,
  type ColTile,
  type ChronoCalendar,
  type ChronoTimed,
  type ChronoAllDay,
  type MonthCell,
  type MonthEvent,
  type ChronoCalView,
  type ColumnActionType,
} from '@/components/views/chrono';
import { Icon } from '@/components/shell';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import { subtaskToStep, type TileStatus } from '@/lib/tile-visual';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { useTileClipboardStore } from '@/store/tile-clipboard-store';
import { useStatuses } from '@/store/statuses-store';
import { statusMeta } from '@/lib/status-meta';
import type { Status, Tile } from '@/types';
import { OB_TEXT } from '@/lib/theme/ob-typography';

/** Status del tile reso come swatch (forma) nella meta-row della card.
 *  'active' è lo stato di default/prevalente → non si segnala. */
function cardStatus(t: Tile, statusById: Map<string, Status>) {
  const st = t.status_id ? statusById.get(t.status_id) : undefined;
  if (!st || st.name === 'active') return undefined;
  const meta = statusMeta(st.name);
  return { label: meta.label, color: meta.color, shape: st.shape };
}

/** Stato del menu contestuale (tasto destro). `slot` presente → la tile è un
 *  evento timed del calendario: "Incolla" schedula lì la copia. */
interface ChronoMenu {
  x: number;
  y: number;
  tileId: string;
  slot?: { dayIndex: number; startFrac: number };
}

const SPARK_MAP: Record<string, 'voice' | 'text' | 'file' | 'photo'> = {
  audio_recording: 'voice',
  image: 'photo',
  photo: 'photo',
  video: 'photo',
  text: 'text',
  file: 'file',
};

const SPARK_PLACEHOLDER: Record<string, string> = {
  audio_recording: 'Nota vocale',
  image: 'Foto',
  photo: 'Foto',
  video: 'Video',
  file: 'File',
  text: 'Nota',
};

/**
 * Titolo da mostrare sulla card. Le note catturate al volo spesso non hanno
 * un titolo (generazione AI non ancora avvenuta): in tal caso ripieghiamo sul
 * contenuto testuale del primo spark, poi sul nome file, infine su un'etichetta
 * per tipo — così la card non resta mai vuota.
 */
function deriveTitle(t: Tile): string {
  if (t.title && t.title.trim()) return t.title.trim();
  const sp = t.sparks?.[0];
  if (sp) {
    const text = (sp.content || sp.file_name || '').trim().replace(/\s+/g, ' ');
    if (text) return text.length > 90 ? `${text.slice(0, 90)}…` : text;
    const label = SPARK_PLACEHOLDER[sp.type];
    if (label) return label;
  }
  return 'Senza titolo';
}

/** Conferme delle due azioni di colonna, una riga per colonna. */
const COLUMN_TOAST: Record<ColumnActionType, { moved: string; created: string }> = {
  none:    { moved: 'Spostato in Notes', created: 'Nota creata' },
  anytime: { moved: 'Spostato in Todo',  created: 'Task creato' },
  flow:    { moved: 'Spostato in Flow',  created: 'Flow creato' },
};

function toColTile(t: Tile, statusById: Map<string, Status>, iconOf: (tileId: string) => { icon: string; color?: string } | null): ColTile {
  const ti = iconOf(t.id);
  const isTodo = t.action_type === 'anytime';
  const isFlow = t.action_type === 'flow';
  const sp = t.sparks?.[0];
  const steps = (t.subtasks ?? []).map(subtaskToStep);
  return {
    id: t.id,
    title: deriveTitle(t),
    actionLabel: isFlow ? 'Flow' : isTodo ? 'To do' : 'Notes',
    actionColor: isFlow ? 'var(--ob-accent)' : isTodo ? 'var(--ob-subtle)' : 'var(--ob-muted)',
    action: t.action_type,
    spark: sp ? SPARK_MAP[sp.type] : undefined,
    sparks: (t.sparks ?? []).map((s) => s.type),
    steps: steps.length ? steps : undefined,
    createdAt: t.created_at,
    done: !!t.is_completed,
    status: cardStatus(t, statusById),
    // Nome grezzo dello status: al sistema visivo serve la chiave, non
    // l'etichetta tradotta che `cardStatus` produce per lo swatch.
    statusName: (t.status_id ? statusById.get(t.status_id)?.name : undefined) as TileStatus | undefined,
    type: ti ? { icon: ti.icon, color: ti.color ?? '#5C5868' } : undefined,
    sparkCount: (t.sparks ?? []).length,
  };
}

/** Il lunedì della settimana in cui cade `d`. */
function mondayOfDate(d: Date): Date {
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
}

function mondayOf(offsetWeeks: number): Date {
  const m = mondayOfDate(new Date());
  return new Date(m.getFullYear(), m.getMonth(), m.getDate() + offsetWeeks * 7);
}

/** `yyyy-mm-dd` nel fuso LOCALE. `toISOString()` no: converte in UTC, e in Italia
 *  d'estate le date fino alle 02:00 tornerebbero indietro di un giorno. */
function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Giorni fra due date, ignorando l'orario. `Math.round` perché fra i due
 *  estremi può esserci un cambio d'ora, che sposta la differenza di 3600000ms. */
function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function dayIndexFrom(iso: string, gridStart: Date): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function frac(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Riferimento temporale dell'evento (deadline → end, altrimenti start). */
function eventRefIso(t: Tile): string | undefined {
  return t.action_type === 'deadline' ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
}

export function ChronoLive() {
  const queryClient = useQueryClient();
  const [view, setViewState] = useState<ChronoCalView>('week');
  const [dayOffset, setDayOffset] = useState(0); // per le viste day / 3day (in giorni)
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  // Vista calendario persistita (init 'week' per evitare mismatch di idratazione).
  // Ripristino in layout-effect: gira prima del paint, così il default 'week'
  // non viene mai disegnato e il segmented non "salta" al rimonto della vista.
  useIsomorphicLayoutEffect(() => {
    const s = typeof window !== 'undefined' ? window.localStorage.getItem('chrono-cal-view') : null;
    if (s === 'day' || s === '3day' || s === 'week' || s === 'month') setViewState(s);
  }, []);
  const setView = useCallback((v: ChronoCalView) => {
    setViewState(v);
    try { window.localStorage.setItem('chrono-cal-view', v); } catch { /* storage non disponibile */ }
  }, []);
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const selectTile = useTileSelectionStore((s) => s.select);
  const clearSelection = useTileSelectionStore((s) => s.clear);
  const clipboardId = useTileClipboardStore((s) => s.tileId);
  const copyTile = useTileClipboardStore((s) => s.copy);
  const { statuses } = useStatuses();
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const [menu, setMenu] = useState<ChronoMenu | null>(null);
  // Modalità "posiziona tile": armata dal pulsante +Tile, attiva il click-to-create
  // sugli slot vuoti della griglia.
  const [addArmed, setAddArmed] = useState(false);

  /*
   * La COLORAZIONE dei tile (per Tag / per Tipo / per Status) non c'è più.
   *
   * Erano tre modi di tingere di pieno lo stesso tile, scelti da tre pulsanti in
   * barra e persistiti in `chrono-color-mode`. Il colore però lo portano già i
   * canali del sistema visivo — l'icona del tipo col suo colore, lo swatch dello
   * status, il bordo, il badge — e ridipingere l'intero tile con UNO di quei tre
   * significati costringeva a sceglierne uno e perdere gli altri due, per di più
   * mascherando i segnali che restano visibili sempre.
   *
   * ⚠️ Restano `ColTile.bg` e `ChronoTimed/AllDay/Month.color`: sono il CANALE
   * (il tile prende un colore da chi glielo passa), non la funzione che è stata
   * tolta. Li usa ancora il ripiego `amber` delle scadenze.
   */

  /**
   * Evidenziazione verde dei COMPLETATI — lo stesso pulsante della topbar del
   * canvas. Distinta dalla colorazione qui sopra: quella decide da quale campo
   * il tile prende il colore, questa accende un segnale sopra tutte e tre.
   * Default SPENTO e init a `false` per non sfasare l'idratazione; il ripristino
   * gira in layout-effect, prima del paint.
   */
  const [doneHl, setDoneHl] = useState(false);
  useIsomorphicLayoutEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem('chrono-done-hl') === '1') setDoneHl(true);
  }, []);
  const toggleDoneHl = useCallback(() => {
    setDoneHl((v) => {
      const next = !v;
      try { window.localStorage.setItem('chrono-done-hl', next ? '1' : '0'); } catch { /* storage non disponibile */ }
      return next;
    });
  }, []);

  const { getIconForTile, loaded: typeIconsLoaded, fetchAll: fetchTypeIcons } = useTypeIcons();
  /**
   * ⚠️ Sottoscrizione agli ASSEGNAMENTI icona→tile. `getIconForTile` è una
   * funzione stabile dello store: da sola non cambia mai identità, quindi i memo
   * che la elencano fra le dipendenze non ricalcolerebbero quando cambia
   * l'icona di un tile — e le liste resterebbero col glifo vecchio finché non
   * cambia qualcos'altro. È questa mappa a farli ricalcolare, ed è per questo
   * che compare nelle dipendenze qui sotto pur non essendo letta direttamente.
   *
   * Prima ci arrivava di rimbalzo: era dipendenza di `colorOf`, che a sua volta
   * era dipendenza dei memo. Tolto `colorOf`, il rimbalzo è sparito e il legame
   * va dichiarato dove serve davvero.
   */
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  useEffect(() => { if (!typeIconsLoaded) fetchTypeIcons(); }, [typeIconsLoaded, fetchTypeIcons]);

  // Numero di colonne-giorno per la vista corrente (month gestito a parte).
  const dayCount = view === 'day' ? 1 : view === '3day' ? 3 : 7;
  // Primo giorno visibile: lunedì della settimana (week) oppure oggi+offset (day/3day).
  const gridStart = useMemo(() => {
    if (view === 'week') return mondayOf(weekOffset);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  }, [view, weekOffset, dayOffset]);
  // Mese target: primo giorno + lunedì della griglia (6×7) che lo contiene.
  const monthInfo = useMemo(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const dow = first.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 + diffToMon);
    return { first, gridStart };
  }, [monthOffset]);

  const range = useMemo(() => {
    if (view === 'month') {
      const s = monthInfo.gridStart;
      const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 41, 23, 59, 59);
      return { start: s.toISOString(), end: e.toISOString() };
    }
    const s = gridStart;
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + (dayCount - 1), 23, 59, 59);
    return { start: s.toISOString(), end: e.toISOString() };
  }, [view, gridStart, dayCount, monthInfo]);

  const { data: eventsData } = useQuery({
    queryKey: ['calendar-events', range.start, range.end],
    queryFn: async () => {
      const res = await calendarApi.events(range.start, range.end);
      if (!res.success) throw new Error(res.error || 'Errore caricamento eventi');
      return res;
    },
    staleTime: 2 * 60 * 1000,
  });
  // Le tre colonne, in una sola chiave di cache.
  //
  // Prima era una richiesta sola senza filtro, e il tetto di 100 righe era
  // spartito fra TUTTI i tipi in ordine di creazione: con 393 eventi su 585
  // tile, la finestra si riempiva di roba che nelle colonne non compare mai e
  // che quindi veniva scartata lato client. Misurato sui dati reali: dei 28 tile
  // che ospitano beat — i candidati flow — ZERO cadevano dentro la finestra.
  //
  // Tre richieste filtrate per tipo, quindi, ognuna col suo tetto di 100.
  // Restano UNA queryKey e UN array: gli aggiornamenti ottimistici e la ricerca
  // del sorgente per Incolla continuano a lavorare su `['tiles-calendar']` come
  // prima, senza sapere che sotto sono tre chiamate.
  const { data: allTilesData, isLoading } = useQuery({
    queryKey: ['tiles-calendar'],
    queryFn: async () => {
      const parts = await Promise.all(
        (['none', 'anytime', 'flow'] as const).map((action_type) => tilesApi.list({ limit: 100, action_type })),
      );
      if (parts.some((r) => !r.success)) throw new Error('Errore caricamento tiles');
      return { success: true as const, data: parts.flatMap((r) => r.data ?? []) };
    },
    staleTime: 60_000,
  });
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const events = useMemo<Tile[]>(() => eventsData?.data ?? [], [eventsData]);
  const allTiles = useMemo<Tile[]>(() => allTilesData?.data ?? [], [allTilesData]);

  // `typeTileIcons` non è letta qui dentro, e il linter la segnala per questo:
  // è la dipendenza che fa RICALCOLARE il memo quando cambia l'icona di un tile,
  // perché `getIconForTile` è stabile e da sola non lo sveglierebbe mai. Vedi la
  // nota sulla sottoscrizione, sopra.
  const notes = useMemo(
    () => allTiles.filter((t) => t.action_type === 'none').map((t) => toColTile(t, statusById, getIconForTile)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTiles, statusById, getIconForTile, typeTileIcons],
  );
  const todos = useMemo(
    () => allTiles.filter((t) => t.action_type === 'anytime').map((t) => toColTile(t, statusById, getIconForTile)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTiles, statusById, getIconForTile, typeTileIcons],
  );
  const flows = useMemo(
    () => allTiles.filter((t) => t.action_type === 'flow').map((t) => toColTile(t, statusById, getIconForTile)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allTiles, statusById, getIconForTile, typeTileIcons],
  );

  // dayIndex (0 = prima colonna) + frazione d'ora → ISO assoluto nel periodo mostrato.
  const fracToISO = useCallback((dayIndex: number, frac: number) => {
    const h = Math.floor(frac);
    const m = Math.round((frac - h) * 60);
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayIndex, h, m);
    return d.toISOString();
  }, [gridStart]);

  // Drag-drop di un evento timed: aggiorna start/end (durata preservata dalla view).
  const handleEventReschedule = useCallback((id: string, dayIndex: number, s: number, e: number) => {
    const start_at = fracToISO(dayIndex, s);
    const end_at = fracToISO(dayIndex, e);
    // Optimistic: sposta subito l'evento nella cache della settimana corrente.
    queryClient.setQueryData(['calendar-events', range.start, range.end], (old: { data?: Tile[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === id ? { ...t, start_at, end_at, all_day: false } : t)) };
    });
    calendarApi.reschedule(id, start_at, end_at)
      .then(() => {
        // Re-valida anche calendar-events: se il server normalizza date/durata
        // diversamente dall'ottimistico, la griglia si riallinea subito.
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      })
      .catch(() => {
        toast.error('Errore spostamento evento');
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
      });
  }, [fracToISO, queryClient, range]);

  // Drop di una tile Notes/Todo su uno slot → la schedula come evento timed (1h).
  const handleScheduleTile = useCallback((tileId: string, dayIndex: number, s: number) => {
    const start_at = fracToISO(dayIndex, s);
    const end_at = fracToISO(dayIndex, Math.min(s + 1, 24));
    calendarApi.schedule({ tile_id: tileId, start_at, end_at })
      .then(() => {
        invalidateTileCaches(queryClient);
        toast.success('Tile schedulata');
      })
      .catch(() => toast.error('Errore schedulazione'));
  }, [fracToISO, queryClient]);

  // (Rimosso) Click su slot vuoto → creava un evento "Nuovo evento". Disabilitato
  // su richiesta: un click semplice sulla griglia non deve inserire nulla. Gli
  // eventi si creano via drag (schedulazione di Notes/Todo) o dal pulsante Tile.

  // Drop di un evento timed sulla lane "tutto il dì" → diventa all-day.
  const handleEventToAllDay = useCallback((id: string, dayIndex: number) => {
    const start_at = fracToISO(dayIndex, 0);
    // Optimistic: marca subito l'evento come all-day nella settimana corrente.
    queryClient.setQueryData(['calendar-events', range.start, range.end], (old: { data?: Tile[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === id ? { ...t, start_at, end_at: start_at, all_day: true } : t)) };
    });
    calendarApi.updateEvent(id, { all_day: true, start_at, end_at: start_at })
      .then(() => {
        // Re-valida anche calendar-events: se il server normalizza date/durata
        // diversamente dall'ottimistico, la griglia si riallinea subito.
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      })
      .catch(() => {
        toast.error('Errore conversione in tutto il dì');
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
      });
  }, [fracToISO, queryClient, range]);

  // Drop di un evento all-day sulla griglia oraria → torna timed (all_day: false).
  const handleEventToTimed = useCallback((id: string, dayIndex: number, s: number, e: number) => {
    const start_at = fracToISO(dayIndex, s);
    const end_at = fracToISO(dayIndex, e);
    queryClient.setQueryData(['calendar-events', range.start, range.end], (old: { data?: Tile[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === id ? { ...t, start_at, end_at, all_day: false } : t)) };
    });
    calendarApi.updateEvent(id, { all_day: false, start_at, end_at })
      .then(() => {
        // Re-valida anche calendar-events: se il server normalizza date/durata
        // diversamente dall'ottimistico, la griglia si riallinea subito.
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      })
      .catch(() => {
        toast.error('Errore conversione evento');
        queryClient.invalidateQueries({ queryKey: ['calendar-events', range.start, range.end] });
      });
  }, [fracToISO, queryClient, range]);

  // Drop di una tile Notes/Todo sulla lane "tutto il dì" → schedulata all-day.
  const handleScheduleAllDayTile = useCallback((tileId: string, dayIndex: number) => {
    const start_at = fracToISO(dayIndex, 0);
    calendarApi.schedule({ tile_id: tileId, start_at, end_at: start_at })
      .then(() => calendarApi.updateEvent(tileId, { all_day: true, start_at, end_at: start_at }))
      .then(() => {
        invalidateTileCaches(queryClient);
        toast.success('Tile schedulata (tutto il dì)');
      })
      .catch(() => toast.error('Errore schedulazione'));
  }, [fracToISO, queryClient]);

  // Drop di un tile (dalla griglia o da un'altra colonna) su Notes/Todo/Flow:
  // imposta action_type e deschedula (azzera evento/orari).
  const handleMoveToColumn = useCallback((tileId: string, actionType: ColumnActionType) => {
    // Optimistic: sposta il tile nella colonna giusta e toglilo dalla griglia.
    queryClient.setQueryData(['tiles-calendar'], (old: { data?: Tile[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t) => (t.id === tileId ? { ...t, action_type: actionType, is_event: false, all_day: false, start_at: undefined, end_at: undefined } : t)) };
    });
    queryClient.setQueryData(['calendar-events', range.start, range.end], (old: { data?: Tile[] } | undefined) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.filter((t) => t.id !== tileId) };
    });
    tilesApi.update(tileId, { action_type: actionType, is_event: false, all_day: false, start_at: null, end_at: null })
      .then(() => invalidateTileCaches(queryClient))
      .catch(() => {
        toast.error('Errore spostamento');
        invalidateTileCaches(queryClient);
      });
    toast.success(COLUMN_TOAST[actionType].moved);
  }, [queryClient, range]);

  // ─── Menu contestuale (tasto destro): Copia · Incolla · Apri flow · Elimina ──
  const closeMenu = useCallback(() => setMenu(null), []);

  // Chiusura con Esc finché il menu è aperto.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  // Esc disarma la modalità "posiziona tile".
  useEffect(() => {
    if (!addArmed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddArmed(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addArmed]);

  const openCardMenu = useCallback((e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, tileId });
  }, []);

  const openEventMenu = useCallback((e: React.MouseEvent, tileId: string, slot?: { dayIndex: number; startFrac: number }) => {
    setMenu({ x: e.clientX, y: e.clientY, tileId, slot });
  }, []);

  const handleCopy = useCallback(() => {
    if (!menu) return;
    copyTile(menu.tileId);
    setMenu(null);
    toast.success('Tile copiata');
  }, [menu, copyTile]);

  // Incolla: duplica la tile copiata. Se il menu è stato aperto su un evento del
  // calendario (slot presente), la copia viene schedulata in quella fascia.
  const handlePaste = useCallback(async () => {
    if (!clipboardId) return;
    const slot = menu?.slot;
    setMenu(null);
    const source = [...allTiles, ...events].find((t) => t.id === clipboardId);
    if (!source) { toast.error('Niente da incollare'); return; }
    try {
      const res = await tilesApi.create({ title: source.title || 'Copia' });
      if (!res.success || !res.data?.id) { toast.error('Errore incolla'); return; }
      const newId = res.data.id;
      if (source.action_type) {
        try { await tilesApi.update(newId, { action_type: source.action_type }); } catch { /* non bloccante */ }
      }
      const rootTag = (tagsData?.data ?? []).find((tg) => tg.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newId]);
      if (slot) {
        const start_at = fracToISO(slot.dayIndex, slot.startFrac);
        const end_at = fracToISO(slot.dayIndex, Math.min(slot.startFrac + 1, 24));
        await calendarApi.schedule({ tile_id: newId, start_at, end_at });
      }
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newId);
      toast.success('Tile incollata');
    } catch {
      toast.error('Errore incolla');
    }
  }, [clipboardId, menu, allTiles, events, tagsData, fracToISO, queryClient, selectTile]);

  const handleDelete = useCallback(async () => {
    if (!menu) return;
    const id = menu.tileId;
    setMenu(null);
    try {
      const res = await tilesApi.delete(id);
      if (!res.success) { toast.error('Errore eliminazione'); return; }
      if (selectedTileId === id) clearSelection();
      invalidateTileCaches(queryClient, ['tags', 'flow-hub']);
      toast.success('Tile eliminata');
    } catch {
      toast.error('Errore eliminazione');
    }
  }, [menu, selectedTileId, clearSelection, queryClient]);

  // "+Tile" non crea più subito una tile in NOTES: arma la modalità
  // "posiziona sul calendario". Il click su uno slot vuoto della griglia crea
  // la tile schedulata in quella fascia (vedi handleCreateAt).
  const handleAddTile = useCallback(() => {
    setAddArmed((a) => !a);
  }, []);

  // Click su uno slot vuoto della griglia mentre +Tile è armato: crea la tile,
  // la schedula come evento timed (1h) in quella fascia, poi disarma.
  const handleCreateAt = useCallback(async (dayIndex: number, s: number) => {
    setAddArmed(false);
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newId = res.data.id;
      const rootTag = (tagsData?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newId]);
      const start_at = fracToISO(dayIndex, s);
      const end_at = fracToISO(dayIndex, Math.min(s + 1, 24));
      await calendarApi.schedule({ tile_id: newId, start_at, end_at });
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newId);
      toast.success('Tile creata');
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsData, selectTile, fracToISO]);

  // Doppio click su una cella vuota della lane "tutto il dì": crea la tile e la
  // schedula come evento all-day in quel giorno. Sempre attivo (indipendente da +Tile).
  const handleDblCreateAllDay = useCallback(async (dayIndex: number) => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newId = res.data.id;
      const rootTag = (tagsData?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newId]);
      const start_at = fracToISO(dayIndex, 0);
      await calendarApi.schedule({ tile_id: newId, start_at, end_at: start_at });
      await calendarApi.updateEvent(newId, { all_day: true, start_at, end_at: start_at });
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newId);
      toast.success('Tile creata');
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsData, selectTile, fracToISO]);

  // Doppio click su area vuota di Notes/Todo/Flow: crea la tile con l'action_type
  // della colonna. Non schedula: resta in colonna.
  const handleCreateColumnTile = useCallback(async (actionType: ColumnActionType) => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newId = res.data.id;
      await tilesApi.update(newId, { action_type: actionType });
      const rootTag = (tagsData?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newId]);
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newId);
      toast.success(COLUMN_TOAST[actionType].created);
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsData, selectTile]);

  const calendar = useMemo<ChronoCalendar>(() => {
    const days = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      return { dow: d.toLocaleDateString('it-IT', { weekday: 'short' }), num: d.getDate() };
    });
    const todayIndex = dayIndexFrom(new Date().toISOString(), gridStart);
    const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + (dayCount - 1));
    const dayRangeLabel = dayCount === 1
      ? gridStart.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : `${gridStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${gridEnd.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const timed: ChronoTimed[] = [];
    const allday: ChronoAllDay[] = [];
    for (const t of events) {
      const isAllDay = !!t.all_day || t.action_type === 'deadline';
      const refIso = t.action_type === 'deadline' ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
      if (!refIso) continue;
      const day = dayIndexFrom(refIso, gridStart);
      if (day < 0 || day >= dayCount) continue;
      if (isAllDay) {
        const ti = getIconForTile(t.id);
        allday.push({
          day,
          title: t.title || 'Senza titolo',
          kind: t.action_type === 'deadline' ? 'deadline' : 'allday',
          id: t.id,
          done: !!t.is_completed,
          type: ti ? { icon: ti.icon, color: ti.color ?? '#5C5868' } : undefined,
          status: cardStatus(t, statusById),
        });
      } else {
        const s = frac(refIso);
        const e = t.end_at ? frac(t.end_at) : s + 1;
        const ti = getIconForTile(t.id);
        timed.push({
          day, s, e: e > s ? e : s + 1, title: t.title || 'Senza titolo', kind: 'timed', id: t.id,
          done: !!t.is_completed,
          type: ti ? { icon: ti.icon, color: ti.color ?? '#5C5868' } : undefined,
          status: cardStatus(t, statusById),
        });
      }
    }

    // ── Celle del mese (6×7) — usate quando view === 'month' ──
    let month: MonthCell[] | undefined;
    let monthRangeLabel = '';
    if (view === 'month') {
      const gs = monthInfo.gridStart;
      const todayK = dateKey(new Date());
      month = Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gs.getFullYear(), gs.getMonth(), gs.getDate() + i);
        const key = dateKey(d);
        const cellEvents: MonthEvent[] = events
          .filter((t) => { const ref = eventRefIso(t); return ref && dateKey(new Date(ref)) === key; })
          .map((t) => ({
            id: t.id,
            title: t.title || 'Senza titolo',
            kind: t.action_type === 'deadline' ? 'deadline' : t.all_day ? 'allday' : 'timed',
            done: !!t.is_completed,
          }));
        return { key, num: d.getDate(), inMonth: d.getMonth() === monthInfo.first.getMonth(), isToday: key === todayK, events: cellEvents };
      });
      monthRangeLabel = monthInfo.first.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }

    // Navigazione per vista: month → mesi, week → settimane, day/3day → giorni
    // (passo pari al numero di colonne mostrate).
    const step = (dir: -1 | 1) => {
      if (view === 'month') setMonthOffset((m) => m + dir);
      else if (view === 'week') setWeekOffset((w) => w + dir);
      else setDayOffset((o) => o + dir * dayCount);
    };
    const goToday = () => {
      if (view === 'month') setMonthOffset(0);
      else if (view === 'week') setWeekOffset(0);
      else setDayOffset(0);
    };

    /**
     * Salto a una data assoluta. La griglia non tiene una data d'ancoraggio: sa
     * solo di quanti periodi è distante da OGGI (`weekOffset`, `dayOffset`,
     * `monthOffset`). Andare a una data vuol dire quindi convertirla nello
     * scarto che la porta in vista, e lo scarto si misura nell'unità della vista
     * corrente — mesi, settimane o giorni.
     *
     * La data arriva come `yyyy-mm-dd` e si ricompone a mano: `new Date(iso)` su
     * una stringa senza orario è mezzanotte UTC, che a ovest di Greenwich è il
     * giorno prima.
     */
    const goToDate = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      if (!y || !m || !d) return;
      const target = new Date(y, m - 1, d);
      const now = new Date();
      if (view === 'month') {
        setMonthOffset((target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
      } else if (view === 'week') {
        setWeekOffset(Math.round(daysBetween(mondayOf(0), mondayOfDate(target)) / 7));
      } else {
        // Day e 3day: la data scelta diventa la PRIMA colonna, non quella
        // centrale — chi scrive una data guarda avanti da lì.
        setDayOffset(daysBetween(now, target));
      }
    };

    return {
      days,
      todayIndex: todayIndex >= 0 && todayIndex < dayCount ? todayIndex : -1,
      selectedId: selectedTileId ?? undefined,
      rangeLabel: view === 'month' ? monthRangeLabel : dayRangeLabel,
      timed,
      allday,
      month,
      view,
      onViewChange: setView,
      onPrev: () => step(-1),
      onNext: () => step(1),
      onToday: goToday,
      // In vista mese il campo mostra il primo del mese, non il primo giorno
      // della griglia: quella comincia col lunedì precedente, che spesso è del
      // mese prima e leggerebbe una data che non è quella che stai guardando.
      anchorDate: isoDay(view === 'month' ? monthInfo.first : gridStart),
      onGoToDate: goToDate,
      onEventClick: (id) => selectTile(id),
      onEventContextMenu: openEventMenu,
      onEventReschedule: handleEventReschedule,
      onScheduleTile: handleScheduleTile,
      onEventToAllDay: handleEventToAllDay,
      onEventToTimed: handleEventToTimed,
      onScheduleAllDayTile: handleScheduleAllDayTile,
      onCreateAt: addArmed ? handleCreateAt : undefined,
      // Doppio click su slot vuoto → crea (solo quando +Tile non è armato, così
      // un doppio click in modalità armata non crea due tile).
      onDblCreateAt: addArmed ? undefined : handleCreateAt,
      onDblCreateAllDay: addArmed ? undefined : handleDblCreateAllDay,
    };
    // `typeTileIcons`: vedi la nota sulla sottoscrizione — non è letta qui, ma è
    // ciò che risveglia il memo quando cambia l'icona di un tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, gridStart, dayCount, view, setView, monthInfo, selectedTileId, selectTile, openEventMenu, handleEventReschedule, handleScheduleTile, handleEventToAllDay, handleEventToTimed, handleScheduleAllDayTile, addArmed, handleCreateAt, handleDblCreateAllDay, statusById, getIconForTile, typeTileIcons]);

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
      <ChronoView
        notes={notes}
        todos={todos}
        flows={flows}
        calendar={calendar}
        selectedId={selectedTileId ?? undefined}
        onCardClick={(id) => selectTile(id)}
        onCardContextMenu={openCardMenu}
        onMoveToColumn={handleMoveToColumn}
        onAddTile={handleAddTile}
        addArmed={addArmed}
        onCreateColumnTile={handleCreateColumnTile}
        doneHighlight={doneHl}
        onToggleDoneHighlight={toggleDoneHl}
      />
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
              top: Math.min(menu.y, (typeof window !== 'undefined' ? window.innerHeight : 9999) - 180),
              left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 196),
            }}
          >
            <button type="button" className="ob-ctx__item" onClick={handleCopy}>
              <Icon name="copy" size={14} /> Copia
            </button>
            <button type="button" className="ob-ctx__item" onClick={handlePaste} disabled={!clipboardId}>
              <Icon name="paste" size={14} /> Incolla
            </button>
            <div className="ob-ctx__sep" />
            <button type="button" className="ob-ctx__item ob-ctx__item--danger" onClick={handleDelete}>
              <Icon name="trash" size={14} /> Elimina
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
