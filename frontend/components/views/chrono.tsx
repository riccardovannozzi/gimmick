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
import { cn } from '@/lib/utils';
import { Icon, type ShellIconName } from '@/components/shell';

// ─── Tokens for semantic event kinds ──────────────────────────────────────────
type EventKind = 'timed' | 'allday' | 'deadline' | 'anytime';
const KIND_COLOR: Record<EventKind, string> = {
  timed: 'var(--ob-success)',
  allday: 'var(--ob-info)',
  deadline: 'var(--ob-error)',
  anytime: 'var(--ob-subtle)',
};
type SparkType = 'voice' | 'text' | 'file' | 'photo';
const SPARK_COLOR: Record<SparkType, string> = {
  voice: 'var(--ob-type-voice)',
  text: 'var(--ob-type-text)',
  file: 'var(--ob-type-file)',
  photo: 'var(--ob-type-photo)',
};

// ─── COLONNA NOTES / TODO card ────────────────────────────────────────────────
export interface ColTile {
  /** Presente quando collegata ai dati reali. */
  id?: string;
  title: string;
  actionLabel: string;
  actionColor: string;
  deadline?: boolean;
  spark?: SparkType;
  amber?: boolean;
  checklist?: boolean[];
  /** ISO di creazione — usato dall'ordinamento "Recenti" nelle colonne. */
  createdAt?: string;
}

function TileCard({ t, onClick, active, schedulable, onContextMenu }: { t: ColTile; onClick?: () => void; active?: boolean; schedulable?: boolean; onContextMenu?: (e: React.MouseEvent) => void }) {
  const cardC = t.amber ? 'var(--ob-warning)' : 'var(--ob-accent)';
  const canDrag = !!schedulable && !!t.id;
  return (
    <div
      className={cn('ob-chrono__card', active && 'ob-chrono__card--active', onClick && 'ob-chrono__card--clickable', canDrag && 'ob-chrono__card--draggable')}
      style={{ ['--card-c' as string]: cardC }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      draggable={canDrag}
      onDragStart={canDrag ? (e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-chrono-tile', t.id!); } : undefined}
    >
      <div className="ob-chrono__card-title">{t.title}</div>
      {t.checklist && (
        <div className="ob-chrono__card-bars">
          {t.checklist.map((d, i) => <div key={i} className={cn('ob-chrono__card-bar', d && 'ob-chrono__card-bar--on')} />)}
        </div>
      )}
      <div className="ob-chrono__card-foot">
        <span className={cn('ob-chrono__card-dot', t.deadline && 'ob-chrono__card-dot--sq')} style={{ ['--action-c' as string]: t.actionColor }} />
        <span className="ob-chrono__card-action">{t.actionLabel}</span>
        <div style={{ flex: 1 }} />
        {t.spark && (
          <span className="ob-chrono__card-spark" style={{ color: SPARK_COLOR[t.spark] }}>
            <Icon name={t.spark} size={13} />
          </span>
        )}
        <span className="ob-chrono__card-tag"><Icon name="tags" size={13} /></span>
      </div>
    </div>
  );
}

const SORT_LABELS = ['Ordina: manuale', 'Ordina: A→Z', 'Ordina: recenti'] as const;

function Column({
  icon, iconColor, label, tiles, empty, onCardClick, selectedId, schedulable, onCardContextMenu,
  dropActionType, onDropTile,
}: {
  icon: ShellIconName; iconColor: string; label: string; tiles: ColTile[]; empty: string;
  onCardClick?: (id: string) => void; selectedId?: string; schedulable?: boolean;
  onCardContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** action_type assegnato a un tile droppato qui ('none' = Notes, 'anytime' = Todo). */
  dropActionType?: 'none' | 'anytime';
  onDropTile?: (tileId: string, actionType: 'none' | 'anytime') => void;
}) {
  const [sort, setSort] = React.useState(0); // 0 manuale · 1 A→Z · 2 recenti
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState(true);
  const [dragOver, setDragOver] = React.useState(false);

  // Drop dalla griglia calendario o da un'altra colonna: legge l'id del tile dal
  // payload evento (JSON) o card (stringa) e ne aggiorna le proprietà.
  const canDrop = !!onDropTile && !!dropActionType;
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
      <div className="ob-chrono__colbody ob-scroll">
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

export interface ChronoDay { dow: string; num: number }
export interface ChronoTimed { day: number; s: number; e: number; title: string; kind: EventKind; amber?: boolean; id?: string }
export interface ChronoAllDay { day: number; title: string; kind: EventKind; id?: string }
export interface MonthEvent { id?: string; title: string; kind: EventKind }
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
  /** Modalità vista corrente. Default 'week'. */
  view?: 'week' | 'month';
  onViewChange?: (v: 'week' | 'month') => void;
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

function eventColor(e: ChronoTimed): string {
  return e.amber ? 'var(--ob-warning)' : KIND_COLOR[e.kind];
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
  dayIndex, isToday, timed, selectedId, onEventClick, onEventContextMenu, onEventReschedule, onEventToTimed, onScheduleTile, onCreateAt,
}: {
  dayIndex: number; isToday: boolean; timed: ChronoTimed[]; selectedId?: string;
  onEventClick?: (id: string) => void;
  onEventContextMenu?: (e: React.MouseEvent, id: string, slot?: { dayIndex: number; startFrac: number }) => void;
  onEventReschedule?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  onEventToTimed?: (id: string, dayIndex: number, startFrac: number, endFrac: number) => void;
  onScheduleTile?: (tileId: string, dayIndex: number, startFrac: number) => void;
  onCreateAt?: (dayIndex: number, startFrac: number) => void;
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
    >
      {HOURS.map((_, k) => <div key={k} className="ob-chrono__gridline" style={{ top: k * H }} />)}
      {evs.map((e, j) => {
        const previewE = resize && resize.id === e.id ? resize.curE : e.e;
        const s = Math.max(e.s, START);
        const eend = Math.min(previewE, END + 1);
        const top = (s - START) * H + 1;
        const height = Math.max((eend - s) * H - 3, 20);
        const tiny = height < 34;
        const click = onEventClick && e.id ? (ev: React.MouseEvent) => { ev.stopPropagation(); onEventClick(e.id!); } : undefined;
        const ctx = onEventContextMenu && e.id ? (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); onEventContextMenu(ev, e.id!, { dayIndex, startFrac: Math.max(e.s, START) }); } : undefined;
        const draggable = !!onEventReschedule && !!e.id;
        const resizable = draggable && !tiny;
        // Posizionamento orizzontale per gestire le sovrapposizioni (colonne).
        const lay = layout.get(e) ?? { col: 0, cols: 1 };
        const left = `calc(${(lay.col / lay.cols) * 100}% + 3px)`;
        const width = `calc(${100 / lay.cols}% - 6px)`;
        return (
          <div
            key={e.id ?? j}
            className={cn('ob-chrono__event', tiny ? 'ob-chrono__event--tiny' : 'ob-chrono__event--tall', click && 'ob-chrono__event--clickable', draggable && 'ob-chrono__event--draggable', !!e.id && e.id === selectedId && 'ob-chrono__event--active')}
            style={{ top, height, left, width, right: 'auto', ['--ev-c' as string]: eventColor(e) }}
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
            <span className="ob-chrono__event-title">{e.title}</span>
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
                    className={cn('ob-chrono__month-ev', click && 'ob-chrono__event--clickable', !!e.id && e.id === selectedId && 'ob-chrono__month-ev--active')}
                    style={{ ['--ev-c' as string]: KIND_COLOR[e.kind] }}
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
    >
      {items.map((a, j) => {
        const click = cal.onEventClick && a.id ? () => cal.onEventClick!(a.id!) : undefined;
        const ctx = cal.onEventContextMenu && a.id ? (ev: React.MouseEvent) => { ev.preventDefault(); ev.stopPropagation(); cal.onEventContextMenu!(ev, a.id!); } : undefined;
        const draggable = !!cal.onEventToTimed && !!a.id;
        return (
          <div
            key={a.id ?? j}
            className={cn('ob-chrono__allday-pill', click && 'ob-chrono__event--clickable', draggable && 'ob-chrono__event--draggable', !!a.id && a.id === cal.selectedId && 'ob-chrono__allday-pill--active')}
            style={{ ['--ev-c' as string]: KIND_COLOR[a.kind] }}
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
            <span className={cn('ob-chrono__allday-dot', a.kind === 'deadline' && 'ob-chrono__allday-dot--sq')} />
            <span className="ob-chrono__allday-title">{a.title}</span>
          </div>
        );
      })}
    </div>
  );
}

function Calendar({ cal }: { cal: ChronoCalendar }) {
  const view = cal.view ?? 'week';
  return (
    <div className="ob-chrono__cal">
      {/* Calendar header */}
      <div className="ob-chrono__cal-head">
        <span className="ob-chrono__cal-icon"><Icon name="calendar" size={15} /></span>
        <span className="ob-chrono__cal-eyebrow">CALENDARIO</span>
        <span className="ob-chrono__cal-range">{cal.rangeLabel}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__cal-seg">
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
      <div className="ob-chrono__dayhead">
        <div className="ob-chrono__gutter-sp" />
        {cal.days.map((d, i) => (
          <div key={i} className={cn('ob-chrono__day', i === 0 && 'ob-chrono__day--first', i === cal.todayIndex && 'ob-chrono__day--today')}>
            <span className="ob-chrono__day-dow">{d.dow}</span>
            <span className="ob-chrono__day-num">{d.num}</span>
          </div>
        ))}
      </div>

      {/* All-day lane */}
      <div className="ob-chrono__allday">
        <div className="ob-chrono__allday-label"><span>TUTTO IL DÌ</span></div>
        {cal.days.map((_, i) => <AllDayCell key={i} dayIndex={i} cal={cal} />)}
      </div>

      {/* Time grid */}
      <div className="ob-chrono__grid ob-scroll">
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

export interface ChronoViewProps {
  notes?: ColTile[];
  todos?: ColTile[];
  calendar?: ChronoCalendar;
  selectedId?: string;
  onCardClick?: (id: string) => void;
  /** Tasto destro su una card delle colonne Notes/Todo → menu contestuale. */
  onCardContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** Drop di un tile (dalla griglia o da un'altra colonna) su Notes/Todo →
   *  aggiorna action_type e deschedula. */
  onMoveToColumn?: (tileId: string, actionType: 'none' | 'anytime') => void;
  /** Toggle: arma/disarma la modalità "posiziona tile" sul calendario. */
  onAddTile?: () => void;
  /** Modalità "posiziona tile" attiva: il pulsante +Tile resta evidenziato. */
  addArmed?: boolean;
}

export function ChronoView({
  notes = NOTES, todos = TODOS, calendar = DEMO_CALENDAR, selectedId, onCardClick, onCardContextMenu, onMoveToColumn, onAddTile, addArmed,
}: ChronoViewProps) {
  return (
    <div className="ob-chrono">
      {/* Toolbar */}
      <div className="ob-chrono__toolbar">
        <button
          type="button"
          className={cn('ob-chrono__add-tile', addArmed && 'ob-chrono__add-tile--armed')}
          onClick={onAddTile}
          aria-pressed={addArmed}
          title={addArmed ? 'Clicca sul calendario per posizionare la tile (Esc per annullare)' : 'Posiziona una nuova tile sul calendario'}
        >
          <Icon name="plus" size={13} />Tile
        </button>
        <div style={{ flex: 1 }} />
        <span className="ob-chrono__toolbar-meta">GIMMICK · {notes.length + todos.length} tile</span>
      </div>

      {/* Body */}
      <div className="ob-chrono__body">
        <Column icon="note" iconColor="var(--ob-muted)" label="NOTES" tiles={notes} empty="Nessun appunto" onCardClick={onCardClick} selectedId={selectedId} schedulable={!!calendar.onScheduleTile} onCardContextMenu={onCardContextMenu} dropActionType="none" onDropTile={onMoveToColumn} />
        <Column icon="todo" iconColor="var(--ob-subtle)" label="TODO" tiles={todos} empty="Nessun task" onCardClick={onCardClick} selectedId={selectedId} schedulable={!!calendar.onScheduleTile} onCardContextMenu={onCardContextMenu} dropActionType="anytime" onDropTile={onMoveToColumn} />
        <Calendar cal={calendar} />
      </div>
    </div>
  );
}
