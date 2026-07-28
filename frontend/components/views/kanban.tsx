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
import { Icon, type ShellIconName } from '@/components/shell';
import { TileMeta, type TileMetaType } from '@/components/tileview/TileMeta';
import { StatusSwatch } from '@/components/statuses/status-swatch';
import type { StatusShape } from '@/types';

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
  return <Icon name={name} size={11} />;
}
/** Cap-chip mostrate nel piede; le eccedenti diventano un contatore "+N". */
const CAPS_MAX = 2;

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
  /** Status del tile → swatch (forma) nella meta-row. */
  status?: { label: string; color: string; shape: StatusShape };
  /** Type-icon del tile → chip colorato nella meta-row. */
  type?: TileMetaType;
  /** Numero di sparks del tile → contatore in basso a destra. */
  sparkCount?: number;
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
  const caps = t.caps ?? [];
  const capsShown = caps.slice(0, CAPS_MAX);
  const capsExtra = caps.length - capsShown.length;
  return (
    <div
      className={cn('ob-kanban__card', active && 'ob-kanban__card--active', onClick && 'ob-kanban__card--clickable', draggable && 'ob-kanban__card--draggable', t.done && 'ob-kanban__card--done')}
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
      {/* Striscia STATUS a sinistra: presente SOLO se la tile ha uno status
          (stesso ragionamento di CHRONO/CANVAS). Senza status la strip sparisce
          e il corpo occupa tutta la larghezza. */}
      {t.status && (
        <div className="ob-kanban__card-strip" title={t.status.label}>
          <StatusSwatch shape={t.status.shape} color={t.status.color} size={10} />
        </div>
      )}
      <div className="ob-kanban__card-body">
        <div className="ob-kanban__card-title">{t.title}</div>

        {/* Gruppo in basso (checklist + piede) ancorato al fondo, come il canvas. */}
        <div className="ob-kanban__card-bottom">
          {t.checklist && (
            <div className="ob-kanban__checklist">
              <div className="ob-kanban__bars">
                {t.checklist.map((d, i) => <div key={i} className={cn('ob-kanban__bar', d && 'ob-kanban__bar--on')} />)}
              </div>
              <span className="ob-kanban__checklist-count">{done}/{t.checklist.length}</span>
            </div>
          )}

          <div className="ob-kanban__card-foot">
            {capsShown.map((c, i) => (
              <span key={i} className="ob-kanban__cap" style={{ ['--cap-c' as string]: CAP_COLOR[c] }}>
                <CapGlyph kind={c} />
              </span>
            ))}
            {capsExtra > 0 && (
              <span className="ob-kanban__cap ob-kanban__cap--more" title={caps.join(', ')}>+{capsExtra}</span>
            )}
            {/* Lo STATUS vive nella striscia sinistra → nel footer solo il TIPO. */}
            <TileMeta type={t.type} compact />
            <span className="ob-kanban__card-tag" title={t.tag}>
              <span className="ob-kanban__card-tag-icon"><Icon name="tags" size={11} /></span>
              <span className="ob-kanban__card-tag-label">{t.tag}</span>
            </span>
            {!!t.sparkCount && (
              <span className="ob-tile-sparkn" title={`${t.sparkCount} spark`}>{t.sparkCount}</span>
            )}
          </div>
        </div>
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
        <span className="ob-kanban__lane-label" title={lane.label}>{lane.label}</span>
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

  return (
    <div className="ob-kanban">
      {/* Toolbar — prima riga della vista (niente header con titolo/mascotte). */}
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
