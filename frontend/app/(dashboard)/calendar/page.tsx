'use client';

import { useCallback, useMemo, useState, useRef, useEffect, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { IconLoader2, IconPlus, IconX, IconSparkles, IconTrash, IconChecklist, IconNote, IconChevronLeft, IconChevronRight, IconArrowsSort, IconFilter, IconLayoutList } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tile, Tag, ApiResponse, PatternShape } from '@/types';
import { useTagTypes } from '@/store/tag-types-store';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { isTileDimmed, isToday, generateWeekDays, groupByDay, formatWeekRange } from '@/lib/tile-helpers';
import { usePatterns } from '@/store/patterns-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useStatusIcons } from '@/store/status-icons-store';
import { useActionColors } from '@/store/action-colors-store';

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

// ─── Reusable dropdown for modal (mirrors sidebar pickers) ───
function ModalDropdown({ value, options, placeholder, onChange, renderOption, renderSelected }: {
  value: string | null;
  options: { id: string | null; label: string; icon?: string; shape?: string }[];
  placeholder: string;
  onChange: (id: string | null) => void;
  renderOption?: (opt: { id: string | null; label: string; icon?: string }) => React.ReactNode;
  renderSelected?: () => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.id === value && o.id !== null);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors text-left"
      >
        {selected && renderSelected ? renderSelected() : (
          selected ? <span className="truncate">{selected.label}</span> : <span className="text-[11px] text-zinc-500">{placeholder}</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id ?? `none-${idx}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                  isSelected && 'bg-zinc-700/30'
                )}
              >
                {renderOption ? renderOption(opt) : <span className={cn('truncate flex-1', isSelected ? 'text-zinc-200' : 'text-zinc-400')}>{opt.label}</span>}
                {isSelected && (
                  <svg className="w-3 h-3 text-blue-400 shrink-0 ml-auto" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
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
  statusIconId: string | null;
  patternId: string | null;
  isCompleted: boolean;
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
  actionType: 'none',
  statusIconId: null,
  patternId: null,
  isCompleted: false,
};

const ACTION_OPTIONS = [
  { value: 'none', label: 'NOTES' },
  { value: 'anytime', label: 'TO DO' },
  { value: 'deadline', label: 'DEADLINE' },
  { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
  { value: 'event', label: 'TIMED', extra: { all_day: false } },
] as const;


let _patId = 0;
function InlinePattern({ shape, color }: { shape: PatternShape; color: string }) {
  const o = 0.2;
  const id = useMemo(() => `il-${++_patId}`, []);
  switch (shape) {
    case 'solid': return null;
    case 'diagonal_ltr': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></>;
    case 'diagonal_rtl': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(-60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></>;
    case 'vertical': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={16} height={20}><line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></>;
    case 'bubble': return <><circle cx={18} cy={14} r={8} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={58} cy={10} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o-0.1} /><circle cx={40} cy={30} r={11} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={62} cy={38} r={9} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={35} cy={56} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o-0.05} /></>;
    default: return null;
  }
}

const START_HOUR = 6;
const END_HOUR = 22;

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const actionColors = useActionColors();
  const { selectedTagIds } = useTagFilterStore();
  const statusIcons = useStatusIcons((s) => s.icons);
  const statusTileIcons = useStatusIcons((s) => s.tileIcons);
  const getIconForTile = useCallback((tileId: string) => {
    const iconId = statusTileIcons[tileId];
    if (!iconId) return null;
    return statusIcons.find((i) => i.id === iconId) || null;
  }, [statusIcons, statusTileIcons]);
  const { doneShape, getActionTypeShape, customPatterns } = usePatterns();

  const resolveShape = useCallback((tile: Tile): PatternShape => {
    if (tile.pattern_id) {
      const custom = customPatterns.find((p) => p.id === tile.pattern_id);
      if (custom) return custom.shape as PatternShape;
    }
    if (tile.is_completed) return doneShape;
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

  // Notes column controls
  type NotesSort = 'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc';
  type NotesFilter = 'all' | 'status' | 'pattern';
  type NotesGroup = 'none' | 'date' | 'tag';
  const [notesSort, setNotesSort] = useState<NotesSort>('date_desc');
  const [notesFilter, setNotesFilter] = useState<NotesFilter>('all');
  const [notesGroup, setNotesGroup] = useState<NotesGroup>('none');
  const [notesMenuOpen, setNotesMenuOpen] = useState<'sort' | 'filter' | 'group' | null>(null);

  // Todo column controls
  type TodoSort = 'order' | 'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc';
  type TodoFilter = 'all' | 'active' | 'completed' | 'pattern';
  type TodoGroup = 'none' | 'date' | 'tag';
  const [todoSort, setTodoSort] = useState<TodoSort>('order');
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('all');
  const [todoGroup, setTodoGroup] = useState<TodoGroup>('none');
  const [todoMenuOpen, setTodoMenuOpen] = useState<'sort' | 'filter' | 'group' | null>(null);

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

  // Processed notes: tag filter, sort, filter
  const processedNotes = useMemo(() => {
    let list = [...notes];
    // Hide tiles excluded by sidebar tag filter
    if (selectedTagIds.size > 0) list = list.filter((t) => !isTileDimmed(t, selectedTagIds));
    // Filter
    if (notesFilter === 'status') list = list.filter((t) => t.is_completed);
    if (notesFilter === 'pattern') list = list.filter((t) => !!t.pattern_id);
    // Sort
    switch (notesSort) {
      case 'date_desc': list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'date_asc': list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'alpha_asc': list.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'alpha_desc': list.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
    }
    return list;
  }, [notes, notesSort, notesFilter, selectedTagIds]);

  // Processed todos: tag filter, sort, filter
  const processedTodos = useMemo(() => {
    let list = [...todos];
    // Hide tiles excluded by sidebar tag filter
    if (selectedTagIds.size > 0) list = list.filter((t) => !isTileDimmed(t, selectedTagIds));
    // Filter
    if (todoFilter === 'active') list = list.filter((t) => !t.is_completed);
    if (todoFilter === 'completed') list = list.filter((t) => t.is_completed);
    if (todoFilter === 'pattern') list = list.filter((t) => !!t.pattern_id);
    // Sort
    switch (todoSort) {
      case 'order':
        list.sort((a, b) => {
          if (a.is_completed && !b.is_completed) return 1;
          if (!a.is_completed && b.is_completed) return -1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });
        break;
      case 'date_desc': list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'date_asc': list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'alpha_asc': list.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'alpha_desc': list.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
    }
    return list;
  }, [todos, selectedTagIds, todoSort, todoFilter]);

  const groupedTodos = useMemo(() => {
    if (todoGroup === 'none') return null;
    const groups: Record<string, Tile[]> = {};
    processedTodos.forEach((t) => {
      let key: string;
      if (todoGroup === 'date') {
        key = new Date(t.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      } else {
        key = t.tags?.[0]?.name || 'Senza tag';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [processedTodos, todoGroup]);

  const groupedNotes = useMemo(() => {
    if (notesGroup === 'none') return null;
    const groups: Record<string, Tile[]> = {};
    processedNotes.forEach((t) => {
      let key: string;
      if (notesGroup === 'date') {
        key = new Date(t.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
      } else {
        key = t.tags?.[0]?.name || 'Senza tag';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [processedNotes, notesGroup]);

  const getTagInfo = (tile: Tile): { icon: string; name: string } => {
    const tag = tile.tags?.[0];
    if (!tag) return { icon: '', name: '' };
    const tagType = tag.tag_type || '';
    return { icon: tagType ? getTypeEmoji(tagType) : '', name: tag.name };
  };

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

  // ─── Drag-and-drop between sections ───
  type DropTarget = 'notes' | 'todo' | 'deadline' | 'allday' | 'timed';
  const dragTileRef = useRef<Tile | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null); // "section" or "section:day" or "timed:day:minutes"

  const onDragStart = useCallback((e: DragEvent, tile: Tile) => {
    dragTileRef.current = tile;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tile.id);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const onDragEnd = useCallback((e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '';
    }
    dragTileRef.current = null;
    setDragOver(null);
  }, []);

  const moveTileMutation = useMutation({
    mutationFn: (params: { id: string; updates: Record<string, unknown> }) =>
      tilesApi.update(params.id, params.updates as Parameters<typeof tilesApi.update>[1]),
    onMutate: ({ id, updates }) => {
      // Optimistic update across all caches
      const patch = (t: Tile) => (t.id === id ? { ...t, ...updates } : t);
      queryClient.setQueriesData({ queryKey: ['calendar-events'] }, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map(patch) };
      });
      queryClient.setQueriesData({ queryKey: ['tiles-calendar'] }, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map(patch) };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
    },
  });

  const handleDrop = useCallback((target: DropTarget, day?: string, minuteOffset?: number) => {
    const tile = dragTileRef.current;
    if (!tile) return;
    setDragOver(null);

    const updates: Record<string, unknown> = {};
    const dateStr = day || days[0]; // fallback to first visible day

    switch (target) {
      case 'notes':
        updates.action_type = 'none';
        updates.is_event = false;
        updates.all_day = false;
        updates.start_at = null;
        updates.end_at = null;
        break;
      case 'todo':
        updates.action_type = 'anytime';
        updates.is_event = false;
        updates.all_day = false;
        updates.start_at = null;
        updates.end_at = null;
        break;
      case 'deadline':
        updates.action_type = 'deadline';
        updates.is_event = false;
        updates.all_day = false;
        updates.end_at = new Date(`${dateStr}T23:59:59`).toISOString();
        if (!tile.start_at) updates.start_at = null;
        break;
      case 'allday':
        updates.action_type = 'event';
        updates.is_event = true;
        updates.all_day = true;
        updates.start_at = new Date(`${dateStr}T00:00:00`).toISOString();
        updates.end_at = new Date(`${dateStr}T23:59:59`).toISOString();
        break;
      case 'timed': {
        const mins = minuteOffset ?? (9 * 60); // default 09:00
        // Snap to 15-minute grid
        const snappedMins = Math.round(mins / 15) * 15;
        const clampedMins = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - 15, snappedMins));
        const h = Math.floor(clampedMins / 60);
        const m = clampedMins % 60;
        const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        // Always reset to 1 hour when dropping
        const durationMins = 60;
        const endMins = Math.min(clampedMins + durationMins, END_HOUR * 60);
        const endH = Math.floor(endMins / 60);
        const endM = endMins % 60;
        const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        updates.action_type = 'event';
        updates.is_event = true;
        updates.all_day = false;
        updates.start_at = new Date(`${dateStr}T${startTime}:00`).toISOString();
        updates.end_at = new Date(`${dateStr}T${endTime}:00`).toISOString();
        break;
      }
    }

    moveTileMutation.mutate({ id: tile.id, updates });
  }, [days, moveTileMutation, queryClient]);

  // ─── Context menu state ───
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tile: Tile } | null>(null);
  const [clipboardTile, setClipboardTile] = useState<Tile | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctxMenu]);

  const onTileContextMenu = useCallback((e: React.MouseEvent, tile: Tile) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, tile });
  }, []);

  const handleCopy = useCallback(() => {
    if (!ctxMenu) return;
    setClipboardTile(ctxMenu.tile);
    setCtxMenu(null);
  }, [ctxMenu]);

  // Categorize calendar events into lanes
  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (aiFilterIds) {
      filtered = events.filter((e: Tile) => aiFilterIds.has(e.id));
    }
    return filtered;
  }, [events, aiFilterIds]);

  // FullCalendar ref + events
  const fcRef = useRef<FullCalendar>(null);

  // Navigate FullCalendar when weekOffset changes
  useEffect(() => {
    const api = fcRef.current?.getApi();
    if (api && days[0]) {
      api.gotoDate(days[0]);
    }
  }, [days]);

  const fcEvents: EventInput[] = useMemo(() => {
    return filteredEvents.map((t) => {
      const color = getTagColor(t);
      const isAllDay = t.all_day || t.action_type === 'deadline';
      return {
        id: t.id,
        title: t.title || 'Senza titolo',
        start: t.action_type === 'deadline' ? (t.end_at || t.created_at) : (t.start_at || t.created_at),
        end: isAllDay ? undefined : (t.end_at || new Date(new Date(t.start_at || t.created_at).getTime() + 3600000).toISOString()),
        allDay: isAllDay,
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        borderColor: `${color}60`,
        textColor: '#A1A1AA',
        classNames: [
          t.is_completed ? 'fc-event-completed' : '',
          t.action_type === 'deadline' ? 'fc-event-deadline' : '',
        ].filter(Boolean),
      };
    });
  }, [filteredEvents, getTagColor]);

  // Handle click on a calendar tile (open edit modal + sidebar)
  const handleCalTileClick = useCallback((tile: Tile) => {
    setSelectedTileId(tile.id);
    if (!sidebarOpen) setSidebarOpen(true);
  }, [sidebarOpen]);

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

  // ─── Context menu actions (need syncTags) ───
  const handlePaste = useCallback(async () => {
    if (!clipboardTile) return;
    setCtxMenu(null);
    try {
      const res = await tilesApi.create({ title: clipboardTile.title, description: clipboardTile.description });
      const newId = res?.data?.id;
      if (newId) {
        await tilesApi.update(newId, {
          action_type: clipboardTile.action_type as any,
          is_event: clipboardTile.is_event,
          all_day: clipboardTile.all_day,
          start_at: clipboardTile.start_at,
          end_at: clipboardTile.end_at,
          is_completed: clipboardTile.is_completed,
          pattern_id: clipboardTile.pattern_id,
        });
        const tagId = clipboardTile.tags?.[0]?.id;
        if (tagId) await syncTags(newId, [tagId]);
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      }
    } catch { /* ignore */ }
  }, [clipboardTile, syncTags, queryClient]);

  const handleDeleteTile = useCallback(async () => {
    if (!ctxMenu) return;
    const id = ctxMenu.tile.id;
    setCtxMenu(null);
    try {
      await tilesApi.delete(id);
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      if (selectedTileId === id) setSelectedTileId(null);
    } catch { /* ignore */ }
  }, [ctxMenu, queryClient, selectedTileId]);

  // Handle create/edit submit
  const { assignIcon } = useStatusIcons();
  const handleSubmit = useCallback(async () => {
    const computeDates = () => {
      if (modal.allDay && modal.startAt) {
        return {
          start_at: new Date(new Date(modal.startAt).setHours(0, 0, 0, 0)).toISOString(),
          end_at: new Date(new Date(modal.startAt).setHours(23, 59, 59, 0)).toISOString(),
        };
      }
      if (modal.actionType === 'deadline') {
        return { start_at: undefined, end_at: modal.endAt || undefined };
      }
      return { start_at: modal.startAt || undefined, end_at: modal.endAt || undefined };
    };

    if (modal.mode === 'create') {
      if (modal.tileId) {
        scheduleMutation.mutate({
          tile_id: modal.tileId,
          ...computeDates(),
          title: modal.title || undefined,
          description: modal.description || undefined,
          auto_detect: modal.autoDetect,
        });
        if (modal.tagIds.length > 0) {
          await syncTags(modal.tileId, modal.tagIds);
        }
        if (modal.statusIconId) assignIcon(modal.tileId, modal.statusIconId);
      } else {
        // Create tile, then apply all settings
        const result = await new Promise<ApiResponse<Tile>>((resolve) => {
          createEventMutation.mutate({
            title: modal.title || undefined,
            description: modal.description || undefined,
            ...computeDates(),
          }, { onSuccess: resolve });
        });
        const newId = result?.data?.id;
        if (newId) {
          // Apply action_type, pattern, done
          await tilesApi.update(newId, {
            action_type: modal.actionType as any,
            all_day: modal.allDay,
            is_event: modal.actionType === 'event',
            is_completed: modal.isCompleted,
            pattern_id: modal.patternId,
          });
          if (modal.tagIds.length > 0) await syncTags(newId, modal.tagIds);
          if (modal.statusIconId) assignIcon(newId, modal.statusIconId);
          queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
          queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
          queryClient.invalidateQueries({ queryKey: ['tags'] });
        }
      }
    } else if (modal.mode === 'edit' && modal.tileId) {
      const currentEvent = events.find((e: Tile) => e.id === modal.tileId);
      const currentTagIds = (currentEvent?.tags || []).map((t) => t.id);
      const toAdd = modal.tagIds.filter((id: string) => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter((id: string) => !modal.tagIds.includes(id));
      for (const tagId of toRemove) {
        try { await tagsApi.untagTile(tagId, modal.tileId); } catch { /* ignore */ }
      }
      if (toAdd.length > 0) await syncTags(modal.tileId, toAdd);

      const dates = computeDates();
      updateMutation.mutate({
        id: modal.tileId,
        updates: {
          title: modal.title,
          description: modal.description,
          start_at: dates.start_at,
          end_at: dates.end_at,
          action_type: modal.actionType,
          all_day: modal.allDay,
        },
      });
      if (modal.statusIconId !== undefined) assignIcon(modal.tileId, modal.statusIconId);
    }
  }, [modal, scheduleMutation, createEventMutation, updateMutation, syncTags, events, queryClient, assignIcon]);

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

  return (
    <div className="flex flex-col h-full" onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
      <Header title="Chrono" />

      <div className="flex flex-1 overflow-hidden">

        {/* 2 — COLONNA NOTES */}
        <div
          className={cn('shrink-0 w-44 border-r border-zinc-800 flex flex-col', dragOver === 'notes' && 'ring-2 ring-inset ring-blue-500/50')}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver('notes'); }}
          onDragLeave={() => setDragOver((v) => v === 'notes' ? null : v)}
          onDrop={(e) => { e.preventDefault(); handleDrop('notes'); }}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800 relative z-20" style={{ backgroundColor: `${actionColors.none}15` }}>
            <IconNote className="h-3.5 w-3.5 shrink-0" style={{ color: actionColors.none }} />
            <span className="text-[10px] font-bold tracking-widest text-zinc-300">NOTES</span>
            <span className="text-[10px] text-zinc-500">{processedNotes.length}</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setNotesMenuOpen(notesMenuOpen === 'sort' ? null : 'sort')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', notesSort !== 'date_desc' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconArrowsSort className="h-3 w-3" />
                </button>
                {notesMenuOpen === 'sort' && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['date_desc', 'Data ↓ (recenti)'], ['date_asc', 'Data ↑ (vecchi)'], ['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesSort(val); setNotesMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', notesSort === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {notesSort === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filter */}
              <div className="relative">
                <button onClick={() => setNotesMenuOpen(notesMenuOpen === 'filter' ? null : 'filter')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', notesFilter !== 'all' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconFilter className="h-3 w-3" />
                </button>
                {notesMenuOpen === 'filter' && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['all', 'Tutti'], ['status', 'Completati'], ['pattern', 'Con pattern']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesFilter(val); setNotesMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', notesFilter === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {notesFilter === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group */}
              <div className="relative">
                <button onClick={() => setNotesMenuOpen(notesMenuOpen === 'group' ? null : 'group')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', notesGroup !== 'none' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconLayoutList className="h-3 w-3" />
                </button>
                {notesMenuOpen === 'group' && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['none', 'Nessuno'], ['date', 'Per data'], ['tag', 'Per tag']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesGroup(val); setNotesMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', notesGroup === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {notesGroup === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {groupedNotes ? (
              Object.entries(groupedNotes).map(([group, tiles]) => (
                <div key={group}>
                  <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold px-1 pt-1.5 pb-0.5">{group}</div>
                  {tiles.map((t) => {
                    const color = getTagColor(t);
                    const info = getTagInfo(t);
                    const shape = resolveShape(t);
                    const si = getIconForTile(t.id);
                    return (
                      <div
                        key={t.id}
                        draggable
                        data-tile-id={t.id}
                    onDragStart={(e) => onDragStart(e, t)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          'rounded-sm overflow-hidden cursor-grab hover:brightness-110 transition-all border mb-1',
                          selectedTileId === t.id && 'ring-2 ring-blue-500',
                          isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'
                        )}
                        style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 62 }}
                        onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                        onContextMenu={(e) => onTileContextMenu(e, t)}
                      >
                        <div className="flex relative" style={{ minHeight: 'inherit' }}>
                          <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                          <div className="px-1.5 py-1 min-w-0 flex-1">
                            {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                            <span className="text-[11px] text-zinc-400 font-semibold block truncate">{t.title || 'Senza titolo'}</span>
                          </div>
                          {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                          {shape !== 'solid' && (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                              <svg className="w-full h-full">
                                <InlinePattern shape={shape} color={color} />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              processedNotes.map((t) => {
                const color = getTagColor(t);
                const info = getTagInfo(t);
                const shape = resolveShape(t);
                const si = getIconForTile(t.id);
                return (
                  <div
                    key={t.id}
                    draggable
                    data-tile-id={t.id}
                    onDragStart={(e) => onDragStart(e, t)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      'rounded-sm overflow-hidden cursor-grab hover:brightness-110 transition-all border',
                      selectedTileId === t.id && 'ring-2 ring-blue-500',
                      isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'
                    )}
                    style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 62 }}
                    onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                    onContextMenu={(e) => onTileContextMenu(e, t)}
                  >
                    <div className="flex relative" style={{ minHeight: 'inherit' }}>
                      <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                      <div className="px-1.5 py-1 min-w-0 flex-1">
                        {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                        <span className="text-[11px] text-zinc-400 font-semibold block truncate">{t.title || 'Senza titolo'}</span>
                      </div>
                      {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                      {shape !== 'solid' && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          <svg className="w-full h-full">
                            <InlinePattern shape={shape} color={color} />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {processedNotes.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun appunto</span>}
          </div>
        </div>

        {/* 3 — COLONNA TODO */}
        <div
          className={cn('shrink-0 w-44 border-r border-zinc-800 flex flex-col', dragOver === 'todo' && 'ring-2 ring-inset ring-blue-500/50')}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver('todo'); }}
          onDragLeave={() => setDragOver((v) => v === 'todo' ? null : v)}
          onDrop={(e) => { e.preventDefault(); handleDrop('todo'); }}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-zinc-800 relative z-20" style={{ backgroundColor: `${actionColors.anytime}15` }}>
            <IconChecklist className="h-3.5 w-3.5 shrink-0" style={{ color: actionColors.anytime }} />
            <span className="text-[10px] font-bold tracking-widest text-zinc-300">TO DO</span>
            <span className="text-[10px] text-zinc-500">{processedTodos.filter((t) => !t.is_completed).length}</span>
            <div className="flex items-center gap-0.5 ml-auto">
              {/* Sort */}
              <div className="relative">
                <button onClick={() => setTodoMenuOpen(todoMenuOpen === 'sort' ? null : 'sort')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', todoSort !== 'order' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconArrowsSort className="h-3 w-3" />
                </button>
                {todoMenuOpen === 'sort' && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['order', 'Ordine'], ['date_desc', 'Data ↓ (recenti)'], ['date_asc', 'Data ↑ (vecchi)'], ['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoSort(val); setTodoMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', todoSort === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {todoSort === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filter */}
              <div className="relative">
                <button onClick={() => setTodoMenuOpen(todoMenuOpen === 'filter' ? null : 'filter')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', todoFilter !== 'all' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconFilter className="h-3 w-3" />
                </button>
                {todoMenuOpen === 'filter' && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['all', 'Tutti'], ['active', 'Attivi'], ['completed', 'Completati'], ['pattern', 'Con pattern']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoFilter(val); setTodoMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', todoFilter === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {todoFilter === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group */}
              <div className="relative">
                <button onClick={() => setTodoMenuOpen(todoMenuOpen === 'group' ? null : 'group')} className={cn('p-1 rounded hover:bg-zinc-800 transition-colors', todoGroup !== 'none' ? 'text-blue-400' : 'text-zinc-500')}>
                  <IconLayoutList className="h-3 w-3" />
                </button>
                {todoMenuOpen === 'group' && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-36">
                    {([['none', 'Nessuno'], ['date', 'Per data'], ['tag', 'Per tag']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoGroup(val); setTodoMenuOpen(null); }} className={cn('flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-zinc-700/50', todoGroup === val ? 'text-blue-400' : 'text-zinc-300')}>
                        {todoGroup === val && <span className="text-blue-400">•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {groupedTodos ? (
              Object.entries(groupedTodos).map(([group, tiles]) => (
                <div key={group}>
                  <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold px-1 pt-1.5 pb-0.5">{group}</div>
                  {tiles.map((t) => {
                    const color = getTagColor(t);
                    const info = getTagInfo(t);
                    const shape = resolveShape(t);
                    const si = getIconForTile(t.id);
                    return (
                      <div
                        key={t.id}
                        draggable
                        data-tile-id={t.id}
                    onDragStart={(e) => onDragStart(e, t)}
                        onDragEnd={onDragEnd}
                        className={cn(
                          'rounded-sm overflow-hidden cursor-grab hover:brightness-110 transition-all border mb-1',
                          selectedTileId === t.id && 'ring-2 ring-blue-500',
                          t.is_completed && 'opacity-50',
                        )}
                        style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 62 }}
                        onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                        onContextMenu={(e) => onTileContextMenu(e, t)}
                      >
                        <div className="flex relative" style={{ minHeight: 'inherit' }}>
                          <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                          <div className="px-1.5 py-1 min-w-0 flex-1">
                            {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                            <span className={cn('text-[11px] text-zinc-400 font-semibold block truncate', t.is_completed && 'line-through')}>{t.title || 'Senza titolo'}</span>
                          </div>
                          {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                          {shape !== 'solid' && (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                              <svg className="w-full h-full">
                                <InlinePattern shape={shape} color={color} />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              processedTodos.map((t) => {
                const color = getTagColor(t);
                const info = getTagInfo(t);
                const shape = resolveShape(t);
                const si = getIconForTile(t.id);
                return (
                  <div
                    key={t.id}
                    draggable
                    data-tile-id={t.id}
                    onDragStart={(e) => onDragStart(e, t)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      'rounded-sm overflow-hidden cursor-grab hover:brightness-110 transition-all border',
                      selectedTileId === t.id && 'ring-2 ring-blue-500',
                      t.is_completed && 'opacity-50',
                    )}
                    style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)', borderColor: `${color}60`, minHeight: 62 }}
                    onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
                    onContextMenu={(e) => onTileContextMenu(e, t)}
                  >
                    <div className="flex relative" style={{ minHeight: 'inherit' }}>
                      <div className="w-1 shrink-0 self-stretch rounded-l-sm" style={{ backgroundColor: color }} />
                      <div className="px-1.5 py-1 min-w-0 flex-1">
                        {info.name && <span className="text-[7px] font-semibold text-zinc-400 block truncate">{info.name}</span>}
                        <span className={cn('text-[11px] text-zinc-400 font-semibold block truncate', t.is_completed && 'line-through')}>{t.title || 'Senza titolo'}</span>
                      </div>
                      {si && <div className="shrink-0 flex items-center justify-center pr-1"><StatusIconRender iconName={si.icon} /></div>}
                      {shape !== 'solid' && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          <svg className="w-full h-full">
                            <InlinePattern shape={shape} color={color} />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {processedTodos.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun task</span>}
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

      {/* FullCalendar grid */}
      <div className="flex-1 overflow-hidden fc-dark">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <FullCalendar
            ref={fcRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale="it"
            firstDay={1}
            headerToolbar={false}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            height="100%"
            allDaySlot={true}
            allDayText=""
            nowIndicator={true}
            editable={true}
            droppable={true}
            eventDurationEditable={true}
            eventStartEditable={true}
            snapDuration="00:15:00"
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            initialDate={days[0]}
            events={fcEvents}
            eventClick={(info) => {
              const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
              if (tile) { setSelectedTileId(tile.id); if (!sidebarOpen) setSidebarOpen(true); }
            }}
            eventDrop={(info) => {
              const { id } = info.event;
              const start = info.event.start;
              const end = info.event.end;
              if (!start) return;
              const allDay = info.event.allDay;
              const updates: Record<string, unknown> = {
                start_at: start.toISOString(),
                end_at: end ? end.toISOString() : new Date(start.getTime() + 3600000).toISOString(),
                all_day: allDay,
                action_type: allDay ? 'event' : 'event',
                is_event: true,
              };
              moveTileMutation.mutate({ id, updates });
            }}
            eventResize={(info) => {
              const { id } = info.event;
              const end = info.event.end;
              if (!end) return;
              moveTileMutation.mutate({ id, updates: { end_at: end.toISOString() } });
            }}
            eventDidMount={(info) => {
              // Right-click context menu
              info.el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
                if (tile) setCtxMenu({ x: e.clientX, y: e.clientY, tile });
              });
              // Apply tag color to border
              const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
              if (tile) {
                const color = getTagColor(tile);
                info.el.style.borderLeft = `3px solid ${color}`;
                info.el.style.backgroundColor = 'rgba(24, 24, 27, 0.9)';
                info.el.style.borderColor = `${color}60`;
                info.el.style.borderLeftColor = color;
              }
            }}
            drop={(info) => {
              // External drop from NOTES/TODO
              const tileId = info.draggedEl.getAttribute('data-tile-id');
              if (!tileId) return;
              const start = info.date;
              const allDay = info.allDay;
              const updates: Record<string, unknown> = {
                action_type: 'event',
                is_event: true,
                all_day: allDay,
                start_at: start.toISOString(),
                end_at: allDay
                  ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59).toISOString()
                  : new Date(start.getTime() + 3600000).toISOString(),
              };
              moveTileMutation.mutate({ id: tileId, updates });
            }}
          />
        )}
      </div>

      {/* Event modal */}
      {/* Context menu */}
      {ctxMenu && createPortal(
        <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
        <div
          ref={ctxRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-40 z-[9999]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copia
          </button>
          <button
            onClick={clipboardTile ? handlePaste : undefined}
            disabled={!clipboardTile}
            className={cn(
              'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs transition-colors',
              clipboardTile ? 'text-zinc-300 hover:bg-zinc-700/50' : 'text-zinc-600 cursor-not-allowed'
            )}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Incolla
          </button>
          <div className="border-t border-zinc-700 my-1" />
          <button
            onClick={handleDeleteTile}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <IconTrash className="h-3.5 w-3.5" />
            Elimina
          </button>
        </div>
        </>,
        document.body
      )}

      {modal.open && (() => {
        const isDeadline = modal.actionType === 'deadline';
        const isEvent = modal.actionType === 'event';
        const isTimed = isEvent && !modal.allDay;
        const showDate = isDeadline || isEvent;
        const dateRef = isDeadline ? modal.endAt : modal.startAt;
        const dateVal = dateRef ? toLocalDatetimeValue(dateRef).slice(0, 10) : '';
        const startTime = modal.startAt ? toLocalDatetimeValue(modal.startAt).slice(11, 16) : '';
        const endTime = modal.endAt ? toLocalDatetimeValue(modal.endAt).slice(11, 16) : '';

        const setDate = (newDate: string) => {
          if (!newDate) return;
          if (isDeadline) {
            setModal({ ...modal, endAt: new Date(`${newDate}T23:59:59`).toISOString() });
          } else if (isTimed) {
            setModal({
              ...modal,
              startAt: new Date(`${newDate}T${startTime || '09:00'}`).toISOString(),
              endAt: endTime ? new Date(`${newDate}T${endTime}`).toISOString() : modal.endAt,
            });
          } else {
            setModal({
              ...modal,
              startAt: new Date(`${newDate}T00:00:00`).toISOString(),
              endAt: new Date(`${newDate}T23:59:59`).toISOString(),
            });
          }
        };

        // Status icons from store
        const allStatusIcons = statusIcons;
        const currentStatusIcon = modal.statusIconId ? allStatusIcons.find((i) => i.id === modal.statusIconId) : null;
        const CurrentStatusComp = currentStatusIcon?.icon ? AllIcons[currentStatusIcon.icon] : null;

        // Tag info for pattern color
        const selectedTag = tags.find((t: Tag) => modal.tagIds.includes(t.id));
        const tagColor = selectedTag ? (getTypeColor(selectedTag.tag_type || 'topic') || '#64748B') : '#64748B';

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setModal(emptyModal)}>
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-[340px] shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm text-white font-semibold">
                  {modal.mode === 'create' ? 'Nuovo Tile' : 'Modifica Tile'}
                </h2>
                <button onClick={() => setModal(emptyModal)} className="text-zinc-400 hover:text-white">
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {/* Titolo */}
                <div>
                  <label className="text-[11px] text-zinc-500">Titolo</label>
                  <input
                    value={modal.title}
                    onChange={(e) => setModal({ ...modal, title: e.target.value })}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 mt-0.5"
                    placeholder="Titolo..."
                    autoFocus
                  />
                </div>

                {/* Descrizione */}
                <div>
                  <label className="text-[11px] text-zinc-500">Descrizione</label>
                  <textarea
                    value={modal.description}
                    onChange={(e) => setModal({ ...modal, description: e.target.value })}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 mt-0.5 resize-none overflow-hidden"
                    placeholder="Descrizione..."
                    rows={2}
                  />
                </div>

                {/* Tipo — all 5 on one line */}
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Tipo</label>
                  <div className="flex gap-1">
                    {ACTION_OPTIONS.map((opt) => {
                      const isActive = opt.value === 'event'
                        ? modal.actionType === 'event' && ((opt as any).extra?.all_day ? modal.allDay : !modal.allDay)
                        : modal.actionType === opt.value;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => {
                            const updates: Partial<EventModalState> = { actionType: opt.value };
                            if (opt.value === 'event') {
                              updates.allDay = !!(opt as any).extra?.all_day;
                              if (!modal.startAt) {
                                updates.startAt = new Date().toISOString();
                                updates.endAt = new Date(Date.now() + 3600000).toISOString();
                              }
                            }
                            setModal({ ...modal, ...updates });
                          }}
                          className={cn(
                            'flex-1 px-1.5 py-1 rounded text-[10px] font-medium border transition-all text-center',
                            isActive
                              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date/time — conditional */}
                {showDate && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-zinc-500 mb-0.5 block">{isDeadline ? 'Scadenza' : 'Data'}</label>
                      <input type="date" value={dateVal} onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500" />
                    </div>
                    {isTimed && (() => {
                      const sH = startTime.slice(0, 2);
                      const sM = startTime.slice(3, 5);
                      const eH = endTime.slice(0, 2);
                      const eM = endTime.slice(3, 5);
                      const selCls = "bg-zinc-800/60 border border-zinc-700 rounded px-1 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500";
                      const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
                      const mins = ['00', '15', '30', '45'];
                      return (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Inizio</label>
                          <div className="flex gap-1 items-center">
                            <select value={sH} onChange={(e) => { if (dateVal) setModal({ ...modal, startAt: new Date(`${dateVal}T${e.target.value}:${sM}`).toISOString() }); }} className={selCls}>
                              {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-zinc-500 text-xs">:</span>
                            <select value={sM} onChange={(e) => { if (dateVal) setModal({ ...modal, startAt: new Date(`${dateVal}T${sH}:${e.target.value}`).toISOString() }); }} className={selCls}>
                              {mins.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Fine</label>
                          <div className="flex gap-1 items-center">
                            <select value={eH} onChange={(e) => { if (dateVal) setModal({ ...modal, endAt: new Date(`${dateVal}T${e.target.value}:${eM}`).toISOString() }); }} className={selCls}>
                              {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-zinc-500 text-xs">:</span>
                            <select value={eM} onChange={(e) => { if (dateVal) setModal({ ...modal, endAt: new Date(`${dateVal}T${eH}:${e.target.value}`).toISOString() }); }} className={selCls}>
                              {mins.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                )}

                {/* Tag — dropdown like sidebar */}
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Tag</label>
                  <ModalDropdown
                    value={modal.tagIds[0] || null}
                    options={tags.filter((t: Tag) => !t.is_root).map((t: Tag) => ({ id: t.id, label: t.name }))}
                    placeholder="Seleziona tag..."
                    onChange={(id) => setModal({ ...modal, tagIds: id ? [id] : [] })}
                  />
                </div>

                {/* Status — dropdown like sidebar */}
                <div>
                  <label className="text-[11px] text-zinc-500 mb-1 block">Status</label>
                  <ModalDropdown
                    value={modal.statusIconId}
                    options={[
                      { id: null as any, label: 'Nessuno' },
                      ...allStatusIcons.map((si) => ({ id: si.id, label: si.name, icon: si.icon })),
                    ]}
                    placeholder="Seleziona status..."
                    onChange={(id) => setModal({ ...modal, statusIconId: id })}
                    renderOption={(opt) => {
                      if (!opt.icon) return <span className="text-zinc-400">{opt.label}</span>;
                      const Comp = AllIcons[opt.icon];
                      return (
                        <span className="flex items-center gap-2">
                          {Comp && <Comp size={14} className="text-zinc-200" />}
                          <span>{opt.label}</span>
                        </span>
                      );
                    }}
                    renderSelected={() => {
                      if (!CurrentStatusComp) return null;
                      return (
                        <>
                          <CurrentStatusComp size={14} className="text-zinc-200 shrink-0" />
                          <span className="text-xs text-zinc-200 truncate">{currentStatusIcon!.name}</span>
                        </>
                      );
                    }}
                  />
                </div>

                {/* Pattern — dropdown like sidebar */}
                {customPatterns.length > 0 && (
                  <div>
                    <label className="text-[11px] text-zinc-500 mb-1 block">Pattern</label>
                    <ModalDropdown
                      value={modal.patternId}
                      options={[
                        { id: null as any, label: 'Nessuno' },
                        ...customPatterns.map((p) => ({ id: p.id, label: p.name, shape: p.shape })),
                      ]}
                      placeholder="Seleziona pattern..."
                      onChange={(id) => setModal({ ...modal, patternId: id })}
                    />
                  </div>
                )}

                {/* Done */}
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={modal.isCompleted}
                      onChange={(e) => setModal({ ...modal, isCompleted: e.target.checked })}
                      className="accent-green-500 w-3.5 h-3.5" />
                    <span className="text-[11px] text-zinc-400">Done</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  {modal.mode === 'edit' && modal.tileId && (
                    <Button variant="outline" size="sm"
                      onClick={() => unscheduleMutation.mutate(modal.tileId!)}
                      className="text-red-400 border-red-900 hover:bg-red-950 text-xs">
                      <IconTrash className="h-3.5 w-3.5 mr-1" /> Rimuovi
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" onClick={() => setModal(emptyModal)}
                    className="text-zinc-400 border-zinc-700 text-xs">Annulla</Button>
                  <Button size="sm" onClick={handleSubmit}
                    disabled={scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                    {(scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending) && (
                      <IconLoader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    )}
                    {modal.mode === 'create' ? 'Crea' : 'Salva'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
