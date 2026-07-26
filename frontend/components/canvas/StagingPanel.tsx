'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconArrowNarrowUp,
  IconArrowNarrowDown,
  IconChevronDown,
  IconLock,
  IconPlayerPause,
} from '@tabler/icons-react';
import { readableOn } from '@/lib/palette';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import { usePixelTheme } from '@/components/pixel';
import { useTypeIcons } from '@/store/type-icons-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
import { useTilesWithFlows } from '@/lib/hooks/useTilesWithFlows';
import { useFlowOpenStore } from '@/store/flow-modal-store';
import { ActionBadge } from '@/components/actions/action-badge';
import { TileMeta } from '@/components/tileview/TileMeta';
import { statusMeta, statusGlyph } from '@/lib/status-meta';
import type { Tile } from '@/types';

// Icone usate dalla colonna status (config `statusGlyph`, kind 'icon').
const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  IconLock,
  IconPlayerPause,
};

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

const TILE_W = 150;
const TILE_H = 80;
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

  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  useIsomorphicLayoutEffect(() => {
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
    // Velatura (come Kanban/Chrono/Canvas): base surface + tinta del tipo molto
    // attenuata, così testo e badge restano leggibili.
    const tint = si?.color ? `${si.color}24` : 'transparent';
    const borderColor = actionKey === 'deadline' ? '#E24B4A' : (si?.color ? `${si.color}3A` : theme.border);
    const isSelected = selectedTileId === t.id;
    const hasFlow = tilesWithFlows.has(t.id);
    const isDone = !!t.is_completed;
    // Status: identico al canvas → vive nella COLONNA a sinistra (icona/pallino/
    // DELETE), non più nel footer. 'active' non mostra nulla.
    const statusName = t.status_id ? statuses.find((s) => s.id === t.status_id)?.name : undefined;
    const sMeta = statusName ? statusMeta(statusName) : null;
    const statusCol = (() => {
      const glyph = statusGlyph(statusName);
      if (glyph.kind === 'none' || !sMeta) return null;
      if (glyph.kind === 'dot') return <span style={{ width: 8, height: 8, borderRadius: '50%', background: sMeta.hex }} />;
      if (glyph.kind === 'text') return (
        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontFamily: 'var(--ob-font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: sMeta.hex }}>{glyph.text}</span>
      );
      const Icon = STATUS_ICONS[glyph.icon];
      return Icon ? <Icon size={12} color={sMeta.hex} /> : null;
    })();
    // Data/ora nel footer (come canvas): solo per deadline/event/allday con date.
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const fmtTime = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    let dateLine = '', timeLine = '';
    if ((actionKey === 'deadline' || actionKey === 'event' || actionKey === 'allday') && (t.start_at || t.end_at)) {
      if (actionKey === 'deadline' && t.end_at) dateLine = fmtDate(t.end_at);
      else if (t.all_day && t.start_at) dateLine = fmtDate(t.start_at);
      else if (t.start_at) { dateLine = fmtDate(t.start_at); timeLine = fmtTime(t.start_at); if (t.end_at) timeLine += ` - ${fmtTime(t.end_at)}`; }
    }
    const subs = t.subtasks || [];
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
            background: theme.surface,
            width: TILE_W,
            height: TILE_H,
            borderRadius: radius,
            border: actionKey === 'deadline' ? `${bW}px dashed #E24B4A` : `${bW}px solid ${borderColor}`,
            boxShadow: isSelected ? `0 0 0 2px ${theme.accent}` : 'none',
          }}
          title={t.title || 'Senza titolo'}
        >
          {/* Tinta del tipo sopra la base surface. */}
          {tint !== 'transparent' && (
            <div style={{ position: 'absolute', inset: 0, background: tint, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
            {/* Colonna STATUS (come canvas): icona/pallino/DELETE centrati. */}
            <div style={{ width: 16, flexShrink: 0, background: theme.bg1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {statusCol}
            </div>
            {/* Contenuto */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '6px 6px 6px 8px' }}>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <p
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 12,
                    fontWeight: 300,
                    lineHeight: '16px',
                    color: readableOn(theme.surface),
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                    margin: 0,
                    ...(isDone ? { textDecoration: 'line-through', opacity: 0.65 } : null),
                  }}
                >
                  {t.title || 'Senza titolo'}
                </p>
              </div>
              {/* Barra checklist (LIST) */}
              {subs.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                  {subs.map((s, i) => (
                    <span key={i} style={{ flex: subs.length <= 10 ? '0 0 8px' : '1 1 0', height: 4, borderRadius: 1, background: s.is_done ? '#20C933' : '#F82B60' }} />
                  ))}
                </div>
              )}
              {/* Footer: azione + data + tipo */}
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 6, position: 'relative', zIndex: 10 }}>
                <ActionBadge actionKey={actionKey} size={14} color={actionColor} keepSpace />
                {(dateLine || timeLine) && (
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.05, minWidth: 0 }}>
                    {dateLine && <span style={{ fontSize: 9, color: theme.ink, whiteSpace: 'nowrap' }}>{dateLine}</span>}
                    {timeLine && <span style={{ fontSize: 8, color: theme.ink2, whiteSpace: 'nowrap' }}>{timeLine}</span>}
                  </div>
                )}
                <div style={{ marginLeft: 'auto' }} />
                <TileMeta type={si ? { icon: si.icon, color: si.color ?? '#5C5868' } : undefined} />
              </div>
            </div>
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

