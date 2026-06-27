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
 * GAP (vedi MIGRATION_PLAN.md): vista mese, drag-drop/reschedule, creazione
 * evento da slot e modale evento restano nella pagina arcade; la griglia
 * Obsidian mostra le ore 07–20 (eventi fuori range sono clampati). Editing nel
 * TileSidebar (Inspector).
 */
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChronoView,
  type ColTile,
  type ChronoCalendar,
  type ChronoTimed,
  type ChronoAllDay,
} from '@/components/views/chrono';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { useTileSelectionStore } from '@/store/tile-selection-store';
import type { Tile } from '@/types';

const SPARK_MAP: Record<string, 'voice' | 'text' | 'file' | 'photo'> = {
  audio_recording: 'voice',
  image: 'photo',
  photo: 'photo',
  video: 'photo',
  text: 'text',
  file: 'file',
};

function toColTile(t: Tile): ColTile {
  const isTodo = t.action_type === 'anytime';
  const sp = t.sparks?.[0];
  const checklist = (t.subtasks ?? []).map((s) => s.is_done);
  return {
    id: t.id,
    title: t.title || 'Senza titolo',
    actionLabel: isTodo ? 'To do' : 'Notes',
    actionColor: isTodo ? 'var(--ob-subtle)' : 'var(--ob-muted)',
    spark: sp ? SPARK_MAP[sp.type] : undefined,
    checklist: checklist.length ? checklist : undefined,
  };
}

function mondayOf(offsetWeeks: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0 Sun … 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon + offsetWeeks * 7);
}

function dayIndexFrom(iso: string, weekStart: Date): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function frac(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

export function ChronoLive() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const selectedTileId = useTileSelectionStore((s) => s.selectedTileId);
  const selectTile = useTileSelectionStore((s) => s.select);

  const weekStart = useMemo(() => mondayOf(weekOffset), [weekOffset]);
  const range = useMemo(() => {
    const start = new Date(weekStart);
    const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [weekStart]);

  const { data: eventsData } = useQuery({
    queryKey: ['calendar-events', range.start, range.end],
    queryFn: () => calendarApi.events(range.start, range.end),
    staleTime: 2 * 60 * 1000,
  });
  const { data: allTilesData, isLoading } = useQuery({
    queryKey: ['tiles-calendar'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
  const { data: tagsData } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const events = useMemo<Tile[]>(() => eventsData?.data ?? [], [eventsData]);
  const allTiles = useMemo<Tile[]>(() => allTilesData?.data ?? [], [allTilesData]);

  const notes = useMemo(
    () => allTiles.filter((t) => t.action_type === 'none').map(toColTile),
    [allTiles],
  );
  const todos = useMemo(
    () => allTiles.filter((t) => t.action_type === 'anytime').map(toColTile),
    [allTiles],
  );

  const calendar = useMemo<ChronoCalendar>(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      return { dow: d.toLocaleDateString('it-IT', { weekday: 'short' }), num: d.getDate() };
    });
    const todayIndex = dayIndexFrom(new Date().toISOString(), weekStart);
    const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const rangeLabel = `${weekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    const timed: ChronoTimed[] = [];
    const allday: ChronoAllDay[] = [];
    for (const t of events) {
      const isAllDay = !!t.all_day || t.action_type === 'deadline';
      const refIso = t.action_type === 'deadline' ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
      if (!refIso) continue;
      const day = dayIndexFrom(refIso, weekStart);
      if (day < 0 || day > 6) continue;
      if (isAllDay) {
        allday.push({
          day,
          title: t.title || 'Senza titolo',
          kind: t.action_type === 'deadline' ? 'deadline' : 'allday',
          id: t.id,
        });
      } else {
        const s = frac(refIso);
        const e = t.end_at ? frac(t.end_at) : s + 1;
        timed.push({ day, s, e: e > s ? e : s + 1, title: t.title || 'Senza titolo', kind: 'timed', id: t.id });
      }
    }

    return {
      days,
      todayIndex: todayIndex >= 0 && todayIndex <= 6 ? todayIndex : -1,
      rangeLabel,
      timed,
      allday,
      onPrev: () => setWeekOffset((w) => w - 1),
      onNext: () => setWeekOffset((w) => w + 1),
      onToday: () => setWeekOffset(0),
      onEventClick: (id) => selectTile(id),
    };
  }, [events, weekStart, selectTile]);

  const handleAddTile = useCallback(async () => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      const newTile = res?.data;
      if (!newTile) return;
      const rootTag = (tagsData?.data ?? []).find((t) => t.is_root);
      if (rootTag) await tagsApi.tagTiles(rootTag.id, [newTile.id]);
      await queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      selectTile(newTile.id);
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsData, selectTile]);

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
    <ChronoView
      notes={notes}
      todos={todos}
      calendar={calendar}
      selectedId={selectedTileId ?? undefined}
      onCardClick={(id) => selectTile(id)}
      onAddTile={handleAddTile}
      meta={`${calendar.allday.length + calendar.timed.length} eventi`}
    />
  );
}
