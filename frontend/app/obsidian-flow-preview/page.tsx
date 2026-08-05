'use client';

/**
 * Gimmick · Obsidian — Anteprima della colonna FLOW e della card a scaletta.
 *
 * Rotta di sola progettazione: /obsidian-flow-preview. Non tocca nessuna vista
 * reale, non legge dati, non chiama il backend. Si cancella senza conseguenze.
 *
 * ─── Il modello che mette alla prova ─────────────────────────────────────────
 *
 * Un FLOW non ha una macchina propria: è un tile la cui LISTA è la sostanza.
 * I passi sono `tile_subtasks` — la stessa checklist che ogni tile ha già — non
 * una seconda entità parallela. Di conseguenza `flow_nodes` sparisce.
 *
 * La lista vive nella STRIP di sinistra come scaletta di segmenti impilati:
 * uno per passo, dal primo in alto all'ultimo in basso. Verde = fatto.
 * Sostituisce le barrette orizzontali di oggi (`.ob-chrono__card-bars`), che
 * dicono la stessa cosa occupando spazio nel piede.
 *
 * L'anello della versione precedente è stato buttato: a 11px dentro la strip si
 * confondeva col badge azione nel piede — due cerchietti a pochi pixel di
 * distanza che volevano dire cose diverse.
 *
 * ─── La decisione lasciata aperta ────────────────────────────────────────────
 *
 * Il rosso. Sotto trovi le DUE varianti affiancate, stessa card:
 *   A — rosso/verde: i passi aperti sono rossi finché non li chiudi.
 *   B — neutro/verde: i passi aperti sono grigi; il rosso resta riservato a ciò
 *       che è in ritardo, come già fa il tratteggio delle deadline.
 * Con A un FLOW appena nato è una barra rossa piena. Guarda le due colonne e
 * decidi se è l'allarme che vuoi o rumore che imparerai a ignorare.
 */
import * as React from 'react';
import {
  IconArrowsExchange, IconChevronLeft, IconArrowsSort, IconFilter,
  IconNote, IconChecklist, IconUser, IconHourglass, IconAlertTriangle, IconCheck,
  IconArrowNarrowRight, IconPlus,
} from '@tabler/icons-react';
import { OB_TEXT, OB_WEIGHT, OB_LEADING } from '@/lib/theme/ob-typography';

type Step = { label: string; done: boolean; who?: string };
type Card = {
  title: string;
  steps: Step[];
  /** Colore dello status, quando il tile ne ha uno. Convive con la scaletta. */
  status?: string;
  /** Tag del tile — nella vista /flows è la prima riga della card. */
  tag?: string;
  /** Giorni dall'ultimo movimento. Oltre la soglia il flow finisce in FERMI. */
  idleDays?: number;
  /** Limite sulla conclusione → bordo tratteggiato, come le deadline. */
  limit?: string;
  color?: string;
  /** Tile marcato DONE: tutti i passi valgono come validati. */
  done?: boolean;
};

// ─── LA SCALETTA ─────────────────────────────────────────────────────────────
/**
 * Un segmento per passo, impilati nella strip da 16px. È la stessa informazione
 * delle barrette orizzontali di oggi, ruotata di 90°: verticale segue l'ordine
 * di lettura della lista (primo in alto), e libera il piede.
 *
 * `openTone` è la variante in prova: 'red' o 'neutral' per i passi non fatti.
 */
function StatusDot({ color }: { color: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />;
}

function Ladder({ steps, done, openTone }: { steps: Step[]; done?: boolean; openTone: 'red' | 'neutral' }) {
  const openColor = openTone === 'red' ? 'var(--ob-danger)' : 'var(--ob-line-2)';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      flex: 1, minHeight: 0, width: '100%', padding: '5px 4px', boxSizing: 'border-box',
    }}>
      {steps.map((s, i) => (
        <div
          key={i}
          title={`${s.label}${s.who ? ` — ${s.who}` : ''}`}
          style={{
            flex: 1, minHeight: 3, borderRadius: 1,
            background: (s.done || done) ? 'var(--ob-success)' : openColor,
          }}
        />
      ))}
    </div>
  );
}

// ─── LA CARD ─────────────────────────────────────────────────────────────────
/**
 * Stessa scatola delle card Notes/Todo (150×80). Cambiano due inquilini:
 *   strip     → la scaletta dei passi, al posto dello swatch di status
 *   riga meta → il PROSSIMO passo aperto, che è l'unica cosa azionabile
 * Il piede porta l'avanzamento in mono (3/7) e, quando c'è, chi ha la palla.
 */
function FlowCard({ c, openTone }: { c: Card; openTone: 'red' | 'neutral' }) {
  const doneCount = c.done ? c.steps.length : c.steps.filter((s) => s.done).length;
  const next = c.done ? undefined : c.steps.find((s) => !s.done);
  const complete = doneCount === c.steps.length;

  return (
    <div
      className="ob-chrono__card"
      style={{
        ['--card-c' as string]: c.color ?? 'var(--ob-tile-bg)',
        ...(c.color ? {} : { background: 'var(--ob-tile-bg)', borderColor: 'var(--ob-tile-border)' }),
        ...(c.limit ? { borderStyle: 'dashed', borderColor: 'var(--ob-danger)' } : {}),
        ...(c.done ? { opacity: 0.6 } : {}),
      }}
    >
      {/* La strip non è più decorativa: è la lista. Lo STATUS non se ne va —
          resta in cima come pallino, la scaletta occupa il resto. Una regola
          sola per ogni tipo di tile: "la strip è lo stato di questa cosa". */}
      <div className="ob-chrono__card-strip" style={{ padding: 0, flexDirection: 'column' }}>
        {c.status && <StatusDot color={c.status} />}
        <Ladder steps={c.steps} done={c.done} openTone={openTone} />
      </div>

      <div className="ob-chrono__card-main">
        <div className="ob-chrono__card-title" style={c.done ? { textDecoration: 'line-through' } : undefined}>
          {c.title}
        </div>

        <div className="ob-chrono__card-bottom">
          {/* PROSSIMO PASSO. Non la condizione finale: quella la leggi aprendo
              il tile. Qui serve ciò su cui puoi agire adesso. */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3, minWidth: 0,
            fontSize: OB_TEXT.micro, lineHeight: OB_LEADING.none,
            color: complete ? 'var(--ob-success)' : 'var(--ob-muted)',
          }}>
            <span style={{ flexShrink: 0, opacity: 0.7 }}>{complete ? '✓' : '▸'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {complete ? 'tutti i passi chiusi' : next?.label}
            </span>
          </div>

          <div className="ob-chrono__card-foot">
            <span className="ob-chrono__card-actbadge" title="FLOW">
              <IconArrowsExchange size={11} color="var(--ob-text)" />
            </span>
            {c.limit && (
              <span style={{
                fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow,
                color: 'var(--ob-danger)', letterSpacing: '0.04em', marginLeft: 4,
              }}>{c.limit}</span>
            )}
            <div style={{ flex: 1 }} />
            {/* Chi ha la palla sul prossimo passo: c'è solo se l'hai compilato. */}
            {next?.who && (
              <span style={{
                fontSize: OB_TEXT.micro, lineHeight: OB_LEADING.none, color: 'var(--ob-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60,
              }}>{next.who}</span>
            )}
            <span style={{
              fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow,
              color: 'var(--ob-subtle)', marginLeft: 5,
            }}>{doneCount}/{c.steps.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CARD NOTES/TODO, per il confronto di famiglia ───────────────────────────
function PlainCard({ title, kind, steps, status, openTone }: {
  title: string; kind: 'note' | 'todo'; steps?: Step[]; status?: string; openTone: 'red' | 'neutral';
}) {
  return (
    <div className="ob-chrono__card ob-chrono__card--plain" style={{ ['--card-c' as string]: 'var(--ob-tile-bg)' }}>
      {/* La lista è disponibile su OGNI tipo di tile, non solo sui FLOW: se il
          tile ha dei passi, la strip li mostra allo stesso modo. */}
      {(steps || status) && (
        <div className="ob-chrono__card-strip" style={{ padding: 0, flexDirection: 'column' }}>
          {status && <StatusDot color={status} />}
          {steps && <Ladder steps={steps} openTone={openTone} />}
        </div>
      )}
      <div className="ob-chrono__card-main">
        <div className="ob-chrono__card-title">{title}</div>
        <div className="ob-chrono__card-bottom">
          <div className="ob-chrono__card-foot">
            {kind === 'todo' && (
              <span className="ob-chrono__card-actbadge"><IconChecklist size={11} color="var(--ob-text)" /></span>
            )}
            <div style={{ flex: 1 }} />
            {steps && (
              <span style={{ fontFamily: 'var(--ob-font-mono)', fontSize: OB_TEXT.eyebrow, color: 'var(--ob-subtle)' }}>
                {steps.filter((s) => s.done).length}/{steps.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COLONNA ─────────────────────────────────────────────────────────────────
function Col({ label, icon, color, count, children }: {
  label: string; icon: React.ReactNode; color: string; count: number; children: React.ReactNode;
}) {
  return (
    <div className="ob-chrono__col">
      <div className="ob-chrono__colhead">
        <button type="button" className="ob-chrono__colhead-collapse"><IconChevronLeft size={13} /></button>
        <span className="ob-chrono__colhead-icon" style={{ color }}>{icon}</span>
        <span className="ob-chrono__colhead-label">{label}</span>
        <span className="ob-chrono__colhead-count">{count}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__colhead-btns">
          <button type="button" className="ob-chrono__colhead-btn"><IconArrowsSort size={12} /></button>
          <button type="button" className="ob-chrono__colhead-btn"><IconFilter size={12} /></button>
        </div>
      </div>
      <div className="ob-chrono__colbody ob-scroll-quiet">{children}</div>
    </div>
  );
}

const FLOWS: Card[] = [
  {
    title: 'Permesso a costruire Montieri', color: '#5B8DEF', status: '#F2C94C',
    tag: 'LAVORO', idleDays: 23,
    steps: [
      { label: 'domanda protocollata', done: true },
      { label: 'integrazione documenti', done: true, who: 'Geom. Bini' },
      { label: 'sollecito al Comune', done: false, who: 'Comune' },
      { label: 'parere commissione', done: false, who: 'Comune' },
      { label: 'permesso rilasciato', done: false },
    ],
  },
  {
    title: 'Preventivo impianto Sorano', tag: 'LAVORO', idleDays: 3,
    steps: [
      { label: 'sopralluogo', done: true },
      { label: 'preventivo firmato', done: false, who: 'Cliente' },
    ],
  },
  {
    title: 'Allaccio Open Fiber', color: '#AB9FF2', tag: 'CASA', idleDays: 1,
    steps: [
      { label: 'richiesta inviata', done: true },
      { label: 'verifica copertura', done: true },
      { label: 'appuntamento tecnico', done: false, who: 'Marco' },
      { label: 'scavo', done: false, who: 'Ditta' },
      { label: 'collaudo', done: false },
      { label: 'allaccio attivo', done: false },
    ],
  },
  {
    title: 'Rinnovo polizza studio', limit: '30 GIU', tag: 'STUDIO', idleDays: 6,
    steps: [
      { label: 'richiesta quotazione', done: true },
      { label: 'confronto offerte', done: false },
      { label: 'polizza emessa', done: false, who: 'Broker' },
    ],
  },
  {
    title: 'Prove di carico Borgo Santo Pietro', tag: 'LAVORO', idleDays: 2,
    steps: [
      { label: 'incarico al laboratorio', done: true },
      { label: 'preparare richiesta', done: false },
      { label: 'certificato ricevuto', done: false, who: 'Laboratorio' },
    ],
  },
  {
    title: 'Voltura utenze Borgo', done: true,
    steps: [
      { label: 'modulo inviato', done: true },
      { label: 'voltura confermata', done: true },
    ],
  },
];

function Frame({ mode, openTone }: { mode: 'light' | 'dark'; openTone: 'red' | 'neutral' }) {
  return (
    <div
      data-theme={mode}
      style={{
        background: 'var(--ob-canvas)', border: '1px solid var(--ob-line-2)',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px -40px rgba(0,0,0,0.45)',
        height: 470, display: 'flex',
      }}
    >
      <Col label="NOTES" icon={<IconNote size={14} />} color="#6FCF97" count={2}>
        <PlainCard kind="note" title="Codice fiscale ditta Rossi" openTone={openTone} />
        <PlainCard kind="note" title="Password wifi cantiere" openTone={openTone} status="#6FCF97" />
      </Col>
      <Col label="TO-DO" icon={<IconChecklist size={14} />} color="#F2C94C" count={2}>
        <PlainCard kind="todo" title="Ordinare le mascherine" openTone={openTone}
          steps={[{ label: 'chiedere preventivo', done: true }, { label: 'ordinare', done: false }, { label: 'ritirare', done: false }]} />
        <PlainCard kind="todo" title="Richiamare lo studio" openTone={openTone} />
      </Col>
      <Col label="FLOW" icon={<IconArrowsExchange size={14} />} color="#AB9FF2" count={FLOWS.length}>
        {FLOWS.map((c) => <FlowCard key={c.title} c={c} openTone={openTone} />)}
      </Col>
      <div style={{ flex: 1, background: 'var(--ob-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ob-subtle)', fontSize: OB_TEXT.meta }}>
        (griglia calendario)
      </div>
    </div>
  );
}

// ─── VISTA /flows, RIFATTA FLOW-CENTRIC ─────────────────────────────────────
/**
 * La board di oggi elenca i BEAT raggruppati per stato del beat (Wait/Undo/
 * Done/Stop). È la vista del vecchio modello: guarda i passi, non i processi.
 *
 * Qui elenca i FLOW, raggruppati per l'unica domanda che conta quando apri
 * questa pagina: **di chi è la palla**.
 *
 *   TOCCA A ME   il prossimo passo aperto non ha un contatto → dipende da te
 *   ASPETTO      il prossimo passo è su qualcun altro → da sollecitare
 *   FERMI        nessun movimento da oltre due settimane → quello che marcisce
 *   CONCLUSI     tutti i passi chiusi
 *
 * Regola: ogni flow compare in UNA sola corsia. FERMI vince su ASPETTO —
 * altrimenti la corsia che serve a stanare i dimenticati resterebbe vuota
 * proprio perché quei flow sono già elencati altrove.
 *
 * Il chrome delle corsie e la card sono quelli che esistono già
 * (`.ob-flows__lane*`, `.ob-flows__card*`): la struttura regge tale e quale,
 * cambia cosa ci metti dentro. L'unico pezzo nuovo è la scaletta al posto del
 * pallino di stato, così il linguaggio visivo è identico a quello di CHRONO.
 */
const IDLE_THRESHOLD = 14;

type LaneKey = 'mine' | 'waiting' | 'stalled' | 'closed';

function laneOf(c: Card): LaneKey {
  if (c.done || c.steps.every((s) => s.done)) return 'closed';
  if ((c.idleDays ?? 0) >= IDLE_THRESHOLD) return 'stalled';
  return c.steps.find((s) => !s.done)?.who ? 'waiting' : 'mine';
}

const LANES: Record<LaneKey, { label: string; color: string; Icon: typeof IconUser }> = {
  mine:    { label: 'TOCCA A ME', color: 'var(--ob-accent)',  Icon: IconUser },
  waiting: { label: 'ASPETTO',    color: '#5B8DEF',           Icon: IconHourglass },
  stalled: { label: 'FERMI',      color: 'var(--ob-warning)', Icon: IconAlertTriangle },
  closed:  { label: 'CONCLUSI',   color: 'var(--ob-success)', Icon: IconCheck },
};

/** Scaletta compatta: stessa grammatica della strip, formato badge. */
function LadderChip({ steps, done }: { steps: Step[]; done?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 10, height: 30, flexShrink: 0 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          flex: 1, minHeight: 2, borderRadius: 1,
          background: (s.done || done) ? 'var(--ob-success)' : 'var(--ob-line-2)',
        }} />
      ))}
    </div>
  );
}

function BoardCard({ c }: { c: Card }) {
  const next = c.steps.find((s) => !s.done);
  const doneCount = c.done ? c.steps.length : c.steps.filter((s) => s.done).length;
  const idle = c.idleDays ?? 0;
  const delayTone = idle >= IDLE_THRESHOLD ? 'mid' : idle > 0 ? 'low' : 'none';

  return (
    <div className="ob-flows__card">
      <LadderChip steps={c.steps} done={c.done} />
      <div className="ob-flows__card-main">
        {c.tag && <div className="ob-flows__card-tag">{c.tag}</div>}
        <div className="ob-flows__card-title">{c.title}</div>
      </div>
      {next ? (
        <div className="ob-flows__card-action">
          <span className="ob-flows__card-arrow"><IconArrowNarrowRight size={15} /></span>
          <span className="ob-flows__card-action-text">{next.label}</span>
        </div>
      ) : (
        <div className="ob-flows__card-action">
          <span className="ob-flows__card-arrow"><IconCheck size={15} /></span>
          <span className="ob-flows__card-action-text">tutti i passi chiusi</span>
        </div>
      )}
      {next?.who && (
        <div className="ob-flows__card-who">
          <span className="ob-flows__card-who-icon"><IconUser size={12} /></span>
          <span className="ob-flows__card-who-name">{next.who}</span>
        </div>
      )}
      <div className="ob-flows__card-meta">
        <span className="ob-flows__card-date">{doneCount}/{c.steps.length}</span>
        {idle > 0 && (
          <span className={`ob-flows__card-delay ob-flows__card-delay--${delayTone}`}>{idle}g</span>
        )}
      </div>
    </div>
  );
}

function Board({ mode }: { mode: 'light' | 'dark' }) {
  const order: LaneKey[] = ['mine', 'waiting', 'stalled', 'closed'];
  return (
    <div
      data-theme={mode}
      style={{
        background: 'var(--ob-canvas)', border: '1px solid var(--ob-line-2)',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px -40px rgba(0,0,0,0.45)',
        height: 460, display: 'flex', flexDirection: 'column',
      }}
    >
      <div className="ob-flows__board">
        {order.map((k) => {
          const lane = LANES[k];
          const items = FLOWS.filter((c) => laneOf(c) === k);
          return (
            <div key={k} className="ob-flows__lane" style={{ ['--st-c' as string]: lane.color }}>
              <div className="ob-flows__lane-head">
                <span className="ob-flows__lane-badge"><lane.Icon size={13} /></span>
                <span className="ob-flows__lane-label">{lane.label}</span>
                <span className="ob-flows__lane-count">{items.length}</span>
                <div style={{ flex: 1 }} />
                {k === 'mine' && <button type="button" className="ob-flows__lane-add"><IconPlus size={14} /></button>}
              </div>
              <div className="ob-flows__lane-body ob-scroll-quiet">
                {items.length
                  ? items.map((c) => <BoardCard key={c.title} c={c} />)
                  : <div className="ob-flows__empty">NIENTE QUI</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FlowPreviewPage() {
  const H = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: OB_TEXT.meta, fontFamily: 'var(--ob-font-mono)', letterSpacing: '0.13em', color: '#8a8f98', marginBottom: 10 }}>{children}</div>
  );
  return (
    <div style={{ minHeight: '100vh', background: '#16171a', padding: 32, display: 'flex', flexDirection: 'column', gap: 30 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: OB_WEIGHT.emphasis, color: '#fff', margin: 0 }}>Colonna FLOW · la lista come sostanza</h1>
        <p style={{ fontSize: OB_TEXT.control, color: '#8a8f98', margin: '6px 0 0', maxWidth: 760, lineHeight: OB_LEADING.text }}>
          I passi sono <b>tile_subtasks</b> — la checklist che ogni tile ha già — non una seconda entità.
          Vivono nella strip di sinistra come scaletta impilata: primo passo in alto, verde quando è fatto.
          La colonna TO-DO qui sotto ha una card con la lista, per mostrare che la scaletta vale su
          <b> tutti</b> i tipi, non solo sui FLOW.
        </p>
      </div>

      <div>
        <H>1 · COLONNA FLOW IN CHRONO — dark</H>
        <Frame mode="dark" openTone="neutral" />
      </div>

      <div>
        <H>1 · COLONNA FLOW IN CHRONO — light</H>
        <Frame mode="light" openTone="neutral" />
      </div>

      <div style={{ borderTop: '1px solid #2a2c31', paddingTop: 26 }}>
        <h2 style={{ fontSize: 18, fontWeight: OB_WEIGHT.emphasis, color: '#fff', margin: '0 0 6px' }}>
          2 · La vista /flows, rifatta flow-centric
        </h2>
        <p style={{ fontSize: OB_TEXT.control, color: '#8a8f98', margin: '0 0 16px', maxWidth: 760, lineHeight: OB_LEADING.text }}>
          Oggi la board elenca i <b>beat</b> raggruppati per stato del beat: è la vista del vecchio modello.
          Qui elenca i <b>flow</b>, raggruppati per l&apos;unica domanda che conta quando apri questa pagina —
          <b> di chi è la palla</b>. Ogni flow compare in una sola corsia: <b>FERMI</b> vince su ASPETTO,
          altrimenti la corsia che serve a stanare i dimenticati resterebbe vuota proprio perché quei flow
          sono già elencati altrove.
        </p>
        <H>DARK</H>
        <Board mode="dark" />
        <div style={{ height: 20 }} />
        <H>LIGHT</H>
        <Board mode="light" />
      </div>
    </div>
  );
}