'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { IconLoader2, IconPlus, IconX, IconSparkles, IconTag, IconTrash, IconCalendar, IconChecklist, IconNote, IconChevronLeft, IconChevronRight, IconHourglass, IconCalendarEvent, IconClock } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tile, Tag, ApiResponse, PatternShape } from '@/types';
import { useTagTypes } from '@/store/tag-types-store';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { BAND_COLORS, isTileDimmed, isToday, isSunday, formatTime, generateWeekDays, groupByDay, formatWeekRange, deadlineSubtitle } from '@/lib/tile-helpers';
import { usePatterns } from '@/store/patterns-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useStatusIcons } from '@/store/status-icons-store';

const FALLBACK_COLOR = '#888780';
const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function StatusIconRender({ iconName, size = 18 }: { iconName: string; size?: number }) {
  const Comp = AllIcons[iconName];
  if (!Comp) return null;
  return <Comp size={size} className="text-zinc-300" />;
}

/** Convert ISO string to datetime-local input value (local time) */
function toLocalDatetimeValue(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface EventModalState {
  open: boolean;
  mode: 'create' | 'edit';
  tileId?: string;
  title: string;
  description: string;
  allDay: boolean;
  startAt: string;
  endAt: string;
  autoDetect: boolean;
  tagIds: string[];
  actionType: string;
}

const emptyModal: EventModalState = {
  open: false,
  mode: 'create',
  title: '',
  description: '',
  allDay: false,
  startAt: '',
  endAt: '',
  autoDetect: true,
  tagIds: [],
  actionType: 'event',
};

const ACTION_OPTIONS = [
  { value: 'none', label: 'Appunto' },
  { value: 'anytime', label: 'Da fare' },
  { value: 'deadline', label: 'Scadenza' },
  { value: 'event', label: 'Evento' },
] as const;


function InlinePattern({ shape, color }: { shape: PatternShape; color: string }) {
  const o = 0.7;
  switch (shape) {
    case 'solid': return null;
    case 'diagonal_ltr': return <><defs><pattern id="il-ltr" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(45)"><line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={o} /></pattern></defs><rect width={80} height={68} fill="url(#il-ltr)" /></>;
    case 'diagonal_rtl': return <><defs><pattern id="il-rtl" patternUnits="userSpaceOnUse" width={20} height={20} patternTransform="rotate(-45)"><line x1={0} y1={0} x2={0} y2={20} stroke={color} strokeWidth={10} strokeOpacity={o} /></pattern></defs><rect width={80} height={68} fill="url(#il-rtl)" /></>;
    case 'vertical': return <><defs><pattern id="il-vert" patternUnits="userSpaceOnUse" width={16} height={20}><line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={o} /></pattern></defs><rect width={80} height={68} fill="url(#il-vert)" /></>;
    case 'bubble': return <><circle cx={18} cy={14} r={8} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={58} cy={10} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o-0.1} /><circle cx={40} cy={30} r={11} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={62} cy={38} r={9} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={35} cy={56} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o-0.05} /></>;
    default: return null;
  }
}

const GUTTER_W = 42;
const SLOT_H = 40; // px per hour slot
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const { selectedTagIds } = useTagFilterStore();
  const getIconForTile = useStatusIcons((s) => s.getIconForTile);
  const { doneShape, getActionTypeShape, customPatterns } = usePatterns();

  const resolveShape = useCallback((tile: Tile): PatternShape => {
    if (tile.is_completed) return doneShape;
    if (tile.pattern_id) {
      const custom = customPatterns.find((p) => p.id === tile.pattern_id);
      if (custom) return custom.shape as PatternShape;
    }
    return getActionTypeShape(tile.action_type || 'none');
  }, [doneShape, customPatterns, getActionTypeShape]);

  const getTagColor = (tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  };

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const days = useMemo(() => generateWeekDays(weekOffset), [weekOffset]);

  // Date range for fetching (covers visible week + buffer)
  const dateRange = useMemo(() => {
    const start = new Date(days[0]);
    start.setMonth(start.getMonth() - 2);
    const end = new Date(days[days.length - 1]);
    end.setMonth(end.getMonth() + 2);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [days]);

  // Filters
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiFilterIds, setAiFilterIds] = useState<Set<string> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Modal
  const [modal, setModal] = useState<EventModalState>(emptyModal);

  // Sidebar
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Schedule from existing tile
  const [showTilePicker, setShowTilePicker] = useState(false);

  // Fetch events
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['calendar-events', dateRange.start, dateRange.end, selectedTagId],
    queryFn: () => calendarApi.events(dateRange.start, dateRange.end, selectedTagId || undefined),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch tags for filter
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  // Fetch unscheduled tiles for picker
  const { data: tilesData } = useQuery({
    queryKey: ['tiles-unscheduled'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    enabled: showTilePicker,
  });

  const events = eventsData?.data || [];
  const tags = (tagsData as ApiResponse<Tag[]>)?.data || [];
  const unscheduledTiles = (tilesData?.data || []).filter((t: Tile) => !t.is_event);

  // Tiles for left panels
  const { data: allTilesData } = useQuery({
    queryKey: ['tiles-calendar'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
  const allTiles = allTilesData?.data || [];

  const { todos, notes } = useMemo(() => {
    const todos: Tile[] = [];
    const notes: Tile[] = [];
    allTiles.forEach((t) => {
      if (t.action_type === 'anytime') todos.push(t);
      else if (t.action_type === 'none') notes.push(t);
    });
    return { todos, notes };
  }, [allTiles]);

  const activeTodos = todos.filter((t) => !t.is_completed).length;

  const getTagInfo = (tile: Tile): { icon: string; name: string } => {
    const tag = tile.tags?.[0];
    if (!tag) return { icon: '', name: '' };
    const tagType = tag.tag_type || '';
    return { icon: tagType ? getTypeEmoji(tagType) : '', name: tag.name };
  };

  // Reschedule mutation (drag-and-drop)
  const rescheduleMutation = useMutation({
    mutationFn: (params: { id: string; start_at: string; end_at?: string }) =>
      calendarApi.reschedule(params.id, params.start_at, params.end_at),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });

  // Create event mutation (creates tile + schedules atomically)
  const createEventMutation = useMutation({
    mutationFn: (params: {
      title?: string;
      description?: string;
      start_at?: string;
      end_at?: string;
    }) => calendarApi.createEvent(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setModal(emptyModal);
    },
  });

  // Schedule existing tile mutation
  const scheduleMutation = useMutation({
    mutationFn: (params: {
      tile_id: string;
      start_at?: string;
      end_at?: string;
      title?: string;
      description?: string;
      auto_detect?: boolean;
    }) => calendarApi.schedule(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['tiles-unscheduled'] });
      setModal(emptyModal);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (params: { id: string; updates: { title?: string; description?: string; start_at?: string; end_at?: string; action_type?: string; all_day?: boolean } }) =>
      calendarApi.updateEvent(params.id, params.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      setModal(emptyModal);
    },
  });

  // Unschedule mutation
  const unscheduleMutation = useMutation({
    mutationFn: (id: string) => calendarApi.unschedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['tiles-unscheduled'] });
      setModal(emptyModal);
    },
  });

  // Categorize calendar events into lanes
  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (aiFilterIds) {
      filtered = events.filter((e: Tile) => aiFilterIds.has(e.id));
    }
    return filtered;
  }, [events, aiFilterIds]);

  const { calDeadlines, calAllDay, calTimed } = useMemo(() => {
    const calDeadlines: Tile[] = [];
    const calAllDay: Tile[] = [];
    const calTimed: Tile[] = [];
    filteredEvents.forEach((t) => {
      if (t.action_type === 'deadline') calDeadlines.push(t);
      else if (t.all_day) calAllDay.push(t);
      else calTimed.push(t);
    });
    return { calDeadlines, calAllDay, calTimed };
  }, [filteredEvents]);

  const groupedDeadlines = useMemo(() => groupByDay(calDeadlines, 'end_at'), [calDeadlines]);
  const groupedAllDay = useMemo(() => groupByDay(calAllDay, 'start_at'), [calAllDay]);
  // Group timed events by day for absolute positioning
  const timedByDay = useMemo(() => {
    const groups: Record<string, Tile[]> = {};
    calTimed.forEach((t) => {
      if (!t.start_at) return;
      const d = new Date(t.start_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [calTimed]);

  // Handle click on a calendar tile (open edit modal + sidebar)
  const handleCalTileClick = useCallback((tile: Tile) => {
    setSelectedTileId(tile.id);
    if (!sidebarOpen) setSidebarOpen(true);
  }, [sidebarOpen]);

  function renderCalTile(tile: Tile, subtitle?: string) {
    const color = getTagColor(tile);
    const info = getTagInfo(tile);
    const shape = resolveShape(tile);
    const statusIcon = getIconForTile(tile.id);
    const isHighlight = tile.action_type === 'deadline' && tile.end_at ? isToday(tile.end_at) : false;
    return (
      <div
        key={tile.id}
        className={cn(
          'rounded-sm overflow-hidden cursor-pointer hover:brightness-110 transition-all border',
          selectedTileId === tile.id && 'ring-2 ring-blue-500',
          isTileDimmed(tile, selectedTagIds) && 'opacity-20 saturate-0',
          tile.is_completed && 'opacity-50',
        )}
        style={{
          backgroundColor: 'rgba(24, 24, 27, 0.5)',
          borderColor: isHighlight ? '#E24B4A' : `${color}60`,
          minWidth: 56,
          minHeight: 40,
        }}
        onClick={() => handleCalTileClick(tile)}
      >
        <div className="flex relative" style={{ minHeight: 'inherit' }}>
          <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
          <div className="px-1.5 py-1 min-w-0 flex-1">
            {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
            <span className={cn('text-[9px] text-zinc-400 font-semibold block truncate', tile.is_completed && 'line-through')}>{tile.title || 'Senza titolo'}</span>
            {subtitle && <span className="text-[7px] text-zinc-500 block truncate">{subtitle}</span>}
          </div>
          {statusIcon && (
            <div className="shrink-0 flex items-center justify-center pr-1">
              <StatusIconRender iconName={statusIcon.icon} />
            </div>
          )}
          {shape !== 'solid' && (
            <div className="absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
                <InlinePattern shape={shape} color={color} />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sync tags for a tile: add missing, remove extra
  const syncTags = useCallback(async (tileId: string, tagIds: string[]) => {
    if (tagIds.length === 0) return;
    // Add each selected tag to the tile
    for (const tagId of tagIds) {
      try {
        await tagsApi.tagTiles(tagId, [tileId]);
      } catch {
        // ignore duplicates
      }
    }
  }, []);

  // Handle create/edit submit
  const handleSubmit = useCallback(async () => {
    if (modal.mode === 'create') {
      if (modal.tileId) {
        // Schedule existing tile
        scheduleMutation.mutate({
          tile_id: modal.tileId,
          start_at: modal.startAt || undefined,
          end_at: modal.endAt || undefined,
          title: modal.title || undefined,
          description: modal.description || undefined,
          auto_detect: modal.autoDetect,
        });
        // Sync tags for existing tile
        if (modal.tagIds.length > 0) {
          await syncTags(modal.tileId, modal.tagIds);
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        }
      } else {
        // Create new tile + schedule atomically (every event IS a tile)
        createEventMutation.mutate({
          title: modal.title || undefined,
          description: modal.description || undefined,
          start_at: modal.startAt || undefined,
          end_at: modal.endAt || undefined,
        }, {
          onSuccess: async (result: ApiResponse<Tile>) => {
            if (result?.data?.id && modal.tagIds.length > 0) {
              await syncTags(result.data.id, modal.tagIds);
              queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
              queryClient.invalidateQueries({ queryKey: ['tags'] });
            }
          },
        });
      }
    } else if (modal.mode === 'edit' && modal.tileId) {
      // Get current tags from the event
      const currentEvent = events.find((e: Tile) => e.id === modal.tileId);
      const currentTagIds = (currentEvent?.tags || []).map((t) => t.id);
      const toAdd = modal.tagIds.filter((id: string) => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter((id: string) => !modal.tagIds.includes(id));

      // Remove tags
      for (const tagId of toRemove) {
        try { await tagsApi.untagTile(tagId, modal.tileId); } catch { /* ignore */ }
      }
      // Add tags
      if (toAdd.length > 0) {
        await syncTags(modal.tileId, toAdd);
      }

      const startAt = modal.allDay && modal.startAt
        ? new Date(new Date(modal.startAt).setHours(0, 0, 0, 0)).toISOString()
        : modal.startAt;
      const endAt = modal.allDay && modal.startAt
        ? new Date(new Date(modal.startAt).setHours(23, 59, 59, 0)).toISOString()
        : modal.endAt;

      updateMutation.mutate({
        id: modal.tileId,
        updates: {
          title: modal.title,
          description: modal.description,
          start_at: startAt,
          end_at: endAt,
          action_type: modal.actionType,
          all_day: modal.allDay,
        },
      });
    }
  }, [modal, scheduleMutation, createEventMutation, updateMutation, syncTags, events, queryClient]);

  // AI filter
  const handleAiFilter = useCallback(async () => {
    if (!aiQuery.trim()) {
      setAiFilterIds(null);
      setAiFilterActive(false);
      return;
    }
    setAiLoading(true);
    try {
      const result = await calendarApi.aiFilter(aiQuery, dateRange.start, dateRange.end);
      if (result.success && result.data) {
        setAiFilterIds(new Set((result.data as Tile[]).map((t) => t.id)));
        setAiFilterActive(true);
      }
    } finally {
      setAiLoading(false);
    }
  }, [aiQuery, dateRange]);

  const clearAiFilter = useCallback(() => {
    setAiQuery('');
    setAiFilterIds(null);
    setAiFilterActive(false);
  }, []);

  // Schedule existing tile
  const handleScheduleTile = useCallback((tile: Tile) => {
    setShowTilePicker(false);
    setModal({
      open: true,
      mode: 'create',
      tileId: tile.id,
      title: tile.title || '',
      description: tile.description || '',
      allDay: tile.all_day || false,
      startAt: '',
      endAt: '',
      autoDetect: true,
      tagIds: [],
      actionType: tile.action_type || 'event',
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Calendario" />

      <div className="flex flex-1 overflow-hidden">

        {/* 2 — COLONNA NOTES */}
        <div className="shrink-0 w-44 border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#64748B' }} />
            <IconNote className="h-3.5 w-3.5" style={{ color: '#64748B' }} />
            <span className="text-[10px] font-bold tracking-widest text-zinc-300">NOTES</span>
            <span className="text-[10px] text-zinc-500 ml-auto">{notes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {notes.map((t) => {
              const color = getTagColor(t);
              const info = getTagInfo(t);
              const shape = resolveShape(t);
              const si = getIconForTile(t.id);
              return (
                <div
                  key={t.id}
                  className={cn(
                    'rounded-sm overflow-hidden cursor-pointer hover:brightness-110 transition-all border',
                    selectedTileId === t.id && 'ring-2 ring-blue-500',
                    isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'
                  )}
                  style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 40 }}
                  onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                >
                  <div className="flex relative" style={{ minHeight: 'inherit' }}>
                    <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                    <div className="px-1.5 py-1 min-w-0 flex-1">
                      {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                      <span className="text-[9px] text-zinc-400 font-semibold block truncate">{t.title || 'Senza titolo'}</span>
                    </div>
                    {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                    {shape !== 'solid' && (
                      <div className="absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center">
                        <svg className="w-full h-full" viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
                          <InlinePattern shape={shape} color={color} />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {notes.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun appunto</span>}
          </div>
        </div>

        {/* 3 — COLONNA TODO */}
        <div className="shrink-0 w-44 border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: BAND_COLORS.todos }} />
            <IconChecklist className="h-3.5 w-3.5" style={{ color: BAND_COLORS.todos }} />
            <span className="text-[10px] font-bold tracking-widest text-zinc-300">TO DO</span>
            <span className="text-[10px] text-zinc-500 ml-auto">{activeTodos} attivi</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {todos.sort((a, b) => {
              if (a.is_completed && !b.is_completed) return 1;
              if (!a.is_completed && b.is_completed) return -1;
              return (a.sort_order ?? 0) - (b.sort_order ?? 0);
            }).map((t) => {
              const color = getTagColor(t);
              const info = getTagInfo(t);
              const shape = resolveShape(t);
              const si = getIconForTile(t.id);
              return (
                <div
                  key={t.id}
                  className={cn(
                    'rounded-sm overflow-hidden cursor-pointer hover:brightness-110 transition-all border',
                    selectedTileId === t.id && 'ring-2 ring-blue-500',
                    isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0',
                    t.is_completed && 'opacity-50',
                  )}
                  style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 40 }}
                  onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                >
                  <div className="flex relative" style={{ minHeight: 'inherit' }}>
                    <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                    <div className="px-1.5 py-1 min-w-0 flex-1">
                      {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                      <span className={cn('text-[9px] text-zinc-400 font-semibold block truncate', t.is_completed && 'line-through')}>{t.title || 'Senza titolo'}</span>
                    </div>
                    {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                    {shape !== 'solid' && (
                      <div className="absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center">
                        <svg className="w-full h-full" viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
                          <InlinePattern shape={shape} color={color} />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {todos.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun task</span>}
          </div>
        </div>

        {/* 4 — PANNELLO CALENDAR */}
        <div className="flex-1 flex flex-col overflow-hidden">

      {/* Toolbar — week nav + AI filter + buttons */}
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

        <div className="flex-1" />

        {/* AI filter */}
        <div className="relative">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiFilter()}
            placeholder="Filtra con AI..."
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 w-40 pr-8"
          />
          {aiFilterActive ? (
            <button onClick={clearAiFilter} className="absolute right-2 top-1/2 -translate-y-1/2">
              <IconX className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          ) : (
            <button onClick={handleAiFilter} className="absolute right-2 top-1/2 -translate-y-1/2">
              {aiLoading ? (
                <IconLoader2 className="h-3.5 w-3.5 text-zinc-400 animate-spin" />
              ) : (
                <IconSparkles className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTilePicker(true)}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs"
        >
          <IconCalendar className="h-3.5 w-3.5 mr-1.5" />
          Pianifica
        </Button>
        <Button
          size="sm"
          onClick={() => setModal({
            ...emptyModal,
            open: true,
            mode: 'create',
            startAt: new Date().toISOString(),
            endAt: new Date(Date.now() + 3600000).toISOString(),
          })}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
        >
          <IconPlus className="h-3.5 w-3.5 mr-1.5" />
          Nuovo
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 className="h-8 w-8 text-zinc-400 animate-spin" />
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
                  <div key={day} className={cn('flex-1 text-center py-1 border-b border-r border-zinc-800', isToday(day) && 'bg-blue-500/10')}>
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

            {/* LANE DEADLINE */}
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
                  <div key={day} className={cn('flex-1 border-r border-zinc-800 p-1 flex flex-col gap-1', isToday(day) && 'bg-blue-500/5')} style={{ minHeight: 46 }}>
                    {tiles.map((t) => renderCalTile(t, deadlineSubtitle(t)))}
                  </div>
                );
              })}
            </div>

            {/* LANE ALL DAY */}
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
                  <div key={day} className={cn('flex-1 border-r border-zinc-800 p-1 flex flex-col gap-1', isToday(day) && 'bg-blue-500/5')} style={{ minHeight: 46 }}>
                    {tiles.map((t) => renderCalTile(t))}
                  </div>
                );
              })}
            </div>

            {/* LANE TIMED header */}
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-950/30 border-b border-zinc-800">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <IconClock size={12} className="text-blue-500/80" />
              <span className="text-[9px] font-bold tracking-widest text-blue-500/80">TIMED</span>
            </div>

            {/* LANE TIMED — continuous time grid */}
            <div className="flex">
              {/* Time gutter */}
              <div className="shrink-0" style={{ width: GUTTER_W }}>
                {HOURS.map((h) => (
                  <div key={h} className="border-r border-b border-zinc-800 bg-zinc-900/50 flex items-start justify-end pr-1" style={{ height: SLOT_H }}>
                    <span className="text-[8px] text-zinc-600 -translate-y-1.5">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>
              {/* Day columns with absolutely positioned events */}
              {days.map((day) => {
                const tiles = timedByDay[day] || [];
                return (
                  <div key={day} className={cn('flex-1 border-r border-zinc-800 relative', isToday(day) && 'bg-blue-500/5')}>
                    {/* Slot grid lines */}
                    {HOURS.map((h) => (
                      <div key={h} className="border-b border-zinc-800" style={{ height: SLOT_H }} />
                    ))}
                    {/* Events positioned absolutely */}
                    {tiles.map((t) => {
                      const start = new Date(t.start_at!);
                      const end = t.end_at ? new Date(t.end_at) : new Date(start.getTime() + 3600000);
                      const startMin = start.getHours() * 60 + start.getMinutes();
                      const endMin = end.getHours() * 60 + end.getMinutes();
                      const durationMin = Math.max(30, endMin - startMin);
                      const topPx = ((startMin - START_HOUR * 60) / 60) * SLOT_H;
                      const heightPx = (durationMin / 60) * SLOT_H;
                      const info = getTagInfo(t);
                      const color = getTagColor(t);
                      const shape = resolveShape(t);
                      const si = getIconForTile(t.id);
                      return (
                        <div
                          key={t.id}
                          className={cn(
                            'absolute left-0.5 right-0.5 rounded-sm overflow-hidden cursor-pointer hover:brightness-110 transition-all border',
                            selectedTileId === t.id && 'ring-2 ring-blue-500',
                            isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'
                          )}
                          style={{
                            top: topPx,
                            height: Math.max(40, heightPx),
                            backgroundColor: 'rgb(24, 24, 27)',
                            borderColor: `${color}60`,
                          }}
                          onClick={() => handleCalTileClick(t)}
                        >
                          <div className="flex h-full">
                            <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                            <div className="px-1 py-0.5 min-w-0 flex-1">
                              {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                              <span className="text-[9px] text-zinc-400 font-semibold block truncate">{t.title || 'Senza titolo'}</span>
                              <span className="text-[7px] text-zinc-500">{formatTime(t.start_at!)}{t.end_at ? ` - ${formatTime(t.end_at)}` : ''}</span>
                            </div>
                            {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                            {shape !== 'solid' && (
                              <div className="absolute top-0 bottom-0 right-0 w-8 flex items-center justify-center">
                                <svg className="w-full h-full" viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
                                  <InlinePattern shape={shape} color={color} />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Event modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModal(emptyModal)}>
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">
                {modal.mode === 'create' ? 'Nuovo Evento' : 'Modifica Evento'}
              </h2>
              <button onClick={() => setModal(emptyModal)} className="text-zinc-400 hover:text-white">
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Titolo</label>
                <input
                  type="text"
                  value={modal.title}
                  onChange={(e) => setModal({ ...modal, title: e.target.value })}
                  placeholder="Titolo evento"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Descrizione</label>
                <textarea
                  value={modal.description}
                  onChange={(e) => setModal({ ...modal, description: e.target.value })}
                  placeholder="Descrizione..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none"
                />
              </div>

              {/* Action type selector */}
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Tipo azione</label>
                <div className="flex gap-1.5">
                  {ACTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setModal({ ...modal, actionType: opt.value })}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        modal.actionType === opt.value
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* All day toggle */}
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={modal.allDay}
                  onChange={(e) => setModal({ ...modal, allDay: e.target.checked })}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-sm text-zinc-300">Tutto il giorno</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Inizio</label>
                  <input
                    type={modal.allDay ? 'date' : 'datetime-local'}
                    value={modal.allDay ? toLocalDatetimeValue(modal.startAt).slice(0, 10) : toLocalDatetimeValue(modal.startAt)}
                    onChange={(e) => {
                      if (modal.allDay) {
                        setModal({ ...modal, startAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : '' });
                      } else {
                        setModal({ ...modal, startAt: e.target.value ? new Date(e.target.value).toISOString() : '' });
                      }
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                {!modal.allDay && (
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Fine</label>
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeValue(modal.endAt)}
                      onChange={(e) => setModal({ ...modal, endAt: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                )}
              </div>

              {/* Tag picker */}
              {tags.length > 0 && (
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Tag</label>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag: Tag) => {
                      const selected = modal.tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setModal({
                              ...modal,
                              tagIds: selected
                                ? modal.tagIds.filter((id) => id !== tag.id)
                                : [...modal.tagIds, tag.id],
                            })
                          }
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                            selected
                              ? 'text-white'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                          )}
                          style={
                            selected
                              ? {
                                  backgroundColor: `${'#94A3B8'}25`,
                                  borderColor: `${'#94A3B8'}70`,
                                  color: '#94A3B8',
                                }
                              : undefined
                          }
                        >
                          <IconTag className="h-3 w-3" style={selected ? { color: '#94A3B8' } : undefined} />
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {modal.mode === 'create' && modal.tileId && (
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modal.autoDetect}
                    onChange={(e) => setModal({ ...modal, autoDetect: e.target.checked })}
                    className="rounded border-zinc-600"
                  />
                  <IconSparkles className="h-4 w-4 text-blue-400" />
                  Rileva data/ora dal contenuto con AI
                </label>
              )}

              <div className="flex items-center gap-2 pt-2">
                {modal.mode === 'edit' && modal.tileId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unscheduleMutation.mutate(modal.tileId!)}
                    className="text-red-400 border-red-900 hover:bg-red-950 text-xs"
                  >
                    <IconTrash className="h-3.5 w-3.5 mr-1" />
                    Rimuovi
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModal(emptyModal)}
                  className="text-zinc-400 border-zinc-700 text-xs"
                >
                  Annulla
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  {(scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending) && (
                    <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  )}
                  {modal.mode === 'create' ? 'Crea' : 'Salva'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tile picker modal */}
      {showTilePicker && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTilePicker(false)}>
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Schedula un Tile</h2>
              <button onClick={() => setShowTilePicker(false)} className="text-zinc-400 hover:text-white">
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-3">
              Seleziona un tile da aggiungere al calendario. L&apos;AI cerchera di rilevare data e ora dal contenuto.
            </p>

            <div className="flex-1 overflow-y-auto space-y-2">
              {unscheduledTiles.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-8">Nessun tile disponibile</p>
              ) : (
                unscheduledTiles.map((tile: Tile) => (
                  <button
                    key={tile.id}
                    onClick={() => handleScheduleTile(tile)}
                    className="w-full text-left bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-lg p-3 transition-colors"
                  >
                    <p className="text-sm text-white font-medium truncate">
                      {tile.title || 'Tile senza titolo'}
                    </p>
                    {tile.description && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{tile.description}</p>
                    )}
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {tile.spark_count || 0} spark &middot; {new Date(tile.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      </div>{/* end PANNELLO CALENDAR */}

      {/* 5 — SIDEBAR DESTRA */}
      <TileSidebar
        tileId={selectedTileId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        invalidateKeys={['calendar-events', 'tiles-calendar']}
      />
      </div>{/* end flex row */}
    </div>
  );
}
