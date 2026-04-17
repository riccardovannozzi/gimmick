'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  IconPlus,
  IconTrash,
  IconFilter,
  IconGripVertical,
  IconX,
  IconCheck,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconCalendar,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { kanbanApi, tilesApi, tagsApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatusIcons } from '@/store/status-icons-store';
import { cn } from '@/lib/utils';
import type { Tile, Tag, KanbanColumn, KanbanFilter, KanbanFilterType, KanbanSortBy, KanbanSortDir, Pattern, ActionType } from '@/types';

const FALLBACK_COLOR = '#94A3B8';

const ACTION_TYPE_LABELS: Record<string, string> = {
  none: 'Notes',
  anytime: 'To Do',
  deadline: 'Deadline',
  event: 'Event',
};

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
  status: 'Done/Undone',
  pattern: 'Pattern',
  status_icon: 'Status',
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

// ─── Filter matching: OR within same type, AND across types ───

function tileMatchesFilters(
  tile: Tile,
  filters: KanbanFilter[],
  statusTileIcons: Record<string, string>,
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
          return tile.action_type === f.value;
        case 'tag':
          return tile.tags?.some((t) => t.id === f.value) ?? false;
        case 'status':
          return f.value === 'completed' ? !!tile.is_completed : !tile.is_completed;
        case 'pattern':
          return tile.pattern_id === f.value;
        case 'status_icon':
          return statusTileIcons[tile.id] === f.value;
        case 'date_range': {
          const { from, to } = parseDateRange(f.value);
          const d = tileDateForRange(tile);
          if (!d) return false;
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
  patterns: Pattern[],
  statusIcons: { id: string; name: string }[],
): string {
  switch (f.type) {
    case 'action_type':
      return ACTION_TYPE_LABELS[f.value] || f.value;
    case 'tag': {
      const tag = tags.find((t) => t.id === f.value);
      return tag?.name || 'Tag ?';
    }
    case 'status':
      return f.value === 'completed' ? 'Done' : 'Undone';
    case 'pattern': {
      const pat = patterns.find((p) => p.id === f.value);
      return pat?.name || 'Pattern ?';
    }
    case 'status_icon': {
      const si = statusIcons.find((s) => s.id === f.value);
      return si?.name || 'Status ?';
    }
    case 'date_range': {
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
  const { getColor: getTypeColor } = useTagTypes();
  const actionColors = useActionColors();

  // Status icons store
  const statusIcons = useStatusIcons((s) => s.icons);
  const statusTileIcons = useStatusIcons((s) => s.tileIcons);
  const fetchStatusIcons = useStatusIcons((s) => s.fetchAll);
  const statusIconsLoaded = useStatusIcons((s) => s.loaded);
  useEffect(() => { if (!statusIconsLoaded) fetchStatusIcons(); }, [statusIconsLoaded, fetchStatusIcons]);

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

  const { data: patternsData } = useQuery({
    queryKey: ['patterns'],
  });
  const patterns: Pattern[] = useMemo(() => (patternsData as any)?.data || [], [patternsData]);

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
    mutationFn: (params: { id: string; updates: { title?: string; filters?: KanbanFilter[]; sort_order?: number; sort_by?: KanbanSortBy; sort_dir?: KanbanSortDir } }) =>
      kanbanApi.updateColumn(params.id, params.updates),
    onMutate: ({ id, updates }) => {
      queryClient.setQueryData(['kanban-columns'], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((c: KanbanColumn) => c.id === id ? { ...c, ...updates } : c) };
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['kanban-columns'] }); },
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
          updates.action_type = f.value;
          if (f.value === 'event') { updates.is_event = true; }
          else if (f.value === 'none' || f.value === 'anytime') { updates.is_event = false; }
          break;
        case 'status':
          updates.is_completed = f.value === 'completed';
          break;
        case 'pattern':
          updates.pattern_id = f.value;
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

  // ─── Inline column title editing ───
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  // ─── Delete confirm ───
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      <Header title="Kanban" />

      <div className="flex flex-1 overflow-hidden">
        {/* Board */}
        <div className="flex-1 flex overflow-x-auto gap-3 p-4">
          {columns.map((col) => {
            const matched = tiles.filter((t) => tileMatchesFilters(t, col.filters, statusTileIcons));
            const colTiles = sortTiles(matched, col.sort_by ?? null, col.sort_dir ?? 'asc');
            const isEditing = editingTitle === col.id;
            const isFilterOpen = filterEditorCol === col.id;
            const isSortOpen = sortEditorCol === col.id;

            return (
              <div
                key={col.id}
                className={cn(
                  'shrink-0 w-72 flex flex-col bg-zinc-900 rounded-xl border border-zinc-800 transition-all',
                  dragOverCol === col.id && 'ring-2 ring-blue-500/50',
                  dragOverTileCol === col.id && 'ring-2 ring-green-500/40',
                )}
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
                {/* Column header */}
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-zinc-800">
                  <IconGripVertical className="h-3.5 w-3.5 text-zinc-600 cursor-grab shrink-0" />

                  {isEditing ? (
                    <input
                      autoFocus
                      className="flex-1 bg-transparent text-sm font-semibold text-white outline-none border-b border-blue-500"
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
                      className="flex-1 text-sm font-semibold text-white truncate cursor-pointer hover:text-zinc-300"
                      onClick={() => { setEditingTitle(col.id); setTitleDraft(col.title); }}
                    >
                      {col.title}
                    </span>
                  )}

                  <span className="text-[10px] text-zinc-500 tabular-nums">{colTiles.length}</span>

                  {/* Sort toggle */}
                  <button
                    onClick={() => setSortEditorCol(isSortOpen ? null : col.id)}
                    className={cn(
                      'p-1 rounded hover:bg-zinc-800 transition-colors',
                      col.sort_by ? 'text-blue-400' : 'text-zinc-500',
                    )}
                    title="Ordinamento"
                  >
                    {col.sort_by ? (
                      col.sort_dir === 'desc' ? <IconSortDescending className="h-3.5 w-3.5" /> : <IconSortAscending className="h-3.5 w-3.5" />
                    ) : (
                      <IconArrowsSort className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {/* Filter button */}
                  <button
                    onClick={() => setFilterEditorCol(isFilterOpen ? null : col.id)}
                    className={cn(
                      'p-1 rounded hover:bg-zinc-800 transition-colors',
                      col.filters.length > 0 ? 'text-blue-400' : 'text-zinc-500',
                    )}
                    title="Filtri"
                  >
                    <IconFilter className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteConfirm(col.id)}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <IconTrash className="h-3.5 w-3.5" />
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

                {/* Filter badges */}
                {col.filters.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-3 py-1.5 border-b border-zinc-800/50">
                    {col.filters.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                      >
                        <span className="text-zinc-500 uppercase">{FILTER_TYPE_LABELS[f.type]}:</span>
                        {getFilterLabel(f, tags, patterns, statusIcons)}
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

                {/* Filter editor popover */}
                {isFilterOpen && (
                  <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/80 space-y-2">
                    <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                      Aggiungi filtro · <span className="text-zinc-600 normal-case font-normal">combinazioni: stesso tipo = OR, tipi diversi = AND</span>
                    </div>

                    {!addFilterType ? (
                      <div className="flex flex-wrap gap-1">
                        {(['action_type', 'tag', 'status', 'status_icon', 'pattern', 'date_range'] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setAddFilterType(type)}
                            className="px-2 py-1 rounded text-[10px] bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition-colors"
                          >
                            {FILTER_TYPE_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-zinc-400 font-medium">{FILTER_TYPE_LABELS[addFilterType]}</span>
                          <button onClick={() => setAddFilterType(null)} className="ml-auto text-zinc-500 hover:text-zinc-300">
                            <IconX className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                          {addFilterType === 'action_type' &&
                            Object.entries(ACTION_TYPE_LABELS).map(([val, label]) => {
                              const active = col.filters.some((f) => f.type === 'action_type' && f.value === val);
                              return (
                                <button
                                  key={val}
                                  onClick={() => {
                                    if (active) return;
                                    const newFilters = [...col.filters, { type: 'action_type' as const, value: val }];
                                    updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                                  }}
                                  className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', active ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800')}
                                  style={{ borderLeft: `3px solid ${actionColors[val as ActionType] || FALLBACK_COLOR}` }}
                                  disabled={active}
                                >
                                  {label} {active && <span className="text-zinc-600">✓</span>}
                                </button>
                              );
                            })}

                          {addFilterType === 'tag' &&
                            tags.filter((t) => !t.is_root && !t.is_archived).map((tag) => {
                              const active = col.filters.some((f) => f.type === 'tag' && f.value === tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    if (active) return;
                                    const newFilters = [...col.filters, { type: 'tag' as const, value: tag.id }];
                                    updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                                  }}
                                  className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', active ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800')}
                                  disabled={active}
                                >
                                  {tag.name} {active && <span className="text-zinc-600">✓</span>}
                                </button>
                              );
                            })}

                          {addFilterType === 'status' &&
                            STATUS_OPTIONS.map(({ value, label }) => {
                              const active = col.filters.some((f) => f.type === 'status' && f.value === value);
                              return (
                                <button
                                  key={value}
                                  onClick={() => {
                                    if (active) return;
                                    const newFilters = [...col.filters, { type: 'status' as const, value }];
                                    updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                                  }}
                                  className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', active ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800')}
                                  disabled={active}
                                >
                                  {label} {active && <span className="text-zinc-600">✓</span>}
                                </button>
                              );
                            })}

                          {addFilterType === 'status_icon' && statusIcons.map((si) => {
                            const active = col.filters.some((f) => f.type === 'status_icon' && f.value === si.id);
                            const Ico = (TablerIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[si.icon] || IconCheck;
                            return (
                              <button
                                key={si.id}
                                onClick={() => {
                                  if (active) return;
                                  const newFilters = [...col.filters, { type: 'status_icon' as const, value: si.id }];
                                  updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                                }}
                                className={cn('flex items-center gap-1.5 text-left px-2 py-1 rounded text-[11px] transition-colors', active ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800')}
                                disabled={active}
                              >
                                <Ico className="h-3.5 w-3.5" />
                                {si.name} {active && <span className="text-zinc-600">✓</span>}
                              </button>
                            );
                          })}

                          {addFilterType === 'status_icon' && statusIcons.length === 0 && (
                            <span className="text-[10px] text-zinc-500 px-2 py-1">Nessuno status disponibile</span>
                          )}

                          {addFilterType === 'pattern' &&
                            patterns.filter((p) => p.category === 'custom').map((pat) => {
                              const active = col.filters.some((f) => f.type === 'pattern' && f.value === pat.id);
                              return (
                                <button
                                  key={pat.id}
                                  onClick={() => {
                                    if (active) return;
                                    const newFilters = [...col.filters, { type: 'pattern' as const, value: pat.id }];
                                    updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                                  }}
                                  className={cn('text-left px-2 py-1 rounded text-[11px] transition-colors', active ? 'text-zinc-600' : 'text-zinc-300 hover:bg-zinc-800')}
                                  disabled={active}
                                >
                                  {pat.name} {active && <span className="text-zinc-600">✓</span>}
                                </button>
                              );
                            })}

                          {addFilterType === 'pattern' && patterns.filter((p) => p.category === 'custom').length === 0 && (
                            <span className="text-[10px] text-zinc-500 px-2 py-1">Nessun pattern custom</span>
                          )}

                          {addFilterType === 'date_range' && (() => {
                            const existing = col.filters.find((f) => f.type === 'date_range');
                            const { from: curFrom, to: curTo } = existing ? parseDateRange(existing.value) : { from: '', to: '' };
                            const apply = (from: string, to: string) => {
                              const others = col.filters.filter((f) => f.type !== 'date_range');
                              const newFilters = (!from && !to)
                                ? others
                                : [...others, { type: 'date_range' as const, value: formatDateRange(from, to) }];
                              updateColMutation.mutate({ id: col.id, updates: { filters: newFilters } });
                            };
                            return (
                              <div className="space-y-1.5 px-1 py-1">
                                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                  <span className="w-8">Dal</span>
                                  <input
                                    type="date"
                                    value={curFrom}
                                    onChange={(e) => apply(e.target.value, curTo)}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-[11px] text-zinc-200"
                                  />
                                </label>
                                <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                  <span className="w-8">Al</span>
                                  <input
                                    type="date"
                                    value={curTo}
                                    onChange={(e) => apply(curFrom, e.target.value)}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-[11px] text-zinc-200"
                                  />
                                </label>
                                {(curFrom || curTo) && (
                                  <button
                                    onClick={() => apply('', '')}
                                    className="w-full text-[10px] text-red-400 hover:bg-red-950/30 rounded px-2 py-1 transition-colors"
                                  >
                                    Rimuovi intervallo
                                  </button>
                                )}
                                <p className="text-[9px] text-zinc-600 leading-tight pt-1">
                                  Filtra per data dell&apos;evento (start_at → end_at → created_at).
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tile list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {colTiles.map((t) => {
                    const color = getTagColor(t);
                    const tagName = t.tags?.[0]?.name;
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); onTileDragStart(e, t); }}
                        onDragEnd={onTileDragEnd}
                        onClick={() => { setSelectedTileId(t.id); setSidebarOpen(true); }}
                        className={cn(
                          'rounded-lg p-2.5 cursor-grab hover:brightness-110 transition-all border',
                          selectedTileId === t.id && 'ring-2 ring-blue-500',
                          t.is_completed && 'opacity-50',
                        )}
                        style={{ backgroundColor: '#1C1C1E', borderColor: `${color}40` }}
                      >
                        <p className={cn(
                          'text-[12px] font-medium leading-[16px] text-[#D4D4D8]',
                          t.is_completed && 'line-through',
                        )} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                          {t.title || 'Senza titolo'}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          {tagName && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full border" style={{ color, borderColor: `${color}40` }}>
                              {tagName}
                            </span>
                          )}
                          {t.action_type && t.action_type !== 'none' && (
                            <span
                              className="text-[8px] uppercase font-semibold px-1 py-0.5 rounded"
                              style={{ color: actionColors[t.action_type as ActionType] || FALLBACK_COLOR }}
                            >
                              {ACTION_TYPE_LABELS[t.action_type] || t.action_type}
                            </span>
                          )}
                          {t.is_completed && <IconCheck className="h-3 w-3 text-green-500 ml-auto" />}
                        </div>
                      </div>
                    );
                  })}

                  {colTiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
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
            className="shrink-0 w-72 h-20 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 transition-colors self-start mt-0"
          >
            <IconPlus className="h-4 w-4" />
            <span className="text-sm font-medium">Aggiungi colonna</span>
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
