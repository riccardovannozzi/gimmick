'use client';

/**
 * Gimmick · Obsidian — Sparks list view (buffer / triage).
 *
 * Filterable, sortable list of captured sparks: Nome · Tipo · Data · Dim. · AI ·
 * Azioni, with per-type filter chips. Reference: GimmickBuffer.dc.html.
 * Type colors come from the canonical `--ob-type-*` scale. Self-contained — drop
 * into the shell's ViewContainer with `hideToolbar`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { Field } from '@/components/primitives';
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

interface Col { key: string; label: string; center?: boolean; sort?: SortKey }
const COLS: Col[] = [
  { key: 'name', label: 'NOME', sort: 'name' },
  { key: 'type', label: 'TIPO', sort: 'type' },
  { key: 'date', label: 'DATA', sort: 'date' },
  { key: 'dimv', label: 'DIM.', sort: 'dimv' },
  { key: 'ai', label: 'AI', center: true, sort: 'ai' },
  { key: 'actions', label: 'AZIONI', center: true },
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

  const toggleSort = (k?: SortKey) => {
    if (!k) return;
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
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

  const chipDefs: Array<{ id: 'all' | SparkKind; label: string; type?: SparkKind; count: number }> = [
    { id: 'all', label: 'Tutti', count: sparks.length },
    { id: 'audio', label: 'Audio', type: 'audio', count: counts.audio ?? 0 },
    { id: 'text', label: 'Text', type: 'text', count: counts.text ?? 0 },
    { id: 'photo', label: 'Photo', type: 'photo', count: counts.photo ?? 0 },
    { id: 'video', label: 'Video', type: 'video', count: counts.video ?? 0 },
    { id: 'file', label: 'File', type: 'file', count: counts.file ?? 0 },
  ];

  return (
    <div className="ob-sparks">
      {/* Toolbar */}
      <div className="ob-sparks__toolbar">
        <div className="ob-sparks__brand">
          <span className="ob-sparks__brand-icon"><Icon name="sparkles" size={20} /></span>
          <span className="ob-sparks__brand-title">Sparks</span>
          <span className="ob-sparks__brand-count">{sparks.length}</span>
        </div>
        <div style={{ flex: 1 }} />
        <Field
          wrapperClassName="ob-sparks__search"
          leading={<Icon name="search" size={14} />}
          placeholder="Cerca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="ob-sparks__typefilter">
          <span className="ob-sparks__typefilter-icon"><Icon name="filter" size={13} /></span>
          Tutti i tipi
          <span className="ob-sparks__typefilter-icon"><Icon name="chevD" size={12} /></span>
        </button>
      </div>

      {/* Filter chips */}
      <div className="ob-sparks__chips ob-scroll">
        {chipDefs.map((c) => {
          const active = filter === c.id;
          const color = c.type ? TYPE_META[c.type].color : undefined;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={cn('ob-sparks__chip', active && (c.type ? 'ob-sparks__chip--type' : 'ob-sparks__chip--accent'))}
              style={color ? ({ ['--badge-c' as string]: color }) : undefined}
            >
              <span className="ob-sparks__chip-icon">
                <Icon name={c.type ? TYPE_META[c.type].icon : 'sparkles'} size={c.type ? 13 : 12} />
              </span>
              {c.label}
              <span className="ob-sparks__chip-count">{c.count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="ob-sparks__scroll ob-scroll">
        <div className="ob-sparks__head">
          {COLS.map((c) => {
            const active = !!c.sort && sortKey === c.sort;
            const content = (
              <>
                <span className="ob-sparks__hlabel">{c.label}</span>
                {active && (
                  <span className="ob-sparks__hsort">
                    {sortDir === 'asc' ? <IconArrowUp size={11} stroke={1.8} /> : <IconArrowDown size={11} stroke={1.8} />}
                  </span>
                )}
              </>
            );
            const cls = cn('ob-sparks__hcell', c.center && 'ob-sparks__hcell--center', active && 'ob-sparks__hcell--active');
            return c.sort ? (
              <button key={c.key} type="button" className={cn(cls, 'ob-sparks__hcell--sortable')} onClick={() => toggleSort(c.sort)}>
                {content}
              </button>
            ) : (
              <div key={c.key} className={cls}>{content}</div>
            );
          })}
        </div>

        {rows.length ? (
          rows.map((s) => (
            <div
              key={s.id}
              className={cn('ob-sparks__row', onSelect && 'ob-sparks__row--clickable')}
              onClick={onSelect ? () => onSelect(s.id) : undefined}
              role={onSelect ? 'button' : undefined}
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
              <div className="ob-sparks__cell"><span className="ob-sparks__name">{s.name}</span></div>
              <div className="ob-sparks__cell"><TypeBadge type={s.type} /></div>
              <div className="ob-sparks__cell"><span className="ob-sparks__date">{s.date}</span></div>
              <div className="ob-sparks__cell">
                <span className={cn('ob-sparks__dim', !s.dim && 'ob-sparks__dim--empty')}>{s.dim ?? '—'}</span>
              </div>
              <div className="ob-sparks__cell ob-sparks__cell--center">
                {s.ai ? (
                  <span className="ob-sparks__ai ob-sparks__ai--on"><IconCheck size={12} stroke={2.4} /></span>
                ) : (
                  <span className="ob-sparks__ai" />
                )}
              </div>
              <div className="ob-sparks__cell ob-sparks__cell--center">
                <button
                  type="button"
                  className="ob-sparks__del"
                  aria-label="Elimina spark"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(s.id); }}
                >
                  <IconTrash size={14} stroke={1.6} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="ob-sparks__empty">Nessuno spark di questo tipo.</div>
        )}
      </div>
    </div>
  );
}
