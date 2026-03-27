'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconChevronLeft, IconChevronRight, IconChecklist, IconNote, IconHourglass, IconCalendarEvent, IconClock } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { tilesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { usePatterns } from '@/store/patterns-store';
import { cn } from '@/lib/utils';
import { TileSquare } from '@/components/tileview/TileSquare';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import {
  FALLBACK_COLOR,
  BAND_COLORS,
  formatTime,
  getDayKey,
  isToday,
  isSunday,
  generateWeekDays,
  groupByDay,
  getSparkCounts,
  isTileDimmed,
  deadlineSubtitle,
  groupByHourBand,
  formatWeekRange,
} from '@/lib/tile-helpers';
import type { Tile, PatternShape } from '@/types';

// ─── Constants ───
const TILE_SIZE = 64;
const GUTTER_W = 32;
const LEFT_PANEL_W = 220;
const DEFAULT_HOUR_BANDS = [8, 9, 11, 14, 17, 20];

// ─── BandHeader (compact version) ───
function BandHeader({ color, label, icon: Icon, badge }: { color: string; label: string; icon: typeof IconChecklist; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-[10px] font-bold tracking-widest text-zinc-300">{label}</span>
      {badge && <span className="text-[10px] text-zinc-500 ml-auto">{badge}</span>}
    </div>
  );
}

// ─── Main Page ───
export default function CommandCenterPage() {
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const { selectedTagIds } = useTagFilterStore();
  const { doneShape, ctaShape, getActionTypeShape, customPatterns } = usePatterns();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const splitDragging = useRef(false);
  const [leftSplit, setLeftSplit] = useState(50); // percent between todos and notes

  const days = useMemo(() => generateWeekDays(weekOffset), [weekOffset]);

  const getTagColor = useCallback((tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  }, [getTypeColor]);

  const getTagInfo = useCallback((tile: Tile): { icon: string; name: string } => {
    const tag = tile.tags?.[0];
    if (!tag) return { icon: '', name: '' };
    const tagType = tag.tag_type || '';
    return { icon: tagType ? getTypeEmoji(tagType) : '', name: tag.name };
  }, [getTypeEmoji]);

  const resolveShape = useCallback((tile: Tile): PatternShape => {
    if (tile.is_completed) return doneShape;
    if (tile.is_cta) return ctaShape;
    if (tile.pattern_id) {
      const custom = customPatterns.find((p) => p.id === tile.pattern_id);
      if (custom) return custom.shape as PatternShape;
    }
    return getActionTypeShape(tile.action_type || 'none');
  }, [doneShape, ctaShape, customPatterns, getActionTypeShape]);

  const handleTileClick = useCallback((id: string) => {
    setSelectedTileId(id);
    if (!sidebarOpen) setSidebarOpen(true);
  }, [sidebarOpen]);

  const { data, isLoading } = useQuery({
    queryKey: ['tiles-command-center'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  const allTiles = data?.data || [];

  const { timedEvents, allDayEvents, deadlines, todos, notes } = useMemo(() => {
    const timedEvents: Tile[] = [];
    const allDayEvents: Tile[] = [];
    const deadlines: Tile[] = [];
    const todos: Tile[] = [];
    const notes: Tile[] = [];
    allTiles.forEach((t) => {
      if (t.action_type === 'event') {
        if (t.all_day) allDayEvents.push(t);
        else timedEvents.push(t);
      } else if (t.action_type === 'deadline') deadlines.push(t);
      else if (t.action_type === 'anytime') todos.push(t);
      else notes.push(t);
    });
    return { timedEvents, allDayEvents, deadlines, todos, notes };
  }, [allTiles]);

  const activeTodos = todos.filter((t) => !t.is_completed).length;

  const groupedDeadlines = useMemo(() => groupByDay(deadlines, 'end_at'), [deadlines]);
  const groupedAllDay = useMemo(() => groupByDay(allDayEvents, 'start_at'), [allDayEvents]);
  const groupedTimed = useMemo(() => groupByHourBand(timedEvents, DEFAULT_HOUR_BANDS), [timedEvents]);

  // Determine which hour bands have tiles this week
  const activeBands = useMemo(() => {
    const weekDaySet = new Set(days);
    return DEFAULT_HOUR_BANDS.filter((band) => {
      const dayMap = groupedTimed[band] || {};
      return Object.keys(dayMap).some((d) => weekDaySet.has(d) && dayMap[d].length > 0);
    });
  }, [days, groupedTimed]);

  // Fallback: show at least some bands even if empty
  const visibleBands = activeBands.length > 0 ? activeBands : [9, 14, 17];

  function renderTile(tile: Tile, subtitle?: string) {
    const tileColor = getTagColor(tile);
    const info = getTagInfo(tile);
    const dimmed = isTileDimmed(tile, selectedTagIds);
    return (
      <TileSquare
        key={tile.id}
        title={tile.title || 'Senza titolo'}
        subtitle={subtitle}
        color={tileColor}
        completed={!!tile.is_completed}
        highlight={tile.action_type === 'deadline' && tile.end_at ? isToday(tile.end_at) : false}
        tagIcon={info.icon}
        tagName={info.name}
        selected={selectedTileId === tile.id}
        dimmed={dimmed}
        onClick={() => handleTileClick(tile.id)}
        sparkCounts={getSparkCounts(tile)}
        patternShape={resolveShape(tile)}
        size={TILE_SIZE}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Centro" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Todos + Notes */}
        <div className="shrink-0 flex flex-col border-r border-zinc-800 overflow-y-auto" style={{ width: LEFT_PANEL_W }}>
          {/* Todos */}
          <div style={{ height: `${leftSplit}%` }} className="overflow-y-auto border-b border-zinc-800">
            <BandHeader color={BAND_COLORS.todos} label="DA FARE" icon={IconChecklist} badge={`${activeTodos} attivi`} />
            <div className="flex flex-wrap gap-1 p-2">
              {todos.sort((a, b) => {
                if (a.is_completed && !b.is_completed) return 1;
                if (!a.is_completed && b.is_completed) return -1;
                return (a.sort_order ?? 0) - (b.sort_order ?? 0);
              }).map((t) => renderTile(t))}
              {todos.length === 0 && <span className="text-xs text-zinc-500 py-2">Nessun task</span>}
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="h-px cursor-row-resize group shrink-0 relative flex items-center justify-center bg-zinc-800 hover:bg-zinc-700"
            onMouseDown={(e) => {
              e.preventDefault();
              splitDragging.current = true;
              const container = (e.target as HTMLElement).closest('.flex.flex-col') as HTMLElement;
              if (!container) return;
              const startY = e.clientY;
              const startPct = leftSplit;
              const containerH = container.offsetHeight;
              const onMove = (ev: MouseEvent) => {
                if (!splitDragging.current) return;
                const diff = ev.clientY - startY;
                setLeftSplit(Math.max(20, Math.min(80, startPct + (diff / containerH) * 100)));
              };
              const onUp = () => {
                splitDragging.current = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
              };
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 h-3 w-6 rounded-full bg-zinc-700 group-hover:bg-zinc-500 z-10 flex items-center justify-center gap-0.5">
              <div className="w-0.5 h-0.5 rounded-full bg-zinc-400" />
              <div className="w-0.5 h-0.5 rounded-full bg-zinc-400" />
            </div>
          </div>

          {/* Notes */}
          <div className="flex-1 overflow-y-auto">
            <BandHeader color="#64748B" label="APPUNTI" icon={IconNote} badge={`${notes.length}`} />
            <div className="flex flex-wrap gap-1 p-2">
              {notes.map((t) => renderTile(t))}
              {notes.length === 0 && <span className="text-xs text-zinc-500 py-2">Nessun appunto</span>}
            </div>
          </div>
        </div>

        {/* Right panel — Weekly calendar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Week navigation */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800 bg-zinc-900 shrink-0">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
              <IconChevronLeft size={16} />
            </button>
            <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400">
              <IconChevronRight size={16} />
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-2 py-0.5 rounded text-xs text-zinc-400 hover:bg-zinc-800 border border-zinc-700">
              Oggi
            </button>
            <span className="text-sm text-zinc-300 font-medium capitalize">{formatWeekRange(days)}</span>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-zinc-400">Caricamento...</span>
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="flex sticky top-0 z-10 bg-zinc-900">
                  <div style={{ width: GUTTER_W }} className="border-b border-r border-zinc-800 shrink-0" />
                  {days.map((day) => {
                    const d = new Date(day);
                    const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
                    const dayNum = d.getDate();
                    return (
                      <div
                        key={day}
                        className={cn(
                          'flex-1 text-center py-1 border-b border-r border-zinc-800',
                          isToday(day) && 'bg-blue-500/10'
                        )}
                      >
                        <div className={cn('text-[9px] uppercase tracking-wider', isToday(day) ? 'text-blue-400' : isSunday(day) ? 'text-red-400' : 'text-zinc-500')}>
                          {weekday}
                        </div>
                        <div className={cn('text-sm font-medium', isToday(day) ? 'text-blue-400' : 'text-zinc-300')}>
                          {dayNum}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DEADLINE section */}
                <div className="flex items-center gap-2 px-2 py-1 bg-red-950/30 border-b border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <IconHourglass size={12} className="text-amber-600/80" />
                  <span className="text-[9px] font-bold tracking-widest text-amber-600/80">DEADLINE</span>
                </div>
                <div className="flex border-b border-zinc-800">
                  <div style={{ width: GUTTER_W }} className="border-r border-zinc-800 bg-zinc-900/50 shrink-0" />
                  {days.map((day) => {
                    const tiles = groupedDeadlines[day] || [];
                    return (
                      <div key={day} className={cn('flex-1 border-r border-zinc-800 p-1 flex flex-wrap gap-1', isToday(day) && 'bg-blue-500/5')} style={{ minHeight: TILE_SIZE + 8 }}>
                        {tiles.map((t) => renderTile(t, deadlineSubtitle(t)))}
                      </div>
                    );
                  })}
                </div>

                {/* ALL DAY section */}
                <div className="flex items-center gap-2 px-2 py-1 bg-amber-950/20 border-b border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                  <IconCalendarEvent size={12} className="text-green-600/80" />
                  <span className="text-[9px] font-bold tracking-widest text-green-600/80">ALL DAY</span>
                </div>
                <div className="flex border-b border-zinc-800">
                  <div style={{ width: GUTTER_W }} className="border-r border-zinc-800 bg-zinc-900/50 shrink-0" />
                  {days.map((day) => {
                    const tiles = groupedAllDay[day] || [];
                    return (
                      <div key={day} className={cn('flex-1 border-r border-zinc-800 p-1 flex flex-wrap gap-1', isToday(day) && 'bg-blue-500/5')} style={{ minHeight: TILE_SIZE + 8 }}>
                        {tiles.map((t) => renderTile(t))}
                      </div>
                    );
                  })}
                </div>

                {/* TIMED section header */}
                <div className="flex items-center gap-2 px-2 py-1 bg-blue-950/30 border-b border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <IconClock size={12} className="text-blue-500/80" />
                  <span className="text-[9px] font-bold tracking-widest text-blue-500/80">TIMED</span>
                </div>

                {/* TIMED sections */}
                {visibleBands.map((band) => (
                  <div key={band}>
                    <div className="flex">
                      <div style={{ width: GUTTER_W }} className="border-r border-b border-zinc-800 bg-zinc-900/50 flex items-start justify-end pr-1 pt-1 shrink-0">
                        <span className="text-[8px] text-zinc-600">{String(band).padStart(2, '0')}:00</span>
                      </div>
                      {days.map((day) => {
                        const tiles = groupedTimed[band]?.[day] || [];
                        return (
                          <div key={day} className={cn('flex-1 border-r border-b border-zinc-800 p-1 flex flex-wrap gap-1', isToday(day) && 'bg-blue-500/5')} style={{ minHeight: TILE_SIZE + 8 }}>
                            {tiles.map((t) => renderTile(t, formatTime(t.start_at!)))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <TileSidebar
          tileId={selectedTileId}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          invalidateKeys={['tiles-command-center']}
        />
      </div>
    </div>
  );
}
