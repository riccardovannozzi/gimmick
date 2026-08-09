'use client';

/**
 * Gimmick · Obsidian — Chrono view (layout-guida).
 *
 * "Kron scandisce i giorni e le scadenze". Three regions:
 *   COLONNA NOTES · COLONNA TODO · PANNELLO CALENDAR
 * The calendar has an All-Day lane plus an hourly grid with Timed/Deadline
 * events. Reference: GimmickChrono.dc.html. Semantic colors from tokens; tile
 * fill = Tint. Self-contained — drop into the shell's ViewContainer with
 * `hideToolbar`.
 *
 * Data-driven: passa `notes`/`todos` (colonne) e `calendar` (griglia) per
 * collegarla ai dati reali (vedi `chrono-live.tsx`). Senza props rende il
 * mock di design (route di anteprima).
 */
import * as React from 'react';
import { useIsomorphicLayoutEffect } from '@/lib/use-isomorphic-layout-effect';
import { cn } from '@/lib/utils';
import { Tile } from '@/components/tiles/Tile';
import { tileVisualKey, type StepState, type TileStatus } from '@/lib/tile-visual';
import { Icon, type ShellIconName } from '@/components/shell';
import { TileMeta, type TileMetaType } from '@/components/tileview/TileMeta';
import { StatusSwatch } from '@/components/statuses/status-swatch';
import type { StatusShape, ActionType } from '@/types';

/** Modalità colorazione dei tile: per colore del tag oppure del tipo. */
export type ChronoColorMode = 'tag' | 'type' | 'status';

/**
 * Gli action_type che hanno una COLONNA propria, cioè i tile senza collocazione
 * nella griglia. Gli altri tre (`deadline`, `event`, e `allday` che ne è la
 * variante) stanno nel calendario, dove li porta una data: non hanno colonna
 * perché hanno un giorno.
 *
 * Questo tipo è il vincolo che tiene insieme le tre cose che devono restare
 * d'accordo: dove si può trascinare un tile, cosa crea il doppio click su una
 * colonna vuota, e quali colonne esistono.
 */
export type ColumnActionType = 'none' | 'anytime' | 'flow';

// ─── Tokens for semantic event kinds ──────────────────────────────────────────
type EventKind = 'timed' | 'allday' | 'deadline' | 'anytime';
const KIND_COLOR: Record<EventKind, string> = {
  timed: 'var(--ob-success)',
  allday: 'var(--ob-info)',
  deadline: 'var(--ob-error)',
  anytime: 'var(--ob-subtle)',
};
type SparkType = 'voice' | 'text' | 'file' | 'photo';

// ─── COLONNA NOTES / TODO card ────────────────────────────────────────────────
export interface ColTile {
  /** Presente quando collegata ai dati reali. */
  id?: string;
  title: string;
  actionLabel: string;
  actionColor: string;
  /** Tipo d'azione del tile → badge icona in basso a sinistra (stile canvas). */
  action?: ActionType;
  deadline?: boolean;
  /** Tile completato (is_completed) → pallino verde in alto a destra. */
  done?: boolean;
  /** Status del tile → swatch (forma) nella meta-row. */
  status?: { label: string; color: string; shape: StatusShape };
  /** Type-icon del tile → chip colorato nella meta-row. */
  type?: TileMetaType;
  /** Numero di sparks del tile → contatore in basso a destra. */
  sparkCount?: number;
  spark?: SparkType;
  amber?: boolean;
  checklist?: boolean[];
  /** ISO di creazione — usato dall'ordinamento "Recenti" nelle colonne. */
  createdAt?: string;
  /** Nome grezzo dello status (`active`, `done`, `paused`…). Distinto da
   *  `status`, che porta l'etichetta già tradotta e la forma dello swatch:
   *  al sistema visivo serve la chiave, non la resa. */
  statusName?: TileStatus;
  /** Colore (hex) del tag/tipo/status quando la colorazione è attiva; usato come
   *  --card-c per una VELATURA di sfondo (via CSS), non come colore pieno. */
  bg?: string;
}

/**
 * Card delle colonne Notes/Todo — ora è il `Tile` del sistema visivo.
 *
 * Il wrapper esiste per due cose che il Tile non fa apposta, per restare
 * presentazionale: il trascinamento verso la griglia del calendario, e la
 * GRONDA di 9px. La gronda sta sulla cella e non sul tile — un margine sul tile
 * ne sposterebbe l'allineamento; un padding sulla cella lascia il rettangolo
 * intatto a 150×80 e riserva sopra lo spazio in cui i badge sbordano.
 */
function TileCard({ t, onClick, active, schedulable, onContextMenu }: { t: ColTile; onClick?: () => void; active?: boolean; schedulable?: boolean; onContextMenu?: (e: React.MouseEvent) => void }) {
  const canDrag = !!schedulable && !!t.id;
  // `is_completed` e lo status `done` sono tenuti allineati dal database
  // (migration 015), quindi qui valgono come la stessa cosa.
  const status: TileStatus = t.done ? 'done' : (t.statusName ?? 'active');
  const steps = t.checklist?.map((d): StepState => (d ? 'done' : 'pending'));
  return (
    <div
      className="ob-chrono__cell"
      draggable={canDrag}
      onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-chrono-tile', t.id!); } : undefined}
    >
      <Tile
        title={t.title}
        visualKey={tileVisualKey({ action_type: t.action })}
        status={status}
        steps={steps}
        accent={t.bg ?? (t.amber ? 'var(--ob-warning)' : undefined)}
        active={active}
        onClick={onClick}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

const SORT_LABELS = ['Ordina: manuale', 'Ordina: A→Z', 'Ordina: recenti'] as const;

function Column({
  icon, iconColor, label, tiles, empty, onCardClick, selectedId, schedulable, onCardContextMenu,
  dropActionType, onDropTile, onCreateTile,
}: {
  icon: ShellIconName; iconColor: string; label: string; tiles: ColTile[]; empty: string;
  onCardClick?: (id: string) => void; selectedId?: string; schedulable?: boolean;
  onCardContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** action_type assegnato a un tile droppato qui ('none' = Notes, 'anytime' = Todo, 'flow' = Flow). */
  dropActionType?: ColumnActionType;
  onDropTile?: (tileId: string, actionType: ColumnActionType) => void;
  /** Doppio click su area vuota della colonna → crea una tile con questo action_type. */
  onCreateTile?: (actionType: ColumnActionType) => void;
}) {
  const [sort, setSort] = React.useState(0); // 0 manuale · 1 A→Z · 2 recenti
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(false);

  // Drop dalla griglia calendario o da un'altra colonna: legge l'id del tile dal
  // payload evento (JSON) o card (stringa) e ne aggiorna le proprietà.
  const canDrop = !!onDropTile && !!dropActionType;
  const canCreate = !!onCreateTile && !!dropActionType;
  const dropProps = canDrop ? {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      let id = '';
      const evRaw = e.dataTransfer.getData('application/x-chrono-event');
      if (evRaw) { try { id = (JSON.parse(evRaw) as { id: string }).id; } catch { /* ignore */ } }
      if (!id) id = e.dataTransfer.getData('application/x-chrono-tile');
      if (id) onDropTile!(id, dropActionType!);
    },
  } : {};

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? tiles.filter((t) => t.title.toLowerCase().includes(q)) : tiles;
    if (sort === 1) list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 2) list = [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    return list;
  }, [tiles, query, sort]);

  // Collassata: barra verticale stretta, click ovunque per riaprire.
  if (collapsed) {
    return (
      <div className={cn('ob-chrono__col ob-chrono__col--collapsed', dragOver && 'ob-chrono__col--dragover')} {...dropProps}>
        <button
          type="button"
          className="ob-chrono__col-rail"
          aria-label={`Espandi ${label}`}
          title={`Espandi ${label}`}
          onClick={() => setCollapsed(false)}
        >
          <span className="ob-chrono__colhead-collapse"><Icon name="panel" size={13} /></span>
          <span className="ob-chrono__col-rail-icon" style={{ color: iconColor }}><Icon name={icon} size={14} /></span>
          <span className="ob-chrono__col-rail-label">{label}</span>
          <span className="ob-chrono__col-rail-count">{tiles.length}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn('ob-chrono__col', dragOver && 'ob-chrono__col--dragover')} {...dropProps}>
      <div className="ob-chrono__colhead">
        <button
          type="button"
          className="ob-chrono__colhead-collapse"
          aria-label={`Comprimi ${label}`}
          title={`Comprimi ${label}`}
          onClick={() => setCollapsed(true)}
        ><Icon name="collapse" size={13} /></button>
        <span className="ob-chrono__colhead-icon" style={{ color: iconColor }}><Icon name={icon} size={14} /></span>
        <span className="ob-chrono__colhead-label">{label}</span>
        <span className="ob-chrono__colhead-count">{shown.length}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__colhead-btns">
          <button
            type="button"
            className="ob-chrono__colhead-btn"
            aria-label={SORT_LABELS[sort]}
            title={SORT_LABELS[sort]}
            style={sort !== 0 ? { color: 'var(--ob-accent)' } : undefined}
            onClick={() => setSort((s) => (s + 1) % 3)}
          ><Icon name="sort" size={12} /></button>
          <button
            type="button"
            className="ob-chrono__colhead-btn"
            aria-label="Filtra"
            title="Filtra per titolo"
            style={searchOpen || query ? { color: 'var(--ob-accent)' } : undefined}
            onClick={() => setSearchOpen((o) => { const n = !o; if (!n) setQuery(''); return n; })}
          ><Icon name="filter" size={12} /></button>
        </div>
      </div>
      {searchOpen && (
        <input
          className="ob-chrono__colsearch"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); } }}
          placeholder="Filtra…"
        />
      )}
      <div
        className="ob-chrono__colbody ob-scroll-quiet"
        onDoubleClick={canCreate ? (e) => {
          // Solo doppio click su area vuota (non su una card) → crea.
          if ((e.target as HTMLElement).closest('.ob-tile')) return;
          onCreateTile!(dropActionType!);
        } : undefined}
        title={canCreate ? 'Doppio click per creare una tile' : undefined}
      >
        {shown.length
          ? shown.map((t, i) => (
              <TileCard
                key={t.id ?? i}
                t={t}
                active={!!t.id && t.id === selectedId}
                onClick={onCardClick && t.id ? () => onCardClick(t.id!) : undefined}
                schedulable={schedulable}
                onContextMenu={onCardContextMenu && t.id ? (e) => onCardContextMenu(e, t.id!) : undefined}
              />
            ))
          : <span className="ob-chrono__empty">{query ? 'Nessun risultato' : empty}</span>}
      </div>
    </div>
  );
}

// ─── Calendar data ────────────────────────────────────────────────────────────
const H = 44, START = 7, END = 20;
const HOURS = Array.from({ length: END - START + 1 }, (_, i) => START + i);

/** Modalità del calendario: 1 giorno, 3 giorni, settimana, mese. */
export type ChronoCalView = 'day' | '3day' | 'week' | 'month';
export interface ChronoDay { dow: string; num: number }
export interface ChronoTimed { day: number; s: number; e: number; title: string; kind: EventKind; amber?: boolean; id?: string; color?: string; done?: boolean; type?: TileMetaType; status?: { shape: StatusShape; color: string; label: string } }
export interface ChronoAllDay { day: number; title: string; kind: EventKind; id?: string; color?: string; done?: boolean; type?: TileMetaType; status?: { shape: StatusShape; color: string; label: string } }
export interface MonthEvent { id?: string; title: string; kind: EventKind; color?: string; done?: boolean }
export interface MonthCell { key: string; num: number; inMonth: boolean; isToday: boolean; events: MonthEvent[] }
export interface ChronoCalendar {
  days: ChronoDay[];
  /** Index of "today" in `days`, or -1 if the current week is not shown. */
  todayIndex: number;
  /** Id della tile selezionata: l'evento corrispondente viene evidenziato. */
  selectedId?: string;
  rangeLabel: string;
  timed: ChronoTimed[];
  allday: ChronoAllDay[];
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onEventClick?: (id: string) => void;
  /** Tasto destro su un evento → menu contestuale. Per gli eventi timed passa
   *  lo slot (giorno + fascia) così "Incolla" può schedulare lì la copia. */
  onEventContextMenu?: (e: React.MouseEvent, id: string, slot?: { dayIndex: number; startFrac: number }) => void;
  /** Drag-drop di un evento timed: nuovo giorno + nuova fascia oraria (snap 15'). */
  onEventReschedule?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  /** Drop di una tile (Notes/Todo) su uno slot del calendario → schedulazione timed. */
  onScheduleTile?: (tileId: string, dayIndex: number, startFrac: number) => void;
  /** Drop di un evento timed sulla lane "tutto il dì" → diventa all-day. */
  onEventToAllDay?: (id: string, dayIndex: number) => void;
  /** Drop di un evento all-day sulla griglia oraria → diventa timed. */
  onEventToTimed?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  /** Drop di una tile (Notes/Todo) sulla lane "tutto il dì" → schedulata all-day. */
  onScheduleAllDayTile?: (tileId: string, dayIndex: number) => void;
  /** Click su uno slot vuoto della griglia → crea un evento timed lì. */
  onCreateAt?: (dayIndex: number, startFrac: number) => void;
  /** Doppio click su uno slot vuoto della griglia → crea un evento timed lì
   *  (sempre attivo, indipendente dalla modalità "posiziona tile"). */
  onDblCreateAt?: (dayIndex: number, startFrac: number) => void;
  /** Doppio click su una cella vuota della lane "tutto il dì" → crea un evento all-day lì. */
  onDblCreateAllDay?: (dayIndex: number) => void;
  /** Modalità vista corrente. Default 'week'. */
  view?: ChronoCalView;
  onViewChange?: (v: ChronoCalView) => void;
  /** Celle del mese (6×7 = 42) quando view === 'month'. */
  month?: MonthCell[];
}

const SNAP = 0.25; // 15 minuti
function snapFrac(v: number): number { return Math.round(v / SNAP) * SNAP; }

// Static demo (preview route, no props).
const DEMO_CALENDAR: ChronoCalendar = {
  days: [
    { dow: 'lun', num: 22 }, { dow: 'mar', num: 23 }, { dow: 'mer', num: 24 },
    { dow: 'gio', num: 25 }, { dow: 'ven', num: 26 }, { dow: 'sab', num: 27 }, { dow: 'dom', num: 28 },
  ],
  todayIndex: 4,
  rangeLabel: '22 – 28 giugno 2026',
  timed: [
    { day: 2, s: 18, e: 18.5, title: 'Proloco Marras e Renai', kind: 'timed' },
    { day: 2, s: 18.5, e: 19.5, title: 'Progetto Cameretta', kind: 'timed' },
    { day: 4, s: 12.25, e: 13.25, title: 'GDS/bisdomini', kind: 'timed', amber: true },
    { day: 4, s: 17, e: 18, title: 'Audio e incontro con Marco', kind: 'timed' },
  ],
  allday: [
    { day: 3, title: 'Aruba — certificato', kind: 'deadline' },
    { day: 3, title: 'Contatto isibrix.it', kind: 'allday' },
    { day: 4, title: 'Incontro su IA', kind: 'allday' },
  ],
};

/**
 * Colore dell'evento secondo la modalità di colorazione attiva. `undefined` =
 * nessuna colorazione impostata → l'evento resta sul fondo unico dei tile
 * (variante `--plain`), esattamente come sul canvas. NON si ripiega più sul
 * colore della categoria (`KIND_COLOR`): timed/all-day si distinguono già dalla
 * posizione nella griglia e le deadline dal bordo tratteggiato rosso.
 */
function eventColor(e: ChronoTimed): string | undefined {
  return e.color ?? (e.amber ? 'var(--ob-warning)' : undefined);
}

/**
 * Layout a colonne per eventi che si sovrappongono nello stesso giorno.
 * Cluster di eventi mutuamente sovrapposti → assegnazione greedy delle colonne
 * (algoritmo classico dei calendari). Ritorna col/cols per ciascun evento.
 */
function layoutOverlaps(evs: ChronoTimed[]): Map<ChronoTimed, { col: number; cols: number }> {
  const res = new Map<ChronoTimed, { col: number; cols: number }>();
  const sorted = [...evs].sort((a, b) => a.s - b.s || a.e - b.e);
  let cluster: ChronoTimed[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const colEnds: number[] = []; // fine dell'ultimo evento per colonna
    for (const ev of cluster) {
      let c = colEnds.findIndex((end) => ev.s >= end);
      if (c === -1) { c = colEnds.length; colEnds.push(ev.e); } else { colEnds[c] = ev.e; }
      res.set(ev, { col: c, cols: 0 });
    }
    for (const ev of cluster) res.get(ev)!.cols = colEnds.length;
    cluster = []; clusterEnd = -Infinity;
  };
  for (const ev of sorted) {
    if (cluster.length && ev.s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  flush();
  return res;
}

function DayColumn({
  dayIndex, isToday, timed, selectedId, onEventClick, onEventContextMenu, onEventReschedule, onEventToTimed, onScheduleTile, onCreateAt, onDblCreateAt,
}: {
  dayIndex: number; isToday: boolean; timed: ChronoTimed[]; selectedId?: string;
  onEventClick?: (id: string) => void;
  onEventContextMenu?: (e: React.MouseEvent, id: string, slot?: { dayIndex: number; startFrac: number }) => void;
  onEventReschedule?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  onEventToTimed?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  onScheduleTile?: (tileId: string, dayIndex: number, startFrac: number) => void;
  onCreateAt?: (dayIndex: number, startFrac: number) => void;
  onDblCreateAt?: (dayIndex: number, startFrac: number) => void;
}) {
  const colRef = React.useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  // Resize in corso: id evento + nuova fine (frazione) in anteprima.
  const [resize, setResize] = React.useState<{ id: string; s: number; startE: number; startY: number; curE: number } | null>(null);
  const evs = timed.filter((e) => e.day === dayIndex);
  const layout = layoutOverlaps(evs);
  // Now-line position (only on today).
  const now = new Date();
  const nowFrac = now.getHours() + now.getMinutes() / 60;
  const dropEnabled = !!onEventReschedule || !!onScheduleTile || !!onEventToTimed;

  // Convert a viewport Y to a snapped start fraction within this column.
  const yToStart = (clientY: number, grabFrac = 0): number => {
    const rect = colRef.current!.getBoundingClientRect();
    const s = START + (clientY - rect.top) / H - grabFrac;
    return snapFrac(s);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const evRaw = e.dataTransfer.getData('application/x-chrono-event');
    if (evRaw) {
      try {
        const { id, dur, grab, allDay } = JSON.parse(evRaw) as { id: string; dur: number; grab: number; allDay?: boolean };
        let s = yToStart(e.clientY, grab);
        s = Math.max(START, Math.min(s, END + 1 - dur));
        // Evento all-day trascinato sulla griglia → riconversione a timed.
        if (allDay && onEventToTimed) onEventToTimed(id, dayIndex, s, s + dur);
        else if (onEventReschedule) onEventReschedule(id, dayIndex, s, s + dur);
      } catch { /* ignore malformed payload */ }
      return;
    }
    const tileId = e.dataTransfer.getData('application/x-chrono-tile');
    if (tileId && onScheduleTile) {
      let s = yToStart(e.clientY, 0);
      s = Math.max(START, Math.min(s, END));
      onScheduleTile(tileId, dayIndex, s);
    }
  };

  return (
    <div
      ref={colRef}
      className={cn('ob-chrono__daycol', dayIndex === 0 && 'ob-chrono__daycol--first', isToday && 'ob-chrono__daycol--today', dragOver && 'ob-chrono__daycol--dragover', onCreateAt && 'ob-chrono__daycol--creatable')}
      onDragOver={dropEnabled ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true); } : undefined}
      onDragLeave={dropEnabled ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); } : undefined}
      onDrop={dropEnabled ? handleDrop : undefined}
      onClick={onCreateAt ? (e) => {
        // Solo click su area vuota (non su un evento) → crea.
        if ((e.target as HTMLElement).closest('.ob-chrono__event')) return;
        const s = Math.max(START, Math.min(yToStart(e.clientY), END));
        onCreateAt(dayIndex, s);
      } : undefined}
      onDoubleClick={onDblCreateAt ? (e) => {
        // Solo doppio click su area vuota (non su un evento) → crea.
        if ((e.target as HTMLElement).closest('.ob-chrono__event')) return;
        const s = Math.max(START, Math.min(yToStart(e.clientY), END));
        onDblCreateAt(dayIndex, s);
      } : undefined}
    >
      {HOURS.map((_, k) => (
        <React.Fragment key={k}>
          <div className="ob-chrono__gridline" style={{ top: k * H }} />
          {/* Mezz'ora tratteggiata: omessa sull'ultima fascia, che non ha
              un'ora successiva a chiuderla. */}
          {k < HOURS.length - 1 && (
            <div className="ob-chrono__gridline ob-chrono__gridline--half" style={{ top: k * H + H / 2 }} />
          )}
        </React.Fragment>
      ))}
      {evs.map((e, j) => {
        const previewE = resize && resize.id === e.id ? resize.curE : e.e;
        const s = Math.max(e.s, START);
        const eend = Math.min(previewE, END + 1);
        const top = (s - START) * H + 1;
        const height = Math.max((eend - s) * H - 3, 20);
        const tiny = height < 34;
        // Numero di righe del titolo che stanno nell'altezza del blocco (padding
        // verticale ~6px, line-height 12px). Se non c'è spazio per due righe →
        // una sola riga con testo accorciato (ellissi). Cap a 4.
        const titleLines = Math.max(1, Math.min(4, Math.floor((height - 6) / 12)));
        const click = onEventClick && e.id ? (ev: React.MouseEvent) => { ev.stopPropagation(); onEventClick(e.id!); } : undefined;
        const ctx = onEventContextMenu && e.id ? (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEventContextMenu(ev, e.id!, { dayIndex, startFrac: Math.max(e.s, START) }); } : undefined;
        const draggable = !!onEventReschedule && !!e.id;
        const resizable = draggable && !tiny;
        const evColor = eventColor(e);
        // Posizionamento orizzontale per gestire le sovrapposizioni (colonne).
        const lay = layout.get(e) ?? { col: 0, cols: 1 };
        const left = `calc(${(lay.col / lay.cols) * 100}% + 3px)`;
        const width = `calc(${100 / lay.cols}% - 6px)`;
        return (
          <div
            key={e.id ?? j}
            className={cn('ob-chrono__event', tiny ? 'ob-chrono__event--tiny' : 'ob-chrono__event--tall', !evColor && 'ob-chrono__event--plain', e.kind === 'deadline' && 'ob-chrono__event--deadline', click && 'ob-chrono__event--clickable', draggable && 'ob-chrono__event--draggable', !!e.id && e.id === selectedId && 'ob-chrono__event--active', e.done && 'ob-chrono__event--done')}
            style={{ top, height, left, width, right: 'auto', ['--ev-c' as string]: evColor ?? 'var(--ob-tile-bg)' }}
            onClick={click}
            onContextMenu={ctx}
            role={click ? 'button' : undefined}
            tabIndex={click ? 0 : undefined}
            draggable={draggable && !resize}
            onDragStart={draggable ? (de) => {
              const r = (de.currentTarget as HTMLElement).getBoundingClientRect();
              const grab = (de.clientY - r.top) / H; // ore "afferrate" dentro l'evento
              de.dataTransfer.effectAllowed = 'move';
              de.dataTransfer.setData('application/x-chrono-event', JSON.stringify({ id: e.id, dur: Math.max(e.e - e.s, SNAP), grab }));
            } : undefined}
          >
            {/* Strip STATUS a sinistra, come canvas/kanban/colonne: presente solo
                se la tile ha uno status. */}
            {e.status && (
              <span className="ob-chrono__event-strip" title={e.status.label}>
                <StatusSwatch shape={e.status.shape} color={e.status.color} size={9} />
              </span>
            )}
            <div className="ob-chrono__event-body">
              <span className="ob-chrono__event-title" style={{ ['--title-lines' as string]: titleLines }}>{e.title}</span>
              {e.type && (
                <span className="ob-chrono__event-meta"><TileMeta type={e.type} compact={tiny} /></span>
              )}
            </div>
            {resizable && (
              <div
                className="ob-chrono__event-resize"
                draggable={false}
                onClick={(ce) => ce.stopPropagation()}
                onPointerDown={(pe) => {
                  pe.stopPropagation();
                  pe.preventDefault();
                  (pe.currentTarget as HTMLElement).setPointerCapture(pe.pointerId);
                  setResize({ id: e.id!, s: e.s, startE: e.e, startY: pe.clientY, curE: e.e });
                }}
                onPointerMove={(pe) => {
                  setResize((r) => {
                    if (!r || r.id !== e.id) return r;
                    let ne = snapFrac(r.startE + (pe.clientY - r.startY) / H);
                    ne = Math.max(r.s + SNAP, Math.min(ne, END + 1));
                    return { ...r, curE: ne };
                  });
                }}
                onPointerUp={(pe) => {
                  (pe.currentTarget as HTMLElement).releasePointerCapture(pe.pointerId);
                  setResize((r) => {
                    if (r && r.id === e.id && Math.abs(r.curE - e.e) > 0.001 && onEventReschedule) {
                      onEventReschedule(e.id!, dayIndex, e.s, r.curE);
                    }
                    return null;
                  });
                }}
              />
            )}
          </div>
        );
      })}
      {isToday && nowFrac >= START && nowFrac <= END + 1 && (
        <div className="ob-chrono__now" style={{ top: (nowFrac - START) * H }}>
          <div className="ob-chrono__now-dot" />
        </div>
      )}
    </div>
  );
}

const MONTH_DOW = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

function MonthGrid({ cells, selectedId, onEventClick, onEventContextMenu }: { cells: MonthCell[]; selectedId?: string; onEventClick?: (id: string) => void; onEventContextMenu?: (e: React.MouseEvent, id: string, slot?: { dayIndex: number; startFrac: number }) => void }) {
  return (
    <div className="ob-chrono__month ob-scroll">
      <div className="ob-chrono__month-head">
        {MONTH_DOW.map((d) => <div key={d} className="ob-chrono__month-dow">{d}</div>)}
      </div>
      <div className="ob-chrono__month-grid">
        {cells.map((c) => (
          <div key={c.key} className={cn('ob-chrono__month-cell', !c.inMonth && 'ob-chrono__month-cell--out', c.isToday && 'ob-chrono__month-cell--today')}>
            <div className="ob-chrono__month-num">{c.num}</div>
            <div className="ob-chrono__month-evs">
              {c.events.slice(0, 3).map((e, i) => {
                const click = onEventClick && e.id ? () => onEventClick(e.id!) : undefined;
                const ctx = onEventContextMenu && e.id ? (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEventContextMenu(ev, e.id!); } : undefined;
                return (
                  <div
                    key={e.id ?? i}
                    className={cn('ob-chrono__month-ev', click && 'ob-chrono__event--clickable', !!e.id && e.id === selectedId && 'ob-chrono__month-ev--active', e.done && 'ob-chrono__month-ev--done')}
                    style={{ ['--ev-c' as string]: e.color ?? KIND_COLOR[e.kind] }}
                    onClick={click}
                    onContextMenu={ctx}
                    title={e.title}
                    role={click ? 'button' : undefined}
                    tabIndex={click ? 0 : undefined}
                  >
                    <span className="ob-chrono__month-ev-dot" />
                    <span className="ob-chrono__month-ev-title">{e.title}</span>
                  </div>
                );
              })}
              {c.events.length > 3 && <div className="ob-chrono__month-more">+{c.events.length - 3}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllDayCell({ dayIndex, cal }: { dayIndex: number; cal: ChronoCalendar }) {
  const [dragOver, setDragOver] = React.useState(false);
  const items = cal.allday.filter((a) => a.day === dayIndex);
  const dropEnabled = !!cal.onEventToAllDay || !!cal.onScheduleAllDayTile;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const evRaw = e.dataTransfer.getData('application/x-chrono-event');
    if (evRaw && cal.onEventToAllDay) {
      try {
        const { id } = JSON.parse(evRaw) as { id: string };
        if (id) cal.onEventToAllDay(id, dayIndex);
      } catch { /* payload malformato */ }
      return;
    }
    const tileId = e.dataTransfer.getData('application/x-chrono-tile');
    if (tileId && cal.onScheduleAllDayTile) cal.onScheduleAllDayTile(tileId, dayIndex);
  };

  return (
    <div
      className={cn('ob-chrono__allday-cell', dayIndex === 0 && 'ob-chrono__allday-cell--first', dayIndex === cal.todayIndex && 'ob-chrono__allday-cell--today', dragOver && 'ob-chrono__allday-cell--dragover')}
      onDragOver={dropEnabled ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!dragOver) setDragOver(true); } : undefined}
      onDragLeave={dropEnabled ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); } : undefined}
      onDrop={dropEnabled ? handleDrop : undefined}
      onDoubleClick={cal.onDblCreateAllDay ? (e) => {
        // Solo doppio click su area vuota (non su un pill esistente) → crea.
        if ((e.target as HTMLElement).closest('.ob-chrono__allday-pill')) return;
        cal.onDblCreateAllDay!(dayIndex);
      } : undefined}
    >
      {items.map((a, j) => {
        const click = cal.onEventClick && a.id ? () => cal.onEventClick!(a.id!) : undefined;
        const ctx = cal.onEventContextMenu && a.id ? (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); cal.onEventContextMenu!(ev, a.id!); } : undefined;
        const draggable = !!cal.onEventToTimed && !!a.id;
        return (
          <div
            key={a.id ?? j}
            className={cn('ob-chrono__allday-pill', !a.color && 'ob-chrono__allday-pill--plain', a.kind === 'deadline' && 'ob-chrono__allday-pill--deadline', click && 'ob-chrono__event--clickable', draggable && 'ob-chrono__event--draggable', !!a.id && a.id === cal.selectedId && 'ob-chrono__allday-pill--active', a.done && 'ob-chrono__allday-pill--done')}
            style={{ ['--ev-c' as string]: a.color ?? 'var(--ob-tile-bg)' }}
            onClick={click}
            onContextMenu={ctx}
            draggable={draggable}
            onDragStart={draggable ? (de) => {
              de.dataTransfer.effectAllowed = 'move';
              // `allDay: true` segnala alla colonna di riconvertire l'evento a timed.
              de.dataTransfer.setData('application/x-chrono-event', JSON.stringify({ id: a.id, dur: 1, grab: 0, allDay: true }));
            } : undefined}
            role={click ? 'button' : undefined}
            tabIndex={click ? 0 : undefined}
          >
            <span className="ob-chrono__allday-title">{a.title}</span>
            {(a.type || a.status) && (
              <span className="ob-chrono__allday-meta"><TileMeta type={a.type} status={a.status} compact /></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Calendar({ cal }: { cal: ChronoCalendar }) {
  const view = cal.view ?? 'week';

  // Allineamento colonne. Day-header e lane All Day stanno FUORI dal contenitore
  // che scrolla: quando la griglia oraria mostra la scrollbar verticale perde in
  // larghezza quanto la scrollbar occupa, mentre le due righe sopra restano a
  // larghezza piena → le colonne si disallineano, con scarto crescente verso
  // destra. Misuriamo la scrollbar e la riserviamo come padding sulle due righe.
  // Su scrollbar overlay (macOS) la misura è 0, quindi nessun effetto.
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [scrollbarW, setScrollbarW] = React.useState(0);
  useIsomorphicLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setScrollbarW(el.offsetWidth - el.clientWidth);
    measure();
    // L'altezza del contenuto è fissa (HOURS.length * H): la comparsa della
    // scrollbar dipende solo dall'altezza del contenitore, quindi basta
    // osservare quello.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  return (
    <div className="ob-chrono__cal">
      {/* Calendar header */}
      <div className="ob-chrono__cal-head">
        <span className="ob-chrono__cal-icon"><Icon name="calendar" size={15} /></span>
        <span className="ob-chrono__cal-eyebrow">CALENDARIO</span>
        <span className="ob-chrono__cal-range">{cal.rangeLabel}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__cal-seg">
          <button type="button" className={cn('ob-chrono__cal-seg-item', view === 'day' && 'ob-chrono__cal-seg-item--active')} onClick={() => cal.onViewChange?.('day')}>Day</button>
          <button type="button" className={cn('ob-chrono__cal-seg-item', view === '3day' && 'ob-chrono__cal-seg-item--active')} onClick={() => cal.onViewChange?.('3day')}>3 Days</button>
          <button type="button" className={cn('ob-chrono__cal-seg-item', view === 'week' && 'ob-chrono__cal-seg-item--active')} onClick={() => cal.onViewChange?.('week')}>Week</button>
          <button type="button" className={cn('ob-chrono__cal-seg-item', view === 'month' && 'ob-chrono__cal-seg-item--active')} onClick={() => cal.onViewChange?.('month')}>Month</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          <button type="button" className="ob-chrono__cal-nav" aria-label="Periodo precedente" onClick={cal.onPrev}><Icon name="chevL" size={14} /></button>
          <button type="button" className="ob-chrono__cal-today" onClick={cal.onToday}>Oggi</button>
          <button type="button" className="ob-chrono__cal-nav" aria-label="Periodo successivo" onClick={cal.onNext}><Icon name="chevR" size={14} /></button>
        </div>
      </div>

      {view === 'month' && cal.month ? (
        <MonthGrid cells={cal.month} selectedId={cal.selectedId} onEventClick={cal.onEventClick} onEventContextMenu={cal.onEventContextMenu} />
      ) : (
      <>
      {/* Day header */}
      <div className="ob-chrono__dayhead" style={{ paddingRight: scrollbarW }}>
        <div className="ob-chrono__gutter-sp" />
        {cal.days.map((d, i) => (
          <div key={i} className={cn('ob-chrono__day', i === 0 && 'ob-chrono__day--first', i === cal.todayIndex && 'ob-chrono__day--today')}>
            <span className="ob-chrono__day-dow">{d.dow}</span>
            <span className="ob-chrono__day-num">{d.num}</span>
          </div>
        ))}
      </div>

      {/* All-day lane */}
      <div className="ob-chrono__allday" style={{ paddingRight: scrollbarW }}>
        <div className="ob-chrono__allday-label"><span>DAILY</span></div>
        {cal.days.map((_, i) => <AllDayCell key={i} dayIndex={i} cal={cal} />)}
      </div>

      {/* Time grid */}
      <div className="ob-chrono__grid ob-scroll" ref={gridRef}>
        <div className="ob-chrono__gutter" style={{ height: HOURS.length * H }}>
          {HOURS.map((x, i) => (
            <div key={x} className="ob-chrono__gutter-h" style={{ top: i * H - 6 }}>
              {i === 0 ? '' : `${x < 10 ? '0' + x : x}:00`}
            </div>
          ))}
        </div>
        <div className="ob-chrono__grid-days" style={{ height: HOURS.length * H }}>
          {cal.days.map((_, i) => (
            <DayColumn
              key={i}
              dayIndex={i}
              isToday={i === cal.todayIndex}
              timed={cal.timed}
              selectedId={cal.selectedId}
              onEventClick={cal.onEventClick}
              onEventContextMenu={cal.onEventContextMenu}
              onEventReschedule={cal.onEventReschedule}
              onEventToTimed={cal.onEventToTimed}
              onScheduleTile={cal.onScheduleTile}
              onCreateAt={cal.onCreateAt}
              onDblCreateAt={cal.onDblCreateAt}
            />
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ─── Column demo data (preview route) ─────────────────────────────────────────
const NOTES: ColTile[] = [
  { title: 'Marco al tramonto mediterraneo, foto e nota', actionLabel: 'Notes', actionColor: 'var(--ob-muted)', spark: 'photo' },
  { title: 'Appuntamento con Marco Guerrieri', actionLabel: 'Notes', actionColor: 'var(--ob-muted)', spark: 'voice' },
  { title: 'Incontro con Bania Piccardi sul preventivo', actionLabel: 'Notes', actionColor: 'var(--ob-muted)', spark: 'voice' },
];
const TODOS: ColTile[] = [
  { title: 'Revoca certificato digitale Aruba', actionLabel: 'To do', actionColor: 'var(--ob-subtle)', spark: 'file', amber: true, checklist: [true, true, false] },
  { title: 'Preparare brief Teleport per Marco', actionLabel: 'To do', actionColor: 'var(--ob-subtle)', spark: 'text', checklist: [true, false, false, false] },
  { title: 'Lista materiali cucina Ortano', actionLabel: 'To do', actionColor: 'var(--ob-subtle)', amber: true, checklist: [false, false] },
];
// I flow di esempio hanno tutti una checklist: senza passi un flow è un tile
// come gli altri, ed è proprio la strip a raccontarlo.
const FLOWS: ColTile[] = [
  { title: 'Voltura contatore acqua', actionLabel: 'Flow', actionColor: 'var(--ob-accent)', action: 'flow', checklist: [true, true, true, false] },
  { title: 'Preventivo APE albergo', actionLabel: 'Flow', actionColor: 'var(--ob-accent)', action: 'flow', checklist: [true, false] },
  { title: 'Concessione demaniale spiaggia', actionLabel: 'Flow', actionColor: 'var(--ob-accent)', action: 'flow', checklist: [true, false, false] },
];

export interface ChronoViewProps {
  notes?: ColTile[];
  todos?: ColTile[];
  /** Tile-processo (`action_type = 'flow'`) — terza colonna, mai in griglia. */
  flows?: ColTile[];
  calendar?: ChronoCalendar;
  selectedId?: string;
  onCardClick?: (id: string) => void;
  /** Tasto destro su una card delle colonne Notes/Todo → menu contestuale. */
  onCardContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** Drop di un tile (dalla griglia o da un'altra colonna) su Notes/Todo/Flow →
   *  aggiorna action_type e deschedula. */
  onMoveToColumn?: (tileId: string, actionType: ColumnActionType) => void;
  /** Toggle: arma/disarma la modalità "posiziona tile" sul calendario. */
  onAddTile?: () => void;
  /** Modalità "posiziona tile" attiva: il pulsante +Tile resta evidenziato. */
  addArmed?: boolean;
  /** Doppio click su area vuota di Notes/Todo/Flow → crea una tile con quell'action_type. */
  onCreateColumnTile?: (actionType: ColumnActionType) => void;
  /** Modalità colorazione tile attiva ('tag' | 'type'); se assente, il controllo è nascosto. */
  colorMode?: ChronoColorMode;
  /** Imposta la modalità colorazione (segmented By Tag / By Type). */
  onSetColorMode?: (mode: ChronoColorMode) => void;
  /**
   * Tinge di verde le attività COMPLETATE, come il pulsante "Done" della topbar
   * del canvas. Non le filtra: i tile ci sono in entrambi gli stati, cambia solo
   * se si tingono — nelle colonne E nel calendario.
   * Assente il callback, il pulsante non compare (anteprime senza dati veri).
   */
  doneHighlight?: boolean;
  onToggleDoneHighlight?: () => void;
}

export function ChronoView({
  notes = NOTES, todos = TODOS, flows = FLOWS, calendar = DEMO_CALENDAR, selectedId, onCardClick, onCardContextMenu, onMoveToColumn, onAddTile, addArmed, onCreateColumnTile, colorMode, onSetColorMode,
  doneHighlight = false, onToggleDoneHighlight,
}: ChronoViewProps) {
  return (
    // `ob-done-hl` accende il verde sui completati DENTRO la vista: una classe
    // sul contenitore, come sul canvas. Qui copre due famiglie — i `Tile` delle
    // colonne e i blocchi del calendario — che restano entrambi ignari di chi li
    // ospita: sono le regole di contesto a decidere.
    <div className={cn('ob-chrono', doneHighlight && 'ob-done-hl')}>
      {/* Toolbar — gemella della toolbar del canvas (`CanvasTopbar`): stessa
          stessa fascia, stessi chip da 30, e come lì i controlli stanno tutti a
          destra (nel canvas la sinistra è occupata dalle linguette dei tag
          pinnati, qui non c'è nulla di equivalente). */}
      <div className="ob-chrono__toolbar">
        <div style={{ flex: 1 }} />
        {colorMode && onSetColorMode && (
          <>
            <button type="button" className={cn('ob-chrono__tbtn', colorMode === 'tag' && 'ob-chrono__tbtn--active')} onClick={() => onSetColorMode('tag')} title="Colora i tile per Tag">By Tag</button>
            <button type="button" className={cn('ob-chrono__tbtn', colorMode === 'type' && 'ob-chrono__tbtn--active')} onClick={() => onSetColorMode('type')} title="Colora i tile per Tipo">By Type</button>
            <button type="button" className={cn('ob-chrono__tbtn', colorMode === 'status' && 'ob-chrono__tbtn--active')} onClick={() => onSetColorMode('status')} title="Colora i tile per Status">By Status</button>
            <div className="ob-chrono__tbar-sep" />
          </>
        )}
        {onToggleDoneHighlight && (
          <>
            {/* Non è una modalità di colorazione come le tre qui sopra: quelle
                decidono da quale campo il tile prende il colore, questa accende
                un segnale sopra tutte. Il separatore la tiene a parte. */}
            <button
              type="button"
              className={cn('ob-chrono__tbtn', doneHighlight && 'ob-chrono__tbtn--active')}
              onClick={onToggleDoneHighlight}
              aria-pressed={doneHighlight}
              title={doneHighlight
                ? 'Togli il verde dalle attività completate'
                : 'Evidenzia in verde le attività completate'}
            >
              <Icon name="check" size={12} />Done
            </button>
            <div className="ob-chrono__tbar-sep" />
          </>
        )}
        <button
          type="button"
          className={cn('ob-chrono__tbtn', addArmed && 'ob-chrono__tbtn--active')}
          onClick={onAddTile}
          aria-pressed={addArmed}
          title={addArmed ? 'Clicca sul calendario per posizionare la tile (Esc per annullare)' : 'Posiziona una nuova tile sul calendario'}
        >
          <Icon name="plus" size={12} />Tile
        </button>
      </div>

      {/* Body */}
      <div className="ob-chrono__body">
        <Column icon="note" iconColor="var(--ob-muted)" label="NOTES" tiles={notes} empty="Nessun appunto" onCardClick={onCardClick} selectedId={selectedId} schedulable={!!calendar.onScheduleTile} onCardContextMenu={onCardContextMenu} dropActionType="none" onDropTile={onMoveToColumn} onCreateTile={onCreateColumnTile} />
        <Column icon="todo" iconColor="var(--ob-subtle)" label="TODO" tiles={todos} empty="Nessun task" onCardClick={onCardClick} selectedId={selectedId} schedulable={!!calendar.onScheduleTile} onCardContextMenu={onCardContextMenu} dropActionType="anytime" onDropTile={onMoveToColumn} onCreateTile={onCreateColumnTile} />
        {/* FLOW — `schedulable` resta acceso come nelle altre due: un flow si può
            trascinare in griglia, e lì diventa un evento (come farebbe una nota).
            Spegnerlo lo renderebbe non trascinabile del tutto, quindi neppure
            riportabile in NOTES: il trascinamento è uno solo per entrambe le
            direzioni. La conversione è reversibile trascinandolo indietro qui. */}
        <Column icon="flow" iconColor="var(--ob-accent)" label="FLOW" tiles={flows} empty="Nessun flow" onCardClick={onCardClick} selectedId={selectedId} schedulable={!!calendar.onScheduleTile} onCardContextMenu={onCardContextMenu} dropActionType="flow" onDropTile={onMoveToColumn} onCreateTile={onCreateColumnTile} />
        <Calendar cal={calendar} />
      </div>
    </div>
  );
}
