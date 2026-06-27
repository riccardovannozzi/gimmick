'use client';

/**
 * Gimmick · Obsidian — Flows view (board per stato).
 *
 * "Tilo segue i flussi aperti": status lanes (Wait/Undo/Done/Stop) of flow
 * cards (tag, title, action → owner, timing). Reference: GimmickFlows.dc.html.
 * State colors map to the semantic tokens. Self-contained — drop into the
 * shell's ViewContainer with `hideToolbar`.
 */
import * as React from 'react';
import { IconCheck, IconHourglass, IconArrowBackUp, IconX, IconArrowRight } from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon } from '@/components/shell';

// ─── State → semantic token + icon ────────────────────────────────────────────
export type FlowState = 'wait' | 'undo' | 'done' | 'stop';
const STATE: Record<FlowState, { color: string; label: string; Icon: React.ComponentType<{ size?: number; stroke?: number }> }> = {
  wait: { color: 'var(--ob-warning)', label: 'Wait', Icon: IconHourglass },
  undo: { color: 'var(--ob-info)', label: 'Undo', Icon: IconArrowBackUp },
  done: { color: 'var(--ob-success)', label: 'Done', Icon: IconCheck },
  stop: { color: 'var(--ob-error)', label: 'Stop', Icon: IconX },
};

export interface Flow {
  tag: string;
  title: string;
  action: string;
  who: string;
  ago: string;
  date: string;
  /** Presenti quando la vista è collegata ai dati reali (deep-link al canvas). */
  tileId?: string;
  nodeId?: string;
}
export interface FlowLane {
  label: string;
  state: FlowState;
  flows: Flow[];
}

const LANES: FlowLane[] = [
  { label: 'WAIT', state: 'wait', flows: [
    { tag: 'RUSLAN_VIA SARDEGNA', title: 'Ruslan/inviare messaggio', action: 'Aggiornare documenti', who: 'IO', ago: '5g fa', date: '22 Giu' },
    { tag: 'OM_PADEL', title: 'OM/Richiesta preventivo', action: 'Attesa preventivo', who: 'L. Anichini', ago: '5g fa', date: '22 Giu' },
    { tag: 'GDS_VARIE', title: 'GDS/Area matrimoni', action: 'Attesa firme', who: 'N. Mainetti', ago: '5g fa', date: '22 Giu' },
    { tag: 'CONSORZIO BONIFICA', title: 'Richiesta informazioni', action: '(senza etichetta)', who: 'Consorzio', ago: '12g fa', date: '15 Giu' },
  ] },
  { label: 'UNDO', state: 'undo', flows: [
    { tag: 'OM_REPORT', title: 'OM/Revisione report', action: 'Da rivedere', who: 'IO', ago: '2g fa', date: '25 Giu' },
    { tag: 'GDS_FOTOVOLTAICO', title: 'GDS/Calcolo resa', action: 'Ricontrollare dati', who: 'M. Renai', ago: '3g fa', date: '24 Giu' },
  ] },
  { label: 'DONE', state: 'done', flows: [
    { tag: 'GDS_PULIZIA', title: 'GDS/Pulizia pannelli', action: 'Completato', who: 'L. Alessi', ago: '1g fa', date: '26 Giu' },
    { tag: 'OM_VARIE', title: 'OM/Cartelli rotonda', action: 'Consegnato', who: 'IO', ago: '4g fa', date: '23 Giu' },
  ] },
  { label: 'STOP', state: 'stop', flows: [
    { tag: 'MONEY', title: 'Fattura Galaxia', action: 'Sospeso', who: 'Commercialista', ago: '8g fa', date: '19 Giu' },
  ] },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────
function FlowCard({ flow, state, onOpen }: { flow: Flow; state: FlowState; onOpen?: () => void }) {
  const s = STATE[state];
  return (
    <div
      className="ob-flows__card"
      style={{ ['--st-c' as string]: s.color, ...(onOpen ? { cursor: 'pointer' } : null) }}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      <div className="ob-flows__card-top">
        <div className="ob-flows__card-main">
          <div className="ob-flows__card-tag">{flow.tag}</div>
          <div className="ob-flows__card-title">{flow.title}</div>
        </div>
        <span className="ob-flows__card-badge"><s.Icon size={14} stroke={1.6} /></span>
      </div>
      <div className="ob-flows__card-action">
        <span className="ob-flows__card-action-text">{flow.action}</span>
        <span className="ob-flows__card-arrow"><IconArrowRight size={13} stroke={1.6} /></span>
        <span className="ob-flows__card-who">
          <span className="ob-flows__card-who-icon"><Icon name="person" size={11} /></span>
          <span className="ob-flows__card-who-name">{flow.who}</span>
        </span>
      </div>
      <div className="ob-flows__card-foot">
        <span className="ob-flows__card-ago">{flow.ago}</span>
        <span className="ob-flows__card-date">{flow.date}</span>
      </div>
    </div>
  );
}

function Lane({ lane, onOpenFlow }: { lane: FlowLane; onOpenFlow?: (tileId: string, nodeId: string) => void }) {
  const s = STATE[lane.state];
  return (
    <div className="ob-flows__lane" style={{ ['--st-c' as string]: s.color }}>
      <div className="ob-flows__lane-head">
        <span className="ob-flows__lane-badge"><s.Icon size={13} stroke={1.6} /></span>
        <span className="ob-flows__lane-label">{lane.label}</span>
        <span className="ob-flows__lane-count">{lane.flows.length}</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="ob-flows__lane-add" aria-label="Aggiungi flusso"><Icon name="plus" size={13} /></button>
      </div>
      <div className="ob-flows__lane-body ob-scroll">
        {lane.flows.length
          ? lane.flows.map((f, i) => (
              <FlowCard
                key={f.nodeId ?? i}
                flow={f}
                state={lane.state}
                onOpen={
                  onOpenFlow && f.tileId && f.nodeId
                    ? () => onOpenFlow(f.tileId!, f.nodeId!)
                    : undefined
                }
              />
            ))
          : <div className="ob-flows__empty">NESSUN FLUSSO</div>}
      </div>
    </div>
  );
}

export interface FlowsViewProps {
  lanes?: FlowLane[];
  /** Click su una card → deep-link al canvas (tile + nodo flow). */
  onOpenFlow?: (tileId: string, nodeId: string) => void;
}

export function FlowsView({ lanes = LANES, onOpenFlow }: FlowsViewProps) {
  return (
    <div className="ob-flows">
      {/* Toolbar / header */}
      <div className="ob-flows__toolbar">
        <span className="ob-flows__mascot"><Beniamino name="tilo" size={26} title="" /></span>
        <div>
          <div className="ob-flows__title">Flows</div>
          <div className="ob-flows__sub">Tilo segue i flussi aperti</div>
        </div>
        <div style={{ flex: 1 }} />
        {(['done', 'wait', 'undo', 'stop'] as FlowState[]).map((st) => {
          const s = STATE[st];
          return (
            <button key={st} type="button" className="ob-flows__filter" style={{ ['--st-c' as string]: s.color }}>
              <span className="ob-flows__filter-icon"><s.Icon size={13} stroke={1.6} /></span>
              {s.label}
            </button>
          );
        })}
        <div className="ob-flows__div" />
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />}>Flusso</Button>
      </div>

      {/* Board */}
      <div className="ob-flows__board ob-scroll">
        {lanes.map((l) => <Lane key={l.label} lane={l} onOpenFlow={onOpenFlow} />)}
      </div>
    </div>
  );
}
