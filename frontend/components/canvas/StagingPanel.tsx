'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconArrowNarrowUp,
  IconArrowNarrowDown,
  IconChevronDown,
} from '@tabler/icons-react';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import { usePixelTheme } from '@/components/pixel';
import { useTypeIcons } from '@/store/type-icons-store';
import { useActionColors } from '@/store/action-colors-store';
import { useStatuses } from '@/store/statuses-store';
// `Tile` è già il tipo di dominio: la card si chiama `TileComponent`.
import { Tile as TileComponent } from '@/components/tiles/Tile';
import { TILE_W } from '@/lib/tile-visual';
import { tileVisualKey, TILE_VISUAL, type StepState, type TileStatus } from '@/lib/tile-visual';
import type { Tile } from '@/types';
import { OB_LEADING, OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

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

/** L'ingombro reale di un tile: 120, non il 150 su cui è disegnato. Arriva dal
 *  sistema visivo perché la colonna deve essere larga quanto il tile è, non
 *  quanto sarebbe se non fosse scalato. */

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** Padding orizzontale (per lato) del corpo scrollabile che contiene i tile. */
const BODY_PAD = 8;
/** Spessore della scrollbar del corpo — deve combaciare con `.ob-staging__body`
 *  in app/obsidian-canvas.css, che riserva sempre lo spazio (gutter stabile). */
const STAGING_SCROLLBAR_W = 6;
/**
 * Larghezza minima del pannello: esattamente UNA colonna di tile, stessa regola
 * delle colonne NOTES/TODO/FLOW di CHRONO (`.ob-chrono__col`) e delle lane del
 * KANBAN, che come qui includono anche il gutter della scrollbar.
 * 120 + 8+8 + 6 + 1 = 143. Sotto questa soglia il tile verrebbe tagliato, quindi
 * è il limite sia del resize col separatore sia del valore ripristinato da
 * localStorage.
 */
export const STAGING_MIN_W = TILE_W + BODY_PAD * 2 + STAGING_SCROLLBAR_W + 1;

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
  const headWeight = OB_WEIGHT.emphasis;
  const actionColors = useActionColors();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const { statuses } = useStatuses();
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

  /**
   * La card dello STAGING è il `Tile` del sistema visivo, lo stesso di Chrono e
   * del canvas. Prima era una terza copia scritta a mano con la sua colonna
   * status, la sua barra checklist e il suo footer: tre resi della stessa cosa
   * che divergevano a ogni ritocco.
   *
   * Il contenitore resta qui perché fa due cose che il Tile non fa apposta, per
   * restare presentazionale: il trascinamento verso la board, e la GRONDA di
   * 9px in cui sborda il badge d'angolo. La gronda sta sul contenitore e non
   * come margine sul tile — un margine ne sposterebbe l'allineamento, un
   * padding lascia il rettangolo intatto a 150×80.
   */
  const renderTile = (t: Tile) => {
    const si = getIconForTile(t.id);
    const key = tileVisualKey({ action_type: t.action_type, all_day: t.all_day });
    // `is_completed` e lo status `done` sono tenuti allineati dal database
    // (migration 015): qui valgono come la stessa cosa.
    const statusName = t.status_id ? statuses.find((s) => s.id === t.status_id)?.name : undefined;
    const status: TileStatus = t.is_completed ? 'done' : ((statusName as TileStatus) ?? 'active');
    // Stessa regola del canvas: tinge il colore del TIPO, con ricaduta sul
    // colore dell'AZIONE quando il tipo manca — così una scadenza senza tipo
    // resta rossa invece di ridursi a una hairline. Entrambi dalle impostazioni.
    const accent = si?.color || (actionColors as Record<string, string>)[key] || undefined;
    const subs = t.subtasks ?? [];
    const steps: StepState[] | undefined = subs.length
      ? subs.map((s): StepState => (s.is_done ? 'done' : 'pending'))
      : undefined;

    const metaKind = TILE_VISUAL[key].meta;
    let meta: string | undefined;
    if (metaKind === 'progress') {
      if (subs.length) meta = `${subs.filter((s) => s.is_done).length} di ${subs.length}`;
    } else if (metaKind !== 'none') {
      // `deadline` vive su end_at, gli eventi su start_at — la stessa regola
      // che il resto dell'app applica in `eventRefIso`.
      const iso = key === 'deadline' ? (t.end_at || t.start_at) : (t.start_at || t.end_at);
      if (iso) {
        meta = metaKind === 'time'
          ? (t.start_at && t.end_at ? `${fmtTime(t.start_at)}–${fmtTime(t.end_at)}` : fmtTime(iso))
          : fmtDate(iso);
      }
    }

    return (
      <div
        key={t.id}
        draggable
        data-tile-id={t.id}
        onDragStart={(e) => onDragStart(e, t.id)}
        style={{
          flexShrink: 0,
          width: TILE_W,
          breakInside: 'avoid',
          paddingTop: 9,
          marginBottom: 3,
          cursor: 'grab',
          overflow: 'visible',
        }}
        title={t.title || 'Senza titolo'}
      >
        <TileComponent
          title={t.title || 'Senza titolo'}
          visualKey={key}
          status={status}
          steps={steps}
          meta={meta}
          accent={accent}
          active={selectedTileId === t.id}
          onClick={onTileClick ? () => onTileClick(t.id) : undefined}
        />
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
            // Stessa fascia della toolbar canvas e della tabbar destra.
            height: 'var(--ob-toolbar-height)',
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
            <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.micro, fontVariantNumeric: 'tabular-nums' }}>{tiles.length}</span>
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
          // Fascia sotto la navbar (vedi CanvasTopbar / TileSidebar).
          height: 'var(--ob-toolbar-height)',
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
            width: 30,
            height: 30,
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
            fontSize: OB_TEXT.control,
            fontWeight: headWeight,
            letterSpacing: 0,
            textTransform: headTransform,
            color: theme.ink,
          }}
        >
          Staging
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.meta, color: theme.ink3, fontVariantNumeric: 'tabular-nums' }}>
          {tiles.length}
        </span>
      </div>

      {tiles.length > 0 && (
        <div
          style={{
            // Sotto-barra annidata nel pannello: livello 3 della scala → 40.
            height: 40,
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
              fontSize: OB_TEXT.meta,
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
                borderRadius: 'var(--ob-radius-md)',
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
                    borderRadius: 'var(--ob-radius-sm)',
                    background: groupBy === opt ? theme.surfaceVariant : 'transparent',
                    border: `${bW}px solid transparent`,
                    color: groupBy === opt ? theme.ink : theme.ink2,
                    fontFamily: bodyFont,
                    fontSize: OB_TEXT.card,
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
        className="ob-staging__body ob-scroll-quiet"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: BODY_PAD }}
      >
        {tiles.length === 0 ? (
          <p
            style={{
              fontFamily: bodyFont,
              fontSize: OB_TEXT.card,
              color: theme.ink3,
              textAlign: 'center',
              padding: '24px 8px',
              lineHeight: OB_LEADING.text,
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
                    fontSize: OB_TEXT.meta,
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

