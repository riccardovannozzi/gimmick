'use client';

import { useCallback, useMemo, useState, useRef, useEffect, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import type { EventInput } from '@fullcalendar/core';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { calendarApi, tilesApi, tagsApi } from '@/lib/api';
import { IconLoader2, IconPlus, IconX, IconTrash, IconChecklist, IconNote, IconChevronLeft, IconChevronRight, IconArrowsSort, IconFilter, IconLayoutList, IconArrowUp, IconBolt, IconClock, IconCalendar, IconLayoutGrid, IconRoute, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { usePixelTheme } from '@/components/pixel';
import { cn } from '@/lib/utils';
import type { Tile, Tag, ApiResponse, StatusShape } from '@/types';
import { useTagTypes } from '@/store/tag-types-store';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { isTileDimmed, isToday, generateWeekDays, groupByDay, formatWeekRange, formatMonthLabel } from '@/lib/tile-helpers';
import { useStatuses } from '@/store/statuses-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { TimePicker } from '@/components/ui/time-picker';
import { useActionColors } from '@/store/action-colors-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import { useFlowOpenRequest } from '@/lib/hooks/useFlowOpenRequest';
import { readableOn } from '@/lib/palette';
import { ChecklistBar } from '@/components/tileview/ChecklistBar';
import { StatusPattern } from '@/components/statuses/status-pattern';
import { ActionBadge } from '@/components/actions/action-badge';

const FALLBACK_COLOR = '#888780';
const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; color?: string }>>;

// Rounded-square badge with the type icon (bg = type color, white icon).
function TypeIconBadge({ iconName, color }: { iconName: string; color?: string }) {
  const Comp = AllIcons[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div style={{ width: 16, height: 16, background: bg, border: '2px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Comp size={10} color={readableOn(bg)} />
    </div>
  );
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
  const theme = usePixelTheme();
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
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: theme.surfaceVariant,
          border: `2px solid ${theme.border}`,
          padding: '6px 10px',
          color: theme.ink,
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 12,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {selected && renderSelected ? renderSelected() : (
          selected ? (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.label}</span>
          ) : (
            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>{placeholder}</span>
          )
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id ?? `none-${idx}`}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  textAlign: 'left',
                  background: isSelected ? theme.surfaceVariant : 'transparent',
                  border: `2px solid ${isSelected ? theme.border : 'transparent'}`,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 12,
                  color: theme.ink2,
                }}
              >
                {renderOption ? renderOption(opt) : (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: isSelected ? theme.ink : theme.ink2 }}>
                    {opt.label}
                  </span>
                )}
                {isSelected && (
                  <svg width={12} height={12} style={{ marginLeft: 'auto', color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  allDay: boolean;
  startAt: string;
  endAt: string;
  autoDetect: boolean;
  tagIds: string[];
  actionType: string;
  typeIconId: string | null;
  statusId: string | null;
}

const emptyModal: EventModalState = {
  open: false,
  mode: 'create',
  title: '',
  allDay: false,
  startAt: '',
  endAt: '',
  autoDetect: true,
  tagIds: [],
  actionType: 'none',
  typeIconId: null,
  statusId: null,
};

const ACTION_OPTIONS = [
  { value: 'none', label: 'NOTES' },
  { value: 'anytime', label: 'TO DO' },
  { value: 'deadline', label: 'DUE' },
  { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
  { value: 'event', label: 'TIMED', extra: { all_day: false } },
] as const;


const START_HOUR = 6;
const END_HOUR = 22;

export default function CalendarPage() {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const actionColors = useActionColors();
  const { selectedTagIds } = useTagFilterStore();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const getIconForTile = useCallback((tileId: string) => {
    const iconId = typeTileIcons[tileId];
    if (!iconId) return null;
    return typeIcons.find((i) => i.id === iconId) || null;
  }, [typeIcons, typeTileIcons]);
  const { doneShape, doneStatusId, getActionTypeShape, statuses: allStatuses } = useStatuses();
  const isDone = useCallback((tile: Tile) => !!doneStatusId && tile.status_id === doneStatusId, [doneStatusId]);
  const tilesWithFlows = useTilesWithFlows();
  const openFlow = useFlowOpenStore((s) => s.open);

  const resolveShape = useCallback((tile: Tile): StatusShape => {
    if (tile.status_id) {
      const st = allStatuses.find((s) => s.id === tile.status_id);
      if (st) return st.shape as StatusShape;
    }
    return getActionTypeShape(tile.action_type || 'none');
  }, [allStatuses, getActionTypeShape]);

  const getTagColor = (tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  };

  // View selector: WEEK (timeGridWeek with hourly slots) vs MONTH
  // (dayGridMonth). Persisted to localStorage so the page reopens on the
  // user's preferred view.
  type CalendarViewMode = 'week' | 'month';
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  useEffect(() => {
    try {
      const raw = localStorage.getItem('calendar_view_mode');
      if (raw === 'week' || raw === 'month') setViewMode(raw);
    } catch { /* */ }
  }, []);
  const changeViewMode = useCallback((mode: CalendarViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('calendar_view_mode', mode); } catch { /* */ }
  }, []);

  // Week + month navigation. The two offsets are independent so that
  // toggling views doesn't lose the user's place in the other one.
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const days = useMemo(() => generateWeekDays(weekOffset), [weekOffset]);

  // First day of the month currently visible in month view (relative to
  // today + monthOffset). Used for the header label, dateRange, and to drive
  // FullCalendar's gotoDate.
  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [monthOffset]);

  // Date range for fetching — covers the visible viewport (week or month)
  // plus a ±2-month buffer so adjacent overflow days in the month view and
  // off-screen scheduling pop in without an extra round trip.
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = new Date(days[0]);
      start.setMonth(start.getMonth() - 2);
      const end = new Date(days[days.length - 1]);
      end.setMonth(end.getMonth() + 2);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    const start = new Date(currentMonth);
    start.setMonth(start.getMonth() - 2);
    const end = new Date(currentMonth);
    end.setMonth(end.getMonth() + 3); // include next month + 2-month buffer
    return { start: start.toISOString(), end: end.toISOString() };
  }, [viewMode, days, currentMonth]);

  // Filters
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  // Modal
  const [modal, setModal] = useState<EventModalState>(emptyModal);

  // Sidebar
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  // Subscribes to the global FLOW-badge signal. The setter pair points at
  // the existing sidebar state; the returned counter is fed into TileSidebar
  // so its active tab switches to Flow on every badge click.
  const forceFlowTab = useFlowOpenRequest(setSelectedTileId, (open) => setSidebarOpen(open));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Reactively toggle the pixel selection ring on FullCalendar events when
  // selectedTileId changes. eventDidMount sets data-tile-id on each event el.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.fc-event[data-tile-id]').forEach((el) => {
      const isSelected = el.getAttribute('data-tile-id') === selectedTileId;
      el.style.boxShadow = isSelected ? `0 0 0 3px ${theme.accent}` : '';
    });
  }, [selectedTileId, theme.accent]);

  // Schedule from existing tile
  const [showTilePicker, setShowTilePicker] = useState(false);

  // Notes column controls
  type NotesSort = 'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc';
  type NotesFilter = 'all' | 'completion' | 'status';
  type NotesGroup = 'none' | 'date' | 'tag';
  const [notesSort, setNotesSort] = useState<NotesSort>('date_desc');
  const [notesFilter, setNotesFilter] = useState<NotesFilter>('all');
  const [notesGroup, setNotesGroup] = useState<NotesGroup>('none');
  const [notesMenuOpen, setNotesMenuOpen] = useState<'sort' | 'filter' | 'group' | null>(null);

  // Todo column controls
  type TodoSort = 'order' | 'date_desc' | 'date_asc' | 'alpha_asc' | 'alpha_desc';
  type TodoFilter = 'all' | 'active' | 'completed' | 'status';
  type TodoGroup = 'none' | 'date' | 'tag';
  const [todoSort, setTodoSort] = useState<TodoSort>('order');
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('all');
  const [todoGroup, setTodoGroup] = useState<TodoGroup>('none');
  const [todoMenuOpen, setTodoMenuOpen] = useState<'sort' | 'filter' | 'group' | null>(null);

  // Collapse/expand for NOTES and TODO columns — mirrors the Canvas
  // StagingPanel pattern: narrow w-8 strip when collapsed, full column when
  // expanded. Preferences persisted to localStorage.
  const [notesOpen, setNotesOpen] = useState(true);
  const [todoOpen, setTodoOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem('chrono_notes_open') === '0') setNotesOpen(false);
      if (localStorage.getItem('chrono_todo_open') === '0') setTodoOpen(false);
    } catch { /* */ }
  }, []);
  const toggleNotesOpen = useCallback(() => {
    setNotesOpen((v) => {
      const next = !v;
      try { localStorage.setItem('chrono_notes_open', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);
  const toggleTodoOpen = useCallback(() => {
    setTodoOpen((v) => {
      const next = !v;
      try { localStorage.setItem('chrono_todo_open', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  }, []);

  // Resizable widths for NOTES and TODO columns. Same bounds + defaults as
  // the Canvas StagingPanel (min 146, max 700, default 176), with persisted
  // localStorage. CALENDAR column has flex-1 so it absorbs the leftover.
  const COL_MIN_W = 146;
  const COL_MAX_W = 700;
  const [notesWidth, setNotesWidth] = useState<number>(176);
  const [todoWidth, setTodoWidth] = useState<number>(176);
  useEffect(() => {
    try {
      const n = localStorage.getItem('chrono_notes_width');
      if (n) {
        const v = parseInt(n, 10);
        if (Number.isFinite(v)) setNotesWidth(Math.min(COL_MAX_W, Math.max(COL_MIN_W, v)));
      }
      const t = localStorage.getItem('chrono_todo_width');
      if (t) {
        const v = parseInt(t, 10);
        if (Number.isFinite(v)) setTodoWidth(Math.min(COL_MAX_W, Math.max(COL_MIN_W, v)));
      }
    } catch { /* */ }
  }, []);
  const handleNotesResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = notesWidth;
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(COL_MAX_W, Math.max(COL_MIN_W, startW + (ev.clientX - startX)));
      lastW = w;
      setNotesWidth(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('chrono_notes_width', String(Math.round(lastW))); } catch { /* */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [notesWidth]);
  const handleTodoResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = todoWidth;
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(COL_MAX_W, Math.max(COL_MIN_W, startW + (ev.clientX - startX)));
      lastW = w;
      setTodoWidth(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('chrono_todo_width', String(Math.round(lastW))); } catch { /* */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [todoWidth]);

  // Fetch events
  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['calendar-events', dateRange.start, dateRange.end, selectedTagId],
    queryFn: () => calendarApi.events(dateRange.start, dateRange.end, selectedTagId || undefined),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch tags for filter — shared cache with the Canvas page; 5 min
  // staleTime so Chrono↔Canvas navigation skips the network round-trip.
  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch unscheduled tiles for picker
  const { data: tilesData } = useQuery({
    queryKey: ['tiles-unscheduled'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    enabled: showTilePicker,
    staleTime: 60 * 1000,
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
    if (notesFilter === 'completion') list = list.filter((t) => isDone(t));
    if (notesFilter === 'status') list = list.filter((t) => !!t.status_id);
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
    if (todoFilter === 'active') list = list.filter((t) => !isDone(t));
    if (todoFilter === 'completed') list = list.filter((t) => isDone(t));
    if (todoFilter === 'status') list = list.filter((t) => !!t.status_id);
    // Sort
    switch (todoSort) {
      case 'order':
        list.sort((a, b) => {
          const aDone = isDone(a);
          const bDone = isDone(b);
          if (aDone && !bDone) return 1;
          if (!aDone && bDone) return -1;
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

  // Register NOTES + TODO columns as FullCalendar external draggable containers,
  // so tiles can be dropped onto the calendar grid and trigger the FC `drop` handler.
  useEffect(() => {
    const selectors = ['[data-kanban-column="notes"]', '[data-kanban-column="todo"]'];
    const instances: Draggable[] = [];
    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      instances.push(new Draggable(el, {
        itemSelector: '[data-tile-id]',
        eventData: (eventEl) => ({
          title: eventEl.getAttribute('data-tile-id') || '',
        }),
      }));
    }
    return () => {
      instances.forEach((i) => i.destroy());
    };
    // Re-register when tiles list size changes so freshly rendered items are draggable
  }, [processedNotes.length, processedTodos.length]);

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
    mutationFn: (params: { id: string; updates: { title?: string; start_at?: string; end_at?: string; action_type?: string; all_day?: boolean } }) =>
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
        // Deadlines live in end_at only — clear start_at so stale times don't linger
        updates.action_type = 'deadline';
        updates.is_event = false;
        updates.all_day = false;
        updates.start_at = null;
        updates.end_at = new Date(`${dateStr}T23:59:59`).toISOString();
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
  const [slotCtxMenu, setSlotCtxMenu] = useState<{ x: number; y: number; date: Date; allDay: boolean } | null>(null);
  const [colCtxMenu, setColCtxMenu] = useState<{ x: number; y: number; type: 'notes' | 'todo' } | null>(null);
  const [clipboardTile, setClipboardTile] = useState<Tile | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);
  const slotCtxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu && !slotCtxMenu && !colCtxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setCtxMenu(null); setSlotCtxMenu(null); setColCtxMenu(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ctxMenu, slotCtxMenu]);

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
  const filteredEvents = useMemo(() => events, [events]);

  // FullCalendar ref + events
  const fcRef = useRef<FullCalendar>(null);
  const externalDropRef = useRef<string | null>(null);

  // Keep FullCalendar in sync with our view+offset state. Switching views
  // calls `changeView`; week/month nav calls `gotoDate` with the right
  // anchor (Mon for week, first-of-month for month).
  useEffect(() => {
    const api = fcRef.current?.getApi();
    if (!api) return;
    const targetView = viewMode === 'week' ? 'timeGridWeek' : 'dayGridMonth';
    if (api.view.type !== targetView) api.changeView(targetView);
    const anchor = viewMode === 'week' ? days[0] : currentMonth;
    if (anchor) api.gotoDate(anchor);
  }, [viewMode, days, currentMonth]);

  const fcEvents: EventInput[] = useMemo(() => {
    return filteredEvents.map((t) => {
      const isAllDay = t.all_day || t.action_type === 'deadline';
      return {
        id: t.id,
        title: t.title || 'Senza titolo',
        start: t.action_type === 'deadline' ? (t.end_at || t.created_at) : (t.start_at || t.created_at),
        end: t.end_at || (isAllDay ? undefined : new Date(new Date(t.start_at || t.created_at).getTime() + 3600000).toISOString()),
        allDay: isAllDay,
        classNames: [
          isDone(t) ? 'fc-event-completed' : '',
          t.action_type === 'deadline' ? 'fc-event-deadline' : '',
        ].filter(Boolean),
      };
    });
  }, [filteredEvents]);

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
      const res = await tilesApi.create({ title: clipboardTile.title });
      const newId = res?.data?.id;
      if (newId) {
        await tilesApi.update(newId, {
          action_type: clipboardTile.action_type as any,
          is_event: clipboardTile.is_event,
          all_day: clipboardTile.all_day,
          start_at: clipboardTile.start_at,
          end_at: clipboardTile.end_at,
          status_id: clipboardTile.status_id,
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

  const handleNewTileInColumn = useCallback(() => {
    if (!colCtxMenu) return;
    const actionType = colCtxMenu.type === 'notes' ? 'none' : 'anytime';
    setColCtxMenu(null);
    setModal({
      ...emptyModal,
      open: true,
      mode: 'create',
      actionType,
    });
  }, [colCtxMenu]);

  const handlePasteInColumn = useCallback(async () => {
    if (!clipboardTile || !colCtxMenu) return;
    const actionType = colCtxMenu.type === 'notes' ? 'none' : 'anytime';
    setColCtxMenu(null);
    try {
      const res = await tilesApi.create({ title: clipboardTile.title });
      const newId = res?.data?.id;
      if (newId) {
        await tilesApi.update(newId, {
          action_type: actionType as any,
          is_event: false,
          all_day: false,
          start_at: null,
          end_at: null,
          status_id: clipboardTile.status_id,
        });
        const tagId = clipboardTile.tags?.[0]?.id;
        if (tagId) await syncTags(newId, [tagId]);
        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
      }
    } catch { /* ignore */ }
  }, [clipboardTile, colCtxMenu, syncTags, queryClient]);

  const handleNewTileAtSlot = useCallback(() => {
    if (!slotCtxMenu) return;
    const { date, allDay } = slotCtxMenu;
    setSlotCtxMenu(null);
    setModal({
      ...emptyModal,
      open: true,
      mode: 'create',
      actionType: allDay ? 'event' : 'event',
      allDay,
      startAt: date.toISOString(),
      endAt: allDay
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
        : new Date(date.getTime() + 3600000).toISOString(),
    });
  }, [slotCtxMenu]);

  // Handle create/edit submit
  const { assignIcon } = useTypeIcons();
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
          auto_detect: modal.autoDetect,
        });
        if (modal.tagIds.length > 0) {
          await syncTags(modal.tileId, modal.tagIds);
        }
        if (modal.typeIconId) assignIcon(modal.tileId, modal.typeIconId);
      } else {
        // Create tile, then apply all settings
        const result = await new Promise<ApiResponse<Tile>>((resolve) => {
          createEventMutation.mutate({
            title: modal.title || undefined,
            ...computeDates(),
          }, { onSuccess: resolve });
        });
        const newId = result?.data?.id;
        if (newId) {
          // Apply action_type and status
          await tilesApi.update(newId, {
            action_type: modal.actionType as any,
            all_day: modal.allDay,
            is_event: modal.actionType === 'event',
            status_id: modal.statusId,
          });
          if (modal.tagIds.length > 0) await syncTags(newId, modal.tagIds);
          if (modal.typeIconId) assignIcon(newId, modal.typeIconId);
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
          start_at: dates.start_at,
          end_at: dates.end_at,
          action_type: modal.actionType,
          all_day: modal.allDay,
        },
      });
      if (modal.typeIconId !== undefined) assignIcon(modal.tileId, modal.typeIconId);
    }
  }, [modal, scheduleMutation, createEventMutation, updateMutation, syncTags, events, queryClient, assignIcon]);

  // Render a tile card for the NOTES / TO DO columns. Mirrors the Canvas
  // StagingPanel tile look (type-icon-tinted bg, 2-line clamp, FLOW badge
  // as an overlay outside the rounded body) so the two pages stay visually
  // in sync. `dimmedClass` is column-specific: NOTES dims tiles outside the
  // active tag filter, TODO dims completed ones — the caller computes it.
  const renderColumnTile = (t: Tile, dimmedClass?: string | false) => {
    const color = getTagColor(t);
    const shape = resolveShape(t);
    const si = getIconForTile(t.id);
    const tileBg = si?.color ? `${si.color}CC` : theme.surface;
    const hasFlow = tilesWithFlows.has(t.id);
    const actionKey = t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
    const actionColor = actionKey === 'none'
      ? theme.ink2
      : (actionColors[actionKey as keyof typeof actionColors] || theme.ink3);
    const isSelected = selectedTileId === t.id;
    return (
      <div
        key={t.id}
        className={cn('relative shrink-0', dimmedClass)}
        style={{ width: 130, breakInside: 'avoid', marginBottom: 6 }}
      >
        <div
          draggable
          data-tile-id={t.id}
          onDragStart={(e) => onDragStart(e, t)}
          onDragEnd={onDragEnd}
          style={{
            flexShrink: 0,
            overflow: 'hidden',
            cursor: 'grab',
            background: tileBg,
            width: 130,
            height: 90,
            border: t.action_type === 'deadline' ? '2px dashed #E24B4A' : `2px solid ${theme.border}`,
            boxShadow: isSelected ? `0 0 0 3px ${theme.accent}` : 'none',
          }}
          onClick={() => { setSelectedTileId(t.id); if (!sidebarOpen) setSidebarOpen(true); }}
          onContextMenu={(e) => onTileContextMenu(e, t)}
        >
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: 6 }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <p
                style={{
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  lineHeight: '14px',
                  color: readableOn(tileBg),
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                  margin: 0,
                }}
              >
                {t.title || 'Senza titolo'}
              </p>
            </div>
            <div style={{ marginTop: 'auto', position: 'relative', zIndex: 10 }}>
              {t.subtasks && t.subtasks.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <ChecklistBar items={t.subtasks} availableWidth={118} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 }}>
                <ActionBadge actionKey={actionKey} color={actionColor} />
                {si && (
                  <span style={{ color: theme.border }}>
                    <TypeIconBadge iconName={si.icon} color={si.color} />
                  </span>
                )}
              </div>
            </div>
            <StatusPattern shape={shape} color={t.action_type === 'none' ? theme.ink : color} bg={tileBg} />
          </div>
        </div>
        {hasFlow && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openFlow(t.id); }}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: -8,
              right: 6,
              zIndex: 20,
              padding: '0 5px',
              height: 16,
              background: theme.accent,
              color: theme.onAccent,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 8,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            title="Apri Flow"
          >
            FLOW
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg1 }} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}>
      <Header title="Chrono" />

      <div className="flex flex-1 overflow-hidden">

        {/* Board area — toolbar + 3 kanban-style columns (NOTES, TODO, CALENDAR) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Toolbar */}
          <div
            className="shrink-0"
            style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 12px',
              borderBottom: `2px solid ${theme.border}`,
              background: theme.bg2,
            }}
          >
            <button
              onClick={() => setModal({
                ...emptyModal,
                open: true,
                mode: 'create',
                startAt: new Date().toISOString(),
                endAt: new Date(Date.now() + 3600000).toISOString(),
              })}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 10px',
                background: theme.surfaceVariant,
                color: theme.ink2,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
              title="Aggiungi tile"
            >
              <IconLayoutGrid size={12} />
              Tile
            </button>
          </div>
          {/* Columns container */}
          <div className="flex-1 flex overflow-hidden" style={{ background: theme.bg1 }}>

        {/* 2 — COLONNA NOTES */}
        <div
          data-kanban-column="notes"
          style={{
            ...(notesOpen ? { width: notesWidth } : { width: 32 }),
            background: theme.bg1,
            borderRight: `2px solid ${theme.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            outline: dragOver === 'notes' ? `2px solid ${theme.accent}` : 'none',
            outlineOffset: -2,
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver('notes'); }}
          onDragLeave={() => setDragOver((v) => v === 'notes' ? null : v)}
          onDrop={(e) => { e.preventDefault(); handleDrop('notes'); }}
          onContextMenu={(e) => {
            if (!notesOpen) return;
            if ((e.target as HTMLElement).closest('[data-tile-id]')) return;
            e.preventDefault();
            setColCtxMenu({ x: e.clientX, y: e.clientY, type: 'notes' });
          }}
        >
          {!notesOpen ? (
            <>
              <button
                onClick={toggleNotesOpen}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.surfaceVariant,
                  borderBottom: `2px solid ${theme.border}`,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Espandi NOTES"
              >
                <IconLayoutSidebarLeftExpand size={14} style={{ color: theme.ink2 }} />
              </button>
              {processedNotes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8, color: theme.ink3 }}>
                  <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{processedNotes.length}</span>
                </div>
              )}
            </>
          ) : (
          <>
          <div
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              background: theme.surfaceVariant,
              borderBottom: `2px solid ${theme.border}`,
              position: 'relative',
              zIndex: 20,
            }}
          >
            <button
              onClick={toggleNotesOpen}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2 }}
              title="Collassa NOTES"
            >
              <IconLayoutSidebarLeftCollapse size={14} />
            </button>
            <IconNote size={14} style={{ color: actionColors.none, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.ink }}>NOTES</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              {/* Sort */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setNotesMenuOpen(notesMenuOpen === 'sort' ? null : 'sort')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: notesSort !== 'date_desc' ? theme.accent : theme.ink3 }}
                >
                  <IconArrowsSort size={12} />
                </button>
                {notesMenuOpen === 'sort' && (
                  <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['date_desc', 'Data ↓ (recenti)'], ['date_asc', 'Data ↑ (vecchi)'], ['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesSort(val); setNotesMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: notesSort === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${notesSort === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: notesSort === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {notesSort === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filter */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setNotesMenuOpen(notesMenuOpen === 'filter' ? null : 'filter')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: notesFilter !== 'all' ? theme.accent : theme.ink3 }}
                >
                  <IconFilter size={12} />
                </button>
                {notesMenuOpen === 'filter' && (
                  <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['all', 'Tutti'], ['completion', 'Completati'], ['status', 'Con status']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesFilter(val); setNotesMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: notesFilter === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${notesFilter === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: notesFilter === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {notesFilter === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setNotesMenuOpen(notesMenuOpen === 'group' ? null : 'group')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: notesGroup !== 'none' ? theme.accent : theme.ink3 }}
                >
                  <IconLayoutList size={12} />
                </button>
                {notesMenuOpen === 'group' && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['none', 'Nessuno'], ['date', 'Per data'], ['tag', 'Per tag']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setNotesGroup(val); setNotesMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: notesGroup === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${notesGroup === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: notesGroup === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {notesGroup === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groupedNotes ? (
              <div className="space-y-3">
              {Object.entries(groupedNotes).map(([group, tiles]) => (
                <div key={group}>
                  <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold px-1 pt-1.5 pb-0.5">{group}</div>
                  <div style={{ columnWidth: '130px', columnGap: '6px' }}>
                  {tiles.map((t) => renderColumnTile(t, isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'))}
                  </div>
                </div>
              ))}
              </div>
            ) : (
              <div style={{ columnWidth: '130px', columnGap: '6px' }}>
              {processedNotes.map((t) => renderColumnTile(t, isTileDimmed(t, selectedTagIds) && 'opacity-20 saturate-0'))}
              </div>
            )}
            {processedNotes.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun appunto</span>}
          </div>
          </>
          )}
        </div>

        {/* Splitter NOTES → TODO */}
        {notesOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleNotesResizeStart}
            className="group"
            style={{ position: 'relative', width: 4, marginLeft: -2, marginRight: -2, flexShrink: 0, cursor: 'col-resize', background: 'transparent', zIndex: 10 }}
            title="Trascina per ridimensionare"
            onMouseEnter={(e) => (e.currentTarget.style.background = `${theme.accent}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 6,
                height: 40,
                background: theme.border,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* 3 — COLONNA TODO */}
        <div
          data-kanban-column="todo"
          style={{
            ...(todoOpen ? { width: todoWidth } : { width: 32 }),
            background: theme.bg1,
            borderRight: `2px solid ${theme.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            outline: dragOver === 'todo' ? `2px solid ${theme.accent}` : 'none',
            outlineOffset: -2,
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver('todo'); }}
          onDragLeave={() => setDragOver((v) => v === 'todo' ? null : v)}
          onDrop={(e) => { e.preventDefault(); handleDrop('todo'); }}
          onContextMenu={(e) => {
            if (!todoOpen) return;
            if ((e.target as HTMLElement).closest('[data-tile-id]')) return;
            e.preventDefault();
            setColCtxMenu({ x: e.clientX, y: e.clientY, type: 'todo' });
          }}
        >
          {!todoOpen ? (
            <>
              <button
                onClick={toggleTodoOpen}
                style={{
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.surfaceVariant,
                  borderBottom: `2px solid ${theme.border}`,
                  border: 'none',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Espandi TO DO"
              >
                <IconLayoutSidebarLeftExpand size={14} style={{ color: theme.ink2 }} />
              </button>
              {processedTodos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8, color: theme.ink3 }}>
                  <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{processedTodos.length}</span>
                </div>
              )}
            </>
          ) : (
          <>
          <div
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 8px',
              background: theme.surfaceVariant,
              borderBottom: `2px solid ${theme.border}`,
              position: 'relative',
              zIndex: 20,
            }}
          >
            <button
              onClick={toggleTodoOpen}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2 }}
              title="Collassa TO DO"
            >
              <IconLayoutSidebarLeftCollapse size={14} />
            </button>
            <IconChecklist size={14} style={{ color: actionColors.anytime, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.ink }}>TO DO</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              {/* Sort */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setTodoMenuOpen(todoMenuOpen === 'sort' ? null : 'sort')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: todoSort !== 'order' ? theme.accent : theme.ink3 }}
                >
                  <IconArrowsSort size={12} />
                </button>
                {todoMenuOpen === 'sort' && (
                  <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['order', 'Ordine'], ['date_desc', 'Data ↓ (recenti)'], ['date_asc', 'Data ↑ (vecchi)'], ['alpha_asc', 'A → Z'], ['alpha_desc', 'Z → A']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoSort(val); setTodoMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: todoSort === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${todoSort === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: todoSort === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {todoSort === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Filter */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setTodoMenuOpen(todoMenuOpen === 'filter' ? null : 'filter')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: todoFilter !== 'all' ? theme.accent : theme.ink3 }}
                >
                  <IconFilter size={12} />
                </button>
                {todoMenuOpen === 'filter' && (
                  <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['all', 'Tutti'], ['active', 'Attivi'], ['completed', 'Completati'], ['status', 'Con status']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoFilter(val); setTodoMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: todoFilter === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${todoFilter === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: todoFilter === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {todoFilter === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Group */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setTodoMenuOpen(todoMenuOpen === 'group' ? null : 'group')}
                  style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: todoGroup !== 'none' ? theme.accent : theme.ink3 }}
                >
                  <IconLayoutList size={12} />
                </button>
                {todoMenuOpen === 'group' && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, background: theme.surface, border: `2px solid ${theme.border}`, boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`, padding: 4, width: 160 }}>
                    {([['none', 'Nessuno'], ['date', 'Per data'], ['tag', 'Per tag']] as const).map(([val, label]) => (
                      <button key={val} onClick={() => { setTodoGroup(val); setTodoMenuOpen(null); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', textAlign: 'left', background: todoGroup === val ? theme.surfaceVariant : 'transparent', border: `2px solid ${todoGroup === val ? theme.border : 'transparent'}`, fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: todoGroup === val ? theme.ink : theme.ink2, cursor: 'pointer' }}>
                        {todoGroup === val && <span style={{ color: theme.accent }}>•</span>}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groupedTodos ? (
              <div className="space-y-3">
              {Object.entries(groupedTodos).map(([group, tiles]) => (
                <div key={group}>
                  <div className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold px-1 pt-1.5 pb-0.5">{group}</div>
                  <div style={{ columnWidth: '130px', columnGap: '6px' }}>
                  {tiles.map((t) => renderColumnTile(t, isDone(t) && 'opacity-50'))}
                  </div>
                </div>
              ))}
              </div>
            ) : (
              <div style={{ columnWidth: '130px', columnGap: '6px' }}>
              {processedTodos.map((t) => renderColumnTile(t, isDone(t) && 'opacity-50'))}
              </div>
            )}
            {processedTodos.length === 0 && <span className="text-[10px] text-zinc-500 py-2">Nessun task</span>}
          </div>
          </>
          )}
        </div>

        {/* Splitter TODO → CALENDAR */}
        {todoOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={handleTodoResizeStart}
            style={{ position: 'relative', width: 4, marginLeft: -2, marginRight: -2, flexShrink: 0, cursor: 'col-resize', background: 'transparent', zIndex: 10 }}
            title="Trascina per ridimensionare"
            onMouseEnter={(e) => (e.currentTarget.style.background = `${theme.accent}66`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 6,
                height: 40,
                background: theme.border,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* 4 — COLONNA CALENDAR */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: theme.bg1, overflow: 'hidden' }}>

      {/* Column header */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          background: theme.surfaceVariant,
          borderBottom: `2px solid ${theme.border}`,
          position: 'relative',
          zIndex: 20,
        }}
      >
        <IconCalendar size={14} style={{ color: theme.ink2, flexShrink: 0 }} />
        <span
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: theme.ink,
          }}
        >
          CALENDARIO
        </span>
        <span
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink3,
            textTransform: 'capitalize',
          }}
        >
          {viewMode === 'week' ? formatWeekRange(days) : formatMonthLabel(currentMonth)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
          {/* View switcher */}
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 4, background: theme.bg2, border: `2px solid ${theme.border}`, padding: 2 }}>
            <button
              onClick={() => changeViewMode('week')}
              style={{
                padding: '0 8px',
                height: 18,
                background: viewMode === 'week' ? theme.accent : 'transparent',
                color: viewMode === 'week' ? theme.onAccent : theme.ink2,
                border: 'none',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
              title="Vista settimanale"
            >
              WEEK
            </button>
            <button
              onClick={() => changeViewMode('month')}
              style={{
                padding: '0 8px',
                height: 18,
                background: viewMode === 'month' ? theme.accent : 'transparent',
                color: viewMode === 'month' ? theme.onAccent : theme.ink2,
                border: 'none',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
              title="Vista mensile"
            >
              MONTH
            </button>
          </div>
          {/* Prev / Oggi / Next */}
          <button
            onClick={() => viewMode === 'week' ? setWeekOffset((o) => o - 1) : setMonthOffset((o) => o - 1)}
            style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2 }}
          >
            <IconChevronLeft size={14} />
          </button>
          <button
            onClick={() => { setWeekOffset(0); setMonthOffset(0); }}
            style={{
              padding: '0 8px',
              height: 22,
              background: theme.bg2,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Oggi
          </button>
          <button
            onClick={() => viewMode === 'week' ? setWeekOffset((o) => o + 1) : setMonthOffset((o) => o + 1)}
            style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2 }}
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* FullCalendar grid */}
      <div
        className="flex-1 overflow-hidden fc-dark"
        onContextMenu={(e) => {
          // Only show slot context menu if not clicking on an event
          const target = e.target as HTMLElement;
          const eventEl = target.closest('.fc-event') as HTMLElement | null;
          if (eventEl) {
            // Fallback: if the event's own contextmenu listener didn't fire
            // (can happen for all-day events with nested handlers), trigger
            // the tile context menu here using the data-tile-id we attach in
            // eventDidMount.
            const tileId = eventEl.getAttribute('data-tile-id');
            if (tileId) {
              const tile = filteredEvents.find((t) => t.id === tileId) || allTiles.find((t) => t.id === tileId);
              if (tile) {
                e.preventDefault();
                e.stopPropagation();
                setCtxMenu({ x: e.clientX, y: e.clientY, tile });
              }
            }
            return;
          }
          e.preventDefault();
          // Try to find the date from the slot element
          const slotEl = target.closest('[data-date]') as HTMLElement | null;
          const tdEl = target.closest('td.fc-timegrid-slot') as HTMLElement | null;
          if (slotEl) {
            const dateStr = slotEl.getAttribute('data-date');
            if (dateStr) {
              const date = new Date(dateStr);
              const allDay = !!target.closest('.fc-daygrid-body, .fc-daygrid-day');
              setSlotCtxMenu({ x: e.clientX, y: e.clientY, date, allDay });
              return;
            }
          }
          if (tdEl) {
            const dateAttr = tdEl.getAttribute('data-time');
            // Find the day column from X position
            const api = fcRef.current?.getApi();
            if (api && dateAttr) {
              // Use the column header to find the day
              const colHeaders = document.querySelectorAll('.fc-col-header-cell');
              let dayDate = new Date();
              colHeaders.forEach((header) => {
                const rect = header.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right) {
                  const d = (header as HTMLElement).getAttribute('data-date');
                  if (d) dayDate = new Date(d);
                }
              });
              const [h, m] = dateAttr.split(':').map(Number);
              dayDate.setHours(h, m, 0, 0);
              setSlotCtxMenu({ x: e.clientX, y: e.clientY, date: dayDate, allDay: false });
              return;
            }
          }
          // Fallback: all-day area or header
          setSlotCtxMenu(null);
          setCtxMenu(null);
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <IconLoader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <FullCalendar
            ref={fcRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView={viewMode === 'month' ? 'dayGridMonth' : 'timeGridWeek'}
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
            dateClick={(info) => {
              // Ignore if clicked on an event element
              const target = info.jsEvent.target as HTMLElement;
              if (target.closest('.fc-event')) return;
              // Left-click on empty slot — open modal pre-filled
              setModal({
                ...emptyModal,
                open: true,
                mode: 'create',
                actionType: 'event',
                allDay: info.allDay,
                startAt: info.date.toISOString(),
                endAt: info.allDay
                  ? new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate(), 23, 59, 59).toISOString()
                  : new Date(info.date.getTime() + 3600000).toISOString(),
              });
            }}
            eventClick={(info) => {
              const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
              if (tile) { setSelectedTileId(tile.id); if (!sidebarOpen) setSidebarOpen(true); }
            }}
            eventDragStart={() => { setDragOver(null); }}
            eventDragStop={(info) => {
              // If the drop landed over the NOTES or TODO column, unschedule the
              // tile and reclassify it instead of leaving it on the calendar.
              const { clientX, clientY } = info.jsEvent;
              const notesEl = document.querySelector('[data-kanban-column="notes"]') as HTMLElement | null;
              const todoEl = document.querySelector('[data-kanban-column="todo"]') as HTMLElement | null;
              const within = (el: HTMLElement | null) => {
                if (!el) return false;
                const r = el.getBoundingClientRect();
                return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
              };
              const target: 'notes' | 'todo' | null = within(notesEl) ? 'notes' : within(todoEl) ? 'todo' : null;
              if (!target) return;
              // Mark the drop as externally handled so eventDrop doesn't also fire a move
              externalDropRef.current = info.event.id;
              info.event.remove();
              moveTileMutation.mutate({
                id: info.event.id,
                updates: {
                  action_type: target === 'notes' ? 'none' : 'anytime',
                  is_event: false,
                  all_day: false,
                  start_at: null,
                  end_at: null,
                },
              });
              setDragOver(null);
            }}
            eventDrop={(info) => {
              // Skip if this drop was already handled by eventDragStop (external target)
              if (externalDropRef.current === info.event.id) {
                externalDropRef.current = null;
                return;
              }
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
              // Mark the FC event element with the tile id so a useEffect can
              // toggle the blue selection ring reactively when selectedTileId changes.
              info.el.setAttribute('data-tile-id', info.event.id);
              // Right-click context menu
              info.el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
                if (tile) setCtxMenu({ x: e.clientX, y: e.clientY, tile });
              });
              // Pixel-style tile: bg = type color (CC alpha) or surface, hard 2px
              // border, and an explicit `color` that the title element inherits.
              // Mirrors the NOTES/TODO tile card: `readableOn(tileBg)` so the
              // title stays legible whether the tile is on a dark type-color or
              // a light theme surface.
              const tile = filteredEvents.find((t) => t.id === info.event.id) || allTiles.find((t) => t.id === info.event.id);
              if (tile) {
                const tileSi = getIconForTile(tile.id);
                const tileBg = tileSi?.color ? `${tileSi.color}CC` : theme.surface;
                const tileFg = readableOn(tileBg);
                // The icon-derived bg has an 80% alpha (`CC`) for visual
                // softening; layer it over an opaque theme.surface base so the
                // calendar grid never bleeds through the remaining 20%.
                if (tileSi?.color) {
                  info.el.style.background = `linear-gradient(${tileBg}, ${tileBg}), ${theme.surface}`;
                } else {
                  info.el.style.backgroundColor = tileBg;
                }
                info.el.style.color = tileFg;
                info.el.style.borderRadius = '0';
                if (tile.action_type === 'deadline') {
                  info.el.style.border = '2px dashed #E24B4A';
                } else {
                  info.el.style.border = `2px solid ${theme.border}`;
                }
                // Push the fg color down to .fc-event-main and .fc-event-title too,
                // so FC's own per-element color rules don't bleed through.
                const mainEl = info.el.querySelector('.fc-event-main') as HTMLElement | null;
                if (mainEl) mainEl.style.color = tileFg;
                const titleEl = info.el.querySelector('.fc-event-title') as HTMLElement | null;
                if (titleEl) titleEl.style.color = tileFg;
              }
              // Inject status SHAPE overlay (pattern) for non-'solid' shapes.
              // We attach to the `.fc-event-main` child instead of `info.el` because
              // FullCalendar uses absolute positioning on `info.el` itself to place
              // the event in the grid — overriding its position would break layout.
              if (tile) {
                const shape = resolveShape(tile);
                if (shape !== 'solid') {
                  const main = info.el.querySelector('.fc-event-main') as HTMLElement | null;
                  if (main) {
                    const tagColor = getTagColor(tile);
                    const shapeColor = tile.action_type === 'none' ? '#e4e4e7' : tagColor;
                    const tileSi = getIconForTile(tile.id);
                    const tileBg = tileSi?.color ? `${tileSi.color}CC` : theme.surface;
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { renderToString: rts } = require('react-dom/server');
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const ReactM = require('react');
                    const overlayHtml: string = rts(ReactM.createElement(StatusPattern, { shape, color: shapeColor, bg: tileBg }));
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0;';
                    overlay.innerHTML = overlayHtml;
                    if (getComputedStyle(main).position === 'static') {
                      main.style.position = 'relative';
                    }
                    main.insertBefore(overlay, main.firstChild);
                    // Lift FC's text content above the overlay
                    Array.from(main.children).forEach((child) => {
                      if (child !== overlay && child instanceof HTMLElement) {
                        if (!child.style.position) child.style.position = 'relative';
                        if (!child.style.zIndex) child.style.zIndex = '1';
                      }
                    });
                  }
                }
              }
              // Inject status icon (if any) into the event.
              // Attach to `.fc-event-main` (NOT `info.el`) — FullCalendar uses
              // absolute positioning on `info.el` to place the event in the time
              // grid, so overriding its position would collapse the event height.
              const si = tile ? getIconForTile(tile.id) : null;
              if (si?.icon) {
                const IconComp = AllIcons[si.icon];
                if (IconComp) {
                  const main = info.el.querySelector('.fc-event-main') as HTMLElement | null;
                  if (main) {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { renderToString } = require('react-dom/server');
                    const React = require('react');
                    const bg = si.color || theme.surfaceVariant;
                    const iconColor = readableOn(bg);
                    const svg = renderToString(React.createElement(IconComp, { size: 10, color: iconColor }));
                    const badge = document.createElement('div');
                    badge.style.cssText = `position:absolute;top:3px;right:3px;width:16px;height:16px;background-color:${bg};border:2px solid ${theme.border};display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:2;`;
                    badge.innerHTML = svg;
                    if (getComputedStyle(main).position === 'static') {
                      main.style.position = 'relative';
                    }
                    main.appendChild(badge);
                  }
                }
              }
              // FLOW badge — pixel chip pinned to the top-right of the event,
              // sticking out past the event boundary.
              if (tile && tilesWithFlows.has(tile.id)) {
                info.el.style.overflow = 'visible';
                const main = info.el.querySelector('.fc-event-main') as HTMLElement | null;
                if (main) {
                  main.style.overflow = 'visible';
                  const tileId = tile.id;
                  const chip = document.createElement('button');
                  chip.type = 'button';
                  chip.style.cssText = `position:absolute;top:-8px;right:6px;padding:0 5px;background:${theme.accent};border:2px solid ${theme.border};color:${theme.onAccent};font-family:var(--font-pixel-head),ui-monospace,monospace;font-size:8px;letter-spacing:0.08em;text-transform:uppercase;line-height:14px;height:16px;cursor:pointer;z-index:3;`;
                  chip.textContent = 'FLOW';
                  chip.title = 'Apri Flow';
                  chip.addEventListener('mousedown', (e) => e.stopPropagation());
                  chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    useFlowOpenStore.getState().open(tileId);
                  });
                  if (getComputedStyle(main).position === 'static') main.style.position = 'relative';
                  main.appendChild(chip);
                }
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
          className="fixed"
          style={{
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 9999,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            width: 168,
          }}
        >
          <button
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            Copia
          </button>
          <button
            onClick={clipboardTile ? handlePaste : undefined}
            disabled={!clipboardTile}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: clipboardTile ? 'pointer' : 'not-allowed', color: clipboardTile ? theme.ink2 : theme.ink3, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
            Incolla
          </button>
          <div style={{ borderTop: `2px solid ${theme.border}`, margin: '4px 0' }} />
          <button
            onClick={() => {
              if (!ctxMenu) return;
              const { tile } = ctxMenu;
              setCtxMenu(null);
              openFlow(tile.id);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <IconRoute size={14} />
            Apri Flow
          </button>
          <button
            onClick={handleDeleteTile}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: '#E24B4A', fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <IconTrash size={14} />
            Elimina
          </button>
        </div>
        </>,
        document.body
      )}

      {/* Slot context menu */}
      {slotCtxMenu && createPortal(
        <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setSlotCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setSlotCtxMenu(null); }} />
        <div
          ref={slotCtxRef}
          className="fixed"
          style={{
            top: slotCtxMenu.y,
            left: slotCtxMenu.x,
            zIndex: 9999,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            width: 184,
          }}
        >
          <button
            onClick={handleNewTileAtSlot}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <IconPlus size={14} />
            Nuovo tile qui
          </button>
          {clipboardTile && (
            <>
              <div style={{ borderTop: `2px solid ${theme.border}`, margin: '4px 0' }} />
              <button
                onClick={() => {
                  if (!clipboardTile || !slotCtxMenu) return;
                  const { date, allDay } = slotCtxMenu;
                  setSlotCtxMenu(null);
                  (async () => {
                    try {
                      const res = await tilesApi.create({ title: clipboardTile.title });
                      const newId = res?.data?.id;
                      if (newId) {
                        await tilesApi.update(newId, {
                          action_type: 'event' as any,
                          is_event: true,
                          all_day: allDay,
                          start_at: date.toISOString(),
                          end_at: allDay
                            ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString()
                            : new Date(date.getTime() + 3600000).toISOString(),
                          status_id: clipboardTile.status_id,
                        });
                        const tagId = clipboardTile.tags?.[0]?.id;
                        if (tagId) await syncTags(newId, [tagId]);
                        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
                        queryClient.invalidateQueries({ queryKey: ['tiles-calendar'] });
                      }
                    } catch { /* ignore */ }
                  })();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                Incolla qui
              </button>
            </>
          )}
        </div>
        </>,
        document.body
      )}

      {/* Column context menu */}
      {colCtxMenu && createPortal(
        <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setColCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setColCtxMenu(null); }} />
        <div
          className="fixed"
          style={{
            top: colCtxMenu.y,
            left: colCtxMenu.x,
            zIndex: 9999,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
            width: 184,
          }}
        >
          <button
            onClick={handleNewTileInColumn}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
          >
            <IconPlus size={14} />
            {colCtxMenu.type === 'notes' ? 'Nuovo appunto' : 'Nuovo task'}
          </button>
          {clipboardTile && (
            <>
              <div style={{ borderTop: `2px solid ${theme.border}`, margin: '4px 0' }} />
              <button
                onClick={handlePasteInColumn}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, fontFamily: 'var(--font-pixel-body)', fontSize: 12 }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
                Incolla qui
              </button>
            </>
          )}
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
        const allTypeIcons = typeIcons;
        const currentTypeIcon = modal.typeIconId ? allTypeIcons.find((i) => i.id === modal.typeIconId) : null;
        const CurrentTypeComp = currentTypeIcon?.icon ? AllIcons[currentTypeIcon.icon] : null;

        // Tag info for status shape color
        const selectedTag = tags.find((t: Tag) => modal.tagIds.includes(t.id));
        const tagColor = selectedTag ? (getTypeColor(selectedTag.tag_type || 'topic') || '#64748B') : '#64748B';

        const modalLabelStyle: React.CSSProperties = {
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink3,
          display: 'block',
          marginBottom: 4,
        };
        const modalInputStyle: React.CSSProperties = {
          width: '100%',
          background: theme.surfaceVariant,
          border: `2px solid ${theme.border}`,
          padding: '6px 10px',
          color: theme.ink,
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 12,
          outline: 'none',
        };

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setModal(emptyModal)}
          >
            <div
              style={{
                background: theme.surface,
                border: `2px solid ${theme.border}`,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                width: 360,
                maxHeight: '85vh',
                overflowY: 'auto',
                color: theme.ink,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: theme.surfaceVariant,
                  borderBottom: `2px solid ${theme.border}`,
                }}
              >
                <h2
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: theme.ink,
                    margin: 0,
                  }}
                >
                  {modal.mode === 'create' ? 'Nuovo Tile' : 'Modifica Tile'}
                </h2>
                <button
                  onClick={() => setModal(emptyModal)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, display: 'inline-flex' }}
                >
                  <IconX size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
                {/* Titolo */}
                <div>
                  <label style={modalLabelStyle}>Titolo</label>
                  <input
                    value={modal.title}
                    onChange={(e) => setModal({ ...modal, title: e.target.value })}
                    placeholder="Titolo..."
                    autoFocus
                    style={modalInputStyle}
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label style={modalLabelStyle}>Tipo</label>
                  <div style={{ display: 'flex', gap: 4 }}>
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
                          style={{
                            flex: 1,
                            padding: '6px 4px',
                            background: isActive ? theme.accent : theme.surfaceVariant,
                            color: isActive ? theme.onAccent : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date/time */}
                {showDate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <label style={modalLabelStyle}>Date</label>
                      <input
                        type="date"
                        value={dateVal}
                        onChange={(e) => setDate(e.target.value)}
                        style={{ ...modalInputStyle, colorScheme: 'dark' }}
                      />
                    </div>
                    {isTimed && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={modalLabelStyle}>Start</label>
                          <TimePicker
                            value={startTime || '09:00'}
                            onChange={(t) => { if (dateVal) setModal({ ...modal, startAt: new Date(`${dateVal}T${t}`).toISOString() }); }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={modalLabelStyle}>End</label>
                          <TimePicker
                            value={endTime || '10:00'}
                            onChange={(t) => { if (dateVal) setModal({ ...modal, endAt: new Date(`${dateVal}T${t}`).toISOString() }); }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tag */}
                <div>
                  <label style={modalLabelStyle}>Tag</label>
                  <ModalDropdown
                    value={modal.tagIds[0] || null}
                    options={tags.filter((t: Tag) => !t.is_root).map((t: Tag) => ({ id: t.id, label: t.name }))}
                    placeholder="Seleziona tag..."
                    onChange={(id) => setModal({ ...modal, tagIds: id ? [id] : [] })}
                  />
                </div>

                {/* Type Icon */}
                <div>
                  <label style={modalLabelStyle}>Tipo icona</label>
                  <ModalDropdown
                    value={modal.typeIconId}
                    options={[
                      { id: null as any, label: 'Nessuno' },
                      ...allTypeIcons.map((si) => ({ id: si.id, label: si.name, icon: si.icon })),
                    ]}
                    placeholder="Seleziona tipo..."
                    onChange={(id) => setModal({ ...modal, typeIconId: id })}
                    renderOption={(opt) => {
                      if (!opt.icon) return <span>{opt.label}</span>;
                      const Comp = AllIcons[opt.icon];
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {Comp && <Comp size={14} />}
                          <span>{opt.label}</span>
                        </span>
                      );
                    }}
                    renderSelected={() => {
                      if (!CurrentTypeComp) return null;
                      return (
                        <>
                          <CurrentTypeComp size={14} />
                          <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTypeIcon!.name}</span>
                        </>
                      );
                    }}
                  />
                </div>

                {/* Status */}
                {allStatuses.length > 0 && (
                  <div>
                    <label style={modalLabelStyle}>Status</label>
                    <ModalDropdown
                      value={modal.statusId}
                      options={allStatuses.map((s) => ({ id: s.id, label: s.name, shape: s.shape }))}
                      placeholder="Seleziona status..."
                      onChange={(id) => setModal({ ...modal, statusId: id })}
                    />
                  </div>
                )}

                {/* Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 10,
                    borderTop: `2px solid ${theme.border}`,
                  }}
                >
                  {modal.mode === 'edit' && modal.tileId && (
                    <button
                      onClick={() => unscheduleMutation.mutate(modal.tileId!)}
                      className="px-press"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 28,
                        padding: '0 10px',
                        background: theme.surfaceVariant,
                        color: '#E24B4A',
                        border: `2px solid #E24B4A`,
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      <IconTrash size={12} /> Rimuovi
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => setModal(emptyModal)}
                    className="px-press"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 28,
                      padding: '0 12px',
                      background: theme.surfaceVariant,
                      color: theme.ink2,
                      border: `2px solid ${theme.border}`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending}
                    className="px-press"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 28,
                      padding: '0 12px',
                      background: theme.accent,
                      color: theme.onAccent,
                      border: `2px solid ${theme.border}`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      cursor: (scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending) ? 'not-allowed' : 'pointer',
                      opacity: (scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending) ? 0.6 : 1,
                      boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                    }}
                  >
                    {(scheduleMutation.isPending || createEventMutation.isPending || updateMutation.isPending) && (
                      <IconLoader2 size={12} className="animate-spin" />
                    )}
                    {modal.mode === 'create' ? 'Crea' : 'Salva'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      </div>{/* end CALENDAR column */}

          </div>{/* end columns container */}
        </div>{/* end board area */}

      {/* 5 — SIDEBAR DESTRA */}
      <TileSidebar
        tileId={selectedTileId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        invalidateKeys={['calendar-events', 'tiles-calendar']}
        forceFlowTab={forceFlowTab}
      />
      </div>{/* end flex row */}
    </div>
  );
}
