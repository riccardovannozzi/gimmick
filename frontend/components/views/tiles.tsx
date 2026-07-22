'use client';

/**
 * Gimmick · Obsidian — Tiles table view ("Quiet rows").
 *
 * The Tiles view rendered as a calm, high-density table: ghost controls,
 * horizontal hairlines, color only where semantic (event type, tag, sparks).
 * Reference: GimmickTable.dc.html (proposal "A"). Drop into the shell's
 * ViewContainer with `hideToolbar` — this view brings its own top bar.
 *
 * Reuses the shell <Icon> and the <Button> primitive; the type colors come
 * straight from the `--ob-type-*` / semantic tokens.
 */
import * as React from 'react';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/primitives';
import { Icon, type ShellIconName } from '@/components/shell';

// ─── Columns ──────────────────────────────────────────────────────────────────
interface Col { key: string; label: string; sort?: boolean; check?: boolean }
const COLS: Col[] = [
  { key: 'check', label: '', check: true },
  { key: 'title', label: 'Title', sort: true },
  { key: 'action', label: 'Action', sort: true },
  { key: 'schedule', label: 'Schedule' },
  { key: 'tags', label: 'Tags', sort: true },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Status' },
  { key: 'sparks', label: 'Sparks', sort: true },
];

// ─── Data model ───────────────────────────────────────────────────────────────
type ActionKind = 'timed' | 'allday' | 'notes';
type SparkType = 'photo' | 'voice' | 'text' | 'file';
interface RowSpark { t: SparkType; x?: string }
export interface TileRow {
  /** Presente quando la vista è collegata ai dati reali. */
  id?: string;
  title: string;
  action: ActionKind;
  date?: string;
  time?: string;
  tags: string;
  tagIcon?: ShellIconName;
  tagAmber?: boolean;
  type?: string;
  sparks: RowSpark[];
  /** Tile completato (is_completed) → titolo barrato e attenuato. */
  done?: boolean;
}

const ROWS: TileRow[] = [
  { title: 'Marco al tramonto mediterran…', action: 'notes', tags: 'Gimmick', sparks: [{ t: 'photo' }, { t: 'text', x: 'Questo è marco guerrieri' }] },
  { title: 'Audio e incontro con Marco', action: 'timed', date: '26/06/2026', time: '17:00 – 18:00', tags: 'Gimmick', sparks: [{ t: 'voice' }, { t: 'voice' }] },
  { title: 'Appuntamento con Marco Guerr…', action: 'notes', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
  { title: 'GDS/bisdomini', action: 'timed', date: '26/06/2026', time: '12:15 – 13:15', tags: 'GDS_Varie', tagIcon: 'sun', tagAmber: true, sparks: [] },
  { title: 'Incontro con Bania Piccardi …', action: 'notes', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
  { title: 'Incontro su Intelligenza Art…', action: 'allday', date: '26/06/2026', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
  { title: 'Contatto isibrix.it per Sola…', action: 'allday', date: '25/06/2026', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
  { title: 'Proloco Marras e Renai', action: 'timed', date: '24/06/2026', time: '18:00 – 18:30', tags: 'Gimmick', sparks: [] },
  { title: 'Aruba - Certificato digitale', action: 'allday', date: '25/06/2026', tags: 'Gimmick', type: 'Importante', sparks: [{ t: 'text', x: 'Reminder revoca imminente del…' }, { t: 'file', x: 'certificato digit…' }] },
  { title: 'Call con Viviani e Renai', action: 'timed', date: '29/06/2026', time: '11:00 – 12:00', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
  { title: 'Progetto Cameretta Bambini', action: 'timed', date: '24/06/2026', time: '18:30 – 19:30', tags: 'Gimmick', sparks: [{ t: 'voice' }] },
];

// ─── Mappings (semantic → tokens) ─────────────────────────────────────────────
interface ActionMeta { label: string; icon: ShellIconName; color: string }
function actionMeta(a: ActionKind): ActionMeta {
  if (a === 'timed') return { label: 'Timed', icon: 'clock', color: 'var(--ob-info)' };
  if (a === 'allday') return { label: 'All Day', icon: 'calendar', color: 'var(--ob-warning)' };
  return { label: 'Notes', icon: 'note', color: 'var(--ob-muted)' };
}

const SPARK_META: Record<SparkType, { color: string; icon: ShellIconName }> = {
  voice: { color: 'var(--ob-type-voice)', icon: 'voice' },
  text: { color: 'var(--ob-type-text)', icon: 'text' },
  file: { color: 'var(--ob-type-file)', icon: 'file' },
  photo: { color: 'var(--ob-type-photo)', icon: 'photo' },
};

// ─── Ghost control (action / type / status) ───────────────────────────────────
function Control({
  label, icon, iconColor, dotColor, square, empty,
}: {
  label?: string; icon?: ShellIconName; iconColor?: string;
  dotColor?: string; square?: boolean; empty?: boolean;
}) {
  return (
    <div className={cn('ob-tiles__ctrl', empty && 'ob-tiles__ctrl--empty')}>
      {!empty && (
        icon
          ? <span style={{ color: iconColor, display: 'inline-flex', flexShrink: 0 }}><Icon name={icon} size={14} /></span>
          : dotColor
            ? <span className={cn('ob-tiles__ctrl-dot', square && 'ob-tiles__ctrl-dot--sq')} style={{ background: dotColor }} />
            : null
      )}
      <span className="ob-tiles__ctrl-label">{empty ? '—' : label}</span>
      <span className="ob-tiles__ctrl-chev"><Icon name="chevD" size={12} /></span>
    </div>
  );
}

function SparkEl({ s }: { s: RowSpark }) {
  const m = SPARK_META[s.t];
  if (s.t === 'photo') {
    return (
      <div className="ob-tiles__spark-box ob-tiles__spark-box--photo">
        <Icon name="photo" size={15} />
      </div>
    );
  }
  if (s.x) {
    return (
      <div className="ob-tiles__spark-chip">
        <span style={{ color: m.color, display: 'inline-flex', flexShrink: 0 }}><Icon name={m.icon} size={13} /></span>
        <span className="ob-tiles__spark-chip-text">{s.x}</span>
      </div>
    );
  }
  return (
    <div className="ob-tiles__spark-box" style={{ color: m.color }}>
      <Icon name={m.icon} size={15} />
    </div>
  );
}

// ─── Checkbox (selezione riga / select-all) ───────────────────────────────────
function Checkbox({
  checked, indeterminate, onToggle, ariaLabel,
}: {
  checked?: boolean; indeterminate?: boolean; onToggle?: () => void; ariaLabel?: string;
}) {
  const on = !!checked || !!indeterminate;
  return (
    <button
      type="button"
      className={cn('ob-tiles__checkbox', on && 'ob-tiles__checkbox--on')}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : !!checked}
      aria-label={ariaLabel}
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
    >
      {indeterminate ? <IconMinus size={11} stroke={3} /> : checked ? <IconCheck size={11} stroke={3} /> : null}
    </button>
  );
}

function Row({ row, onClick, active, checked, onToggle, onContextMenu }: { row: TileRow; onClick?: () => void; active?: boolean; checked?: boolean; onToggle?: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const am = actionMeta(row.action);
  return (
    <div
      className={cn('ob-tiles__row', active && 'ob-tiles__row--active', onClick && 'ob-tiles__row--clickable', checked && 'ob-tiles__row--checked')}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="ob-tiles__cell ob-tiles__cell--check">
        <Checkbox checked={checked} onToggle={onToggle} ariaLabel="Seleziona tile" />
      </div>
      <div className="ob-tiles__cell"><span className={cn('ob-tiles__title', row.done && 'ob-tiles__title--done')}>{row.title}</span></div>
      <div className="ob-tiles__cell ob-tiles__cell--ctrl"><Control label={am.label} icon={am.icon} iconColor={am.color} /></div>
      <div className="ob-tiles__cell">
        {row.date ? (
          <div>
            <div className="ob-tiles__sched-date">{row.date}</div>
            {row.time && <div className="ob-tiles__sched-time">{row.time}</div>}
          </div>
        ) : (
          <span className="ob-tiles__dash">—</span>
        )}
      </div>
      <div className="ob-tiles__cell">
        <div className="ob-tiles__tag">
          <span style={{ color: row.tagAmber ? 'var(--ob-warning)' : 'var(--ob-accent)', display: 'inline-flex', flexShrink: 0 }}>
            <Icon name={row.tagIcon ?? 'tags'} size={13} />
          </span>
          <span className="ob-tiles__tag-name">{row.tags}</span>
        </div>
      </div>
      <div className="ob-tiles__cell ob-tiles__cell--ctrl">
        {row.type
          ? <Control label={row.type} dotColor="var(--ob-error)" square />
          : <Control empty />}
      </div>
      <div className="ob-tiles__cell ob-tiles__cell--ctrl"><Control empty /></div>
      <div className="ob-tiles__cell">
        <div className="ob-tiles__sparks">
          {row.sparks.length
            ? row.sparks.map((s, i) => <SparkEl key={i} s={s} />)
            : <span className="ob-tiles__dash">—</span>}
        </div>
      </div>
    </div>
  );
}

export interface TilesViewProps {
  rows?: TileRow[];
  count?: number;
  total?: number;
  onAddTile?: () => void;
  /** Click su una riga (apre il dettaglio nell'Inspector). */
  onRowClick?: (id: string) => void;
  /** Id della riga attualmente selezionata (evidenziata). */
  selectedId?: string;
  /** Contenuto in coda alla lista, dentro lo scroll (es. sentinella infinite-scroll). */
  footer?: React.ReactNode;
  /** Id delle righe spuntate (multi-selezione per azioni bulk). */
  checkedIds?: Set<string>;
  /** Toggle della spunta di una riga. */
  onToggleRow?: (id: string) => void;
  /** Toggle select-all (spunta/deseleziona tutte le righe visibili). */
  onToggleAll?: () => void;
  /** Svuota la selezione. */
  onClearSelection?: () => void;
  /** Elimina le righe selezionate. */
  onDeleteSelected?: () => void;
  /** Tasto destro su una riga (apre il menu contestuale). */
  onRowContextMenu?: (e: React.MouseEvent, id: string) => void;
}

export function TilesView({
  rows = ROWS, count = 400, total = 400, onAddTile, onRowClick, selectedId, footer,
  checkedIds, onToggleRow, onToggleAll, onClearSelection, onDeleteSelected, onRowContextMenu,
}: TilesViewProps) {
  const checkable = !!onToggleRow;
  const idRows = rows.filter((r) => !!r.id);
  const checkedCount = checkedIds?.size ?? 0;
  const allChecked = checkable && !!checkedIds && idRows.length > 0 && idRows.every((r) => checkedIds.has(r.id!));
  const someChecked = checkedCount > 0 && !allChecked;

  // Conferma a due passi sul pulsante Elimina (coerente con la sidebar): il primo
  // click arma la conferma, il secondo esegue. Si resetta quando la selezione cambia.
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => { setConfirming(false); }, [checkedCount]);

  return (
    <div className="ob-tiles">
      <div className="ob-tiles__topbar">
        {checkedCount > 0 ? (
          <div className="ob-tiles__selbar">
            <span className="ob-tiles__selbar-n">{checkedCount} selezionati</span>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>Deseleziona</Button>
          </div>
        ) : (
          <div className="ob-tiles__count">
            <Icon name="tiles" size={15} />
            <span className="ob-tiles__count-n">{count}</span>
            <span className="ob-tiles__count-sep">/</span>
            <span className="ob-tiles__count-tot">{total}</span>
            <span className="ob-tiles__count-label">TILES</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {checkedCount > 0 && onDeleteSelected && (
          <Button
            variant="danger"
            size="sm"
            icon={<Icon name="trash" size={13} />}
            onClick={() => {
              if (confirming) { onDeleteSelected(); setConfirming(false); }
              else setConfirming(true);
            }}
          >
            {confirming ? `Conferma · elimina ${checkedCount}` : 'Elimina'}
          </Button>
        )}
        <Button variant="primary" size="sm" icon={<Icon name="plus" size={13} />} onClick={onAddTile}>
          Add tile
        </Button>
      </div>

      <div className="ob-tiles__scroll ob-scroll">
        <div className="ob-tiles__head">
          {COLS.map((c) => (
            <div key={c.key} className={cn('ob-tiles__hcell', c.check && 'ob-tiles__hcell--check')}>
              {c.check ? (
                checkable
                  ? <Checkbox checked={allChecked} indeterminate={someChecked} onToggle={onToggleAll} ariaLabel="Seleziona tutte" />
                  : <div className="ob-tiles__checkbox" />
              ) : (
                <>
                  <span className="ob-tiles__hlabel">{c.label}</span>
                  {c.sort && <span className="ob-tiles__hsort"><Icon name="filter" size={10} /></span>}
                </>
              )}
            </div>
          ))}
        </div>
        {rows.map((r, i) => (
          <Row
            key={r.id ?? i}
            row={r}
            active={!!r.id && r.id === selectedId}
            onClick={onRowClick && r.id ? () => onRowClick(r.id!) : undefined}
            checked={!!r.id && !!checkedIds?.has(r.id)}
            onToggle={checkable && r.id ? () => onToggleRow!(r.id!) : undefined}
            onContextMenu={onRowContextMenu && r.id ? (e) => onRowContextMenu(e, r.id!) : undefined}
          />
        ))}
        {footer}
      </div>
    </div>
  );
}
