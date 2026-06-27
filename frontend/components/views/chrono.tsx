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
import { Button } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
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
}

function TileCard({ t, onClick, active }: { t: ColTile; onClick?: () => void; active?: boolean }) {
  const cardC = t.amber ? 'var(--ob-warning)' : 'var(--ob-accent)';
  return (
    <div
      className={cn('ob-chrono__card', active && 'ob-chrono__card--active', onClick && 'ob-chrono__card--clickable')}
      style={{ ['--card-c' as string]: cardC }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
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

function Column({
  icon, iconColor, label, tiles, empty, onCardClick, selectedId,
}: {
  icon: ShellIconName; iconColor: string; label: string; tiles: ColTile[]; empty: string;
  onCardClick?: (id: string) => void; selectedId?: string;
}) {
  return (
    <div className="ob-chrono__col">
      <div className="ob-chrono__colhead">
        <span className="ob-chrono__colhead-collapse"><Icon name="collapse" size={13} /></span>
        <span className="ob-chrono__colhead-icon" style={{ color: iconColor }}><Icon name={icon} size={14} /></span>
        <span className="ob-chrono__colhead-label">{label}</span>
        <span className="ob-chrono__colhead-count">{tiles.length}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__colhead-btns">
          <button type="button" className="ob-chrono__colhead-btn" aria-label="Ordina"><Icon name="sort" size={12} /></button>
          <button type="button" className="ob-chrono__colhead-btn" aria-label="Filtra"><Icon name="filter" size={12} /></button>
          <button type="button" className="ob-chrono__colhead-btn" aria-label="Raggruppa"><Icon name="group" size={12} /></button>
        </div>
      </div>
      <div className="ob-chrono__colbody ob-scroll">
        {tiles.length
          ? tiles.map((t, i) => (
              <TileCard
                key={t.id ?? i}
                t={t}
                active={!!t.id && t.id === selectedId}
                onClick={onCardClick && t.id ? () => onCardClick(t.id!) : undefined}
              />
            ))
          : <span className="ob-chrono__empty">{empty}</span>}
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
export interface ChronoCalendar {
  days: ChronoDay[];
  /** Index of "today" in `days`, or -1 if the current week is not shown. */
  todayIndex: number;
  rangeLabel: string;
  timed: ChronoTimed[];
  allday: ChronoAllDay[];
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onEventClick?: (id: string) => void;
}

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

function fmt(v: number): string {
  const hh = Math.floor(v);
  const mm = Math.round((v - hh) * 60);
  return `${hh < 10 ? '0' + hh : hh}:${mm < 10 ? '0' + mm : mm}`;
}
function eventColor(e: ChronoTimed): string {
  return e.amber ? 'var(--ob-warning)' : KIND_COLOR[e.kind];
}

function DayColumn({
  dayIndex, isToday, timed, onEventClick,
}: { dayIndex: number; isToday: boolean; timed: ChronoTimed[]; onEventClick?: (id: string) => void }) {
  const evs = timed.filter((e) => e.day === dayIndex);
  // Now-line position (only on today).
  const now = new Date();
  const nowFrac = now.getHours() + now.getMinutes() / 60;
  return (
    <div className={cn('ob-chrono__daycol', dayIndex === 0 && 'ob-chrono__daycol--first', isToday && 'ob-chrono__daycol--today')}>
      {HOURS.map((_, k) => <div key={k} className="ob-chrono__gridline" style={{ top: k * H }} />)}
      {evs.map((e, j) => {
        const s = Math.max(e.s, START);
        const eend = Math.min(e.e, END + 1);
        const top = (s - START) * H + 1;
        const height = Math.max((eend - s) * H - 3, 20);
        const tiny = height < 34;
        const click = onEventClick && e.id ? () => onEventClick(e.id!) : undefined;
        return (
          <div
            key={e.id ?? j}
            className={cn('ob-chrono__event', tiny ? 'ob-chrono__event--tiny' : 'ob-chrono__event--tall', click && 'ob-chrono__event--clickable')}
            style={{ top, height, ['--ev-c' as string]: eventColor(e) }}
            onClick={click}
            role={click ? 'button' : undefined}
            tabIndex={click ? 0 : undefined}
          >
            <span className="ob-chrono__event-title">{e.title}</span>
            <span className="ob-chrono__event-time">{tiny ? fmt(e.s) : `${fmt(e.s)}–${fmt(e.e)}`}</span>
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

function Calendar({ cal }: { cal: ChronoCalendar }) {
  return (
    <div className="ob-chrono__cal">
      {/* Calendar header */}
      <div className="ob-chrono__cal-head">
        <span className="ob-chrono__cal-icon"><Icon name="calendar" size={15} /></span>
        <span className="ob-chrono__cal-eyebrow">CALENDARIO</span>
        <span className="ob-chrono__cal-range">{cal.rangeLabel}</span>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__cal-seg">
          <button type="button" className="ob-chrono__cal-seg-item ob-chrono__cal-seg-item--active">Week</button>
          <button type="button" className="ob-chrono__cal-seg-item">Month</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          <button type="button" className="ob-chrono__cal-nav" aria-label="Settimana precedente" onClick={cal.onPrev}><Icon name="chevL" size={14} /></button>
          <button type="button" className="ob-chrono__cal-today" onClick={cal.onToday}>Oggi</button>
          <button type="button" className="ob-chrono__cal-nav" aria-label="Settimana successiva" onClick={cal.onNext}><Icon name="chevR" size={14} /></button>
        </div>
      </div>

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
        {cal.days.map((_, i) => {
          const items = cal.allday.filter((a) => a.day === i);
          return (
            <div key={i} className={cn('ob-chrono__allday-cell', i === 0 && 'ob-chrono__allday-cell--first', i === cal.todayIndex && 'ob-chrono__allday-cell--today')}>
              {items.map((a, j) => {
                const click = cal.onEventClick && a.id ? () => cal.onEventClick!(a.id!) : undefined;
                return (
                  <div
                    key={a.id ?? j}
                    className={cn('ob-chrono__allday-pill', click && 'ob-chrono__event--clickable')}
                    style={{ ['--ev-c' as string]: KIND_COLOR[a.kind] }}
                    onClick={click}
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
        })}
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
            <DayColumn key={i} dayIndex={i} isToday={i === cal.todayIndex} timed={cal.timed} onEventClick={cal.onEventClick} />
          ))}
        </div>
      </div>
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
  onAddTile?: () => void;
  meta?: React.ReactNode;
}

export function ChronoView({
  notes = NOTES, todos = TODOS, calendar = DEMO_CALENDAR, selectedId, onCardClick, onAddTile, meta,
}: ChronoViewProps) {
  return (
    <div className="ob-chrono">
      {/* Header */}
      <div className="ob-chrono__header">
        <span className="ob-chrono__header-mascot"><Beniamino name="kron" size={26} title="" /></span>
        <div>
          <div className="ob-chrono__header-title">Chrono</div>
          <div className="ob-chrono__header-sub">Kron scandisce i giorni e le scadenze</div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="ob-chrono__header-meta">
          <span className="ob-chrono__header-meta-dot" />{meta ?? '2 scadenze questa settimana'}
        </div>
      </div>

      {/* Toolbar */}
      <div className="ob-chrono__toolbar">
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={onAddTile}>Tile</Button>
        <div style={{ flex: 1 }} />
        <span className="ob-chrono__toolbar-meta">GIMMICK · {notes.length + todos.length} tile</span>
      </div>

      {/* Body */}
      <div className="ob-chrono__body">
        <Column icon="note" iconColor="var(--ob-muted)" label="NOTES" tiles={notes} empty="Nessun appunto" onCardClick={onCardClick} selectedId={selectedId} />
        <Column icon="todo" iconColor="var(--ob-subtle)" label="TODO" tiles={todos} empty="Nessun task" onCardClick={onCardClick} selectedId={selectedId} />
        <Calendar cal={calendar} />
      </div>
    </div>
  );
}
