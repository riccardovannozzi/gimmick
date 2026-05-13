/**
 * /flows — FlowHub: cross-tile inbox of pending Flow nodes.
 *
 * Five tab-filters mirror the backend (`GET /api/flows/hub?filter=…`):
 *   mine      Palla mia (open leaves in state='mine')
 *   theirs    In attesa di loro (open leaves in state='theirs')
 *   due_soon  Scheduled within next 48h
 *   stalled   Open leaves untouched > N days
 *   blocked   state='blocked'
 *
 * Each card is a deep-link into /canvas — `?tile=<id>&flow=<node_id>` — which
 * canvas/page.tsx resolves by picking a tag the tile belongs to, then opens
 * FlowTrack with that node pre-selected.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconRoute, IconClock, IconUserCheck, IconUserOff, IconHourglassHigh, IconLock, IconRefresh } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { useFlowHub, type FlowHubFilter } from '@/lib/hooks/useFlowHub';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { cn } from '@/lib/utils';
import type { FlowHubItem } from '@/types/flow';

const TABS: Array<{ key: FlowHubFilter; label: string; icon: typeof IconClock; tint: string }> = [
  { key: 'mine',     label: 'Palla mia',        icon: IconUserCheck,   tint: '#378ADD' },
  { key: 'theirs',   label: 'In attesa di loro', icon: IconUserOff,     tint: '#EF9F27' },
  { key: 'due_soon', label: 'In scadenza',      icon: IconClock,       tint: '#A78BFA' },
  { key: 'stalled',  label: 'Fermi',            icon: IconHourglassHigh, tint: '#94A3B8' },
  { key: 'blocked',  label: 'Bloccati',         icon: IconLock,        tint: '#E24B4A' },
];

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
  const stateColor = FLOW_STATE_COLORS[item.state];
  const stateLabel = FLOW_STATE_LABELS[item.state];
  const isDue = item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {/* State dot */}
        <div
          className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stateColor }}
          title={stateLabel}
        />

        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* Tile title (top, small, muted) */}
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 truncate">
            {item.tile.title || '(senza titolo)'}
          </div>
          {/* Node label */}
          <div className="text-sm text-zinc-100 group-hover:text-white truncate mt-0.5">
            {item.label || <span className="italic text-zinc-500">(senza etichetta)</span>}
          </div>
          {/* Footer row */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
            <span
              className="px-1.5 py-0.5 rounded font-medium leading-none"
              style={{
                backgroundColor: `${stateColor}26`,
                color: stateColor,
                border: `1px solid ${stateColor}55`,
              }}
            >
              {stateLabel}
            </span>
            {item.contact && (
              <span
                className="px-1.5 py-0.5 rounded leading-none border"
                style={{
                  color: item.contact.color || '#A1A1AA',
                  borderColor: item.contact.color ? `${item.contact.color}55` : '#3F3F46',
                }}
              >
                {item.contact.name}
              </span>
            )}
            {item.scheduled_at && (
              <span className={cn('flex items-center gap-1', isDue && 'text-red-400')}>
                <IconClock size={11} />
                {formatScheduled(item.scheduled_at)}
              </span>
            )}
            {!item.scheduled_at && item.days_since_activity > 0 && (
              <span>{item.days_since_activity}g fa</span>
            )}
          </div>
          {item.notes && (
            <div className="mt-2 text-xs text-zinc-400 line-clamp-2 whitespace-pre-wrap">
              {item.notes}
            </div>
          )}
        </div>

        {/* Right: occurred_at */}
        {item.occurred_at && (
          <div className="text-[10px] text-zinc-500 shrink-0">
            {formatDate(item.occurred_at)}
          </div>
        )}
      </div>
    </button>
  );
}

export default function FlowsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FlowHubFilter>('mine');
  const [stalledDays, setStalledDays] = useState(7);

  const { items, isLoading, isError, refetch } = useFlowHub(
    filter,
    filter === 'stalled' ? stalledDays : undefined,
  );

  const handleOpen = (item: FlowHubItem) => {
    // Canvas resolves missing ?tag= by picking the tile's first non-root tag.
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
              const Icon = tab.icon;
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
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Stalled days control */}
          {filter === 'stalled' && (
            <div className="mb-4 flex items-center gap-2 text-xs text-zinc-400">
              <span>Soglia:</span>
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setStalledDays(d)}
                  className={cn(
                    'h-6 px-2 rounded text-[11px] font-medium transition-colors',
                    stalledDays === d
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {d}g
                </button>
              ))}
            </div>
          )}

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
                {filter === 'mine' && 'Quando avrai dei task aperti tocca a te qui appariranno'}
                {filter === 'theirs' && 'Le palle in mano agli altri compariranno qui'}
                {filter === 'due_soon' && 'I task pianificati nelle prossime 48h compariranno qui'}
                {filter === 'stalled' && `I flussi fermi da più di ${stalledDays} giorni compariranno qui`}
                {filter === 'blocked' && 'I nodi marcati come "Bloccato" compariranno qui'}
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
