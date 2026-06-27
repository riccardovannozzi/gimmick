/**
 * /flows — FlowHub: cross-tile inbox of pending Flow nodes.
 *
 * Four tab-filters mirror the backend (`GET /api/flows/hub?filter=…`), one
 * per lifecycle decorator on `flow_nodes.state`:
 *   done   nodes marked as completed
 *   wait   nodes paused / waiting (default tab on page open)
 *   undo   nodes reverted / cancelled
 *   stop   nodes blocked
 *
 * Each card is a deep-link into /canvas — `?tile=<id>&flow=<node_id>` — which
 * canvas/page.tsx resolves by picking a tag the tile belongs to, then opens
 * FlowTrack with that node pre-selected.
 */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconRoute, IconClock, IconArrowsSort, IconCheck } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { usePixelTheme } from '@/components/pixel';
import { useFlowHub, type FlowHubFilter } from '@/lib/hooks/useFlowHub';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { StatusIcon } from '@/components/flow/FlowNodeView';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { useActionColors } from '@/store/action-colors-store';
import { readableOn } from '@/lib/palette';
import { pixelToolbarBtn } from '@/lib/pixel-toolbar';
import { ViewContainer } from '@/components/shell';
import { FlowsLive } from '@/components/views/flows-live';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import type { FlowHubItem } from '@/types/flow';

function isItemSelf(item: FlowHubItem): boolean {
  return !item.contact || item.contact.is_self;
}

const TABS: Array<{ key: FlowHubFilter; label: string; tint: string }> = [
  { key: 'done', label: 'DONE', tint: FLOW_STATE_COLORS.done },
  { key: 'wait', label: 'WAIT', tint: FLOW_STATE_COLORS.wait },
  { key: 'undo', label: 'UNDO', tint: FLOW_STATE_COLORS.undo },
  { key: 'stop', label: 'STOP', tint: FLOW_STATE_COLORS.stop },
];

type FlowSort = 'days_desc' | 'days_asc' | 'tag' | 'contact';
const SORT_OPTIONS: Array<{ key: FlowSort; label: string }> = [
  { key: 'days_desc', label: 'Giorni ↓' },
  { key: 'days_asc',  label: 'Giorni ↑' },
  { key: 'tag',       label: 'Tag' },
  { key: 'contact',   label: 'Contatto' },
];

/** Days passed from the date set on the card (scheduled_at) or, if absent,
 *  from creation. Negative = future. Shared with the days badge. */
function daysOf(item: FlowHubItem): number {
  const ref = item.scheduled_at || item.created_at;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}

function StateGlyph({ state, color, size = 13 }: { state: FlowHubFilter; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 block">
      <g transform={`translate(${size / 2},${size / 2})`}>
        <StatusIcon state={state} color={color} size={size} />
      </g>
    </svg>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatScheduled(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function FlowItemCard({ item, onOpen, isActive }: { item: FlowHubItem; onOpen: () => void; isActive?: boolean }) {
  const theme = usePixelTheme();
  const actionColors = useActionColors();
  // The "scadenza" color the user picked in Settings → Style of actions
  // drives the days badge so all urgency cues across the app stay in sync.
  const urgentColor = actionColors.deadline;
  const [hover, setHover] = useState(false);
  const isSelf = isItemSelf(item);
  const ownerLabel = isSelf ? 'Palla mia' : item.contact?.name ?? 'Palla loro';
  const stateLabel = FLOW_STATE_LABELS[item.state];
  const pillLabel = item.state !== 'active' ? stateLabel : ownerLabel;
  const isDue = item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();
  // Compact meta hint (right-side): scheduled time wins, else "Ng fa", else occurred date.
  const metaHint = item.scheduled_at
    ? formatScheduled(item.scheduled_at)
    : item.days_since_activity > 0
      ? `${item.days_since_activity}g fa`
      : item.occurred_at
        ? formatDate(item.occurred_at)
        : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={item.notes || undefined}
      className="px-press"
      style={{
        width: '100%',
        textAlign: 'left',
        // Inverted: base = surface (raised look + shadow), hover = surfaceVariant (pressed-in).
        // Active (currently shown in the sidebar) gets an accent ring so the
        // user always knows which row drove the sidebar contents.
        background: hover ? theme.surfaceVariant : theme.surface,
        border: `2px solid ${isActive ? theme.accent : theme.border}`,
        outline: isActive ? `2px solid ${theme.accent}` : 'none',
        outlineOffset: -4,
        padding: '8px 12px',
        cursor: 'pointer',
        boxShadow: hover ? 'none' : `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
        transition: 'background 100ms',
        // CSS grid (not flex) so columns line up across rows regardless of
        // which optional fields each card has. Last 3 tracks (meta / state /
        // days) are auto-sized but each card always renders a slot — empty
        // when missing — so the right edge stays aligned too.
        display: 'grid',
        gridTemplateColumns: '110px minmax(0,2fr) minmax(0,1fr) 130px 70px 28px 60px',
        alignItems: 'center',
        gap: 12,
        minHeight: 36,
      }}
    >
      {/* Col 1 — tag chip */}
      <span
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 8,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.tile.tag?.name || '—'}
      </span>

      {/* Col 2 — tile title (primary) */}
      <span
        style={{
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 12,
          fontWeight: 600,
          color: theme.ink,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.tile.title || '(senza titolo)'}
      </span>

      {/* Col 3 — node label */}
      <span
        style={{
          fontFamily: 'var(--font-pixel-body)',
          fontSize: 11,
          color: theme.ink2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.label || <span style={{ fontStyle: 'italic', color: theme.ink3 }}>(senza etichetta)</span>}
      </span>

      {/* Col 4 — contact pill (slot always rendered to keep right cols aligned) */}
      {item.contact ? (
        <span
          style={{
            padding: '2px 6px',
            lineHeight: 1,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 8,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: item.contact.color || theme.ink2,
            border: `2px solid ${theme.border}`,
            background: theme.surfaceVariant,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            justifySelf: 'start',
            maxWidth: '100%',
          }}
        >
          {item.contact.is_self ? `[ ${item.contact.name} ]` : item.contact.name}
        </span>
      ) : (
        <span />
      )}

      {/* Col 5 — meta hint */}
      {metaHint ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 10,
            color: isDue ? '#E24B4A' : theme.ink3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.scheduled_at && <IconClock size={10} />}
          {metaHint}
        </span>
      ) : (
        <span />
      )}

      {/* Col 6 — state badge */}
      <span style={{ display: 'inline-flex', alignItems: 'center', justifySelf: 'center' }} title={pillLabel}>
        <FlowMiniBadge isSelf={isSelf} state={item.state} />
      </span>

      {/* Days badge — counts from scheduled_at (the date set on the card) if
          present, otherwise from created_at. Default tier uses theme.ink as
          background to stand out from the surrounding surfaceVariant chips. */}
      {(() => {
        const ref = item.scheduled_at || item.created_at;
        if (!ref) return null;
        const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
        const label = days === 0 ? 'oggi' : days < 0 ? `tra ${Math.abs(days)}` : `${days}`;
        const tooltip = item.scheduled_at
          ? `${days < 0 ? 'Mancano' : 'Sono passati'} ${Math.abs(days)} giorni dalla data fissata`
          : `Creato ${days} giorni fa`;
        // Uniform style across all tiers: light text on the user's deadline
        // color (from Settings → Style of actions). No more yellow/accent
        // escalation — the days number itself communicates the age.
        const bg = urgentColor;
        const color = readableOn(urgentColor);
        return (
          <span
            title={tooltip}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Doubled vertical footprint vs. the rest of the row: padding +
              // font scaled together so the badge becomes the clear focal
              // point of each card.
              padding: '6px 8px',
              minHeight: 30,
              lineHeight: 1,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 16,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: bg,
              color,
              border: `2px solid ${theme.border}`,
              whiteSpace: 'nowrap',
              minWidth: 44,
              textAlign: 'center',
            }}
          >
            {label}
          </span>
        );
      })()}
    </button>
  );
}

function FlowMiniBadge({
  isSelf,
  state,
}: {
  isSelf: boolean;
  state: 'active' | 'done' | 'wait' | 'undo' | 'stop';
}) {
  const r = 16;
  const SIZE = r * 2 + 4;
  const half = SIZE / 2;
  const bodyFill = '#000000';
  const bodyStroke = '#FFFFFF';
  const bodyStrokeWidth = 2;
  const statusColor = FLOW_STATE_COLORS[state];
  const useSquare = isSelf;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 block">
      <g transform={`translate(${half},${half})`}>
        {useSquare ? (
          <rect
            x={-r}
            y={-r}
            width={r * 2}
            height={r * 2}
            fill={bodyFill}
            stroke={bodyStroke}
            strokeWidth={bodyStrokeWidth}
          />
        ) : (
          <circle r={r} fill={bodyFill} stroke={bodyStroke} strokeWidth={bodyStrokeWidth} />
        )}
        {state !== 'active' && <StatusIcon state={state} color={statusColor} size={r * 1.2} />}
      </g>
    </svg>
  );
}

export default function FlowsPage() {
  // Migrazione Obsidian (Fase 2): dietro feature-flag la board Flows reale è
  // resa dalla `FlowsView` Obsidian (4 lane) collegata all'hub. Read-only:
  // click card → deep-link canvas. Default OFF = FlowHub arcade.
  if (isObsidianShellEnabled()) {
    return (
      <ViewContainer hideToolbar>
        <FlowsLive />
      </ViewContainer>
    );
  }
  return <ArcadeFlowsPage />;
}

function ArcadeFlowsPage() {
  const theme = usePixelTheme();
  const [filter, setFilter] = useState<FlowHubFilter>('wait');
  const [sortBy, setSortBy] = useState<FlowSort>('days_desc');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu on outside click.
  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortBtnRef.current?.contains(e.target as Node)) return;
      if (sortMenuRef.current?.contains(e.target as Node)) return;
      setSortMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sortMenuOpen]);
  // TileSidebar state — opening a flow item shows the related tile in the
  // sidebar without leaving the FlowHub page. The flowNodeId is passed
  // through so the sidebar's Flow tab auto-selects that node.
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedFlowNodeId, setSelectedFlowNodeId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forceFlowTab, setForceFlowTab] = useState(0);

  const { items, isLoading, isError } = useFlowHub(filter);

  // Sorted view of the hub items — the badge tier, auto-select, list render
  // and counter all read this instead of the raw query data.
  const sortedItems = useMemo(() => {
    const arr = [...items];
    switch (sortBy) {
      case 'days_desc': return arr.sort((a, b) => daysOf(b) - daysOf(a));
      case 'days_asc':  return arr.sort((a, b) => daysOf(a) - daysOf(b));
      case 'tag':       return arr.sort((a, b) => (a.tile.tag?.name || '').localeCompare(b.tile.tag?.name || ''));
      case 'contact':   return arr.sort((a, b) => (a.contact?.name || '').localeCompare(b.contact?.name || ''));
      default: return arr;
    }
  }, [items, sortBy]);

  const handleOpen = (item: FlowHubItem) => {
    setSelectedTileId(item.tile_id);
    setSelectedFlowNodeId(item.id);
    setSidebarOpen(true);
    // Bump the counter to force TileSidebar's Flow tab to (re-)activate
    // every time we open a flow item, even if it's the same tile as before.
    setForceFlowTab((n) => n + 1);
  };

  // Auto-select the first item: on initial page load AND whenever the user
  // switches the filter tab. Without the filter dep the sidebar would keep
  // showing a tile that no longer appears in the visible list.
  const autoSelectedFilter = useRef<FlowHubFilter | null>(null);
  useEffect(() => {
    if (isLoading || sortedItems.length === 0) return;
    if (autoSelectedFilter.current === filter) return;
    autoSelectedFilter.current = filter;
    handleOpen(sortedItems[0]);
    // handleOpen is referentially stable enough here — it only reads setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedItems, isLoading, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: theme.bg1 }}>
     <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      <Header />

      {/* Pinned toolbar — title + tabs. NOT inside the scrolling container so
          the scrollbar lives on the list area only, not on the whole page. */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 8px', width: '100%' }}>
          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  color: theme.accent,
                }}
              >
                <IconRoute size={20} />
              </div>
              <div>
                <h1
                  style={{
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 16,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.ink,
                    margin: 0,
                  }}
                >
                  Flow Hub
                </h1>
                <p
                  style={{
                    fontFamily: 'var(--font-pixel-body)',
                    fontSize: 11,
                    color: theme.ink3,
                    margin: '4px 0 0',
                  }}
                >
                  Inbox dei flussi pendenti, aggregati da tutti i tile
                </p>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 16,
              borderBottom: `2px solid ${theme.border}`,
              paddingBottom: 8,
              overflowX: 'auto',
            }}
          >
            {TABS.map((tab) => {
              const isActive = filter === tab.key;
              // Flow tabs are special: instead of theme.accent, the active
              // tint is the state color (done/wait/undo/stop). Active text
              // contrast is computed via `readableOn` (tint is mid-saturated,
              // not a palette pair). Default usa "slot scuro/chiaro" della
              // palette swap-pati per mode così il fondo resta scuro in
              // entrambi i mode (vedi pixel-toolbar.ts).
              const darkSlot = theme.mode === 'dark' ? theme.surface : theme.ink;
              const lightSlot = theme.mode === 'dark' ? theme.ink : theme.surface;
              const fg = isActive ? readableOn(tab.tint) : lightSlot;
              const shadowCol = theme.mode === 'dark' ? theme.shadowColor : theme.surface;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className="px-press"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    padding: '0 12px',
                    background: isActive ? tab.tint : darkSlot,
                    color: fg,
                    border: `2px solid ${fg}`,
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 8,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: isActive ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${shadowCol}` : 'none',
                  }}
                >
                  <StateGlyph state={tab.key} color={fg} size={13} />
                  {tab.label}
                </button>
              );
            })}
            {/* Sort dropdown — pushed to the opposite end of the tabs row */}
            <div style={{ position: 'relative', display: 'inline-block', marginLeft: 'auto', flexShrink: 0 }}>
              <button
                ref={sortBtnRef}
                onClick={() => setSortMenuOpen((v) => !v)}
                className="px-press"
                title="Ordina"
                style={pixelToolbarBtn(theme, sortMenuOpen)}
              >
                <IconArrowsSort size={12} />
                {SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? 'Ordina'}
              </button>
              {sortMenuOpen && (
                <div
                  ref={sortMenuRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    minWidth: 140,
                    zIndex: 50,
                    background: theme.surface,
                    border: `2px solid ${theme.border}`,
                    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                    padding: 4,
                  }}
                >
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortBy === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setSortMenuOpen(false); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: '100%',
                          padding: '6px 8px',
                          textAlign: 'left',
                          background: active ? theme.surfaceVariant : 'transparent',
                          border: 'none',
                          color: active ? theme.ink : theme.ink2,
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        <IconCheck size={11} style={{ opacity: active ? 1 : 0, flexShrink: 0, color: theme.accent }} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      </div>{/* /pinned toolbar */}

      {/* Scrollable list area — owns the scrollbar */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px 24px', width: '100%' }}>
          {/* List */}
          {isLoading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              Caricamento…
            </div>
          ) : isError ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 0',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#E24B4A',
              }}
            >
              Errore nel caricamento
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  color: theme.ink3,
                  marginBottom: 12,
                }}
              >
                <IconRoute size={28} />
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.ink2,
                  margin: 0,
                }}
              >
                Nessun flusso in questa categoria
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  color: theme.ink3,
                  marginTop: 6,
                }}
              >
                {filter === 'done' && 'I nodi marcati come "Fatto" compariranno qui'}
                {filter === 'wait' && 'I nodi marcati come "In attesa" compariranno qui'}
                {filter === 'undo' && 'I nodi marcati come "Annullato" compariranno qui'}
                {filter === 'stop' && 'I nodi marcati come "Bloccato" compariranno qui'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedItems.map((item) => (
                <FlowItemCard key={item.id} item={item} onOpen={() => handleOpen(item)} isActive={item.id === selectedFlowNodeId} />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div
              style={{
                marginTop: 24,
                textAlign: 'center',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              {items.length} {items.length === 1 ? 'flusso' : 'flussi'}
            </div>
          )}
        </div>
      </div>
     </div>
      <TileSidebar
        tileId={selectedTileId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        invalidateKeys={['flow-hub']}
        flowNodeId={selectedFlowNodeId}
        onSelectFlowNode={setSelectedFlowNodeId}
        forceFlowTab={forceFlowTab}
      />
    </div>
  );
}
