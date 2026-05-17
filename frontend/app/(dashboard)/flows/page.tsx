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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconRoute, IconClock, IconRefresh } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { useFlowHub, type FlowHubFilter } from '@/lib/hooks/useFlowHub';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { StatusIcon } from '@/components/flow/FlowNodeView';
import { cn } from '@/lib/utils';
import type { FlowHubItem } from '@/types/flow';

/** True when the node's "ball" is on the current user — contact is the seeded
 *  self row, or no contact has been assigned (default-self semantics). */
function isItemSelf(item: FlowHubItem): boolean {
  return !item.contact || item.contact.is_self;
}

// Four scenarios, one per lifecycle decorator. Labels match the STATUS
// picker in the Flow inspector verbatim (uppercase English); tints come
// from the shared FLOW_STATE_COLORS palette. Glyphs are rendered via
// <StateGlyph> below, which reuses the exact same StatusIcon used inside
// flow nodes — no tabler-icon approximation.
const TABS: Array<{ key: FlowHubFilter; label: string; tint: string }> = [
  { key: 'done', label: 'DONE', tint: FLOW_STATE_COLORS.done },
  { key: 'wait', label: 'WAIT', tint: FLOW_STATE_COLORS.wait },
  { key: 'undo', label: 'UNDO', tint: FLOW_STATE_COLORS.undo },
  { key: 'stop', label: 'STOP', tint: FLOW_STATE_COLORS.stop },
];

/** Renders one of the four lifecycle glyphs (check / hourglass / slash / X)
 *  using the same StatusIcon paths that decorate the flow nodes themselves,
 *  so the Hub tab icon is pixel-identical to what the user sees inside a
 *  flow. */
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

function FlowItemCard({ item, onOpen }: { item: FlowHubItem; onOpen: () => void }) {
  const isSelf = isItemSelf(item);
  const ownerLabel = isSelf ? 'Palla mia' : item.contact?.name ?? 'Palla loro';
  const stateLabel = FLOW_STATE_LABELS[item.state];
  // Tooltip text on the badge surfaces the most informative single label:
  //   - if a status decorator is set (done/wait/undo/stop), the status wins
  //   - otherwise show the ownership ("Palla mia" / contact name)
  const pillLabel = item.state !== 'active' ? stateLabel : ownerLabel;
  const isDue = item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors group"
    >
      {/* 3-column grid, each col split in 2 stacked rows:
          col 1: TAG (top, grey caps)         | TILE TITLE (bottom, light)
          col 2: CONTACT pill (top, bordered) | NODE LABEL (bottom, grey)
          col 3: mini badge (spans both rows) */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 items-center">
        {/* Column 1 — tag (top) + tile title (bottom) */}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 truncate">
            {item.tile.tag?.name || ' '}
          </div>
          <div className="text-[12px] font-semibold text-zinc-100 group-hover:text-white truncate mt-0.5">
            {item.tile.title || '(senza titolo)'}
          </div>
        </div>

        {/* Column 2 — node label (top) + contact pill (bottom) */}
        <div className="min-w-0 flex flex-col items-start gap-1 pl-8">
          <span className="text-[12px] text-zinc-400 truncate max-w-full">
            {item.label || <span className="italic text-zinc-600">(senza etichetta)</span>}
          </span>
          <span
            className={cn(
              'px-2 py-1 rounded leading-none text-[11px] border max-w-full truncate',
              !item.contact && 'opacity-0',
            )}
            style={
              item.contact
                ? {
                    color: item.contact.color || '#D4D4D8',
                    borderColor: '#52525B',
                  }
                : { color: 'transparent', borderColor: 'transparent' }
            }
          >
            {item.contact
              ? (item.contact.is_self ? `[ ${item.contact.name} ]` : item.contact.name)
              : '—'}
          </span>
        </div>

        {/* Column 3 — mini badge, same scale as the modal nodes. */}
        <span className="shrink-0 flex items-center justify-center" title={pillLabel}>
          <FlowMiniBadge isSelf={isSelf} state={item.state} />
        </span>
      </div>

      {/* Secondary metadata — schedule date / age / notes — only when present */}
      {(item.scheduled_at || (!item.scheduled_at && item.days_since_activity > 0) || item.notes) && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
          {item.scheduled_at && (
            <span className={cn('flex items-center gap-1', isDue && 'text-red-400')}>
              <IconClock size={11} />
              {formatScheduled(item.scheduled_at)}
            </span>
          )}
          {!item.scheduled_at && item.days_since_activity > 0 && (
            <span>{item.days_since_activity}g fa</span>
          )}
          {item.occurred_at && (
            <span className="ml-auto">{formatDate(item.occurred_at)}</span>
          )}
        </div>
      )}
      {item.notes && (
        <div className="mt-2 text-xs text-zinc-400 line-clamp-2 whitespace-pre-wrap">
          {item.notes}
        </div>
      )}
    </button>
  );
}

/** Reproduction of a FlowNodeView body at the same scale used in the modal
 *  (radius 16 → 32×32 body), so the Hub reads visually identical: black
 *  background + white border, square when the ball is on me (self contact
 *  or null) / circle when it's on someone else, with the inline status glyph
 *  (check/hourglass/slash/X) drawn inside when state is a decorator. */
function FlowMiniBadge({
  isSelf,
  state,
}: {
  isSelf: boolean;
  state: 'active' | 'done' | 'wait' | 'undo' | 'stop';
}) {
  // Match FlowTrack.NODE_RADIUS so the Hub badge has the exact same diameter
  // as a node body inside the Flow modal.
  const r = 16;
  const SIZE = r * 2 + 4; // +4 leaves 2px of pad around the stroke
  const half = SIZE / 2;
  const bodyFill = '#000000';
  const bodyStroke = '#FFFFFF';
  const bodyStrokeWidth = 1;
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
            rx={4}
            fill={bodyFill}
            stroke={bodyStroke}
            strokeWidth={bodyStrokeWidth}
          />
        ) : (
          <circle r={r} fill={bodyFill} stroke={bodyStroke} strokeWidth={bodyStrokeWidth} />
        )}
        {/* Reuse the exact same status glyph component as the modal so the
            decorator renders pixel-identical (same proportions, same stroke
            widths). The size formula matches FlowNodeView (radius * 1.2). */}
        {state !== 'active' && <StatusIcon state={state} color={statusColor} size={r * 1.2} />}
      </g>
    </svg>
  );
}

export default function FlowsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FlowHubFilter>('wait');

  const { items, isLoading, isError, refetch } = useFlowHub(filter);

  const handleOpen = (item: FlowHubItem) => {
    // Navigate to the canvas with this tile + flow node pre-selected. The
    // canvas page's deep-link effect sets selectedFlowNodeId so TileSidebar
    // jumps to the Flow tab focused on the right node.
    router.push(`/canvas?tile=${item.tile_id}&flow=${item.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <Header />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Page title */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <IconRoute size={22} className="text-blue-400" />
              <div>
                <h1 className="text-xl font-semibold text-white">Flow Hub</h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Inbox dei flussi pendenti, aggregati da tutti i tile
                </p>
              </div>
            </div>
            <button
              onClick={() => refetch()}
              className="h-8 px-3 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              title="Aggiorna"
            >
              <IconRefresh size={13} />
              Aggiorna
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-zinc-800 pb-2 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'h-8 px-3 rounded text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0',
                    isActive
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900',
                  )}
                  style={isActive ? { color: tab.tint } : undefined}
                >
                  <StateGlyph state={tab.key} color={isActive ? tab.tint : 'currentColor'} size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="text-center py-12 text-zinc-500 text-sm">Caricamento…</div>
          ) : isError ? (
            <div className="text-center py-12 text-red-400 text-sm">Errore nel caricamento</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <IconRoute size={32} className="mx-auto text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">Nessun flusso in questa categoria</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                {filter === 'done' && 'I nodi marcati come "Fatto" compariranno qui'}
                {filter === 'wait' && 'I nodi marcati come "In attesa" compariranno qui'}
                {filter === 'undo' && 'I nodi marcati come "Annullato" compariranno qui'}
                {filter === 'stop' && 'I nodi marcati come "Bloccato" compariranno qui'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <FlowItemCard key={item.id} item={item} onOpen={() => handleOpen(item)} />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-6 text-center text-[11px] text-zinc-600">
              {items.length} {items.length === 1 ? 'flusso' : 'flussi'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
