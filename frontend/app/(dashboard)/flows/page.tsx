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
import { usePixelTheme } from '@/components/pixel';
import { useFlowHub, type FlowHubFilter } from '@/lib/hooks/useFlowHub';
import { FLOW_STATE_COLORS, FLOW_STATE_LABELS } from '@/lib/flow-colors';
import { StatusIcon } from '@/components/flow/FlowNodeView';
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
  const theme = usePixelTheme();
  const [hover, setHover] = useState(false);
  const isSelf = isItemSelf(item);
  const ownerLabel = isSelf ? 'Palla mia' : item.contact?.name ?? 'Palla loro';
  const stateLabel = FLOW_STATE_LABELS[item.state];
  const pillLabel = item.state !== 'active' ? stateLabel : ownerLabel;
  const isDue = item.scheduled_at && new Date(item.scheduled_at).getTime() < Date.now();

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-press"
      style={{
        width: '100%',
        textAlign: 'left',
        background: hover ? theme.surface : theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: hover ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
        transition: 'background 100ms',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto',
          gap: 16,
          alignItems: 'center',
        }}
      >
        {/* Column 1 — tag (top) + tile title (bottom) */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: theme.ink3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.tile.tag?.name || ' '}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 13,
              fontWeight: 600,
              color: theme.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2,
            }}
          >
            {item.tile.title || '(senza titolo)'}
          </div>
        </div>

        {/* Column 2 — node label (top) + contact pill (bottom) */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, paddingLeft: 24 }}>
          <span
            style={{
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 12,
              color: theme.ink2,
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.label || <span style={{ fontStyle: 'italic', color: theme.ink3 }}>(senza etichetta)</span>}
          </span>
          {item.contact ? (
            <span
              style={{
                padding: '3px 6px',
                lineHeight: 1,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: item.contact.color || theme.ink2,
                border: `2px solid ${theme.border}`,
                background: theme.surfaceVariant,
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.contact.is_self ? `[ ${item.contact.name} ]` : item.contact.name}
            </span>
          ) : (
            <span style={{ height: 18 }} />
          )}
        </div>

        {/* Column 3 — mini badge */}
        <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title={pillLabel}>
          <FlowMiniBadge isSelf={isSelf} state={item.state} />
        </span>
      </div>

      {(item.scheduled_at || (!item.scheduled_at && item.days_since_activity > 0) || item.notes) && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink3,
          }}
        >
          {item.scheduled_at && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: isDue ? '#E24B4A' : theme.ink3,
              }}
            >
              <IconClock size={11} />
              {formatScheduled(item.scheduled_at)}
            </span>
          )}
          {!item.scheduled_at && item.days_since_activity > 0 && (
            <span>{item.days_since_activity}g fa</span>
          )}
          {item.occurred_at && (
            <span style={{ marginLeft: 'auto' }}>{formatDate(item.occurred_at)}</span>
          )}
        </div>
      )}
      {item.notes && (
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink2,
            whiteSpace: 'pre-wrap',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.notes}
        </div>
      )}
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
  const theme = usePixelTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<FlowHubFilter>('wait');
  const [refreshHover, setRefreshHover] = useState(false);

  const { items, isLoading, isError, refetch } = useFlowHub(filter);

  const handleOpen = (item: FlowHubItem) => {
    router.push(`/canvas?tile=${item.tile_id}&flow=${item.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg1 }}>
      <Header />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', padding: '24px' }}>
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
            <button
              onClick={() => refetch()}
              onMouseEnter={() => setRefreshHover(true)}
              onMouseLeave={() => setRefreshHover(false)}
              className="px-press"
              title="Aggiorna"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 10px',
                background: refreshHover ? theme.surface : theme.surfaceVariant,
                color: theme.ink2,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <IconRefresh size={12} />
              Aggiorna
            </button>
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
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className="px-press"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: '0 10px',
                    background: isActive ? tab.tint : theme.surfaceVariant,
                    color: isActive ? '#000' : theme.ink2,
                    border: `2px solid ${theme.border}`,
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: isActive ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
                  }}
                >
                  <StateGlyph state={tab.key} color={isActive ? '#000' : tab.tint} size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

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
              {items.map((item) => (
                <FlowItemCard key={item.id} item={item} onOpen={() => handleOpen(item)} />
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
  );
}
