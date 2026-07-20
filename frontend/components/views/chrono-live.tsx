'use client';

/**
 * Gimmick · Obsidian — Chrono view collegata ai dati reali (Fase 5).
 *
 * Collega la `ChronoView`:
 *   - colonne NOTES/TODO ← `tilesApi.list` splittato per action_type
 *     ('none' → Notes, 'anytime' → Todo)
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
  type ChronoColorMode,
  type ChronoCalView,
} from '@/components/views/chrono';
import { Icon } from '@/components/shell';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { invalidateTileCaches } from '@/lib/tile-cache';
import { useTagTypes } from '@/store/tag-types-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import { useTileClipboardStore } from '@/store/tile-clipboard-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import type { Tile } from '@/types';

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

function toColTile(t: Tile): ColTile {
  const isTodo = t.action_type === 'anytime';
  const sp = t.sparks?.[0];
  const checklist = (t.subtasks ?? []).map((s) => s.is_done);
  return {
    id: t.id,
    title: deriveTitle(t),
    actionLabel: isTodo ? 'To do' : 'Notes',
    actionColor: isTodo ? 'var(--ob-subtle)' : 'var(--ob-muted)',
    spark: sp ? SPARK_MAP[sp.type] : undefined,
    checklist: checklist.length ? checklist : undefined,
    createdAt: t.created_at,
  };
}

function mondayOf(offsetWeeks: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0 Sun … 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon + offsetWeeks * 7);
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
  useEffect(() => {
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
  const openFlow = useFlowOpenStore((s) => s.open);
  const tilesWithFlows = useTilesWithFlows();
  const [menu, setMenu] = useState<ChronoMenu | null>(null);
  // Modalità "posiziona tile": armata dal pulsante +Tile, attiva il click-to-create
  // sugli slot vuoti della griglia.
  const [addArmed, setAddArmed] = useState(false);

  // Colorazione dei tile: per Tag (colore del tag_type) o per Tipo (type-icon).
  // Persistita in localStorage; init 'tag' per evitare mismatch di idratazione.
  const [colorMode, setColorMode] = useState<ChronoColorMode>('tag');
  useEffect(() => {
    const s = typeof window !== 'undefined' ? window.localStorage.getItem('chrono-color-mode') : null;
    if (s === 'tag' || s === 'type') setColorMode(s);
  }, []);
  const selectColorMode = useCallback((m: ChronoColorMode) => {
    setColorMode(m);
    try { window.localStorage.setItem('chrono-color-mode', m); } catch { /* storage non disponibile */ }
  }, []);

  // Sorgenti colore (definite nei settings): colore del tag_type e del type-icon.
  const { getColor: getTagTypeColor } = useTagTypes();
  const { getIconForTile, loaded: typeIconsLoaded, fetchAll: fetchTypeIcons } = useTypeIcons();
  const typeTileIcons = useTypeIcons((s) => s.tileIcons); // riabbona il render agli assegnamenti
  useEffect(() => { if (!typeIconsLoaded) fetchTypeIcons(); }, [typeIconsLoaded, fetchTypeIcons]);

  /** Colore pieno (hex) del tile secondo la modalità corrente, o null se assente. */
  const colorOf = useCallback((t: Tile): string | undefined => {
    if (colorMode === 'type') {
      return getIconForTile(t.id)?.color ?? undefined;
    }
    const tag = t.tags?.find((tg) => !tg.is_root);
    return tag?.tag_type ? (getTagTypeColor(tag.tag_type) ?? undefined) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode, getTagTypeColor, getIconForTile, typeTileIcons]);

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
  const { data: allTilesData, isLoading } = useQuery({
    queryKey: ['tiles-calendar'],
    queryFn: async () => {
      const res = await tilesApi.list({ limit: 100 });
      if (!res.success) throw new Error('Errore caricamento tiles');
      return res;
    },
    staleTime: 60_000,
  });
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const events = useMemo<Tile[]>(() => eventsData?.data ?? [], [eventsData]);
  const allTiles = useMemo<Tile[]>(() => allTilesData?.data ?? [], [allTilesData]);

  const notes = useMemo(
    () => allTiles.filter((t) => t.action_type === 'none').map((t) => ({ ...toColTile(t), bg: colorOf(t) })),
    [allTiles, colorOf],
  );
  const todos = useMemo(
    () => allTiles.filter((t) => t.action_type === 'anytime').map((t) => ({ ...toColTile(t), bg: colorOf(t) })),
    [allTiles, colorOf],
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

  // Drop di un tile (dalla griglia o da un'altra colonna) su Notes/Todo:
  // imposta action_type e deschedula (azzera evento/orari).
  const handleMoveToColumn = useCallback((tileId: string, actionType: 'none' | 'anytime') => {
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
    toast.success(actionType === 'none' ? 'Spostato in Notes' : 'Spostato in Todo');
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

  const handleOpenFlow = useCallback(() => {
    if (!menu) return;
    const id = menu.tileId;
    setMenu(null);
    openFlow(id);
  }, [menu, openFlow]);

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

  // Doppio click su area vuota di Notes/Todo: crea la tile con l'action_type
  // della colonna ('none' = Notes, 'anytime' = Todo). Non schedula: resta in colonna.
  const handleCreateColumnTile = useCallback(async (actionType: 'none' | 'anytime') => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      if (!res.success || !res.data) { toast.error('Errore creazione tile'); return; }
      const newId = res.data.id;
      await tilesApi.update(newId, { action_type: actionType });
      const rootTag = (tagsData?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newId]);
      invalidateTileCaches(queryClient, ['tags']);
      selectTile(newId);
      toast.success(actionType === 'none' ? 'Nota creata' : 'Task creato');
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
        allday.push({
          day,
          title: t.title || 'Senza titolo',
          kind: t.action_type === 'deadline' ? 'deadline' : 'allday',
          id: t.id,
          color: colorOf(t),
        });
      } else {
        const s = frac(refIso);
        const e = t.end_at ? frac(t.end_at) : s + 1;
        timed.push({ day, s, e: e > s ? e : s + 1, title: t.title || 'Senza titolo', kind: 'timed', id: t.id, color: colorOf(t) });
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
            color: colorOf(t),
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
  }, [events, gridStart, dayCount, view, setView, monthInfo, selectedTileId, selectTile, openEventMenu, handleEventReschedule, handleScheduleTile, handleEventToAllDay, handleEventToTimed, handleScheduleAllDayTile, addArmed, handleCreateAt, handleDblCreateAllDay, colorOf]);

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
    <>
      <ChronoView
        notes={notes}
        todos={todos}
        calendar={calendar}
        selectedId={selectedTileId ?? undefined}
        onCardClick={(id) => selectTile(id)}
        onCardContextMenu={openCardMenu}
        onMoveToColumn={handleMoveToColumn}
        onAddTile={handleAddTile}
        addArmed={addArmed}
        onCreateColumnTile={handleCreateColumnTile}
        colorMode={colorMode}
        onSetColorMode={selectColorMode}
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
            {tilesWithFlows.has(menu.tileId) && (
              <button type="button" className="ob-ctx__item" onClick={handleOpenFlow}>
                <Icon name="flow" size={14} /> Apri flow
              </button>
            )}
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
