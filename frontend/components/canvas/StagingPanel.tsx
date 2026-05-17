'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as TablerIcons from '@tabler/icons-react';
import {
  IconBolt,
  IconArrowUp,
  IconClock,
  IconCalendar,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconArrowNarrowUp,
  IconArrowNarrowDown,
  IconChevronDown,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { readableOn } from '@/lib/palette';
import { useTypeIcons } from '@/store/type-icons-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import type { Tile } from '@/types';

interface Props {
  /** Tiles belonging to the current tag that are NOT yet positioned on the
   *  canvas (no entry in canvas_layout). Drag them into the canvas to place. */
  tiles: Tile[];
  /** Element ref forwarded out — the canvas page uses it for hit-testing
   *  when a canvas tile is dragged back here. */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** True while a canvas-side tile is being dragged. The panel highlights
   *  itself as a drop target. */
  isCanvasDragActive?: boolean;
  /** Whether the panel is currently the active drop target (mouse inside). */
  isDropTargetHover?: boolean;
  /** Currently selected tile (drives the staging card highlight). */
  selectedTileId?: string | null;
  /** Click handler — opens the tile in the right sidebar. */
  onTileClick?: (tileId: string) => void;
  /** Panel width in pixels. Driven by the parent's resize handle so the
   *  splitter between staging and canvas can be dragged. */
  width?: number;
  /** When false, panel collapses to a thin strip with only an expand button
   *  (mirrors the right TileSidebar's collapse behavior). */
  open?: boolean;
  /** Called when the user clicks the collapse/expand chevron. */
  onToggle?: () => void;
}

// Match CanvasBoard's TILE_W / TILE_H exactly so a tile reads at the same
// scale whether it's on the canvas or in staging.
const TILE_W = 130;
const TILE_H = 90;
const FALLBACK_COLOR = '#94A3B8';

/** Map action types (and special 'allday') → icon component. Mirrors the
 *  Kanban/canvas vocabulary. NOTES (none) renders no badge. */
const ACTION_ICON: Record<string, typeof IconBolt | null> = {
  none: null,
  anytime: IconArrowUp,
  deadline: IconBolt,
  event: IconClock,
  allday: IconCalendar,
};

type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'action' | 'date' | 'tag' | 'type' | 'status';

const SORT_LS_KEY = 'staging_sort_dir';
const GROUP_LS_KEY = 'staging_group_by';

// Section ordering when grouping by action — high-priority actions first
// so deadlines/events bubble to the top of the list.
const ACTION_GROUP_ORDER: Record<string, number> = {
  deadline: 0,
  event: 1,
  allday: 2,
  anytime: 3,
  none: 4,
};
const ACTION_GROUP_LABEL: Record<string, string> = {
  deadline: 'Deadline',
  event: 'Evento',
  allday: 'Tutto il giorno',
  anytime: 'Anytime',
  none: 'Note',
};

// Display label for the group-by selector trigger + each menu item.
const GROUP_LABEL: Record<GroupBy, string> = {
  none: 'Nessun gruppo',
  action: 'Action',
  date: 'Data',
  tag: 'Tag',
  type: 'Tipo',
  status: 'Status',
};
const GROUP_OPTIONS: GroupBy[] = ['none', 'action', 'date', 'tag', 'type', 'status'];

interface Group {
  key: string;
  label: string;
  tiles: Tile[];
  order: number;
}

// Bucket a date into a sort-friendly section. Uses local-midnight comparisons
// so "Oggi" / "Domani" snap to calendar days, and "questa/prossima settimana"
// extend to the upcoming Sunday boundary.
function dateBucket(iso: string | undefined): { key: string; label: string; order: number } {
  if (!iso) return { key: 'nodate', label: 'Senza data', order: 99 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: 'nodate', label: 'Senza data', order: 99 };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayOfWeek = today.getDay(); // 0 = Sun
  const daysToSunday = (7 - dayOfWeek) % 7 || 7;
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + daysToSunday);
  const nextWeekEnd = new Date(weekEnd); nextWeekEnd.setDate(weekEnd.getDate() + 7);
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = dDate.getTime();
  if (t < today.getTime()) return { key: 'past', label: 'Passate', order: 0 };
  if (t === today.getTime()) return { key: 'today', label: 'Oggi', order: 1 };
  if (t === tomorrow.getTime()) return { key: 'tomorrow', label: 'Domani', order: 2 };
  if (t < weekEnd.getTime()) return { key: 'thisweek', label: 'Questa settimana', order: 3 };
  if (t < nextWeekEnd.getTime()) return { key: 'nextweek', label: 'Prossima settimana', order: 4 };
  return { key: 'later', label: 'Più tardi', order: 5 };
}

/**
 * Vertical "parcheggio" sandwiched between the left Sidebar (tag list) and
 * the canvas. Lists tiles that exist in the current tag but have no canvas
 * position yet, rendered with the same visual vocabulary used on the canvas
 * (type-icon-tinted background, type/action badges, dashed border for
 * deadlines) so a tile looks consistent everywhere it's shown.
 *
 * Drag-back (canvas tile dragged here): CanvasBoard publishes mouse coords
 * via callback; if the gesture ends over this panel's bounding rect the
 * canvas page removes that tile's canvas_layout entry, sending it back to
 * staging. The panel also highlights itself as a drop target while the
 * cursor is hovering it during the drag.
 */
export function StagingPanel({
  tiles,
  panelRef,
  isCanvasDragActive,
  isDropTargetHover,
  selectedTileId,
  onTileClick,
  width,
  open = true,
  onToggle,
}: Props) {
  const actionColors = useActionColors();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const { statuses } = useStatuses();
  const tilesWithFlows = useTilesWithFlows();
  const openFlow = useFlowOpenStore((s) => s.open);
  const getIconForTile = useCallback(
    (tileId: string) => {
      const iconId = typeTileIcons[tileId];
      if (!iconId) return null;
      return typeIcons.find((i) => i.id === iconId) || null;
    },
    [typeIcons, typeTileIcons],
  );

  // Sort + group preferences, persisted to localStorage so they survive a
  // reload. Default: no grouping, newest first.
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  useEffect(() => {
    try {
      const s = localStorage.getItem(SORT_LS_KEY);
      if (s === 'asc' || s === 'desc') setSortDir(s);
      const g = localStorage.getItem(GROUP_LS_KEY);
      if (g === 'none' || g === 'action' || g === 'date' || g === 'tag' || g === 'type' || g === 'status') {
        setGroupBy(g);
      }
    } catch { /* */ }
  }, []);
  const toggleSort = useCallback(() => {
    setSortDir((cur) => {
      const next: SortDir = cur === 'asc' ? 'desc' : 'asc';
      try { localStorage.setItem(SORT_LS_KEY, next); } catch { /* */ }
      return next;
    });
  }, []);
  const changeGroup = useCallback((g: GroupBy) => {
    setGroupBy(g);
    try { localStorage.setItem(GROUP_LS_KEY, g); } catch { /* */ }
  }, []);

  // Custom dropdown for the group selector. Same portal + click-outside
  // pattern as TileSidebar's TypeIconPicker so the menu can escape the
  // staging panel's overflow clipping.
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupTriggerRef = useRef<HTMLButtonElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [groupMenuPos, setGroupMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useEffect(() => {
    if (!groupMenuOpen) return;
    if (groupTriggerRef.current) {
      const r = groupTriggerRef.current.getBoundingClientRect();
      setGroupMenuPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) });
    }
    const handler = (e: MouseEvent) => {
      if (groupTriggerRef.current?.contains(e.target as Node)) return;
      if (groupMenuRef.current?.contains(e.target as Node)) return;
      setGroupMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [groupMenuOpen]);

  // Date used for sorting + the "Data" group bucket. Prefer the actionable
  // start_at (event scheduling) and fall back to created_at so every tile
  // has a usable timestamp.
  const tileDate = useCallback((t: Tile) => t.start_at || t.created_at, []);

  const sortedTiles = useMemo(() => {
    const arr = [...tiles];
    arr.sort((a, b) => {
      const da = new Date(tileDate(a)).getTime();
      const db = new Date(tileDate(b)).getTime();
      return sortDir === 'asc' ? da - db : db - da;
    });
    return arr;
  }, [tiles, sortDir, tileDate]);

  // status_id → { name, order } lookup used by the STATUS grouping. Reuses
  // the canonical order baked into useStatuses (active/done/paused/...).
  const statusLookup = useMemo(() => {
    const m = new Map<string, { name: string; order: number }>();
    statuses.forEach((s, i) => m.set(s.id, { name: s.name, order: i }));
    return m;
  }, [statuses]);

  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, Group>();
    const add = (key: string, label: string, order: number, t: Tile) => {
      let g = map.get(key);
      if (!g) { g = { key, label, order, tiles: [] }; map.set(key, g); }
      g.tiles.push(t);
    };
    for (const t of sortedTiles) {
      if (groupBy === 'action') {
        const k = t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
        add(k, ACTION_GROUP_LABEL[k] ?? k, ACTION_GROUP_ORDER[k] ?? 99, t);
      } else if (groupBy === 'date') {
        const b = dateBucket(tileDate(t));
        add(b.key, b.label, b.order, t);
      } else if (groupBy === 'tag') {
        // First non-root tag is used as the section. In the canvas context
        // every staging tile already shares the current tag, so grouping by
        // tag is most useful for *additional* tags the tile carries.
        const tag = (t.tags || []).find((x) => !x.is_root);
        if (tag) add(tag.id, tag.name, 0, t);
        else add('__notag__', 'Senza tag', 99, t);
      } else if (groupBy === 'type') {
        const iconId = typeTileIcons[t.id];
        const icon = iconId ? typeIcons.find((i) => i.id === iconId) : null;
        if (icon) add(icon.id, icon.name, 0, t);
        else add('__notype__', 'Senza tipo', 99, t);
      } else if (groupBy === 'status') {
        if (t.status_id) {
          const s = statusLookup.get(t.status_id);
          add(t.status_id, s?.name || 'Status', s?.order ?? 50, t);
        } else add('__nostatus__', 'Senza status', 99, t);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
    return arr;
  }, [groupBy, sortedTiles, tileDate, typeTileIcons, typeIcons, statusLookup]);

  const onDragStart = (e: React.DragEvent, tileId: string) => {
    e.dataTransfer.setData('text/x-canvas-tile-id', tileId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Render one tile card. Pulled out so both the flat list and the grouped
  // sections use the same markup — change here, change everywhere.
  const renderTile = (t: Tile) => {
    const si = getIconForTile(t.id);
    const actionKey: string =
      t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
    const actionColor: string =
      actionKey === 'none'
        ? '#e4e4e7'
        : ((actionColors as Record<string, string>)[actionKey] as string)
          || FALLBACK_COLOR;
    // Background = type-icon color at ~50% alpha (matches canvas/kanban
    // tile bg). When no type icon set, fall back to a neutral zinc.
    const tileBg = si?.color ? `${si.color}80` : '#1C1C1E';
    const isSelected = selectedTileId === t.id;
    const hasFlow = tilesWithFlows.has(t.id);
    return (
      // Outer wrapper allows the FLOW badge to overflow past the tile's
      // rounded body (the body has overflow-hidden for the status patterns,
      // so the badge has to live outside).
      <div
        key={t.id}
        className="relative shrink-0"
        style={{ width: TILE_W, breakInside: 'avoid', marginBottom: 6 }}
      >
        <div
          draggable
          data-tile-id={t.id}
          onDragStart={(e) => onDragStart(e, t.id)}
          onClick={() => onTileClick?.(t.id)}
          className={cn(
            'shrink-0 rounded overflow-hidden cursor-grab active:cursor-grabbing transition-all border',
            actionKey === 'deadline'
              ? 'border-dashed border-red-500'
              : 'border-white/[0.08]',
            isSelected && 'ring-2 ring-blue-500',
            'hover:brightness-110',
          )}
          style={{ backgroundColor: tileBg, width: TILE_W, height: TILE_H }}
          title={t.title || 'Senza titolo'}
        >
          <div className="relative h-full flex flex-col p-1.5">
            <div className="flex-1 min-h-0 overflow-hidden">
              <p
                className="text-[11px] leading-[14px] text-[#D4D4D8] font-normal"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {t.title || 'Senza titolo'}
              </p>
            </div>
            <div className="mt-auto flex items-end justify-between gap-1 relative z-10">
              <ActionBadgeMini actionKey={actionKey} color={actionColor} />
              {si && <TypeBadgeMini iconName={si.icon} color={si.color} />}
            </div>
          </div>
        </div>
        {/* FLOW badge — same overhang and styling as Canvas/Kanban. */}
        {hasFlow && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openFlow(t.id);
            }}
            onContextMenu={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
            className="absolute -top-1.5 right-2 z-20 px-1.5 h-4 rounded text-[9px] font-bold tracking-wider text-blue-100 bg-blue-900/95 border border-blue-500 shadow flex items-center hover:bg-blue-800 transition-colors cursor-pointer"
            title="Apri Flow"
          >
            FLOW
          </button>
        )}
      </div>
    );
  };

  if (!open) {
    // Collapsed: thin strip with expand button. Keeps panelRef + drop-target
    // tinting so dragging a canvas tile onto the strip still hit-tests and
    // sends the tile back to staging — the user just won't see it land until
    // they expand the panel.
    return (
      <div
        ref={panelRef}
        data-staging-panel
        className={cn(
          'shrink-0 w-8 border-r flex flex-col transition-colors',
          isDropTargetHover
            ? 'bg-blue-500/[0.18] border-blue-500'
            : isCanvasDragActive
            ? 'bg-blue-500/[0.06] border-blue-500/30'
            : 'bg-zinc-950/40 border-zinc-800',
        )}
      >
        <button
          onClick={onToggle}
          className="h-12 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0 border-b border-zinc-800"
          title="Espandi staging"
        >
          <IconLayoutSidebarLeftExpand className="h-4 w-4 text-zinc-400" />
        </button>
        {tiles.length > 0 && (
          <div className="flex flex-col items-center gap-1 pt-2 text-zinc-500">
            <span className="text-[10px] tabular-nums">{tiles.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      data-staging-panel
      style={width != null ? { width } : undefined}
      className={cn(
        'shrink-0 border-r flex flex-col transition-colors',
        width == null && 'w-44',
        isDropTargetHover
          ? 'bg-blue-500/[0.18] border-blue-500'
          : isCanvasDragActive
          ? 'bg-blue-500/[0.06] border-blue-500/30'
          : 'bg-zinc-950/40 border-zinc-800',
      )}
    >
      <div className="h-12 flex items-center gap-1.5 pl-1 pr-3 border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors shrink-0"
          title="Collassa staging"
        >
          <IconLayoutSidebarLeftCollapse className="h-3.5 w-3.5 text-zinc-400" />
        </button>
        <span className="text-xs leading-none font-medium normal-case tracking-normal text-zinc-400">Staging</span>
        <span className="ml-auto tabular-nums">{tiles.length}</span>
      </div>

      {/* Controls bar — group-by dropdown + sort-direction toggle. Borderless
          + transparent to match the "Expand all" sidebar button style. */}
      {tiles.length > 0 && (
        <div className="h-8 px-2 flex items-center gap-1 border-b border-zinc-800 shrink-0">
          <button
            ref={groupTriggerRef}
            onClick={() => setGroupMenuOpen((v) => !v)}
            className="flex-1 min-w-0 h-7 px-1 flex items-center gap-1 bg-transparent border-0 text-[11px] leading-none font-medium text-zinc-500 hover:text-zinc-200 focus:outline-none transition-colors"
            title="Raggruppa per"
          >
            <span className="truncate">{GROUP_LABEL[groupBy]}</span>
            <IconChevronDown className="h-3 w-3 shrink-0" />
          </button>
          {groupMenuOpen && groupMenuPos && createPortal(
            <div
              ref={groupMenuRef}
              className="fixed bg-zinc-800 border border-white/[0.08] rounded-lg shadow-xl py-1"
              style={{ top: groupMenuPos.top, left: groupMenuPos.left, width: groupMenuPos.width, zIndex: 9999 }}
            >
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { changeGroup(opt); setGroupMenuOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs leading-none font-medium transition-colors',
                    groupBy === opt
                      ? 'bg-zinc-700/40 text-white'
                      : 'text-zinc-300 hover:bg-zinc-700/50',
                  )}
                >
                  {GROUP_LABEL[opt]}
                </button>
              ))}
            </div>,
            document.body,
          )}
          <button
            onClick={toggleSort}
            className="h-7 px-1 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
            title={sortDir === 'asc' ? 'Crescente (più vecchie in cima) — clicca per invertire' : 'Decrescente (più recenti in cima) — clicca per invertire'}
          >
            {sortDir === 'asc' ? <IconArrowNarrowUp className="h-3 w-3" /> : <IconArrowNarrowDown className="h-3 w-3" />}
          </button>
        </div>
      )}

      {/* Tile list. When groupBy='none', tiles flow into a single CSS-column
          grid driven by container width. Otherwise, render one column-grid
          per group with a small uppercase header above it. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tiles.length === 0 ? (
          <p className="text-[10px] text-zinc-600 text-center py-6 px-2 leading-relaxed">
            {isCanvasDragActive || isDropTargetHover
              ? 'Rilascia qui per togliere il tile dal canvas'
              : 'I nuovi tile compaiono qui. Trascinali nel canvas per posizionarli.'}
          </p>
        ) : groupBy === 'none' ? (
          <div style={{ columnWidth: `${TILE_W}px`, columnGap: '6px' }}>
            {sortedTiles.map(renderTile)}
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.key}>
                <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <span className="truncate">{g.label}</span>
                  <span className="tabular-nums text-zinc-600">{g.tiles.length}</span>
                </div>
                <div style={{ columnWidth: `${TILE_W}px`, columnGap: '6px' }}>
                  {g.tiles.map(renderTile)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBadgeMini({ actionKey, color }: { actionKey: string; color: string }) {
  const Icon = ACTION_ICON[actionKey];
  if (!Icon) return <span className="w-3.5 h-3.5" />;
  return (
    <div
      className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
    >
      <Icon size={9} color={readableOn(color)} />
    </div>
  );
}

function TypeBadgeMini({ iconName, color }: { iconName: string; color?: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div
      className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0"
      style={{ backgroundColor: bg }}
    >
      <Comp size={9} color={readableOn(bg)} />
    </div>
  );
}
