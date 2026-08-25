'use client';

/**
 * Gimmick · Obsidian — Tiles table view ("Quiet rows").
 *
 * La vista Tiles come tabella densa: controlli fantasma, colore solo dove è
 * semantico (tipo di evento, tag, spark).
 *
 * Tabella e barra sono quelle CONDIVISE (`components/primitives/table.tsx`), le
 * stesse di Sparks, Tags e Contatti. Prima era una griglia CSS tutta sua
 * (`--ob-tiles-grid`, righe da 52, solo fili orizzontali) e una barra con
 * bottoni pieni: due vocabolari che non tornavano da nessun'altra parte.
 *
 * ⚠️ Le colonne sono LARGHEZZE FISSE tranne il titolo, che prende quello che
 * avanza. È il patto di `table-layout: fixed`: senza, una riga con molti spark
 * allargherebbe la sua colonna e sfalserebbe l'incolonnamento di tutte le altre
 * — che in una tabella di controlli affiancati è esattamente ciò che la rende
 * leggibile.
 */
import * as React from 'react';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  TableCard, Table, TableBody, TableRow, TableCell, TableText, TableEmpty,
  Toolbar, ToolbarGap, ToolGroup, ToolSep, ToolButton, ToolWord,
  type TableColumn,
} from '@/components/primitives';
import { Icon, type ShellIconName } from '@/components/shell';
import { StatusSwatch } from '@/components/statuses/status-swatch';
import { actionMeta, type ActionKind } from '@/lib/tile-action';
import type { StatusShape } from '@/types';

// ─── Columns ──────────────────────────────────────────────────────────────────
const COLUMNS: TableColumn[] = [
  { key: 'check', width: 40, align: 'center' },
  { key: 'title', label: 'Title' },
  { key: 'action', label: 'Action', width: 134 },
  { key: 'schedule', label: 'Schedule', width: 128 },
  { key: 'tags', label: 'Tags', width: 148 },
  { key: 'type', label: 'Type', width: 134 },
  { key: 'status', label: 'Status', width: 122 },
  { key: 'sparks', label: 'Sparks', width: 230 },
];

// ─── Data model ───────────────────────────────────────────────────────────────
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
  /** Status del tile (colonna STATUS). */
  status?: { label: string; color: string; shape: StatusShape };
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
// `actionMeta` vive in `lib/tile-action`: la usa anche Ask Gimmick per disegnare
// le tile trovate, e devono venire uguali.

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
    <TableRow
      interactive={!!onClick}
      active={active}
      checked={checked}
      onClick={onClick}
      onContextMenu={onContextMenu}
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
      <TableCell align="center" style={{ padding: '0 8px' }}>
        <Checkbox checked={checked} onToggle={onToggle} ariaLabel="Seleziona tile" />
      </TableCell>
      <TableCell>
        <TableText className={cn('ob-tiles__title', row.done && 'ob-tiles__title--done')}>{row.title}</TableText>
      </TableCell>
      <TableCell style={{ padding: '0 6px' }}><Control label={am.label} icon={am.icon} iconColor={am.color} /></TableCell>
      <TableCell>
        {row.date ? (
          <div>
            <div className="ob-tiles__sched-date">{row.date}</div>
            {row.time && <div className="ob-tiles__sched-time">{row.time}</div>}
          </div>
        ) : (
          <span className="ob-table__dash">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="ob-tiles__tag">
          <span style={{ color: row.tagAmber ? 'var(--ob-warning)' : 'var(--ob-accent)', display: 'inline-flex', flexShrink: 0 }}>
            <Icon name={row.tagIcon ?? 'tags'} size={13} />
          </span>
          <span className="ob-tiles__tag-name">{row.tags}</span>
        </div>
      </TableCell>
      <TableCell style={{ padding: '0 6px' }}>
        {row.type
          ? <Control label={row.type} dotColor="var(--ob-error)" square />
          : <Control empty />}
      </TableCell>
      <TableCell style={{ padding: '0 6px' }}>
        {row.status ? (
          <div className="ob-tiles__status">
            <StatusSwatch shape={row.status.shape} color={row.status.color} size={13} />
            <span className="ob-tiles__ctrl-label">{row.status.label}</span>
          </div>
        ) : (
          <Control empty />
        )}
      </TableCell>
      <TableCell>
        <div className="ob-tiles__sparks">
          {row.sparks.length
            ? row.sparks.map((s, i) => <SparkEl key={i} s={s} />)
            : <span className="ob-table__dash">—</span>}
        </div>
      </TableCell>
    </TableRow>
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

  // La colonna della spunta porta il select-all al posto di un'intestazione: è
  // l'unica testata che è un COMANDO, e va costruita qui perché conosce lo stato
  // della selezione.
  const columns = React.useMemo<TableColumn[]>(() => COLUMNS.map((c) => (
    c.key === 'check'
      ? {
          ...c,
          label: checkable
            ? <Checkbox checked={allChecked} indeterminate={someChecked} onToggle={onToggleAll} ariaLabel="Seleziona tutte" />
            : undefined,
        }
      : c
  )), [checkable, allChecked, someChecked, onToggleAll]);

  return (
    <div className="ob-tablepage">
      <Toolbar>
        {checkedCount > 0 ? (
          <ToolGroup>
            <span className="ob-tiles__selbar-n">{checkedCount} selezionati</span>
            <ToolSep />
            <ToolWord onClick={onClearSelection}>Deseleziona</ToolWord>
          </ToolGroup>
        ) : (
          <div className="ob-tiles__count">
            <Icon name="tiles" size={15} />
            <span className="ob-tiles__count-n">{count}</span>
            <span className="ob-tiles__count-sep">/</span>
            <span className="ob-tiles__count-tot">{total}</span>
            <span className="ob-tiles__count-label">TILES</span>
          </div>
        )}
        <ToolbarGap />
        <ToolGroup>
          {/* Conferma a due passi, come nella sidebar: il primo click ARMA (la
              parola diventa rossa e dice quante righe porta via), il secondo
              esegue. È una parola e non un'icona perché deve poter dichiarare il
              numero — un cestino che cambia significato al secondo click sarebbe
              lo stesso comando con due esiti e nessun modo di distinguerli. */}
          {checkedCount > 0 && onDeleteSelected && (
            <>
              <ToolWord
                on={confirming}
                tone="var(--ob-error)"
                onClick={() => {
                  if (confirming) { onDeleteSelected(); setConfirming(false); }
                  else setConfirming(true);
                }}
              >
                {confirming ? `Conferma · elimina ${checkedCount}` : 'Elimina'}
              </ToolWord>
              <ToolSep />
            </>
          )}
          <ToolButton icon={<Icon name="plus" size={16} />} label="Aggiungi tile" onClick={onAddTile} disabled={!onAddTile} />
        </ToolGroup>
      </Toolbar>

      <div className="ob-tableview">
        <TableCard footer={footer}>
          <Table columns={columns}>
            <TableBody>
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
              {rows.length === 0 && <TableEmpty colSpan={COLUMNS.length}>Nessun tile</TableEmpty>}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
}
