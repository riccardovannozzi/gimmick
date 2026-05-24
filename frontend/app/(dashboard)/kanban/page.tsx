'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  IconChevronDown,
  IconChevronRight,
  IconLayoutGrid,
  IconRoute,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { usePixelTheme } from '@/components/pixel';
import { pixelToolbarBtn } from '@/lib/pixel-toolbar';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { kanbanApi, tilesApi, tagsApi, statusesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useStatuses } from '@/store/statuses-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import { useFlowOpenRequest } from '@/lib/hooks/useFlowOpenRequest';
import { cn } from '@/lib/utils';
import { formatDay, getDayKey } from '@/lib/tile-helpers';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';
import { readableOn } from '@/lib/palette';
import { ChecklistBar } from '@/components/tileview/ChecklistBar';
import { StatusPattern } from '@/components/statuses/status-pattern';
import { ActionBadge } from '@/components/actions/action-badge';
import type { Tile, Tag, KanbanColumn, KanbanFilter, KanbanFilterType, KanbanSortBy, KanbanSortDir, Status, ActionType, StatusShape } from '@/types';

const FALLBACK_COLOR = '#94A3B8';
// Canvas tile dimensions (shared with CanvasBoard + calendar columns)
const TILE_W = 130;
const TILE_H = 90;

// Pixel-styled confirm dialog used for tile + column delete.
type ConfirmTheme = {
  surface: string; surfaceVariant: string; border: string; ink: string; ink2: string; ink3: string;
  shadowOffset: number; shadowColor: string;
};

function ConfirmDialog({
  title,
  body,
  onCancel,
  onConfirm,
  theme,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  onConfirm: () => void;
  theme: ConfirmTheme;
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          width: 320,
          color: theme.ink,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '10px 14px',
            background: theme.surfaceVariant,
            borderBottom: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: theme.ink,
          }}
        >
          {title}
        </div>
        <div style={{ padding: 14, fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2 }}>{body}</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: 12,
            borderTop: `2px solid ${theme.border}`,
            background: theme.surfaceVariant,
          }}
        >
          <button
            onClick={onCancel}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 12px',
              background: theme.surface,
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
            onClick={onConfirm}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 12px',
              background: '#E24B4A',
              color: '#FFFFFF',
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            Elimina
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Shared tile visual helpers (mirror of calendar page) ───

// Rounded-square badge with the type icon inside (background = type color, white icon).
function TypeIconBadge({ iconName, color }: { iconName: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div style={{ width: 16, height: 16, background: bg, border: '2px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Comp size={10} color={readableOn(bg)} />
    </div>
  );
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
  const theme = usePixelTheme();
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
      style={{
        width: 64,
        background: theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        padding: '6px 8px',
        color: theme.ink,
        fontFamily: 'var(--font-pixel-body)',
        fontSize: 12,
        outline: 'none',
      }}
    />
  );
}

// ─── Filter matching: OR within same type, AND across types ───

function tileMatchesFilters(
  tile: Tile,
  filters: KanbanFilter[],
  typeTileIcons: Record<string, string>,
  doneStatusId: string | undefined,
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
        case 'completion': {
          const done = !!doneStatusId && tile.status_id === doneStatusId;
          return f.value === 'completed' ? done : !done;
        }
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
  const theme = usePixelTheme();
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
  const { statuses: allStatuses, doneStatusId, getActionTypeShape } = useStatuses();
  const tilesWithFlows = useTilesWithFlows();
  const openFlow = useFlowOpenStore((s) => s.open);
  const resolveShape = useCallback((tile: Tile): StatusShape => {
    if (tile.status_id) {
      const st = allStatuses.find((s) => s.id === tile.status_id);
      if (st) return st.shape as StatusShape;
    }
    return getActionTypeShape(tile.action_type || 'none');
  }, [allStatuses, getActionTypeShape]);

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
  // Subscribes to the global FLOW-badge signal — see useFlowOpenRequest.
  const forceFlowTab = useFlowOpenRequest(setSelectedTileId, (open) => setSidebarOpen(open));

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
          // Setting/clearing the canonical 'done' status. If the system status
          // hasn't loaded yet, skip silently to avoid wiping the field.
          if (doneStatusId) {
            updates.status_id = f.value === 'completed' ? doneStatusId : null;
          }
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

  // ─── Expanded filter rows per column ───
  const [expandedFilterCols, setExpandedFilterCols] = useState<Set<string>>(new Set());

  // ─── Auto-scroll each column to "today" once tiles load ───
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    if (tiles.length === 0) return;
    didAutoScrollRef.current = true;
    // Wait one frame so the DOM has the rendered date rows.
    requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('[data-col-list]').forEach((c) => {
        const today = c.querySelector<HTMLElement>('[data-today-row="true"]');
        if (!today) return;
        const cRect = c.getBoundingClientRect();
        const tRect = today.getBoundingClientRect();
        c.scrollTop += tRect.top - cRect.top - 12;
      });
    });
  }, [tiles]);

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

  const handleAddTile = useCallback(async () => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      const newTile = (res as { data?: Tile })?.data;
      if (newTile) {
        const rootTag = tags.find((t) => t.is_root);
        if (rootTag) {
          await tagsApi.tagTiles(rootTag.id, [newTile.id]);
        }
        await queryClient.invalidateQueries({ queryKey: ['tiles-kanban'] });
        await queryClient.invalidateQueries({ queryKey: ['tags'] });
        setSelectedTileId(newTile.id);
        setSidebarOpen(true);
      }
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tags]);

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

  const toolbarBtn: React.CSSProperties = pixelToolbarBtn(theme, false);

  return (
    <div className="flex flex-col h-full" style={{ background: theme.bg1 }}>
      <Header title="Kanban" />

      <div className="flex flex-1 overflow-hidden">
        {/* Board column: toolbar + columns */}
        <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="shrink-0"
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px',
            borderBottom: `2px solid ${theme.border}`,
            background: theme.bg2,
          }}
        >
          <button onClick={handleAddTile} className="px-press" style={toolbarBtn} title="Aggiungi tile">
            <IconLayoutGrid size={12} />
            Tile
          </button>
          <button onClick={() => createColMutation.mutate({ title: 'Nuova colonna' })} className="px-press" style={toolbarBtn} title="Aggiungi colonna">
            <IconPlus size={12} />
            Colonna
          </button>
          <button
            onClick={() => {
              document.querySelectorAll<HTMLElement>('[data-col-list]').forEach((c) => {
                const today = c.querySelector<HTMLElement>('[data-today-row="true"]');
                if (!today) return;
                const cRect = c.getBoundingClientRect();
                const tRect = today.getBoundingClientRect();
                c.scrollTo({ top: c.scrollTop + (tRect.top - cRect.top) - 12, behavior: 'smooth' });
              });
            }}
            className="px-press"
            style={toolbarBtn}
            title="Scorri tutte le colonne fino a oggi"
          >
            <IconCalendarEvent size={12} />
            Oggi
          </button>
        </div>
        {/* Columns */}
        <div
          className="flex-1"
          style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 12,
            padding: '8px 12px 12px',
            background: theme.bg1,
          }}
        >
          {columns.map((col) => {
            const matched = tiles.filter((t) => tileMatchesFilters(t, col.filters, typeTileIcons, doneStatusId));
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
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  background: theme.bg2,
                  border: `2px solid ${theme.border}`,
                  overflow: 'hidden',
                  width: colPxWidth,
                  outline: dragOverCol === col.id
                    ? `2px solid ${theme.accent}`
                    : dragOverTileCol === col.id
                      ? `2px dashed ${theme.accent}`
                      : 'none',
                  outlineOffset: -2,
                }}
                draggable
                onDragStart={(e) => {
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
                {/* Column header */}
                <div
                  style={{
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 8px',
                    background: col.bg_color ? `${col.bg_color}4D` : theme.surfaceVariant,
                    borderBottom: `2px solid ${theme.border}`,
                  }}
                >
                  <IconGripVertical size={12} style={{ color: theme.ink3, cursor: 'grab', flexShrink: 0 }} />

                  {isEditing ? (
                    <input
                      autoFocus
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        color: theme.ink,
                        outline: 'none',
                        border: 'none',
                        borderBottom: `2px solid ${theme.accent}`,
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 8,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
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
                      onClick={() => { setEditingTitle(col.id); setTitleDraft(col.title); }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        color: theme.ink,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 8,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.title}
                    </span>
                  )}

                  {(col.filters.length > 0 || col.sort_by) && (
                    <button
                      onClick={() => {
                        setExpandedFilterCols((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.id)) next.delete(col.id);
                          else next.add(col.id);
                          return next;
                        });
                      }}
                      style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, flexShrink: 0 }}
                      title={expandedFilterCols.has(col.id) ? 'Nascondi filtri' : 'Mostra filtri'}
                    >
                      {expandedFilterCols.has(col.id)
                        ? <IconChevronDown size={14} />
                        : <IconChevronRight size={14} />}
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setColMenu({ x: rect.right, y: rect.bottom, colId: col.id });
                    }}
                    style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2, flexShrink: 0 }}
                    title="Opzioni colonna"
                  >
                    <IconDots size={14} />
                  </button>
                </div>

                {/* Sort editor popover */}
                {isSortOpen && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderBottom: `2px solid ${theme.border}`,
                      background: theme.surface,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: theme.ink3,
                      }}
                    >
                      Ordinamento
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: null } })}
                        style={{
                          textAlign: 'left',
                          padding: '4px 8px',
                          fontFamily: 'var(--font-pixel-body)',
                          fontSize: 11,
                          background: !col.sort_by ? theme.surfaceVariant : 'transparent',
                          border: `2px solid ${!col.sort_by ? theme.border : 'transparent'}`,
                          color: !col.sort_by ? theme.ink : theme.ink2,
                          cursor: 'pointer',
                        }}
                      >
                        Nessuno
                      </button>
                      {(Object.keys(SORT_BY_LABELS) as KanbanSortBy[]).filter((k): k is Exclude<KanbanSortBy, null> => !!k).map((key) => (
                        <button
                          key={key}
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: key } })}
                          style={{
                            textAlign: 'left',
                            padding: '4px 8px',
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 11,
                            background: col.sort_by === key ? theme.surfaceVariant : 'transparent',
                            border: `2px solid ${col.sort_by === key ? theme.border : 'transparent'}`,
                            color: col.sort_by === key ? theme.ink : theme.ink2,
                            cursor: 'pointer',
                          }}
                        >
                          {SORT_BY_LABELS[key]}
                        </button>
                      ))}
                    </div>
                    {col.sort_by && (
                      <div style={{ display: 'flex', gap: 4, paddingTop: 6, borderTop: `2px solid ${theme.border}` }}>
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_dir: 'asc' } })}
                          style={{
                            flex: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            background: (col.sort_dir ?? 'asc') === 'asc' ? theme.accent : theme.surfaceVariant,
                            color: (col.sort_dir ?? 'asc') === 'asc' ? theme.onAccent : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          <IconSortAscending size={11} /> Crescente
                        </button>
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_dir: 'desc' } })}
                          style={{
                            flex: 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            background: col.sort_dir === 'desc' ? theme.accent : theme.surfaceVariant,
                            color: col.sort_dir === 'desc' ? theme.onAccent : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          <IconSortDescending size={11} /> Decrescente
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Filter + sort chips */}
                {(col.filters.length > 0 || col.sort_by) && expandedFilterCols.has(col.id) && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      padding: '6px 12px',
                      borderBottom: `2px solid ${theme.border}`,
                    }}
                  >
                    {col.sort_by && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          background: theme.accent,
                          color: theme.onAccent,
                          border: `2px solid ${theme.border}`,
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {(col.sort_dir ?? 'asc') === 'desc'
                          ? <IconSortDescending size={10} />
                          : <IconSortAscending size={10} />}
                        <span>{SORT_BY_LABELS[col.sort_by]}</span>
                        <button
                          onClick={() => updateColMutation.mutate({ id: col.id, updates: { sort_by: null } })}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.onAccent, display: 'inline-flex', padding: 0, marginLeft: 2 }}
                          title="Rimuovi ordinamento"
                        >
                          <IconX size={10} />
                        </button>
                      </span>
                    )}
                    {col.filters.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 6px',
                          background: theme.surfaceVariant,
                          color: theme.ink2,
                          border: `2px solid ${theme.border}`,
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <span style={{ color: theme.ink3 }}>{FILTER_TYPE_LABELS[f.type]}:</span>
                        <span>{getFilterLabel(f, tags, statuses, typeIcons)}</span>
                        <button
                          onClick={() => {
                            const newFilters = col.filters.filter((_, j) => j !== i);
                            updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                          }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink3, display: 'inline-flex', padding: 0, marginLeft: 2 }}
                        >
                          <IconX size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Filter editor is rendered as a modal portal at the end of the component */}

                {/* Tile list — grouped by day */}
                <div
                  data-col-list={col.id}
                  className="[&::-webkit-scrollbar-thumb]:bg-[var(--px-border)] [&::-webkit-scrollbar-thumb:hover]:bg-[var(--px-accent)]"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                    alignContent: 'flex-start',
                    rowGap: 8,
                    columnGap: 12,
                  }}
                >
                  {(() => {
                    const dateFieldFor = (t: Tile): string | null => {
                      switch (col.sort_by) {
                        case 'date_start': return t.start_at || null;
                        case 'date_end': return t.end_at || null;
                        case 'date_created': return t.created_at || null;
                        case 'date_updated': return t.updated_at || null;
                        // Default (no sort): mirror TileSidebar's "Date" field exactly.
                        // Deadlines read from end_at then fall back to start_at;
                        // everything else reads from start_at.
                        default:
                          if (t.action_type === 'deadline') return t.end_at || t.start_at || null;
                          return t.start_at || null;
                      }
                    };
                    const nodes: React.ReactNode[] = [];
                    let lastKey: string | null | '___init' = '___init';
                    const todayKey = getDayKey(new Date().toISOString());
                    const sortDir = col.sort_dir ?? 'asc';
                    let insertedToday = false;
                    const pushTodayHeader = () => {
                      if (insertedToday) return;
                      nodes.push(
                        <div
                          key={`hdr-today-empty-${nodes.length}`}
                          data-today-row="true"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: nodes.length === 0 ? 0 : 8 }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 6px',
                              background: theme.accent,
                              color: theme.onAccent,
                              border: `2px solid ${theme.border}`,
                              fontFamily: 'var(--font-pixel-head)',
                              fontSize: 7,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDay(new Date().toISOString())}
                          </span>
                        </div>,
                      );
                      insertedToday = true;
                    };
                    colTiles.forEach((t) => {
                      const iso = dateFieldFor(t);
                      const key = iso ? getDayKey(iso) : null;
                      // Insert "today" header lazily when we cross it without finding it.
                      // Skip null-date tiles (group "Senza data") for the comparison.
                      if (!insertedToday && key !== null) {
                        const past = sortDir === 'asc' ? key > todayKey : key < todayKey;
                        if (past) pushTodayHeader();
                      }
                      if (key !== lastKey) {
                        const isToday = key !== null && key === todayKey;
                        if (isToday) insertedToday = true;
                        nodes.push(
                          <div
                            key={`hdr-${key ?? 'none'}-${nodes.length}`}
                            data-today-row={isToday ? 'true' : undefined}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginTop: nodes.length === 0 ? 0 : 8 }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 6px',
                                background: isToday ? theme.accent : theme.surfaceVariant,
                                color: isToday ? theme.onAccent : theme.ink2,
                                border: `2px solid ${theme.border}`,
                                fontFamily: 'var(--font-pixel-head)',
                                fontSize: 7,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {iso ? formatDay(iso) : 'Senza data'}
                            </span>
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
                      const tileBg = si?.color ? `${si.color}CC` : theme.surface;
                      nodes.push(
                        <div key={t.id} style={{ position: 'relative', flexShrink: 0, width: TILE_W }}>
                        <div
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
                          style={{
                            flexShrink: 0,
                            overflow: 'hidden',
                            cursor: 'grab',
                            background: tileBg,
                            width: TILE_W,
                            height: TILE_H,
                            border: actionKey === 'deadline' ? '2px dashed #E24B4A' : `2px solid ${theme.border}`,
                            boxShadow: selectedTileId === t.id ? `0 0 0 3px ${theme.accent}` : 'none',
                          }}
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
                          {tileTag && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, position: 'relative', zIndex: 10 }}>
                              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12 }}>
                                {renderTagTypeIcon(tileTag.tag_type || '', 10)}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--font-pixel-head)',
                                  fontSize: 8,
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color: readableOn(tileBg),
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={tileTag.name}
                              >
                                {tileTag.name}
                              </span>
                            </div>
                          )}
                          <div style={{ marginTop: 'auto', position: 'relative', zIndex: 10 }}>
                            {t.subtasks && t.subtasks.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <ChecklistBar items={t.subtasks} availableWidth={TILE_W - 12} />
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
                          <StatusPattern shape={shape} color={actionColor} bg={tileBg} />
                        </div>
                      </div>
                      {/* FLOW badge — pixel chip floating past the tile's top-right corner */}
                      {tilesWithFlows.has(t.id) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openFlow(t.id); }}
                          onContextMenu={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
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
                        >FLOW</button>
                      )}
                      </div>,
                      );
                    });
                    // If we never found nor inserted "today" (e.g. all tiles are
                    // earlier than today in asc, or all later in desc, or only
                    // unscheduled tiles), append it at the end so the row is
                    // always visible.
                    if (!insertedToday) pushTodayHeader();
                    return nodes;
                  })()}

                  {colTiles.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', color: theme.ink3, width: '100%' }}>
                      <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nessun tile</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
        </div>

        {/* 5 — SIDEBAR DESTRA */}
        <TileSidebar
          tileId={selectedTileId}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          invalidateKeys={['tiles-kanban', 'kanban-columns', 'tags']}
          forceFlowTab={forceFlowTab}
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
          <div
            style={{
              padding: '8px 12px',
              borderBottom: `2px solid ${theme.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              background: theme.surfaceVariant,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
              }}
            >
              {label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {countFor(t) > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    background: theme.accent,
                    color: theme.onAccent,
                    border: `2px solid ${theme.border}`,
                    padding: '1px 6px',
                  }}
                >
                  {countFor(t)}
                </span>
              )}
              <button
                onClick={() => clearSection(t)}
                disabled={countFor(t) === 0}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: countFor(t) > 0 ? 'pointer' : 'not-allowed',
                  color: countFor(t) > 0 ? theme.ink2 : theme.ink3,
                  display: 'inline-flex',
                  padding: 0,
                }}
                title="Ripulisci filtri"
              >
                <IconX size={12} />
              </button>
            </div>
          </div>
        );
        return createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
            }}
            onClick={() => setFilterEditorCol(null)}
          >
            <div
              style={{
                background: theme.surface,
                border: `2px solid ${theme.border}`,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                maxWidth: '95vw',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                color: theme.ink,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderBottom: `2px solid ${theme.border}`,
                  flexShrink: 0,
                  background: theme.surfaceVariant,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <IconFilter size={14} style={{ color: theme.accent, flexShrink: 0 }} />
                  <h3
                    style={{
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: theme.ink,
                      margin: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Filtri · {filterCol.title}
                  </h3>
                </div>
                <button
                  onClick={() => setFilterEditorCol(null)}
                  style={{ display: 'inline-flex', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.ink2 }}
                >
                  <IconX size={16} />
                </button>
              </div>

              {/* Body: 6 sections side by side */}
              <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden' }}>
                {/* Column 1 — Action */}
                <div style={{ flexShrink: 0, width: 176, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${theme.border}` }}>
                  {renderSectionHeader('action_type', 'Action')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {ACTION_OPTIONS.map((opt) => {
                    const active = filterCol.filters.some((f) => f.type === 'action_type' && f.value === opt.value);
                    const borderKey = opt.value === 'allday' ? 'allday' : opt.value;
                    const clr = (actionColors as Record<string, string>)[borderKey] || FALLBACK_COLOR;
                    const OptIcon = opt.icon;
                    return (
                      <div key={opt.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'action_type' && f.value === opt.value))
                              : [...filterCol.filters, { type: 'action_type' as const, value: opt.value }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          style={{
                            width: TILE_W,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 8px',
                            background: active ? theme.surfaceVariant : 'transparent',
                            color: active ? theme.ink : theme.ink2,
                            border: `2px solid ${clr}`,
                            fontFamily: 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                          }}
                        >
                          <OptIcon size={11} />
                          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                        </button>
                        <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <IconCheck size={14} strokeWidth={3} style={{ color: theme.accent }} />}
                        </span>
                      </div>
                    );
                  })}
                  </div>
                </div>

                {/* Column 2 — Tag */}
                <div style={{ flexShrink: 0, width: 176, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${theme.border}` }}>
                  {renderSectionHeader('tag', 'Tag')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {tags.filter((t) => !t.is_archived).map((tag) => {
                        const active = filterCol.filters.some((f) => f.type === 'tag' && f.value === tag.id);
                        return (
                          <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              onClick={() => {
                                const newFilters = active
                                  ? filterCol.filters.filter((f) => !(f.type === 'tag' && f.value === tag.id))
                                  : [...filterCol.filters, { type: 'tag' as const, value: tag.id }];
                                updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                              }}
                              style={{
                                width: TILE_W,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 8px',
                                background: active ? theme.surfaceVariant : 'transparent',
                                color: active ? theme.ink : theme.ink2,
                                border: `2px solid ${theme.border}`,
                                fontFamily: 'var(--font-pixel-body)',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                              title={tag.name}
                            >
                              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14 }}>
                                {renderTagTypeIcon(tag.tag_type || '', 11)}
                              </span>
                              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                            </button>
                            <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {active && <IconCheck size={14} strokeWidth={3} style={{ color: theme.accent }} />}
                            </span>
                          </div>
                        );
                      })}
                    {tags.filter((t) => !t.is_archived).length === 0 && (
                      <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>Nessun tag</span>
                    )}
                  </div>
                </div>

                {/* Column 3 — Done/Undone */}
                <div style={{ flexShrink: 0, width: 176, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${theme.border}` }}>
                  {renderSectionHeader('completion', 'Done/Undone')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {STATUS_OPTIONS.map(({ value, label }) => {
                    const active = filterCol.filters.some((f) => f.type === 'completion' && f.value === value);
                    return (
                      <div key={value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'completion' && f.value === value))
                              : [...filterCol.filters, { type: 'completion' as const, value }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          style={{
                            width: TILE_W,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 8px',
                            background: active ? theme.surfaceVariant : 'transparent',
                            color: active ? theme.ink : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {value === 'completed'
                            ? <IconCheck size={11} style={{ color: theme.ink2, flexShrink: 0 }} />
                            : <span style={{ display: 'inline-block', width: 11, height: 11, border: `2px solid ${theme.ink3}`, flexShrink: 0 }} />}
                          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        </button>
                        <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <IconCheck size={14} strokeWidth={3} style={{ color: theme.accent }} />}
                        </span>
                      </div>
                    );
                  })}
                  </div>
                </div>

                {/* Column 4 — Type */}
                <div style={{ flexShrink: 0, width: 176, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${theme.border}` }}>
                  {renderSectionHeader('type_icon', 'Type')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {typeIcons.map((si) => {
                    const active = filterCol.filters.some((f) => f.type === 'type_icon' && f.value === si.id);
                    const Ico = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>>)[si.icon] || IconCheck;
                    return (
                      <div key={si.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'type_icon' && f.value === si.id))
                              : [...filterCol.filters, { type: 'type_icon' as const, value: si.id }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          style={{
                            width: TILE_W,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 8px',
                            background: active ? theme.surfaceVariant : 'transparent',
                            color: active ? theme.ink : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          title={si.name}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              background: si.color || theme.surfaceVariant,
                              border: `2px solid ${theme.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Ico size={11} style={{ color: readableOn(si.color || theme.surfaceVariant) }} />
                          </div>
                          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{si.name}</span>
                        </button>
                        <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <IconCheck size={14} strokeWidth={3} style={{ color: theme.accent }} />}
                        </span>
                      </div>
                    );
                  })}
                  {typeIcons.length === 0 && (
                    <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>Nessun tipo</span>
                  )}
                  </div>
                </div>

                {/* Column 5 — Status */}
                <div style={{ flexShrink: 0, width: 176, display: 'flex', flexDirection: 'column', borderRight: `2px solid ${theme.border}` }}>
                  {renderSectionHeader('status', 'Status')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {statuses.map((st) => {
                    const active = filterCol.filters.some((f) => f.type === 'status' && f.value === st.id);
                    const stColor = st.action_type ? (actionColors[st.action_type as ActionType] || FALLBACK_COLOR) : FALLBACK_COLOR;
                    return (
                      <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => {
                            const newFilters = active
                              ? filterCol.filters.filter((f) => !(f.type === 'status' && f.value === st.id))
                              : [...filterCol.filters, { type: 'status' as const, value: st.id }];
                            updateColMutation.mutate({ id: filterCol.id, updates: { filters: newFilters } });
                          }}
                          style={{
                            width: TILE_W,
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            background: active ? theme.surfaceVariant : 'transparent',
                            color: active ? theme.ink : theme.ink2,
                            border: `2px solid ${theme.border}`,
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                          title={st.name}
                        >
                          <StatusPattern shape={st.shape as StatusShape} color={stColor} bg={active ? theme.surfaceVariant : theme.bg2} />
                          <span style={{ position: 'relative', zIndex: 10, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                        </button>
                        <span style={{ width: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {active && <IconCheck size={14} strokeWidth={3} style={{ color: theme.accent }} />}
                        </span>
                      </div>
                    );
                  })}
                  {statuses.length === 0 && (
                    <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>Nessuno status</span>
                  )}
                  </div>
                </div>

                {/* Column 6 — Data */}
                <div style={{ flexShrink: 0, width: 224, display: 'flex', flexDirection: 'column' }}>
                  {renderSectionHeader('date_range', 'Data')}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
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

                    const sectionLabel: React.CSSProperties = {
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: theme.ink3,
                    };
                    const dateInputStyle: React.CSSProperties = {
                      flex: 1,
                      minWidth: 0,
                      background: theme.surfaceVariant,
                      border: `2px solid ${theme.border}`,
                      padding: '6px 8px',
                      color: theme.ink,
                      fontFamily: 'var(--font-pixel-body)',
                      fontSize: 12,
                      outline: 'none',
                      colorScheme: 'dark',
                    };
                    const rowLabel: React.CSSProperties = {
                      width: 32,
                      flexShrink: 0,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: theme.ink3,
                    };
                    const xBtn: React.CSSProperties = {
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#E24B4A',
                      display: 'inline-flex',
                      padding: 0,
                    };
                    return (
                      <>
                        {/* Absolute range */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={sectionLabel}>Intervallo</span>
                            {(curFrom || curTo) && (
                              <button onClick={() => replaceRule('absolute', null)} style={xBtn} title="Rimuovi">
                                <IconX size={12} />
                              </button>
                            )}
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={rowLabel}>Dal</span>
                            <input
                              type="date"
                              value={curFrom}
                              onChange={(e) => {
                                const from = e.target.value; const to = curTo;
                                replaceRule('absolute', (!from && !to) ? null : formatDateRange(from, to));
                              }}
                              style={dateInputStyle}
                            />
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={rowLabel}>Al</span>
                            <input
                              type="date"
                              value={curTo}
                              onChange={(e) => {
                                const from = curFrom; const to = e.target.value;
                                replaceRule('absolute', (!from && !to) ? null : formatDateRange(from, to));
                              }}
                              style={dateInputStyle}
                            />
                          </label>
                        </div>

                        {/* Ultimi N giorni */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: `2px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={sectionLabel}>Ultimi giorni</span>
                            {curLast !== null && (
                              <button onClick={() => replaceRule('last', null)} style={xBtn} title="Rimuovi">
                                <IconX size={12} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DaysInput
                              value={curLast}
                              onChange={(n) => replaceRule('last', n === null ? null : `last:${n}`)}
                            />
                            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2 }}>giorni fa</span>
                          </div>
                        </div>

                        {/* Prossimi N giorni */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: `2px solid ${theme.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={sectionLabel}>Prossimi giorni</span>
                            {curNext !== null && (
                              <button onClick={() => replaceRule('next', null)} style={xBtn} title="Rimuovi">
                                <IconX size={12} />
                              </button>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DaysInput
                              value={curNext}
                              onChange={(n) => replaceRule('next', n === null ? null : `next:${n}`)}
                            />
                            <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2 }}>giorni</span>
                          </div>
                        </div>

                        <p
                          style={{
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 10,
                            color: theme.ink3,
                            lineHeight: 1.3,
                            paddingTop: 8,
                            borderTop: `2px solid ${theme.border}`,
                            margin: 0,
                          }}
                        >
                          Riferimento: start_at → end_at → created_at. Più regole della data = OR fra loro.
                        </p>
                      </>
                    );
                  })()}
                  </div>
                </div>
              </div>

              {/* Footer — AND/OR hint */}
              <div
                style={{
                  padding: '8px 14px',
                  borderTop: `2px solid ${theme.border}`,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  color: theme.ink3,
                  flexShrink: 0,
                  background: theme.surfaceVariant,
                }}
              >
                Stesso tipo = <span style={{ color: theme.accent }}>OR</span> · Tipi diversi = <span style={{ color: theme.accent }}>AND</span>
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
        const menuItem: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          height: 30,
          padding: '0 12px',
          textAlign: 'left',
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink2,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        };
        return createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setColMenu(null)} onContextMenu={(e) => { e.preventDefault(); setColMenu(null); }} />
            <div
              className="fixed"
              style={{
                top: Math.min(colMenu.y + 4, window.innerHeight - 360),
                left: Math.min(colMenu.x - 320, window.innerWidth - 336),
                zIndex: 9999,
                width: 320,
                background: theme.surface,
                border: `2px solid ${theme.border}`,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                padding: 4,
              }}
            >
              <button
                onClick={() => {
                  setColMenu(null);
                  setFilterEditorCol(menuCol.id);
                  setAddFilterType((prev) => prev ?? 'action_type');
                }}
                style={menuItem}
              >
                <IconFilter size={14} style={{ color: menuCol.filters.length > 0 ? theme.accent : theme.ink3 }} />
                Filtri
                {menuCol.filters.length > 0 && (
                  <span style={{ marginLeft: 'auto', padding: '1px 5px', background: theme.accent, color: theme.onAccent, border: `2px solid ${theme.border}`, fontSize: 9 }}>
                    {menuCol.filters.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setColMenu(null);
                  setSortEditorCol(menuCol.id);
                }}
                style={menuItem}
              >
                {menuCol.sort_by ? (
                  (menuCol.sort_dir ?? 'asc') === 'desc'
                    ? <IconSortDescending size={14} style={{ color: theme.accent }} />
                    : <IconSortAscending size={14} style={{ color: theme.accent }} />
                ) : (
                  <IconArrowsSort size={14} style={{ color: theme.ink3 }} />
                )}
                Ordinamento
                {menuCol.sort_by && (
                  <span style={{ marginLeft: 'auto', color: theme.accent, fontSize: 9 }}>{SORT_BY_LABELS[menuCol.sort_by]}</span>
                )}
              </button>

              <div style={{ margin: '4px 0', borderTop: `2px solid ${theme.border}` }} />

              <button
                onClick={() => {
                  const next = Math.min(10, menuWidth + 1);
                  if (next !== menuWidth) updateColMutation.mutate({ id: menuCol.id, updates: { width: next } });
                }}
                disabled={menuWidth >= 10}
                style={{ ...menuItem, cursor: menuWidth >= 10 ? 'not-allowed' : 'pointer', color: menuWidth >= 10 ? theme.ink3 : theme.ink2 }}
              >
                <IconPlus size={14} style={{ color: theme.ink3 }} />
                Aumenta colonna
                <span style={{ marginLeft: 'auto', color: theme.ink3, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{menuWidth}×</span>
              </button>
              <button
                onClick={() => {
                  const next = Math.max(1, menuWidth - 1);
                  if (next !== menuWidth) updateColMutation.mutate({ id: menuCol.id, updates: { width: next } });
                }}
                disabled={menuWidth <= 1}
                style={{ ...menuItem, cursor: menuWidth <= 1 ? 'not-allowed' : 'pointer', color: menuWidth <= 1 ? theme.ink3 : theme.ink2 }}
              >
                <IconMinus size={14} style={{ color: theme.ink3 }} />
                Diminuisci colonna
              </button>

              <div style={{ margin: '4px 0', borderTop: `2px solid ${theme.border}` }} />

              <div style={{ padding: '6px 12px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: theme.ink3,
                    marginBottom: 6,
                  }}
                >
                  Colore sfondo
                </div>
                <ColorPickerGrid
                  selectedColor={menuCol.bg_color ?? null}
                  onSelect={(hex) => updateColMutation.mutate({ id: menuCol.id, updates: { bg_color: hex } })}
                  showReset
                />
              </div>

              <div style={{ margin: '4px 0', borderTop: `2px solid ${theme.border}` }} />

              <button
                onClick={() => {
                  setColMenu(null);
                  setDeleteConfirm(menuCol.id);
                }}
                style={{ ...menuItem, color: '#E24B4A' }}
              >
                <IconTrash size={14} />
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
            className="fixed"
            style={{
              top: tileCtxMenu.y,
              left: tileCtxMenu.x,
              zIndex: 9999,
              width: 168,
              background: theme.surface,
              border: `2px solid ${theme.border}`,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              padding: 4,
            }}
          >
            <button
              onClick={() => {
                const id = tileCtxMenu.tileId;
                setTileCtxMenu(null);
                openFlow(id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: theme.ink2,
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 12,
              }}
            >
              <IconRoute size={14} />
              Apri Flow
            </button>
            <button
              onClick={() => {
                setDeleteTileConfirm(tileCtxMenu.tileId);
                setTileCtxMenu(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#E24B4A',
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 12,
              }}
            >
              <IconTrash size={14} />
              Elimina tile
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Tile delete confirm portal */}
      {deleteTileConfirm && (
        <ConfirmDialog
          title="Elimina tile"
          body="Il tile e tutti i suoi spark verranno eliminati. Azione non reversibile."
          onCancel={() => setDeleteTileConfirm(null)}
          onConfirm={() => {
            deleteTileMutation.mutate(deleteTileConfirm);
            if (selectedTileId === deleteTileConfirm) setSelectedTileId(null);
            setDeleteTileConfirm(null);
          }}
          theme={theme}
        />
      )}

      {/* Column delete confirm portal */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Elimina colonna"
          body="La colonna verrà eliminata. I tile non vengono toccati."
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => { deleteColMutation.mutate(deleteConfirm); setDeleteConfirm(null); }}
          theme={theme}
        />
      )}
    </div>
  );
}
