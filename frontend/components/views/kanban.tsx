'use client';

/**
 * Gimmick · Obsidian — Kanban view.
 *
 * "Snappy sposta i tile da una colonna all'altra": status lanes holding
 * date-grouped tile cards. The date group header is a Pill (option 01 of
 * GimmickKanbanDates). Reference: GimmickKanban.dc.html. Tile fill = Tint;
 * cap/tag and lane colors from the canonical tokens. Self-contained — drop into
 * the shell's ViewContainer with `hideToolbar`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconGripVertical, IconDots } from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon, type ShellIconName } from '@/components/shell';

// ─── Model ────────────────────────────────────────────────────────────────────
type CapKind = 'photo' | 'file' | 'voice' | 'doc' | 'text';
const CAP_COLOR: Record<CapKind, string> = {
  photo: 'var(--ob-type-photo)',
  file: 'var(--ob-type-file)',
  voice: 'var(--ob-type-voice)',
  doc: 'var(--ob-type-text)',
  text: 'var(--ob-type-text)',
};
function CapGlyph({ kind }: { kind: CapKind }) {
  const name: ShellIconName = kind === 'doc' ? 'file' : kind;
  return <Icon name={name} size={12} />;
}

export interface CardData {
  /** Presente quando la vista è collegata ai dati reali. */
  id?: string;
  title: string;
  tag: string;
  amber?: boolean;
  caps?: CapKind[];
  checklist?: boolean[];
  /** Tile completato (is_completed) → pallino verde in alto a destra. */
  done?: boolean;
}
export interface DateGroup {
  date?: string;
  long?: string;
  today?: boolean;
  noDate?: boolean;
  drop?: boolean;
  tiles: CardData[];
}
export interface Lane {
  /** Id colonna reale (target del drag-drop). */
  id?: string;
  label: string;
  color: string;
  square?: boolean; // square status dot (deadline)
  groups: DateGroup[];
}

const LANES: Lane[] = [
  {
    label: 'NOTE', color: 'var(--ob-muted)', groups: [
      { date: '27/06/26', today: true, tiles: [{ title: 'Appuntamento con Marco Guerrieri', tag: 'OM', caps: ['voice'] }] },
      { date: '29/06/26', long: 'Lun 29 giu', tiles: [{ title: 'Moodboard cucina Ortano — riferimenti materiali', tag: 'GDS', caps: ['photo', 'doc'] }] },
    ],
  },
  {
    label: 'DA FARE', color: 'var(--ob-muted)', groups: [
      { date: '27/06/26', today: true, drop: true, tiles: [
        { title: 'Revoca certificato digitale Aruba', tag: 'OM', amber: true, caps: ['file'], checklist: [true, true, false] },
        { title: 'Preparare brief Teleport per Marco', tag: 'GDS', caps: ['text'], checklist: [true, false, false, false] },
      ] },
      { noDate: true, tiles: [{ title: 'Lista materiali cucina', tag: 'OM', amber: true, checklist: [false, false] }] },
    ],
  },
  {
    label: 'PROGRAMMATI', color: 'var(--ob-success)', groups: [
      { date: '27/06/26', today: true, tiles: [{ title: 'Audio e incontro con Marco', tag: 'OM', caps: ['voice'] }] },
      { date: '28/06/26', long: 'Dom 28 giu', tiles: [{ title: 'GDS/bisdomini — sopralluogo', tag: 'GDS', amber: true, caps: ['photo'] }] },
    ],
  },
  {
    label: 'SCADENZE', color: 'var(--ob-error)', square: true, groups: [
      { date: '30/06/26', long: 'Mar 30 giu', tiles: [{ title: 'Aruba — rinnovo certificato', tag: 'OM', amber: true, caps: ['file'] }] },
      { noDate: true, tiles: [{ title: 'Rinnovo polizza Unipol casa', tag: 'OM', amber: true, caps: ['file'] }] },
    ],
  },
  {
    label: 'FATTI', color: 'var(--ob-success)', groups: [
      { date: '26/06/26', long: 'Ven 26 giu', tiles: [
        { title: 'Itinerario Lisbona confermato', tag: 'Viaggio', caps: ['file', 'photo'], checklist: [true, true, true] },
        { title: 'Demo prodotto v2 rivista', tag: 'GDS', caps: ['doc'] },
      ] },
    ],
  },
  { label: 'FAMIGLIA', color: 'var(--ob-warning)', groups: [] },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────
function TileCard({ t, onClick, active }: { t: CardData; onClick?: () => void; active?: boolean }) {
  const cardC = t.amber ? 'var(--ob-warning)' : 'var(--ob-accent)';
  const done = t.checklist?.filter(Boolean).length ?? 0;
  const draggable = !!t.id;
  return (
    <div
      className={cn('ob-kanban__card', active && 'ob-kanban__card--active', onClick && 'ob-kanban__card--clickable', t.done && 'ob-kanban__card--done')}
      style={{ ['--card-c' as string]: cardC }}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.setData('text/x-tile', t.id!); e.dataTransfer.effectAllowed = 'move'; } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }
          : undefined
      }
    >
      <div className="ob-kanban__card-top">
        <div className="ob-kanban__card-title">{t.title}</div>
        {t.done && <span className="ob-kanban__card-done" title="Completato" aria-label="Completato" />}
        <span className="ob-kanban__card-grip"><IconGripVertical size={14} stroke={1.6} /></span>
      </div>

      {t.checklist && (
        <div className="ob-kanban__checklist">
          <div className="ob-kanban__bars">
            {t.checklist.map((d, i) => <div key={i} className={cn('ob-kanban__bar', d && 'ob-kanban__bar--on')} />)}
          </div>
          <span className="ob-kanban__checklist-count">{done}/{t.checklist.length}</span>
        </div>
      )}

      <div className="ob-kanban__card-foot">
        {t.caps?.map((c, i) => (
          <span key={i} className="ob-kanban__cap" style={{ ['--cap-c' as string]: CAP_COLOR[c] }}>
            <CapGlyph kind={c} />
          </span>
        ))}
        <span className="ob-kanban__card-tag">
          <span className="ob-kanban__card-tag-icon"><Icon name="tags" size={12} /></span>
          <span className="ob-kanban__card-tag-label">{t.tag}</span>
        </span>
      </div>
    </div>
  );
}

function DatePill({ g }: { g: DateGroup }) {
  const label = g.noDate ? 'Senza data' : g.today ? 'Oggi' : g.long ?? g.date;
  return (
    <div className={cn('ob-kanban__datepill', g.today && 'ob-kanban__datepill--today')}>
      <span className="ob-kanban__datepill-dot" />
      <span className="ob-kanban__datepill-label">{label}</span>
      {!g.noDate && <span className="ob-kanban__datepill-date">{g.date}</span>}
    </div>
  );
}

function LaneCol({
  lane, onCardClick, selectedId, onMoveTile,
}: {
  lane: Lane;
  onCardClick?: (id: string) => void;
  selectedId?: string;
  onMoveTile?: (tileId: string, targetColId: string) => void;
}) {
  const count = lane.groups.reduce((n, g) => n + g.tiles.length, 0);
  const [dragOver, setDragOver] = React.useState(false);
  const canDrop = !!onMoveTile && !!lane.id;
  return (
    <div
      className={cn('ob-kanban__lane', dragOver && 'ob-kanban__lane--dropover')}
      style={{ ['--lane-c' as string]: lane.color }}
      onDragOver={canDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(true); } : undefined}
      onDragLeave={canDrop ? () => setDragOver(false) : undefined}
      onDrop={
        canDrop
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              const id = e.dataTransfer.getData('text/x-tile');
              if (id) onMoveTile!(id, lane.id!);
            }
          : undefined
      }
    >
      <div className="ob-kanban__lane-head">
        <span className="ob-kanban__lane-grip"><IconGripVertical size={11} stroke={1.6} /></span>
        <span className={cn('ob-kanban__lane-dot', lane.square && 'ob-kanban__lane-dot--sq')} />
        <span className="ob-kanban__lane-label">{lane.label}</span>
        <span className="ob-kanban__lane-count">{count}</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="ob-kanban__lane-btn" aria-label="Comprimi"><Icon name="chevR" size={12} /></button>
        <button type="button" className="ob-kanban__lane-btn" aria-label="Altro"><IconDots size={12} stroke={1.6} /></button>
      </div>
      <div className="ob-kanban__lane-body ob-scroll">
        {count ? (
          lane.groups.map((g, gi) => (
            <div key={gi} className="ob-kanban__group">
              <DatePill g={g} />
              {g.tiles.map((t, ti) => (
                <TileCard
                  key={t.id ?? ti}
                  t={t}
                  active={!!t.id && t.id === selectedId}
                  onClick={onCardClick && t.id ? () => onCardClick(t.id!) : undefined}
                />
              ))}
              {g.drop && <div className="ob-kanban__drop">Rilascia qui</div>}
            </div>
          ))
        ) : (
          <div className="ob-kanban__lane-empty">NESSUN TILE</div>
        )}
      </div>
    </div>
  );
}

export interface KanbanViewProps {
  lanes?: Lane[];
  onCardClick?: (id: string) => void;
  selectedId?: string;
  onAddTile?: () => void;
  /** Drag di un tile su una colonna → applica i filtri colonna come update. */
  onMoveTile?: (tileId: string, targetColId: string) => void;
}

export function KanbanView({ lanes = LANES, onCardClick, selectedId, onAddTile, onMoveTile }: KanbanViewProps) {
  const [tag, setTag] = React.useState('all');
  const total = lanes.reduce((n, l) => n + l.groups.reduce((m, g) => m + g.tiles.length, 0), 0);

  return (
    <div className="ob-kanban">
      {/* Header */}
      <div className="ob-kanban__header">
        <span className="ob-kanban__header-mascot"><Beniamino name="snappy" size={26} title="" /></span>
        <div>
          <div className="ob-kanban__header-title">Kanban</div>
          <div className="ob-kanban__header-sub">Snappy sposta i tile da una colonna all’altra</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="ob-kanban__header-meta">GIMMICK · {total} tile in board</span>
      </div>

      {/* Toolbar */}
      <div className="ob-kanban__toolbar">
        <button type="button" className="ob-kanban__ctrl">
          <span className="ob-kanban__ctrl-muted">Raggruppa:</span>
          Stato
          <span className="ob-kanban__ctrl-icon"><Icon name="chevD" size={12} /></span>
        </button>
        <div className="ob-kanban__div" />
        {[
          { id: 'all', label: 'Tutti i tag' },
          { id: 'OM', label: 'OM' },
          { id: 'GDS', label: 'GDS' },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            className={cn('ob-kanban__pill', tag === p.id && 'ob-kanban__pill--active')}
            onClick={() => setTag(p.id)}
          >
            <span className="ob-kanban__pill-dot" />
            {p.label}
          </button>
        ))}
        <div className="ob-kanban__spacer" />
        <button type="button" className="ob-kanban__ctrl">
          <span className="ob-kanban__ctrl-icon"><Icon name="calendar" size={13} /></span>Oggi
        </button>
        <button type="button" className="ob-kanban__ctrl">
          <span className="ob-kanban__ctrl-icon"><Icon name="kanban" size={13} /></span>Colonna
        </button>
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={onAddTile}>Tile</Button>
      </div>

      {/* Board */}
      <div className="ob-kanban__board ob-scroll">
        {lanes.map((l) => (
          <LaneCol
            key={l.id ?? l.label}
            lane={l}
            onCardClick={onCardClick}
            selectedId={selectedId}
            onMoveTile={onMoveTile}
          />
        ))}
      </div>
    </div>
  );
}
