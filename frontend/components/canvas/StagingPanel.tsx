'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as TablerIcons from '@tabler/icons-react';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconArrowNarrowUp,
  IconArrowNarrowDown,
  IconChevronDown,
} from '@tabler/icons-react';
import { readableOn } from '@/lib/palette';
import { usePixelTheme } from '@/components/pixel';
import { useTypeIcons } from '@/store/type-icons-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import { StatusPattern } from '@/components/statuses/status-pattern';
import { ActionBadge } from '@/components/actions/action-badge';
import type { Tile, StatusShape } from '@/types';

interface Props {
  tiles: Tile[];
  panelRef: React.RefObject<HTMLDivElement | null>;
  isCanvasDragActive?: boolean;
  isDropTargetHover?: boolean;
  selectedTileId?: string | null;
  onTileClick?: (tileId: string) => void;
  width?: number;
  open?: boolean;
  onToggle?: () => void;
}

const TILE_W = 130;
const TILE_H = 90;
const FALLBACK_COLOR = '#94A3B8';

type SortDir = 'asc' | 'desc';
type GroupBy = 'none' | 'action' | 'date' | 'tag' | 'type' | 'status';

const SORT_LS_KEY = 'staging_sort_dir';
const GROUP_LS_KEY = 'staging_group_by';

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

function dateBucket(iso: string | undefined): { key: string; label: string; order: number } {
  if (!iso) return { key: 'nodate', label: 'Senza data', order: 99 };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: 'nodate', label: 'Senza data', order: 99 };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayOfWeek = today.getDay();
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
  const theme = usePixelTheme();
  // Strutturali per il restyle nativo Obsidian (colori già dal theme in shell).
  const bW = 1;
  const headFont = 'var(--ob-font-sans)';
  const bodyFont = 'var(--ob-font-sans)';
  const headTransform: 'none' | 'uppercase' = 'none';
  const headWeight = 600;
  const radius = 8;
  const actionColors = useActionColors();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const { statuses, getActionTypeShape } = useStatuses();
  const resolveShape = useCallback((tile: Tile): StatusShape => {
    if (tile.status_id) {
      const st = statuses.find((s) => s.id === tile.status_id);
      if (st) return st.shape as StatusShape;
    }
    return getActionTypeShape(tile.action_type || 'none');
  }, [statuses, getActionTypeShape]);
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

  // Outer bg according to drop-target state. Default matches the canvas
  // background (theme.bg1) so the panel feels like a continuation of the board.
  const panelBg = isDropTargetHover
    ? `${theme.accent}33`
    : isCanvasDragActive
      ? `${theme.accent}14`
      : theme.bg1;
  const panelBorderColor = (isDropTargetHover || isCanvasDragActive) ? theme.accent : theme.border;

  const renderTile = (t: Tile) => {
    const si = getIconForTile(t.id);
    const actionKey: string =
      t.all_day && t.action_type === 'event' ? 'allday' : (t.action_type || 'none');
    const actionColor: string =
      actionKey === 'none'
        ? theme.ink2
        : ((actionColors as Record<string, string>)[actionKey] as string)
          || FALLBACK_COLOR;
    const tileBg = si?.color ? `${si.color}CC` : theme.surface;
    const isSelected = selectedTileId === t.id;
    const hasFlow = tilesWithFlows.has(t.id);
    const shape = resolveShape(t);
    const shapeColor = actionKey === 'none' ? theme.ink : actionColor;
    return (
      <div
        key={t.id}
        style={{ position: 'relative', flexShrink: 0, width: TILE_W, breakInside: 'avoid', marginBottom: 6 }}
      >
        <div
          draggable
          data-tile-id={t.id}
          onDragStart={(e) => onDragStart(e, t.id)}
          onClick={() => onTileClick?.(t.id)}
          style={{
            flexShrink: 0,
            overflow: 'hidden',
            cursor: 'grab',
            background: tileBg,
            width: TILE_W,
            height: TILE_H,
            borderRadius: radius,
            border: actionKey === 'deadline' ? `${bW}px dashed #E24B4A` : `${bW}px solid ${theme.border}`,
            boxShadow: isSelected ? `0 0 0 2px ${theme.accent}` : 'none',
          }}
          title={t.title || 'Senza titolo'}
        >
          <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: 6 }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <p
                style={{
                  fontFamily: bodyFont,
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
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, position: 'relative', zIndex: 10 }}>
              <ActionBadge actionKey={actionKey} size={14} color={actionColor} keepSpace />
              {si && <TypeBadgeMini iconName={si.icon} color={si.color} borderColor={theme.border} />}
            </div>
            <StatusPattern shape={shape} color={shapeColor} bg={tileBg} />
          </div>
        </div>
        {/* FLOW badge — pixel chip floating past the tile's top-right corner */}
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
            style={{
              position: 'absolute',
              top: -8,
              right: 6,
              zIndex: 20,
              padding: '0 5px',
              height: 16,
              background: theme.accent,
              color: theme.onAccent,
              border: `${bW}px solid transparent`,
              borderRadius: 6,
              fontFamily: headFont,
              fontSize: 9,
              fontWeight: headWeight,
              letterSpacing: 0.2,
              textTransform: headTransform,
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

  if (!open) {
    return (
      <div
        ref={panelRef}
        data-staging-panel
        style={{
          flexShrink: 0,
          width: 32,
          background: panelBg,
          borderRight: `${bW}px solid ${panelBorderColor}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          onClick={onToggle}
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderBottom: `${bW}px solid ${theme.border}`,
            cursor: 'pointer',
            flexShrink: 0,
            color: theme.ink2,
          }}
          title="Espandi staging"
        >
          <IconLayoutSidebarLeftExpand size={14} />
        </button>
        {tiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 8, color: theme.ink3 }}>
            <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>{tiles.length}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      data-staging-panel
      style={{
        flexShrink: 0,
        width: width != null ? width : 176,
        background: panelBg,
        borderRight: `${bW}px solid ${panelBorderColor}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 4,
          paddingRight: 12,
          borderBottom: `${bW}px solid ${theme.border}`,
          background: theme.surfaceVariant,
        }}
      >
        <button
          onClick={onToggle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            color: theme.ink2,
          }}
          title="Collassa staging"
        >
          <IconLayoutSidebarLeftCollapse size={14} />
        </button>
        <span
          style={{
            fontFamily: headFont,
            fontSize: 13,
            fontWeight: headWeight,
            letterSpacing: 0,
            textTransform: headTransform,
            color: theme.ink,
          }}
        >
          Staging
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--ob-font-mono)', fontSize: 11, color: theme.ink3, fontVariantNumeric: 'tabular-nums' }}>
          {tiles.length}
        </span>
      </div>

      {tiles.length > 0 && (
        <div
          style={{
            height: 32,
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: `${bW}px solid ${theme.border}`,
            flexShrink: 0,
            background: theme.bg1,
          }}
        >
          <button
            ref={groupTriggerRef}
            onClick={() => setGroupMenuOpen((v) => !v)}
            style={{
              flex: 1,
              minWidth: 0,
              height: 24,
              padding: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              color: theme.ink2,
              fontFamily: headFont,
              fontSize: 11.5,
              fontWeight: headWeight,
              letterSpacing: 0,
              textTransform: headTransform,
              cursor: 'pointer',
            }}
            title="Raggruppa per"
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{GROUP_LABEL[groupBy]}</span>
            <IconChevronDown size={11} style={{ flexShrink: 0 }} />
          </button>
          {groupMenuOpen && groupMenuPos && createPortal(
            <div
              ref={groupMenuRef}
              className="fixed"
              style={{
                top: groupMenuPos.top,
                left: groupMenuPos.left,
                width: groupMenuPos.width,
                zIndex: 9999,
                background: theme.surface,
                border: `${bW}px solid ${theme.border}`,
                borderRadius: 10,
                boxShadow: 'var(--ob-shadow-card)',
                padding: 4,
              }}
            >
              {GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { changeGroup(opt); setGroupMenuOpen(false); }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: groupBy === opt ? theme.surfaceVariant : 'transparent',
                    border: `${bW}px solid transparent`,
                    color: groupBy === opt ? theme.ink : theme.ink2,
                    fontFamily: bodyFont,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {GROUP_LABEL[opt]}
                </button>
              ))}
            </div>,
            document.body,
          )}
          <button
            onClick={toggleSort}
            style={{
              height: 24,
              padding: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: theme.ink2,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title={sortDir === 'asc' ? 'Crescente — clicca per invertire' : 'Decrescente — clicca per invertire'}
          >
            {sortDir === 'asc' ? <IconArrowNarrowUp size={12} /> : <IconArrowNarrowDown size={12} />}
          </button>
        </div>
      )}

      <div
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8 }}
      >
        {tiles.length === 0 ? (
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: 12,
              color: theme.ink3,
              textAlign: 'center',
              padding: '24px 8px',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {isCanvasDragActive || isDropTargetHover
              ? 'Rilascia qui per togliere il tile dal canvas'
              : 'I nuovi tile compaiono qui. Trascinali nel canvas per posizionarli.'}
          </p>
        ) : groupBy === 'none' ? (
          <div style={{ columnWidth: `${TILE_W}px`, columnGap: '6px' }}>
            {sortedTiles.map(renderTile)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map((g) => (
              <div key={g.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                    fontFamily: headFont,
                    fontSize: 11,
                    fontWeight: headWeight,
                    letterSpacing: 0,
                    textTransform: headTransform,
                    color: theme.ink3,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: theme.ink3 }}>{g.tiles.length}</span>
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

function TypeBadgeMini({ iconName, color, borderColor }: { iconName: string; color?: string; borderColor: string }) {
  const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string }>>)[iconName];
  if (!Comp) return null;
  const bg = color || '#27272A';
  return (
    <div
      style={{
        width: 14,
        height: 14,
        background: bg,
        border: `2px solid ${borderColor}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Comp size={8} color={readableOn(bg)} />
    </div>
  );
}
