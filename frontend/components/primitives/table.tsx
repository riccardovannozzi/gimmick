'use client';

/**
 * Gimmick · Obsidian — LA TABELLA e LA BARRA.
 *
 * I due involucri che Sparks, Tiles, Tags e Contatti condividono. Il
 * ragionamento sulla forma sta per esteso in `app/obsidian-primitives.css`
 * (blocchi «LA TABELLA» e «LA BARRA DEGLI STRUMENTI»); qui c'è solo il JSX che
 * la indossa.
 *
 * Perché componenti e non quattro copie di classi: la parte che si sbagliava non
 * era il colore — quello veniva dai token — ma la STRUTTURA. Una cornice
 * dimenticata, un `<colgroup>` scritto a mano che non corrispondeva alle
 * intestazioni, uno scroll messo sull'antenato sbagliato che rendeva la testata
 * appiccicata inutile. Sono errori che si vedono solo scorrendo, e che quattro
 * pagine diverse commettevano in quattro modi diversi.
 *
 * ⚠️ `table-layout: fixed` è nel CSS, non qui: le larghezze arrivano dal
 * `<colgroup>` che questo componente genera dalle colonne. Una colonna senza
 * `width` prende lo spazio che avanza — dichiararle TUTTE fisse in una tabella
 * larga quanto la vista lascerebbe una banda vuota a destra.
 */
import * as React from 'react';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

// ─── Colonne ──────────────────────────────────────────────────────────────────
export interface TableColumn {
  key: string;
  /** Intestazione. Omessa = colonna senza titolo (spunte, azioni). */
  label?: React.ReactNode;
  /** Larghezza in px. Omessa: la colonna prende lo spazio che avanza. */
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** L'intestazione diventa premibile e chiama `onSort` con questa `key`. */
  sortable?: boolean;
}

/** Classe di allineamento di una cella. Esportata perché le celle si scrivono
 *  fuori di qui, riga per riga, e devono allinearsi alla loro colonna. */
export function tableAlign(align?: TableColumn['align']) {
  return align === 'center' ? 'ob-table__c--center' : align === 'right' ? 'ob-table__c--right' : undefined;
}

// ─── Cornice ──────────────────────────────────────────────────────────────────
export interface TableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Tetto allo scroll. Serve nelle MODALI, dove non c'è una vista a dare
   * l'altezza e senza un limite la tabella crescerebbe oltre la finestra.
   * Dentro una vista si omette: ci pensa il `flex: 1` della cornice.
   */
  maxHeight?: number | string;
  /** Contenuto in coda allo scroll (sentinella dell'infinite-scroll). */
  footer?: React.ReactNode;
}

export function TableCard({ children, maxHeight, footer, className, ...rest }: TableCardProps) {
  return (
    <div className={cn('ob-tablecard', className)} {...rest}>
      {/* `ob-scroll` è la barra di scorrimento sottile dello shell: la tabella
          scorre dentro una scatola stretta, e quella di sistema si porta via
          una colonna di larghezza. */}
      <div className="ob-tablecard__scroll ob-scroll" style={maxHeight !== undefined ? { maxHeight } : undefined}>
        {children}
        {footer}
      </div>
    </div>
  );
}

// ─── Tabella ──────────────────────────────────────────────────────────────────
export interface TableProps extends Omit<React.TableHTMLAttributes<HTMLTableElement>, 'onSort'> {
  /**
   * Colonne. Con questa prop il componente genera da sé `<colgroup>` e
   * `<thead>`, che è il caso di tre tabelle su quattro. Chi ha una testata
   * speciale — TAGS, che ha le maniglie per ridimensionare le colonne — la
   * omette e scrive il proprio `<thead>` dentro `children`.
   */
  columns?: TableColumn[];
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export function Table({ columns, sortKey, sortDir = 'asc', onSort, className, children, ...rest }: TableProps) {
  return (
    <table className={cn('ob-table', className)} {...rest}>
      {columns && (
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width !== undefined ? { width: c.width } : undefined} />
          ))}
        </colgroup>
      )}
      {columns && (
        <thead>
          <tr>
            {columns.map((c) => {
              const on = !!c.sortable && sortKey === c.key;
              return (
                <th
                  key={c.key}
                  className={cn(
                    tableAlign(c.align),
                    c.sortable && onSort && 'ob-table__h--sortable',
                    on && 'ob-table__h--on',
                  )}
                  aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}
                >
                  {c.label}
                  {on && (
                    <span className="ob-table__sort">
                      {sortDir === 'asc'
                        ? <IconArrowUp size={11} stroke={2} />
                        : <IconArrowDown size={11} stroke={2} />}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
      )}
      {children}
    </table>
  );
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
  /** Riga APERTA (una sola: quella nell'inspector). Accent pieno. */
  active?: boolean;
  /** Riga SPUNTATA (molte, per le azioni di insieme). Velatura d'accento. */
  checked?: boolean;
}

export function TableRow({ interactive, active, checked, className, ...rest }: TableRowProps) {
  return (
    <tr
      className={cn(
        'ob-tablerow',
        interactive && 'ob-tablerow--interactive',
        active && 'ob-tablerow--active',
        checked && 'ob-tablerow--checked',
        className,
      )}
      {...rest}
    />
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: TableColumn['align'];
}

export function TableCell({ align, className, ...rest }: TableCellProps) {
  return <td className={cn(tableAlign(align), className)} {...rest} />;
}

/** Testo di cella troncato con i puntini. È un opt-in: una cella che contiene un
 *  badge o una fila di chip non lo usa (vedi la nota nel CSS). */
export function TableText({ className, ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ob-table__text', className)} {...rest} />;
}

/** Il trattino del valore assente. Una cella vuota si legge come un errore di
 *  caricamento; questo dice che il dato non c'è. */
export function TableDash() {
  return <span className="ob-table__dash">—</span>;
}

/** Riga sola al posto del corpo: «nessun risultato». Sta DENTRO la tabella (un
 *  `<td colSpan>`) e non sotto, così resta allineata alla cornice anche quando
 *  la tabella scorre in orizzontale. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ height: 'auto', borderRight: 'none' }}>
        <p className="ob-table__empty">{children}</p>
      </td>
    </tr>
  );
}

// ─── Barra ────────────────────────────────────────────────────────────────────
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Dentro una MODALE: senza fondo, senza hairline, senza rientro. */
  bare?: boolean;
}

export function Toolbar({ bare, className, ...rest }: ToolbarProps) {
  return <div className={cn('ob-toolbar', bare && 'ob-toolbar--bare', className)} {...rest} />;
}

/** Lo spazio che spinge a destra quello che viene dopo. */
export function ToolbarGap() {
  return <div className="ob-toolbar__gap" />;
}

/** Il gruppo di comandi e il filo che ne separa le famiglie: gli stessi due di
 *  canvas e chrono, qui solo per non far importare classi nude alle viste. */
export function ToolGroup({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ob-tools', className)} {...rest} />;
}

export function ToolSep() {
  return <div className="ob-toolsep" />;
}
