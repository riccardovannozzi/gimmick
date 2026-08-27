'use client';

/**
 * Gimmick · Obsidian — Sparks list view (buffer / triage).
 *
 * Lista filtrabile e ordinabile degli spark catturati: Nome · Tipo · Data ·
 * Dim. · AI · Azioni.
 *
 * Tabella e barra sono quelle CONDIVISE (`components/primitives/table.tsx`), le
 * stesse di Tiles, Tags e Contatti. Prima era una griglia CSS tutta sua
 * (`--ob-sparks-grid`, righe da 50, intestazione senza fili verticali) e una
 * barra di chip pieni con contorno: due vocabolari che qui non tornavano più da
 * nessun'altra parte dell'app.
 *
 * I chip di filtro sono diventati PAROLE (`ToolWord`), come i comandi di chrono:
 * cambiano cosa guardi e non toccano i dati, quindi sono i più leggeri della
 * barra. Il colore del tipo non è andato perso — è il tono che la parola prende
 * da accesa, esattamente come il verde di «Done» in chrono.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconTrash } from '@tabler/icons-react';
import {
  TableCard, Table, TableBody, TableRow, TableCell, TableText, TableEmpty,
  Toolbar, ToolbarGap, ToolGroup, ToolWord,
  type TableColumn,
} from '@/components/primitives';
import { Icon, type ShellIconName } from '@/components/shell';

// ─── Model ────────────────────────────────────────────────────────────────────
type SparkKind = 'audio' | 'text' | 'photo' | 'video' | 'file';
export interface SparkItem {
  /** number for the design mock; string (UUID) when wired to real sparks. */
  id: string | number;
  name: string;
  type: SparkKind;
  date: string; // dd/mm/yyyy
  dim?: string;
  dimv?: number;
  ai?: boolean;
}

const SPARKS: SparkItem[] = [
  { id: 1, name: 'audio_recording', type: 'audio', date: '26/06/2026', ai: true },
  { id: 2, name: 'p 16.12.25', type: 'text', date: '26/06/2026', ai: true },
  { id: 3, name: 'pagata 20.03.26', type: 'text', date: '26/06/2026', ai: true },
  { id: 4, name: 'pagta a 26/06/26', type: 'text', date: '26/06/2026', ai: true },
  { id: 5, name: 'Questo è marco guerrieri', type: 'text', date: '25/06/2026', ai: true },
  { id: 6, name: 'photo', type: 'photo', date: '25/06/2026', dim: '1,4 MB', dimv: 1400, ai: true },
  { id: 7, name: 'audio_recording', type: 'audio', date: '25/06/2026', ai: true },
  { id: 8, name: 'audio_recording', type: 'audio', date: '25/06/2026', ai: true },
  { id: 9, name: 'preventivo_om.pdf', type: 'file', date: '25/06/2026', dim: '240 KB', dimv: 240, ai: false },
  { id: 10, name: 'audio_recording', type: 'audio', date: '25/06/2026', ai: true },
  { id: 11, name: 'clip_demo', type: 'video', date: '24/06/2026', dim: '8,2 MB', dimv: 8200, ai: false },
  { id: 12, name: 'audio_recording', type: 'audio', date: '24/06/2026', ai: true },
  { id: 13, name: 'note rapide cucina', type: 'text', date: '24/06/2026', ai: true },
  { id: 14, name: 'audio_recording', type: 'audio', date: '23/06/2026', ai: true },
];

const TYPE_META: Record<SparkKind, { label: string; icon: ShellIconName; color: string }> = {
  audio: { label: 'Audio', icon: 'voice', color: 'var(--ob-type-voice)' },
  text: { label: 'Text', icon: 'text', color: 'var(--ob-type-text)' },
  photo: { label: 'Photo', icon: 'photo', color: 'var(--ob-type-photo)' },
  video: { label: 'Video', icon: 'video', color: 'var(--ob-type-video)' },
  file: { label: 'File', icon: 'file', color: 'var(--ob-type-file)' },
};

// ─── Sorting ──────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'type' | 'date' | 'dimv' | 'ai';
type SortDir = 'asc' | 'desc';

function sortVal(s: SparkItem, k: SortKey): string | number {
  if (k === 'date') { const [d, m, y] = s.date.split('/'); return `${y}${m}${d}`; }
  if (k === 'dimv') return s.dimv ?? 0;
  if (k === 'ai') return s.ai ? 1 : 0;
  if (k === 'type') return s.type;
  return s.name.toLowerCase();
}

/** NOME senza larghezza: è la colonna-contenuto e prende lo spazio che avanza. */
const COLUMNS: TableColumn[] = [
  { key: 'name', label: 'Nome', sortable: true },
  { key: 'type', label: 'Tipo', width: 130, sortable: true },
  { key: 'date', label: 'Data', width: 116, sortable: true },
  { key: 'dimv', label: 'Dim.', width: 100, sortable: true },
  { key: 'ai', label: 'AI', width: 60, align: 'center', sortable: true },
  { key: 'actions', label: 'Azioni', width: 78, align: 'center' },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: SparkKind }) {
  const m = TYPE_META[type];
  return (
    <span className="ob-sparks__type" style={{ ['--badge-c' as string]: m.color }}>
      <span className="ob-sparks__type-icon"><Icon name={m.icon} size={12} /></span>
      <span className="ob-sparks__type-name">{m.label}</span>
    </span>
  );
}

export interface SparksViewProps {
  sparks?: SparkItem[];
  onDelete?: (id: string | number) => void;
  /** Row click (e.g. open the spark viewer). */
  onSelect?: (id: string | number) => void;
}

export function SparksView({ sparks = SPARKS, onDelete, onSelect }: SparksViewProps) {
  const [filter, setFilter] = React.useState<'all' | SparkKind>('all');
  const [search, setSearch] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('date');
  const [sortDir, setSortDir] = React.useState<SortDir>('desc');

  const toggleSort = (k: string) => {
    const key = k as SortKey;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    sparks.forEach((s) => { c[s.type] = (c[s.type] ?? 0) + 1; });
    return c;
  }, [sparks]);

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = sparks.filter(
      (s) => (filter === 'all' || s.type === filter) && (!q || s.name.toLowerCase().includes(q)),
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const va = sortVal(a, sortKey), vb = sortVal(b, sortKey);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [sparks, filter, search, sortKey, sortDir]);

  const filters: Array<{ id: 'all' | SparkKind; label: string; type?: SparkKind; count: number }> = [
    { id: 'all', label: 'Tutti', count: sparks.length },
    { id: 'audio', label: 'Audio', type: 'audio', count: counts.audio ?? 0 },
    { id: 'text', label: 'Text', type: 'text', count: counts.text ?? 0 },
    { id: 'photo', label: 'Photo', type: 'photo', count: counts.photo ?? 0 },
    { id: 'video', label: 'Video', type: 'video', count: counts.video ?? 0 },
    { id: 'file', label: 'File', type: 'file', count: counts.file ?? 0 },
  ];

  return (
    <div className="ob-tablepage">
      <Toolbar>
        <ToolGroup>
          {filters.map((f) => (
            <ToolWord
              key={f.id}
              on={filter === f.id}
              tone={f.type ? TYPE_META[f.type].color : undefined}
              onClick={() => setFilter(f.id)}
              title={f.type ? `Solo ${f.label.toLowerCase()}` : 'Tutti i tipi'}
            >
              {f.label}
              <span className="ob-toolword__n">{f.count}</span>
            </ToolWord>
          ))}
        </ToolGroup>
        <ToolbarGap />
        <input
          className="ob-toolinput"
          style={{ width: 220 }}
          placeholder="Cerca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Toolbar>

      <div className="ob-tableview">
        <TableCard>
          <Table columns={COLUMNS} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  key={s.id}
                  interactive={!!onSelect}
                  onClick={onSelect ? () => onSelect(s.id) : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onKeyDown={
                    onSelect
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(s.id);
                          }
                        }
                      : undefined
                  }
                >
                  <TableCell><TableText className="ob-sparks__name">{s.name}</TableText></TableCell>
                  <TableCell><TypeBadge type={s.type} /></TableCell>
                  <TableCell><span className="ob-sparks__date">{s.date}</span></TableCell>
                  <TableCell>
                    <span className={cn('ob-sparks__dim', !s.dim && 'ob-sparks__dim--empty')}>{s.dim ?? '—'}</span>
                  </TableCell>
                  <TableCell align="center">
                    {/* Acceso = indicizzato dall'AI. Lo spento è un quadrato vuoto e
                        non un trattino: sta in colonna sotto quelli accesi, e la
                        differenza si legge di colpo scorrendo la lista. */}
                    {s.ai ? (
                      <span className="ob-sparks__ai ob-sparks__ai--on"><IconCheck size={12} stroke={2.4} /></span>
                    ) : (
                      <span className="ob-sparks__ai" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <button
                      type="button"
                      className="ob-sparks__del"
                      aria-label="Elimina spark"
                      onClick={(e) => { e.stopPropagation(); onDelete?.(s.id); }}
                    >
                      <IconTrash size={14} stroke={1.6} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableEmpty colSpan={COLUMNS.length}>
                  {search ? 'Nessun risultato' : 'Nessuno spark di questo tipo'}
                </TableEmpty>
              )}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
}
