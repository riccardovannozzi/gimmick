'use client';

/**
 * Gimmick · Obsidian — Flows view collegata ai dati reali (Fase 2, read-only).
 *
 * La `FlowsView` Obsidian è una board a 4 lane (Wait/Undo/Done/Stop) mostrate
 * contemporaneamente: per popolarle interroghiamo l'hub una volta per stato
 * (`useFlowHub`), mappiamo `FlowHubItem` → `Flow` e costruiamo le lane.
 *
 * Read-only: il click su una card fa deep-link al canvas
 * (`/canvas?tile=<id>&flow=<nodeId>`), come la pagina FlowHub arcade. Nessuna
 * mutation in questa fase.
 */
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FlowsView, type FlowLane } from '@/components/views/flows';
import { useFlowHub } from '@/lib/hooks/useFlowHub';
import type { FlowHubItem } from '@/types/flow';

function ago(item: FlowHubItem): string {
  const d = item.days_since_activity;
  return d > 0 ? `${d}g fa` : 'oggi';
}

function shortDate(item: FlowHubItem): string {
  const ref = item.scheduled_at || item.occurred_at || item.created_at;
  if (!ref) return '';
  const d = new Date(ref);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

function toFlow(item: FlowHubItem) {
  const isSelf = !item.contact || item.contact.is_self;
  return {
    tag: item.tile.tag?.name || '—',
    title: item.tile.title || '(senza titolo)',
    action: item.label || '(senza etichetta)',
    who: isSelf ? 'IO' : item.contact?.name ?? '—',
    ago: ago(item),
    date: shortDate(item),
    tileId: item.tile_id,
    nodeId: item.id,
  };
}

export function FlowsLive() {
  const router = useRouter();
  const wait = useFlowHub('wait');
  const undo = useFlowHub('undo');
  const done = useFlowHub('done');
  const stop = useFlowHub('stop');

  // Ordine lane come nel design DC: Wait · Undo · Done · Stop.
  const lanes: FlowLane[] = useMemo(
    () => [
      { label: 'WAIT', state: 'wait', flows: wait.items.map(toFlow) },
      { label: 'UNDO', state: 'undo', flows: undo.items.map(toFlow) },
      { label: 'DONE', state: 'done', flows: done.items.map(toFlow) },
      { label: 'STOP', state: 'stop', flows: stop.items.map(toFlow) },
    ],
    [wait.items, undo.items, done.items, stop.items],
  );

  const initialLoading =
    wait.isLoading && undo.isLoading && done.isLoading && stop.isLoading;

  if (initialLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ob-subtle)',
          fontSize: 13,
          fontFamily: 'var(--ob-font-sans)',
        }}
      >
        Caricamento…
      </div>
    );
  }

  return (
    <FlowsView
      lanes={lanes}
      onOpenFlow={(tileId, nodeId) => router.push(`/canvas?tile=${tileId}&flow=${nodeId}`)}
    />
  );
}
