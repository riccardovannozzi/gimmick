'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  IconPlus,
  IconMinus,
  IconTrash,
  IconDots,
  IconPalette,
  IconFilter,
  IconGripVertical,
  IconX,
  IconCheck,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconCalendar,
  IconCalendarEvent,
  IconPin,
  IconBolt,
  IconClock,
  IconArrowUp,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { kanbanApi, tilesApi, tagsApi, statusesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useStatuses } from '@/store/statuses-store';
import { cn } from '@/lib/utils';
import { formatDay, getDayKey } from '@/lib/tile-helpers';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';
import { readableOn } from '@/lib/palette';
import { ChecklistBar } from '@/components/tileview/ChecklistBar';
import type { Tile, Tag, KanbanColumn, KanbanFilter, KanbanFilterType, KanbanSortBy, KanbanSortDir, Status, ActionType, StatusShape } from '@/types';

const FALLBACK_COLOR = '#94A3B8';
// Canvas tile dimensions (shared with CanvasBoard + calendar columns)
const TILE_W = 130;
const TILE_H = 90;

// ─── Shared tile visual helpers (mirror of calendar page) ───

// Rounded-square badge with the type icon inside (background = type color, white icon).
function TypeIconBadge({ iconName, color }: { iconName: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
      <Comp size={12} color={readableOn(bg)} />
    </div>
  );
}

// Round colored badge with the action icon (white). Notes (none) renders nothing.
const ACTION_ICON: Record<string, typeof IconBolt | null> = {
  none:     null,
  anytime:  IconArrowUp,
  deadline: IconBolt,
  event:    IconClock,     // TIMED
  allday:   IconCalendar,
};

function ActionIconBadge({ actionKey, color }: { actionKey: string; color: string }) {
  const Icon = ACTION_ICON[actionKey];
  if (!Icon) return null;
  return (
    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color }}>
      <Icon size={10} color={readableOn(color)} />
    </div>
  );
}

let _patId = 0;
function InlineStatus({ shape, color }: { shape: StatusShape; color: string }) {
  const o = 0.2;
  const id = useMemo(() => `kb-il-${++_patId}`, []);
  switch (shape) {
    case 'solid': return null;
    case 'diagonal_ltr': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect x={5} y={5} width={120} height={80} rx={3} fill={`url(#${id})`} /></>;
    case 'diagonal_rtl': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(-60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect x={5} y={5} width={120} height={80} rx={3} fill={`url(#${id})`} /></>;
    case 'vertical': return <><defs><pattern id={id} patternUnits="userSpaceOnUse" width={16} height={20}><line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#${id})`} /></>;
    case 'bubble': return <><circle cx={20} cy={20} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.05} /><circle cx={44} cy={16} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={68} cy={22} r={7} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.1} /><circle cx={94} cy={18} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={114} cy={24} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.02} /><circle cx={28} cy={45} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={54} cy={47} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.08} /><circle cx={80} cy={43} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.05} /><circle cx={104} cy={47} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={22} cy={70} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.05} /><circle cx={46} cy={72} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={70} cy={68} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.08} /><circle cx={96} cy={72} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={116} cy={68} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.05} /></>;
    case 'cross': return <><line x1={10} y1={10} x2={120} y2={80} stroke={color} strokeWidth={10} strokeOpacity={o + 0.3} strokeLinecap="round" /><line x1={120} y1={10} x2={10} y2={80} stroke={color} strokeWidth={10} strokeOpacity={o + 0.3} strokeLinecap="round" /></>;
    case 'hourglass': return <path d="M55,30 L75,30 L65,45 L75,60 L55,60 L65,45 Z" fill="none" stroke={color} strokeWidth={4} strokeOpacity={o + 0.25} strokeLinejoin="round" strokeLinecap="round" />;
    case 'pause_bars': return <><rect x={57} y={26} width={6} height={38} rx={1} fill={color} fillOpacity={o + 0.15} /><rect x={67} y={26} width={6} height={38} rx={1} fill={color} fillOpacity={o + 0.15} /></>;
    case 'lock': return <><path d="M58,41 V35 a7,7 0 0 1 14,0 V41" fill="none" stroke={color} strokeWidth={2} strokeOpacity={o + 0.15} strokeLinecap="round" /><rect x={53} y={41} width={24} height={20} rx={3} fill={color} fillOpacity={o + 0.1} /><circle cx={65} cy={51} r={2} fill="#1C1C1E" /></>;
    case 'shade': return <rect width={130} height={90} fill="#000000" opacity={0.5} />;
    default: return null;
  }
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  none: 'NOTES',
  anytime: 'TO DO',
  deadline: 'DUE',
  event: 'TIMED',
  allday: 'ALL DAY',
};

// 5 action options — allday is a virtual value (tile.action_type='event' + all_day=true)
const ACTION_OPTIONS: { value: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { value: 'none', label: 'NOTES', icon: IconPin },
  { value: 'anytime', label: 'TO DO', icon: IconBolt },
  { value: 'deadline', label: 'DUE', icon: IconClock },
  { value: 'allday', label: 'ALL DAY', icon: IconCalendarEvent },
  { value: 'event', label: 'TIMED', icon: IconCalendar },
];

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Done' },
  { value: 'active', label: 'Undone' },
];

const SORT_BY_LABELS: Record<string, string> = {
  date_start: 'Data inizio',
  date_end: 'Data fine',
  date_created: 'Creazione',
  date_updated: 'Aggiornamento',
};

const FILTER_TYPE_LABELS: Record<string, string> = {
  action_type: 'Action',
  tag: 'Tag',
  completion: 'Done/Undone',
  status: 'Status',
  type_icon: 'Type',
  date_range: 'Data',
};

// ─── Date range helpers ───

function parseDateRange(value: string): { from: string; to: string } {
  const [from = '', to = ''] = value.split('|');
  return { from, to };
}

function formatDateRange(from: string, to: string): string {
  return `${from}|${to}`;
}

function tileDateForRange(tile: Tile): Date | null {
  const iso = tile.start_at || tile.end_at || tile.created_at;
  return iso ? new Date(iso) : null;
}

// Relative date ranges stored as "last:N" / "next:N" in date_range value
function dateRangeKind(value: string): 'last' | 'next' | 'absolute' {
  if (value.startsWith('last:')) return 'last';
  if (value.startsWith('next:')) return 'next';
  return 'absolute';
}

function parseRelativeDays(value: string): number | null {
  const n = parseInt(value.split(':')[1] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function matchRelativeLastDays(d: Date, n: number): boolean {
  const from = new Date(); from.setDate(from.getDate() - n); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

function matchRelativeNextDays(d: Date, n: number): boolean {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setDate(to.getDate() + n); to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

// Uncontrolled-ish integer input with a local draft synced from props.
// Uses type="text" + inputMode="numeric" so there is no spinner but still a
// numeric keypad on mobile; onChange strips non-digits.
function DaysInput({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const [draft, setDraft] = useState<string>(value !== null ? String(value) : '');
  useEffect(() => {
    setDraft(value !== null ? String(value) : '');
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="N"
      value={draft}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9]/g, '');
        setDraft(cleaned);
        if (cleaned === '') { onChange(null); return; }
        const n = parseInt(cleaned, 10);
        if (!Number.isFinite(n) || n <= 0) return;
        onChange(n);
      }}
      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
    />
  );
}

// ─── Filter matching: OR within same type, AND across types ───

function tileMatchesFilters(
  tile: Tile,
  filters: KanbanFilter[],
  typeTileIcons: Record<string, string>,
): boolean {
  if (filters.length === 0) return true;

  // Group filters by type
  const byType = new Map<KanbanFilterType, KanbanFilter[]>();
  for (const f of filters) {
    const list = byType.get(f.type) || [];
    list.push(f);
    byType.set(f.type, list);
  }

  // Each type group must have at least one matching rule (OR within, AND across)
  for (const [type, rules] of byType) {
    const anyMatch = rules.some((f) => {
      switch (type) {
        case 'action_type':
          if (f.value === 'allday') return tile.action_type === 'event' && !!tile.all_day;
          if (f.value === 'event') return tile.action_type === 'event' && !tile.all_day;
          return tile.action_type === f.value;
        case 'tag':
          return tile.tags?.some((t) => t.id === f.value) ?? false;
        case 'completion':
          return f.value === 'completed' ? !!tile.is_completed : !tile.is_completed;
        case 'status':
          return tile.status_id === f.value;
        case 'type_icon':
          return typeTileIcons[tile.id] === f.value;
        case 'date_range': {
          const d = tileDateForRange(tile);
          if (!d) return false;
          const kind = dateRangeKind(f.value);
          if (kind === 'last') {
            const n = parseRelativeDays(f.value);
            return n !== null && matchRelativeLastDays(d, n);
          }
          if (kind === 'next') {
            const n = parseRelativeDays(f.value);
            return n !== null && matchRelativeNextDays(d, n);
          }
          const { from, to } = parseDateRange(f.value);
          if (from && d < new Date(from + 'T00:00:00')) return false;
          if (to && d > new Date(to + 'T23:59:59')) return false;
          return true;
        }
        default:
          return true;
      }
    });
    if (!anyMatch) return false;
  }
  return true;
}

// ─── Sorting ───

function sortTiles(tiles: Tile[], sortBy: KanbanSortBy, sortDir: KanbanSortDir): Tile[] {
  if (!sortBy) return tiles;
  const field = ({
    date_start: 'start_at',
    date_end: 'end_at',
    date_created: 'created_at',
    date_updated: 'updated_at',
  } as const)[sortBy];
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...tiles].sort((a, b) => {
    const va = (a as any)[field] as string | undefined;
    const vb = (b as any)[field] as string | undefined;
    // Nulls sort last regardless of direction
    if (!va && !vb) return 0;
    if (!va) return 1;
    if (!vb) return -1;
    return (new Date(va).getTime() - new Date(vb).getTime()) * dir;
  });
}

// ─── Filter label helper ───

function getFilterLabel(
  f: KanbanFilter,
  tags: Tag[],
  statuses: Status[],
  typeIcons: { id: string; name: string }[],
): string {
  switch (f.type) {
    case 'action_type':
      return ACTION_TYPE_LABELS[f.value] || f.value;
    case 'tag': {
      const tag = tags.find((t) => t.id === f.value);
      return tag?.name || 'Tag ?';
    }
    case 'completion':
      return f.value === 'completed' ? 'Done' : 'Undone';
    case 'status': {
      const st = statuses.find((s) => s.id === f.value);
      return st?.name || 'Status ?';
    }
    case 'type_icon': {
      const ti = typeIcons.find((s) => s.id === f.value);
      return ti?.name || 'Type ?';
    }
    case 'date_range': {
      const kind = dateRangeKind(f.value);
      if (kind === 'last') {
        const n = parseRelativeDays(f.value);
        return n ? `Ultimi ${n} gg` : 'Ultimi ? gg';
      }
      if (kind === 'next') {
        const n = parseRelativeDays(f.value);
        return n ? `Prossimi ${n} gg` : 'Prossimi ? gg';
      }
      const { from, to } = parseDateRange(f.value);
      if (from && to) return `${from} → ${to}`;
      if (from) return `dal ${from}`;
      if (to) return `al ${to}`;
      return 'Data';
    }
    default:
      return f.value;
  }
}

// ═══════════════════════════════════════════
// Main page
// ═══════════════════════════════════════════

export default function KanbanPage() {
  const queryClient = useQueryClient();
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();

  // Mirror sidebar's resolveIcon for a tag (uses its tag_type emoji/icon + color)
  const renderTagTypeIcon = useCallback((tagType: string, size = 13) => {
    const color = getTypeColor(tagType);
    const emoji = getTypeEmoji(tagType);
    if (emoji) {
      if (emoji.startsWith('Icon')) {
        const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
        if (Comp) return <Comp size={size} style={color ? { color } : undefined} />;
      }
      return <span style={{ fontSize: size - 2, color: color || undefined }}>{emoji}</span>;
    }
    return <span className="inline-block rounded-full" style={{ width: size - 5, height: size - 5, backgroundColor: color || FALLBACK_COLOR }} />;
  }, [getTypeColor, getTypeEmoji]);
  const actionColors = useActionColors();

  // Type icons store
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const fetchTypeIcons = useTypeIcons((s) => s.fetchAll);
  const typeIconsLoaded = useTypeIcons((s) => s.loaded);
  useEffect(() => { if (!typeIconsLoaded) fetchTypeIcons(); }, [typeIconsLoaded, fetchTypeIcons]);
  const getIconForTile = useCallback((tileId: string) => {
    const iconId = typeTileIcons[tileId];
    if (!iconId) return null;
    return typeIcons.find((i) => i.id === iconId) || null;
  }, [typeIcons, typeTileIcons]);

  // Statuses (for shape overlay on tiles). Resolve against the full list
  // (system + custom) because canonical system statuses drive the shape now.
  const { statuses: allStatuses, doneShape, getActionTypeShape } = useStatuses();
  const resolveShape = useCallback((tile: Tile): StatusShape => {
    if (tile.status_id) {
      const st = allStatuses.find((s) => s.id === tile.status_id);
      if (st) return st.shape as StatusShape;
    }
    if (tile.is_completed) return doneShape;
    return getActionTypeShape(tile.action_type || 'none');
  }, [allStatuses, doneShape, getActionTypeShape]);

  // ─── Data ───
  const { data: columnsData } = useQuery({
    queryKey: ['kanban-columns'],
    queryFn: () => kanbanApi.listColumns(),
  });
  const columns: KanbanColumn[] = useMemo(() => columnsData?.data || [], [columnsData]);

  const { data: tilesData } = useQuery({
    queryKey: ['tiles-kanban'],
    queryFn: () => tilesApi.list({ limit: 100 }),
  });
  const tiles: Tile[] = useMemo(() => (tilesData as any)?.data || [], [tilesData]);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });
  const tags: Tag[] = useMemo(() => (tagsData as any)?.data || [], [tagsData]);

  const { data: statusesData } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
  });
  const statuses: Status[] = useMemo(() => (statusesData as any)?.data || [], [statusesData]);

  // ─── Sidebar ───
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Tile helpers ───
  const getTagColor = useCallback((tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  }, [getTypeColor]);

  // ─── Column mutations ───
  const createColMutation = useMutation({
    mutationFn: (data: { title: string; filters?: KanbanFilter[] }) => kanbanApi.createColumn(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kanban-columns'] }); },
  });

  const updateColMutation = useMutation({
    mutationFn: (params: { id: string; updates: { title?: string; filters?: KanbanFilter[]; sort_order?: number; sort_by?: KanbanSortBy; sort_dir?: KanbanSortDir; width?: number; bg_color?: string | null } }) =>
      kanbanApi.updateColumn(params.id, params.updates),
    onMutate: ({ id, updates }) => {
      // Snapshot previous cache for potential rollback
      const previous = queryClient.getQueryData(['kanban-columns']);
      queryClient.setQueryData(['kanban-columns'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((c: KanbanColumn) => c.id === id ? { ...c, ...updates } : c) };
      });
      return { previous };
    },
    onSuccess: (res, _vars, ctx) => {
      // apiRequest resolves with { success: false, error } on non-2xx; don't invalidate
      // (would refetch stale data and revert optimistic update). Roll back instead.
      if (res && (res as any).success === false) {
        if (ctx?.previous !== undefined) {
          queryClient.setQueryData(['kanban-columns'], ctx.previous);
        }
        console.error('[kanban] updateColumn failed:', (res as any).error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['kanban-columns'] });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(['kanban-columns'], ctx.previous);
      }
    },
  });

  const deleteColMutation = useMutation({
    mutationFn: (id: string) => kanbanApi.deleteColumn(id),
    onMutate: (id) => {
      queryClient.setQueryData(['kanban-columns'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((c: KanbanColumn) => c.id !== id) };
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kanban-columns'] }); },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => kanbanApi.reorderColumns(items),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kanban-columns'] }); },
  });

  // ─── Tile update mutation ───
  const tileMutation = useMutation({
    mutationFn: (params: { id: string; updates: Record<string, unknown> }) =>
      tilesApi.update(params.id, params.updates as any),
    onMutate: ({ id, updates }) => {
      const patch = (t: Tile) => (t.id === id ? { ...t, ...updates } : t);
      queryClient.setQueryData(['tiles-kanban'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map(patch) };
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['kanban-columns'] });
    },
  });

  // ─── Column drag-and-drop ───
  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const onColDragStart = useCallback((e: React.DragEvent, colId: string) => {
    dragColRef.current = colId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-kanban-col', colId);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4';
  }, []);

  const onColDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '';
    dragColRef.current = null;
    setDragOverCol(null);
  }, []);

  const onColDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const sourceId = dragColRef.current;
    if (!sourceId || sourceId === targetId) return;
    const ordered = [...columns];
    const srcIdx = ordered.findIndex((c) => c.id === sourceId);
    const tgtIdx = ordered.findIndex((c) => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const [moved] = ordered.splice(srcIdx, 1);
    ordered.splice(tgtIdx, 0, moved);
    const items = ordered.map((c, i) => ({ id: c.id, sort_order: i }));
    // Optimistic
    queryClient.setQueryData(['kanban-columns'], (old: any) => {
      if (!old?.data) return old;
      const reordered = items.map((item) => {
        const col = old.data.find((c: KanbanColumn) => c.id === item.id);
        return col ? { ...col, sort_order: item.sort_order } : null;
      }).filter(Boolean);
      return { ...old, data: reordered };
    });
    reorderMutation.mutate(items);
  }, [columns, queryClient, reorderMutation]);

  // ─── Tile drag-and-drop between columns ───
  const dragTileRef = useRef<Tile | null>(null);
  const [dragOverTileCol, setDragOverTileCol] = useState<string | null>(null);

  const onTileDragStart = useCallback((e: React.DragEvent, tile: Tile) => {
    dragTileRef.current = tile;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-tile', tile.id);
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.4';
  }, []);

  const onTileDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '';
    dragTileRef.current = null;
    setDragOverTileCol(null);
  }, []);

  const onTileDrop = useCallback(async (e: React.DragEvent, targetCol: KanbanColumn) => {
    e.preventDefault();
    setDragOverTileCol(null);
    const tile = dragTileRef.current;
    if (!tile) return;

    // Build updates from target column filters
    const updates: Record<string, unknown> = {};
    for (const f of targetCol.filters) {
      switch (f.type) {
        case 'action_type':
          if (f.value === 'allday') {
            updates.action_type = 'event';
            updates.is_event = true;
            updates.all_day = true;
          } else if (f.value === 'event') {
            updates.action_type = 'event';
            updates.is_event = true;
            updates.all_day = false;
          } else if (f.value === 'deadline') {
            // Deadlines only use end_at — clear start_at + event flags
            updates.action_type = 'deadline';
            updates.is_event = false;
            updates.all_day = false;
            updates.start_at = null;
          } else if (f.value === 'none' || f.value === 'anytime') {
            // Unscheduled: clear every date/event field so stale values don't linger
            updates.action_type = f.value;
            updates.is_event = false;
            updates.all_day = false;
            updates.start_at = null;
            updates.end_at = null;
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
          // Tag changes need separate API call
          if (!tile.tags?.some((t) => t.id === f.value)) {
            await tagsApi.tagTiles(f.value, [tile.id]);
            queryClient.invalidateQueries({ queryKey: ['tiles-kanban'] });
          }
          break;
      }
    }

    if (Object.keys(updates).length > 0) {
      tileMutation.mutate({ id: tile.id, updates });
    }
  }, [tileMutation, queryClient]);

  // ─── Filter editor state ───
  const [filterEditorCol, setFilterEditorCol] = useState<string | null>(null);
  const [addFilterType, setAddFilterType] = useState<KanbanFilter['type'] | null>(null);
  const [sortEditorCol, setSortEditorCol] = useState<string | null>(null);

  // Close filter modal on Escape
  useEffect(() => {
    if (!filterEditorCol) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilterEditorCol(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filterEditorCol]);

  // ─── Inline column title editing ───
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  // ─── Delete confirm ───
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Column menu (three-dots) ───
  const [colMenu, setColMenu] = useState<{ x: number; y: number; colId: string } | null>(null);
  useEffect(() => {
    if (!colMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [colMenu]);

  // ─── Tile context menu ───
  const [tileCtxMenu, setTileCtxMenu] = useState<{ x: number; y: number; tileId: string } | null>(null);
  const [deleteTileConfirm, setDeleteTileConfirm] = useState<string | null>(null);

  // Close tile context menu on Escape
  useEffect(() => {
    if (!tileCtxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTileCtxMenu(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tileCtxMenu]);

  const deleteTileMutation = useMutation({
    mutationFn: (id: string) => tilesApi.delete(id),
    onMutate: (id) => {
      const previous = queryClient.getQueryData(['tiles-kanban']);
      queryClient.setQueryData(['tiles-kanban'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.filter((t: Tile) => t.id !== id) };
      });
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) queryClient.setQueryData(['tiles-kanban'], ctx.previous);
    },
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Kanban" />

      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex overflow-x-auto gap-4 p-4">
          {columns.map((col) => {
            const matched = tiles.filter((t) => tileMatchesFilters(t, col.filters, typeTileIcons));
            const colTiles = sortTiles(matched, col.sort_by ?? null, col.sort_dir ?? 'asc');
            const isEditing = editingTitle === col.id;
            const isFilterOpen = filterEditorCol === col.id;
            const isSortOpen = sortEditorCol === col.id;
            const colWidth = Math.max(1, col.width ?? 1);
            // width: N tiles + padding + gaps between them
            const colPxWidth = TILE_W * colWidth + 32 + Math.max(0, colWidth - 1) * 12;

            return (
              <div
                key={col.id}
                className={cn(
                  'shrink-0 flex flex-col rounded-xl border border-zinc-800 transition-all bg-zinc-900 overflow-hidden',
                  dragOverCol === col.id && 'ring-2 ring-blue-500/50',
                  dragOverTileCol === col.id && 'ring-2 ring-green-500/40',
                )}
                style={{ width: colPxWidth }}
                draggable
                onDragStart={(e) => {
                  // Only column drag if not from a tile
                  if (e.dataTransfer.types.includes('text/x-tile')) return;
                  onColDragStart(e, col.id);
                }}
                onDragEnd={onColDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (e.dataTransfer.types.includes('text/x-tile')) {
                    setDragOverTileCol(col.id);
                  } else {
                    setDragOverCol(col.id);
                  }
                }}
                onDragLeave={() => { setDragOverCol(null); setDragOverTileCol(null); }}
                onDrop={(e) => {
                  if (e.dataTransfer.types.includes('text/x-tile')) {
                    onTileDrop(e, col);
                  } else if (e.dataTransfer.types.includes('text/x-kanban-col')) {
                    onColDrop(e, col.id);
                  }
                }}
              >
                {/* Column header — single row: grip + title + count + menu */}
                <div
                  className="flex items-start gap-1 px-2 py-2 border-b border-zinc-800"
                  style={col.bg_color
                    ? { backgroundImage: `linear-gradient(${col.bg_color}4D, ${col.bg_color}4D)` }
                    : undefined}
                >
                  <IconGripVertical className="h-3 w-3 text-zinc-600 cursor-grab shrink-0 mt-0.5" />

                  {isEditing ? (
                    <input
                      autoFocus
                      className="flex-1 min-w-0 min-h-[26px] bg-transparent text-[11px] font-semibold text-white outline-none border-b border-blue-500"
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateColMutation.mutate({ id: col.id, updates: { title: titleDraft } });
                          setEditingTitle(null);
                        }
                        if (e.key === 'Escape') setEditingTitle(null);
                      }}
                      onBlur={() => {
                        if (titleDraft.trim()) {
                          updateColMutation.mutate({ id: col.id, updates: { title: titleDraft } });
                        }
                        setEditingTitle(null);
                      }}
                    />
                  ) : (
                    <span
                      className="flex-1 min-w-0 min-h-[26px] text-[11px] font-semibold leading-[13px] text-white cursor-pointer hover:text-zinc-300 break-words"
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      onClick={() => { setEditingTitle(col.id); setTitleDraft(col.title); }}
                    >
                      {col.title}
                    </span>
                  )}

                  <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 mt-0.5">{colTiles.length}</span>

                  <button
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setColMenu({ x: rect.right, y: rect.bottom, colId: col.id });
                    }}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
                    title="Opzioni colonna"
                  >
                    <IconDots className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Sort editor popover */}
                {isSortOpen && (
                  <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/80 space-y-2">
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Ordinamento</div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: null } })}
                        className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', !col.sort_by ? 'text-blue-400 bg-zinc-800/60' : 'text-zinc-300 hover:bg-zinc-800')}
                      >
                        Nessuno
                      </button>
                      {(Object.keys(SORT_BY_LABELS) as KanbanSortBy[]).filter((k): k is Exclude<KanbanSortBy, null> => !!k).map((key) => (
                        <button
                          key={key}
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: key } })}
                          className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', col.sort_by === key ? 'text-blue-400 bg-zinc-800/60' : 'text-zinc-300 hover:bg-zinc-800')}
                        >
                          {SORT_BY_LABELS[key]}
                        </button>
                      ))}
                    </div>
                    {col.sort_by && (
                      <div className="flex gap-1 pt-1 border-t border-zinc-800">
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_dir: 'asc' } })}
                          className={cn('flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-colors',
                            (col.sort_dir ?? 'asc') === 'asc' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700')}
                        >
                          <IconSortAscending className="h-3 w-3" /> Crescente
                        </button>
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_dir: 'desc' } })}
                          className={cn('flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] transition-colors',
                            col.sort_dir === 'desc' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700')}
                        >
                          <IconSortDescending className="h-3 w-3" /> Decrescente
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Filter + sort badges */}
                {(col.filters.length > 0 || col.sort_by) && (
                  <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-zinc-800/50">
                    {col.sort_by && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30">
                        {(col.sort_dir ?? 'asc') === 'desc'
                          ? <IconSortDescending className="h-2.5 w-2.5" />
                          : <IconSortAscending className="h-2.5 w-2.5" />}
                        <span className="uppercase tracking-wider">{SORT_BY_LABELS[col.sort_by]}</span>
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: null } })}
                          className="hover:text-red-400 ml-0.5"
                          title="Rimuovi ordinamento"
                        >
                          <IconX className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    )}
                    {col.filters.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                      >
                        <span className="text-zinc-500 uppercase">{FILTER_TYPE_LABELS[f.type]}:</span>
                        {getFilterLabel(f, tags, statuses, typeIcons)}
                        <button
                          onClick={() => {
                            const newFilters = col.filters.filter((_, j) => j !== i);
                            updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                          }}
                          className="hover:text-red-400 ml-0.5"
                        >
                          <IconX className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Filter editor is rendered as a modal portal at the end of the component */}

                {/* Tile list — grouped by day; full-width date header forces row break */}
                <div className="flex-1 overflow-y-auto p-3 flex flex-row flex-wrap justify-start content-start gap-y-2 gap-x-3">
                  {(() => {
                    const dateFieldFor = (t: Tile): string | null => {
                      switch (col.sort_by) {
                        case 'date_start': return t.start_at || null;
                        case 'date_end': return t.end_at || null;
                        case 'date_created': return t.created_at || null;
                        case 'date_updated': return t.updated_at || null;
                        // Default (no sort): mirror TileSidebar's "Date" field exactly.
                        // Deadlines read from end_at; everything else reads from start_at.
                        // No cross-field fallback — so the date shown in kanban headers is
                        // exactly the one surfaced by the sidebar.
                        default:
                          if (t.action_type === 'deadline') return t.end_at || null;
                          return t.start_at || null;
                      }
                    };
                    const nodes: React.ReactNode[] = [];
                    let lastKey: string | null | '___init' = '___init';
                    colTiles.forEach((t) => {
                      const iso = dateFieldFor(t);
                      const key = iso ? getDayKey(iso) : null;
                      if (key !== lastKey) {
                        const todayKey = getDayKey(new Date().toISOString());
                        const isToday = key !== null && key === todayKey;
                        nodes.push(
                          <div key={`hdr-${key ?? 'none'}-${nodes.length}`} className="w-full flex items-center gap-2 mt-2 first:mt-0">
                            <span className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-semibold uppercase tracking-wider',
                              isToday
                                ? 'bg-red-600 border-red-500 text-white'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-200',
                            )}>
                              {iso ? formatDay(iso) : 'Senza data'}
                            </span>
                            <span className="flex-1 h-px bg-zinc-800" />
                          </div>,
                        );
                        lastKey = key;
                      }
                      const tagColor = getTagColor(t);
                      const shape = resolveShape(t);
                      const si = getIconForTile(t.id);
                      // Prefer the first non-root tag (matches TileSidebar). The root
                      // (GIMMICK inbox) only surfaces if the tile has no other tag.
                      const rootTagId = tags.find((x) => x.is_root)?.id;
                      const tileTag = (t.tags || []).find((tg) => tg.id !== rootTagId) || t.tags?.[0];
                      const isSelected = selectedTileId === t.id;
                      // Mirror canvas tile style: background ← status color (tinted), border ← action_type
                      const actionKey = t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
                      // For NOTES, override to a visible gray so the pattern stands out.
                      const actionColor = actionKey === 'none' ? '#e4e4e7' : ((actionColors as Record<string, string>)[actionKey] || FALLBACK_COLOR);
                      const tileBg = si?.color ? `${si.color}80` : '#1C1C1E';
                      nodes.push(
                        <div
                          key={t.id}
                          draggable
                          data-tile-id={t.id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTileId(t.id);
                            setTileCtxMenu({ x: e.clientX, y: e.clientY, tileId: t.id });
                          }}
                        onDragStart={(e) => { e.stopPropagation(); onTileDragStart(e, t); }}
                        onDragEnd={onTileDragEnd}
                        onClick={() => { setSelectedTileId(t.id); setSidebarOpen(true); }}
                        className={cn(
                          'shrink-0 rounded overflow-hidden cursor-grab hover:brightness-110 transition-all',
                          selectedTileId === t.id && 'ring-2 ring-blue-500',
                        )}
                        style={{ backgroundColor: tileBg, width: TILE_W, height: TILE_H }}
                      >
                        <div className="relative h-full flex flex-col p-1.5">
                          <div className="flex-1 min-h-0 overflow-hidden">
                            <p
                              className="text-[11px] font-medium leading-[14px] text-[#D4D4D8]"
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}
                            >
                              {t.title || 'Senza titolo'}
                            </p>
                          </div>
                          {tileTag && (
                            <div className="flex items-center gap-1 mb-0.5 relative z-10">
                              <span className="shrink-0 flex items-center justify-center w-3">
                                {renderTagTypeIcon(tileTag.tag_type || '', 10)}
                              </span>
                              <span
                                className="text-[9px] truncate"
                                style={{ color: tagColor }}
                                title={tileTag.name}
                              >
                                {tileTag.name}
                              </span>
                            </div>
                          )}
                          <div className="mt-auto relative z-10">
                            {t.subtasks && t.subtasks.length > 0 && (
                              <div className="mb-2">
                                <ChecklistBar items={t.subtasks} availableWidth={TILE_W - 12} />
                              </div>
                            )}
                            <div className="flex items-end justify-between">
                              <ActionIconBadge actionKey={actionKey} color={actionColor} />
                              {si && <TypeIconBadge iconName={si.icon} color={si.color} />}
                            </div>
                          </div>
                          {shape !== 'solid' && (
                            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded">
                              <svg className="w-full h-full">
                                <InlineStatus shape={shape} color={actionColor} />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>,
                      );
                    });
                    return nodes;
                  })()}

                  {colTiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-600 w-full">
                      <span className="text-[11px]">Nessun tile</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add column button */}
          <button
            onClick={() => createColMutation.mutate({ title: 'Nuova colonna' })}
            className="shrink-0 h-20 flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors self-start mt-0 px-2"
            style={{ width: TILE_W + 32 }}
          >
            <IconPlus className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Aggiungi</span>
          </button>
        </div>

        {/* 5 — SIDEBAR DESTRA */}
        <TileSidebar
          tileId={selectedTileId}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          invalidateKeys={['tiles-kanban', 'kanban-columns', 'tags']}
        />
      </div>

      {/* ─── Filter modal ─── */}
      {filterEditorCol && (() => {
        const filterCol = columns.find((c) => c.id === filterEditorCol);
        if (!filterCol) return null;
        const section = addFilterType ?? 'action_type';
        const SECTIONS: KanbanFilterType[] = ['action_type', 'tag', 'completion', 'type_icon', 'status', 'date_range'];
        const countFor = (t: KanbanFilterType) => filterCol.filters.filter((f) => f.type === t).length;
        const clearSection = (t: KanbanFilterType) => {
          const newFilters = filterCol.filters.filter((f) => f.type !== t);
          updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
        };
        const renderSectionHeader = (t: KanbanFilterType, label: string) => (
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
            <div className="flex items-center gap-1.5">
              {countFor(t) > 0 && (
                <span className="text-[9px] font-medium bg-blue-500/20 text-blue-400 rounded-full px-1.5 py-0.5">{countFor(t)}</span>
              )}
              <button
                onClick={() => clearSection(t)}
                disabled={countFor(t) === 0}
                className={cn(
                  'p-0.5 rounded transition-colors',
                  countFor(t) > 0
                    ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800'
                    : 'text-zinc-700 cursor-not-allowed',
                )}
                title="Ripulisci filtri"
              >
                <IconX className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
        return createPortal(
          <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60"
            onClick={() => setFilterEditorCol(null)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-[95vw] max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <IconFilter className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white truncate">Filtri · {filterCol.title}</h3>
                </div>
                <button onClick={() => setFilterEditorCol(null)} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200">
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              {/* Body: 6 columns side by side, each a filter section */}
              <div className="flex-1 flex overflow-x-auto overflow-y-hidden">
                {/* Column 1 — Action */}
                <div className="shrink-0 w-44 flex flex-col border-r border-zinc-800">
                  {renderSectionHeader('action_type', 'Action')}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-1.5">
                  {ACTION_OPTIONS.map((opt) => {
                    const active = filterCol.filters.some((f) => f.type === 'action_type' && f.value === opt.value);
                    const borderKey = opt.value === 'allday' ? 'allday' : opt.value;
                    const clr = (actionColors as Record<string, string>)[borderKey] || FALLBACK_COLOR;
                    const cssBorder: React.CSSProperties = { border: `1.5px solid ${clr}` };
                    const OptIcon = opt.icon;
                    return (
                      <div key={opt.label} className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'action_type' && f.value === opt.value))
                              : [...filterCol.filters, { type: 'action_type' as const, value: opt.value }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          className={cn(
                            'flex items-center gap-1 py-1.5 px-2 rounded text-[9px] font-medium uppercase transition-all',
                            active ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
                          )}
                          style={{ width: TILE_W, ...cssBorder }}
                        >
                          <OptIcon size={11} className="shrink-0" />
                          <span className="flex-1 text-left truncate">{opt.label}</span>
                        </button>
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {active && <IconCheck size={15} strokeWidth={3} className="text-green-500" />}
                        </span>
                      </div>
                    );
                  })}

                  </div>
                </div>

                {/* Column 2 — Tag */}
                <div className="shrink-0 w-44 flex flex-col border-r border-zinc-800">
                  {renderSectionHeader('tag', 'Tag')}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-1.5">
                    {tags.filter((t) => !t.is_archived).map((tag) => {
                        const active = filterCol.filters.some((f) => f.type === 'tag' && f.value === tag.id);
                        return (
                          <div key={tag.id} className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                const newFilters = active
                                  ? filterCol.filters.filter((f) => !(f.type === 'tag' && f.value === tag.id))
                                  : [...filterCol.filters, { type: 'tag' as const, value: tag.id }];
                                updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                              }}
                              className={cn(
                                'flex items-center gap-2.5 px-2 py-1.5 rounded border text-xs transition-colors duration-150',
                                active ? 'bg-zinc-800 text-white font-medium border-zinc-600' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900 border-zinc-700/50',
                              )}
                              style={{ width: TILE_W }}
                              title={tag.name}
                            >
                              <span className="shrink-0 flex items-center justify-center w-3.5">
                                {renderTagTypeIcon(tag.tag_type || '', 11)}
                              </span>
                              <span className="flex-1 text-left truncate">{tag.name}</span>
                            </button>
                            <span className="w-4 flex items-center justify-center shrink-0">
                              {active && <IconCheck size={15} strokeWidth={3} className="text-green-500" />}
                            </span>
                          </div>
                        );
                      })}
                    {tags.filter((t) => !t.is_archived).length === 0 && (
                      <span className="text-[11px] text-zinc-500">Nessun tag</span>
                    )}
                  </div>
                </div>

                {/* Column 3 — Done/Undone */}
                <div className="shrink-0 w-44 flex flex-col border-r border-zinc-800">
                  {renderSectionHeader('completion', 'Done/Undone')}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-1.5">
                  {STATUS_OPTIONS.map(({ value, label }) => {
                    const active = filterCol.filters.some((f) => f.type === 'completion' && f.value === value);
                    return (
                      <div key={value} className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'completion' && f.value === value))
                              : [...filterCol.filters, { type: 'completion' as const, value }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          className={cn(
                            'flex items-center gap-1.5 pl-1.5 py-1.5 rounded border text-xs transition-colors duration-150',
                            active ? 'bg-zinc-800 text-white font-medium border-zinc-600' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900 border-zinc-700/50',
                          )}
                          style={{ width: TILE_W }}
                        >
                          {value === 'completed' ? <IconCheck size={11} className="shrink-0 text-zinc-400" /> : <span className="inline-block w-[11px] h-[11px] rounded-full border border-zinc-500 shrink-0" />}
                          <span className="flex-1 text-left truncate">{label}</span>
                        </button>
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {active && <IconCheck size={15} strokeWidth={3} className="text-green-500" />}
                        </span>
                      </div>
                    );
                  })}

                  </div>
                </div>

                {/* Column 4 — Type */}
                <div className="shrink-0 w-44 flex flex-col border-r border-zinc-800">
                  {renderSectionHeader('type_icon', 'Type')}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-1.5">
                  {typeIcons.map((si) => {
                    const active = filterCol.filters.some((f) => f.type === 'type_icon' && f.value === si.id);
                    const Ico = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>>)[si.icon] || IconCheck;
                    return (
                      <div key={si.id} className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'type_icon' && f.value === si.id))
                              : [...filterCol.filters, { type: 'type_icon' as const, value: si.id }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          className={cn(
                            'flex items-center gap-1.5 pl-1.5 py-1.5 rounded border text-xs transition-colors duration-150',
                            active ? 'bg-zinc-800 text-white font-medium border-zinc-600' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900 border-zinc-700/50',
                          )}
                          style={{ width: TILE_W }}
                          title={si.name}
                        >
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                            style={{ backgroundColor: si.color || '#27272A' }}
                          >
                            <Ico size={12} className="text-white" />
                          </div>
                          <span className="flex-1 text-left truncate">{si.name}</span>
                        </button>
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {active && <IconCheck size={15} strokeWidth={3} className="text-green-500" />}
                        </span>
                      </div>
                    );
                  })}
                  {typeIcons.length === 0 && (
                    <span className="text-[11px] text-zinc-500">Nessun tipo</span>
                  )}
                  </div>
                </div>

                {/* Column 5 — Status */}
                <div className="shrink-0 w-44 flex flex-col border-r border-zinc-800">
                  {renderSectionHeader('status', 'Status')}
                  <div className="flex-1 overflow-y-auto p-3 flex flex-col items-center gap-1.5">
                  {statuses.filter((s) => s.category === 'custom').map((st) => {
                    const active = filterCol.filters.some((f) => f.type === 'status' && f.value === st.id);
                    const stColor = st.action_type ? (actionColors[st.action_type as ActionType] || FALLBACK_COLOR) : FALLBACK_COLOR;
                    return (
                      <div key={st.id} className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'status' && f.value === st.id))
                              : [...filterCol.filters, { type: 'status' as const, value: st.id }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          className={cn(
                            'relative overflow-hidden flex items-center px-2 py-1.5 rounded border text-xs transition-colors duration-150',
                            active ? 'bg-zinc-800 text-white font-medium border-zinc-600' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900 border-zinc-700/50',
                          )}
                          style={{ width: TILE_W }}
                          title={st.name}
                        >
                          <span className="absolute inset-0 pointer-events-none">
                            <svg className="w-full h-full">
                              <InlineStatus shape={st.shape} color={stColor} />
                            </svg>
                          </span>
                          <span className="relative z-10 flex-1 text-left truncate">{st.name}</span>
                        </button>
                        <span className="w-4 flex items-center justify-center shrink-0">
                          {active && <IconCheck size={15} strokeWidth={3} className="text-green-500" />}
                        </span>
                      </div>
                    );
                  })}
                  {statuses.filter((s) => s.category === 'custom').length === 0 && (
                    <span className="text-[11px] text-zinc-500">Nessuno status</span>
                  )}
                  </div>
                </div>

                {/* Column 6 — Data */}
                <div className="shrink-0 w-56 flex flex-col">
                  {renderSectionHeader('date_range', 'Data')}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {(() => {
                    // Find existing rules (one of each kind at most)
                    const absRule = filterCol.filters.find((f) => f.type === 'date_range' && dateRangeKind(f.value) === 'absolute');
                    const lastRule = filterCol.filters.find((f) => f.type === 'date_range' && dateRangeKind(f.value) === 'last');
                    const nextRule = filterCol.filters.find((f) => f.type === 'date_range' && dateRangeKind(f.value) === 'next');
                    const { from: curFrom, to: curTo } = absRule ? parseDateRange(absRule.value) : { from: '', to: '' };
                    const curLast = lastRule ? parseRelativeDays(lastRule.value) : null;
                    const curNext = nextRule ? parseRelativeDays(nextRule.value) : null;

                    const replaceRule = (kind: 'absolute' | 'last' | 'next', newValue: string | null) => {
                      const others = filterCol.filters.filter((f) => !(f.type === 'date_range' && dateRangeKind(f.value) === kind));
                      const newFilters = newValue === null ? others : [...others, { type: 'date_range' as const, value: newValue }];
                      updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                    };

                    return (
                      <>
                        {/* Absolute range */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Intervallo</span>
                            {(curFrom || curTo) && (
                              <button
                                onClick={() => replaceRule('absolute', null)}
                                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                                title="Rimuovi"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="w-8 shrink-0">Dal</span>
                            <input
                              type="date"
                              value={curFrom}
                              onChange={(e) => {
                                const from = e.target.value; const to = curTo;
                                replaceRule('absolute', (!from && !to) ? null : formatDateRange(from, to));
                              }}
                              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="w-8 shrink-0">Al</span>
                            <input
                              type="date"
                              value={curTo}
                              onChange={(e) => {
                                const from = curFrom; const to = e.target.value;
                                replaceRule('absolute', (!from && !to) ? null : formatDateRange(from, to));
                              }}
                              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                            />
                          </label>
                        </div>

                        {/* Ultimi N giorni */}
                        <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Ultimi giorni</span>
                            {curLast !== null && (
                              <button
                                onClick={() => replaceRule('last', null)}
                                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                                title="Rimuovi"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <DaysInput
                              value={curLast}
                              onChange={(n) => replaceRule('last', n === null ? null : `last:${n}`)}
                            />
                            <span className="text-xs text-zinc-400">giorni fa</span>
                          </div>
                        </div>

                        {/* Prossimi N giorni */}
                        <div className="space-y-1.5 pt-2 border-t border-zinc-800">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Prossimi giorni</span>
                            {curNext !== null && (
                              <button
                                onClick={() => replaceRule('next', null)}
                                className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
                                title="Rimuovi"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <DaysInput
                              value={curNext}
                              onChange={(n) => replaceRule('next', n === null ? null : `next:${n}`)}
                            />
                            <span className="text-xs text-zinc-400">giorni</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-zinc-600 leading-tight pt-1 border-t border-zinc-800">
                          Riferimento: start_at → end_at → created_at. Più regole della data = OR fra loro.
                        </p>
                      </>
                    );
                  })()}
                  </div>
                </div>
              </div>

              {/* Footer — AND/OR logic hint */}
              <div className="px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-500 shrink-0">
                Stesso tipo = <span className="text-zinc-300">OR</span> · Tipi diversi = <span className="text-zinc-300">AND</span>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Column options menu (three-dots) */}
      {colMenu && (() => {
        const menuCol = columns.find((c) => c.id === colMenu.colId);
        if (!menuCol) return null;
        const menuWidth = Math.max(1, menuCol.width ?? 1);
        return createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setColMenu(null)} onContextMenu={(e) => { e.preventDefault(); setColMenu(null); }} />
            <div
              className="fixed bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 w-56 z-[9999]"
              style={{ top: Math.min(colMenu.y + 4, window.innerHeight - 360), left: Math.min(colMenu.x - 224, window.innerWidth - 240) }}
            >
              <button
                onClick={() => {
                  setColMenu(null);
                  setFilterEditorCol(menuCol.id);
                  setAddFilterType((prev) => prev ?? 'action_type');
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <IconFilter className={cn('h-3.5 w-3.5', menuCol.filters.length > 0 ? 'text-blue-400' : 'text-zinc-500')} />
                Filtri
                {menuCol.filters.length > 0 && (
                  <span className="ml-auto text-[9px] bg-blue-500/20 text-blue-400 rounded-full px-1.5 py-0.5">{menuCol.filters.length}</span>
                )}
              </button>
              <button
                onClick={() => {
                  setColMenu(null);
                  setSortEditorCol(menuCol.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                {menuCol.sort_by ? (
                  (menuCol.sort_dir ?? 'asc') === 'desc'
                    ? <IconSortDescending className="h-3.5 w-3.5 text-blue-400" />
                    : <IconSortAscending className="h-3.5 w-3.5 text-blue-400" />
                ) : (
                  <IconArrowsSort className="h-3.5 w-3.5 text-zinc-500" />
                )}
                Ordinamento
                {menuCol.sort_by && (
                  <span className="ml-auto text-[9px] text-blue-400">{SORT_BY_LABELS[menuCol.sort_by]}</span>
                )}
              </button>

              <div className="my-1 border-t border-zinc-800" />

              <button
                onClick={() => {
                  const next = Math.min(10, menuWidth + 1);
                  if (next !== menuWidth) updateColMutation.mutate({ id: menuCol.id, updates: { width: next } });
                }}
                disabled={menuWidth >= 10}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                <IconPlus className="h-3.5 w-3.5 text-zinc-500" />
                Aumenta colonna
                <span className="ml-auto text-[9px] text-zinc-500 tabular-nums">{menuWidth}×</span>
              </button>
              <button
                onClick={() => {
                  const next = Math.max(1, menuWidth - 1);
                  if (next !== menuWidth) updateColMutation.mutate({ id: menuCol.id, updates: { width: next } });
                }}
                disabled={menuWidth <= 1}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
              >
                <IconMinus className="h-3.5 w-3.5 text-zinc-500" />
                Diminuisci colonna
              </button>

              <div className="my-1 border-t border-zinc-800" />

              <div className="px-3 py-1.5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Colore sfondo</div>
                <ColorPickerGrid
                  selectedColor={menuCol.bg_color ?? null}
                  onSelect={(hex) => updateColMutation.mutate({ id: menuCol.id, updates: { bg_color: hex } })}
                  size={24}
                  cols={6}
                  gap={4}
                  showReset
                />
              </div>

              <div className="my-1 border-t border-zinc-800" />

              <button
                onClick={() => {
                  setColMenu(null);
                  setDeleteConfirm(menuCol.id);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
              >
                <IconTrash className="h-3.5 w-3.5" />
                Elimina colonna
              </button>
            </div>
          </>,
          document.body
        );
      })()}

      {/* Tile context menu */}
      {tileCtxMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setTileCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setTileCtxMenu(null); }} />
          <div
            className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 w-40 z-[9999]"
            style={{ top: tileCtxMenu.y, left: tileCtxMenu.x }}
          >
            <button
              onClick={() => {
                setDeleteTileConfirm(tileCtxMenu.tileId);
                setTileCtxMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-950/30 transition-colors"
            >
              <IconTrash className="h-3.5 w-3.5" />
              Elimina tile
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Tile delete confirm portal */}
      {deleteTileConfirm && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60" onClick={() => setDeleteTileConfirm(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-2">Elimina tile</h3>
            <p className="text-xs text-zinc-400 mb-4">Il tile e tutti i suoi spark verranno eliminati. Azione non reversibile.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTileConfirm(null)} className="px-3 py-1.5 rounded text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors">Annulla</button>
              <button
                onClick={() => {
                  deleteTileMutation.mutate(deleteTileConfirm);
                  if (selectedTileId === deleteTileConfirm) setSelectedTileId(null);
                  setDeleteTileConfirm(null);
                }}
                className="px-3 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm portal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 w-72 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-2">Elimina colonna</h3>
            <p className="text-xs text-zinc-400 mb-4">La colonna verrà eliminata. I tile non vengono toccati.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 rounded text-xs text-zinc-400 border border-zinc-700 hover:bg-zinc-800 transition-colors">Annulla</button>
              <button
                onClick={() => { deleteColMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
                className="px-3 py-1.5 rounded text-xs text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
