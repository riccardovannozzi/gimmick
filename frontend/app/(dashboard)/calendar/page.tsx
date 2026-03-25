'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import type { EventInput, EventDropArg, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Header } from '@/components/layout/header';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { IconLoader2, IconPlus, IconX, IconSparkles, IconTag, IconTrash, IconCalendar, IconChevronDown, IconFilter } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tile, Tag, ApiResponse } from '@/types';
import { useTagTypes } from '@/store/tag-types-store';

const FALLBACK_COLOR = '#888780';

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

function TagFilterDropdown({
  tags,
  selectedTagId,
  onSelect,
}: {
  tags: Tag[];
  selectedTagId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selectedTag = tags.find((t) => t.id === selectedTagId);

  // Close on outside click / scroll — only attach when open
  // Use useRef + useCallback to keep stable references
  const closeDropdown = useCallback(() => setOpen(false), []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    // Check bounding rect to include scrollbar area (not just DOM children)
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
    }
    if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
    closeDropdown();
  }, [closeDropdown]);

  const onScroll = useCallback((e: Event) => {
    // Ignore scroll events inside the dropdown itself
    if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) return;
    closeDropdown();
  }, [closeDropdown]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onMouseDown, onScroll]);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(!open);
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
          selectedTagId
            ? 'text-white'
            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-750'
        )}
        style={selectedTag ? {
          backgroundColor: `${'#94A3B8'}20`,
          borderColor: `${'#94A3B8'}60`,
        } : undefined}
      >
        <IconFilter className="h-3.5 w-3.5" />
        {selectedTag ? selectedTag.name : 'Filtra per tag'}
        <IconChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed w-48 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1"
          style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <button
            className={cn(
              'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 transition-colors',
              !selectedTagId && 'bg-zinc-800'
            )}
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            <span className="text-zinc-300">Tutti</span>
            {!selectedTagId && <span className="ml-auto text-blue-400 text-[10px]">&#10003;</span>}
          </button>
          {tags.map((tag) => {
            const isActive = selectedTagId === tag.id;
            return (
              <button
                key={tag.id}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 transition-colors',
                  isActive && 'bg-zinc-800'
                )}
                onClick={() => { onSelect(isActive ? null : tag.id); setOpen(false); }}
              >
                <IconTag className="h-3 w-3 flex-shrink-0" style={{ color: '#94A3B8' }} />
                <span className="text-zinc-300 truncate">{tag.name}</span>
                {isActive && <span className="ml-auto text-blue-400 text-[10px]">&#10003;</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const queryClient = useQueryClient();
  const { getColor: getTypeColor } = useTagTypes();

  const getTagColor = (tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  };

  // Current visible range
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
    return { start: start.toISOString(), end: end.toISOString() };
  });

  // Filters
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiFilterIds, setAiFilterIds] = useState<Set<string> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Modal
  const [modal, setModal] = useState<EventModalState>(emptyModal);

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

  // Convert tiles to FullCalendar events
  const calendarEvents: EventInput[] = useMemo(() => {
    let filtered = events;
    if (aiFilterIds) {
      filtered = events.filter((e: Tile) => aiFilterIds.has(e.id));
    }

    return filtered.map((tile: Tile) => {
      const isDeadline = tile.action_type === 'deadline' && !tile.is_event;
      const tagColor = getTagColor(tile);
      return {
        id: tile.id,
        title: isDeadline ? `\u23F0 ${tile.title || 'Scadenza'}` : (tile.title || 'Senza titolo'),
        start: tile.start_at!,
        end: isDeadline ? undefined : (tile.end_at || undefined),
        allDay: isDeadline || tile.all_day || false,
        backgroundColor: tagColor,
        borderColor: tagColor,
        extendedProps: {
          description: tile.description,
          spark_count: tile.spark_count || 0,
          tags: tile.tags || [],
          isDeadline,
        },
      };
    });
  }, [events, aiFilterIds]);

  // Handle date range changes — only refetch if navigating outside cached range
  const handleDatesSet = useCallback((arg: { start: Date; end: Date }) => {
    setDateRange((prev) => {
      const prevStart = new Date(prev.start);
      const prevEnd = new Date(prev.end);
      if (arg.start >= prevStart && arg.end <= prevEnd) return prev; // still within cached range
      // Expand range: 3 months before and after the visible range
      const newStart = new Date(arg.start);
      newStart.setMonth(newStart.getMonth() - 3);
      const newEnd = new Date(arg.end);
      newEnd.setMonth(newEnd.getMonth() + 3);
      return { start: newStart.toISOString(), end: newEnd.toISOString() };
    });
  }, []);

  // Handle drag-and-drop
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const { event } = info;
    rescheduleMutation.mutate({
      id: event.id,
      start_at: event.start!.toISOString(),
      end_at: event.end?.toISOString(),
    });
  }, [rescheduleMutation]);

  // Handle event resize
  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const { event } = info;
    rescheduleMutation.mutate({
      id: event.id,
      start_at: event.start!.toISOString(),
      end_at: event.end?.toISOString(),
    });
  }, [rescheduleMutation]);

  // Handle click on empty slot (create new event)
  const handleDateSelect = useCallback((info: DateSelectArg) => {
    // Use Date objects (not strings) to ensure proper ISO format in all views
    const start = info.start;
    const end = info.end;
    // If from dayGrid (all-day), default to 09:00-10:00
    if (info.allDay) {
      start.setHours(9, 0, 0, 0);
      end.setTime(start.getTime() + 3600000);
    }
    setModal({
      open: true,
      mode: 'create',
      title: '',
      description: '',
      allDay: info.allDay,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      autoDetect: false,
      tagIds: [],
      actionType: 'event',
    });
  }, []);

  // Handle click on existing event (edit)
  const handleEventClick = useCallback((info: EventClickArg) => {
    const tile = events.find((e: Tile) => e.id === info.event.id);
    if (!tile) return;
    setModal({
      open: true,
      mode: 'edit',
      tileId: tile.id,
      title: tile.title || '',
      description: tile.description || '',
      allDay: tile.all_day || false,
      startAt: tile.start_at || '',
      endAt: tile.end_at || '',
      autoDetect: false,
      tagIds: (tile.tags || []).map((t) => t.id),
      actionType: tile.action_type || 'event',
    });
  }, [events]);

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

      {/* Toolbar */}
      <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        {/* Tag filter dropdown */}
        <TagFilterDropdown
          tags={tags}
          selectedTagId={selectedTagId}
          onSelect={setSelectedTagId}
        />

        <div className="flex-1" />

        {/* AI filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiFilter()}
              placeholder="Filtra con AI..."
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 w-48 pr-8"
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
        </div>

        {/* Add event buttons */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTilePicker(true)}
          className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs"
        >
          <IconCalendar className="h-3.5 w-3.5 mr-1.5" />
          Pianifica Tile
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
          Nuovo Evento
        </Button>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 overflow-auto calendar-dark">
        <style jsx global>{`
          .calendar-dark .fc {
            --fc-border-color: #3E3E42;
            --fc-button-bg-color: #27272a;
            --fc-button-border-color: #3E3E42;
            --fc-button-hover-bg-color: #3f3f46;
            --fc-button-hover-border-color: #52525b;
            --fc-button-active-bg-color: #528BFF;
            --fc-button-active-border-color: #528BFF;
            --fc-button-text-color: #d4d4d8;
            --fc-today-bg-color: rgba(82, 139, 255, 0.08);
            --fc-neutral-bg-color: #18181b;
            --fc-page-bg-color: #09090b;
            --fc-event-bg-color: #528BFF;
            --fc-event-border-color: #528BFF;
            --fc-event-text-color: #fff;
            --fc-highlight-color: rgba(82, 139, 255, 0.15);
            --fc-now-indicator-color: #EF4444;
            color: #d4d4d8;
            font-size: 13px;
          }
          .calendar-dark .fc .fc-col-header-cell {
            background-color: #18181b;
            padding: 8px 0;
          }
          .calendar-dark .fc .fc-timegrid-slot {
            height: 40px;
          }
          .calendar-dark .fc .fc-daygrid-day-number,
          .calendar-dark .fc .fc-col-header-cell-cushion {
            color: #a1a1aa;
            text-decoration: none;
          }
          .calendar-dark .fc .fc-event {
            border-radius: 4px;
            padding: 2px 4px;
            cursor: pointer;
            font-size: 12px;
          }
          .calendar-dark .fc .fc-toolbar-title {
            color: #f4f4f5;
            font-size: 18px;
          }
          .calendar-dark .fc .fc-button {
            font-size: 12px;
            padding: 4px 12px;
            border-radius: 6px;
          }
          .calendar-dark .fc .fc-scrollgrid {
            border-radius: 8px;
            overflow: hidden;
          }
          .calendar-dark .fc .fc-daygrid-day.fc-day-today {
            background-color: rgba(82, 139, 255, 0.06);
          }
        `}</style>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, multiMonthPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridDay,timeGridWeek,dayGridMonth,multiMonthYear',
            }}
            buttonText={{
              today: 'Oggi',
              day: 'Giorno',
              week: 'Settimana',
              month: 'Mese',
              year: 'Anno',
            }}
            locale="it"
            firstDay={1}
            nowIndicator={true}
            editable={true}
            selectable={true}
            selectMirror={true}
            eventResizableFromStart={true}
            events={calendarEvents}
            datesSet={handleDatesSet}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="100%"
            allDaySlot={true}
            allDayText="Tutto il giorno"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="00:30:00"
            scrollTime="08:00:00"
            expandRows={true}
            stickyHeaderDates={true}
            dayMaxEventRows={4}
          />
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
    </div>
  );
}
