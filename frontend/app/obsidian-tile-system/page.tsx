'use client';

/**
 * Gimmick · Obsidian — Anteprima del sistema visivo dei Tile.
 *
 * Rotta di sola progettazione: /obsidian-tile-system. Monta il componente
 * `Tile` reale con dati finti, in chiaro e in scuro, per verificare la lista
 * dello STEP 5 a occhio. Non tocca nessuna vista, si cancella con un `rm`.
 */
import * as React from 'react';
import { Tile } from '@/components/tiles/Tile';
import { DEFAULT_ACTION_COLORS } from '@/lib/palette';
import { OB_TEXT, OB_WEIGHT, OB_LEADING } from '@/lib/theme/ob-typography';
import type { StepState, TileStatus, TileVisualKey } from '@/lib/tile-visual';

// `flow` non ha ancora un colore nelle impostazioni: finché il valore non
// esiste nel database non esiste nemmeno la sua voce nel picker. Qui uso
// l'accento come segnaposto — è l'unico hex di questa pagina, e sta in
// un'anteprima, non in un componente.
const ACCENT: Record<TileVisualKey, string> = { ...DEFAULT_ACTION_COLORS, flow: '#AB9FF2' };

const S = (...s: StepState[]) => s;

type Row = { label: string; tiles: Array<React.ComponentProps<typeof Tile>> };

const ROWS: Row[] = [
  {
    label: 'I SEI TIPI · stato active',
    tiles: [
      { title: 'Appunti riunione con Mario', visualKey: 'none', accent: ACCENT.none },
      { title: 'Chiamare fornitore per preventivo', visualKey: 'anytime', accent: ACCENT.anytime },
      { title: 'Consegna progetto esecutivo', visualKey: 'deadline', accent: ACCENT.deadline, meta: '12 ago' },
      { title: 'Rassegna stampa mattutina', visualKey: 'allday', accent: ACCENT.allday, meta: '14 ago' },
      { title: 'Riunione clienti in studio', visualKey: 'event', accent: ACCENT.event, meta: '13:00–14:00' },
      { title: 'Pratica notaio Bianchi', visualKey: 'flow', accent: ACCENT.flow, meta: '2 di 4', steps: S('done', 'done', 'pending', 'pending') },
    ],
  },
  {
    label: 'STATUS · il footer sinistro parla solo quando serve',
    tiles: [
      { title: 'Rogito Bianchi', visualKey: 'flow', accent: ACCENT.flow, status: 'blocked', meta: '1 di 5', steps: S('done', 'blocked', 'pending', 'pending', 'pending') },
      { title: 'Pratica catastale', visualKey: 'flow', accent: ACCENT.flow, status: 'done', steps: S('done', 'done', 'done') },
      { title: 'Pratica notaio Rossi', visualKey: 'flow', accent: ACCENT.flow, status: 'cancelled', steps: S('cancelled', 'cancelled') },
      { title: 'Verifica strutturale', visualKey: 'anytime', accent: ACCENT.anytime, status: 'paused' },
      { title: 'Collaudo impianto elettrico', visualKey: 'event', accent: ACCENT.event, status: 'blocked', meta: '09:30–11:00' },
    ],
  },
  {
    label: 'STEPPER · oltre il quinto segmento, e la regola del rosso',
    tiles: [
      { title: 'Concessione demaniale', visualKey: 'flow', accent: ACCENT.flow, meta: '2 di 9', steps: S('done', 'done', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending') },
      { title: 'Allaccio Open Fiber', visualKey: 'flow', accent: ACCENT.flow, meta: '4 di 6', steps: S('done', 'done', 'done', 'done', 'pending', 'pending') },
      { title: 'Voltura utenze', visualKey: 'flow', accent: ACCENT.flow, meta: '1 di 3', steps: S('done', 'blocked', 'pending') },
      { title: 'Titolo molto lungo che deve troncare alla seconda riga senza rompere il footer', visualKey: 'flow', accent: ACCENT.flow, meta: '0 di 2', steps: S('pending', 'pending') },
    ],
  },
  {
    label: 'PRIORITÀ DEL FOOTER · status vince, il metadato cede',
    tiles: [
      { title: 'Status corto, metadato entra', visualKey: 'event', accent: ACCENT.event, status: 'paused', meta: '13:00–14:00' },
      { title: 'Status lungo, metadato scompare', visualKey: 'flow', accent: ACCENT.flow, status: 'done', meta: '12 di 14', steps: S('done', 'done') },
      { title: 'Nessuno status, metadato pieno', visualKey: 'deadline', accent: ACCENT.deadline, meta: '30 settembre' },
    ],
  },
];

/**
 * Sonda tipografica. Invece di discutere di che carattere sia, lo si guarda:
 * la stessa frase resa in modo esplicito nei due token e poi dentro un `Tile`
 * vero. Se la terza riga non combacia con la prima, il tile non sta usando il
 * font che crede.
 */
function FontProbe() {
  const SAMPLE = 'Appunti riunione con Mario · 12 ago';
  const row = (label: string, style: React.CSSProperties) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
      <span style={{ width: 190, flexShrink: 0, fontSize: OB_TEXT.meta, color: '#6b7079', fontFamily: 'var(--ob-font-mono)' }}>{label}</span>
      <span style={{ fontSize: OB_TEXT.card, fontWeight: OB_WEIGHT.emphasis, letterSpacing: '-0.01em', color: '#e8e9ec', ...style }}>{SAMPLE}</span>
    </div>
  );
  return (
    <div data-theme="dark" style={{ background: '#1c1d21', border: '1px solid #2a2c31', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {row('--ob-font-sans (atteso)', { fontFamily: 'var(--ob-font-sans)' })}
      {row('--ob-font-mono (confronto)', { fontFamily: 'var(--ob-font-mono)' })}
      {row('ereditato dal body', {})}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
        <span style={{ width: 190, flexShrink: 0, fontSize: OB_TEXT.meta, color: '#6b7079', fontFamily: 'var(--ob-font-mono)' }}>dentro un Tile vero</span>
        <Tile title={SAMPLE} visualKey="none" accent={ACCENT.none} />
      </div>
    </div>
  );
}

function Frame({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <div
      data-theme={mode}
      style={{
        background: 'var(--ob-canvas)', border: '1px solid var(--ob-line-2)',
        borderRadius: 16, padding: '4px 20px 22px',
        boxShadow: '0 30px 80px -40px rgba(0,0,0,0.45)',
      }}
    >
      {ROWS.map((r) => (
        <div key={r.label}>
          <div style={{
            fontSize: OB_TEXT.eyebrow, fontFamily: 'var(--ob-font-mono)', letterSpacing: '0.13em',
            color: 'var(--ob-subtle)', margin: '20px 0 4px',
          }}>{r.label}</div>
          {/* La gronda di 9px vive sulla CELLA, non sul tile: il rettangolo
              del tile resta 180×100 e l'allineamento non si sposta. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {r.tiles.map((t, i) => (
              <div key={i} style={{ paddingTop: 9 }}><Tile {...t} /></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TileSystemPreview() {
  return (
    <div style={{ minHeight: '100vh', background: '#16171a', padding: 32, display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: OB_WEIGHT.emphasis, color: '#fff', margin: 0 }}>Sistema visivo dei Tile</h1>
        <p style={{ fontSize: OB_TEXT.control, color: '#8a8f98', margin: '6px 0 0', maxWidth: 780, lineHeight: OB_LEADING.text }}>
          Cinque canali su cinque zone che non collidono: bordo, badge d&apos;angolo, strip, footer sinistro,
          footer destro. <b>Note</b> è l&apos;unico completamente muto e si identifica per sottrazione.
          Il rosso appare solo sui passi <b>bloccati</b>, mai su quelli semplicemente non fatti.
        </p>
      </div>
      <FontProbe />
      <Frame mode="dark" />
      <Frame mode="light" />
    </div>
  );
}
