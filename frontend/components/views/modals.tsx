'use client';

/**
 * Gimmick · Obsidian — Tag modals (Icon picker + Color picker).
 *
 * "Icona del tag": search + category chips + an 8-col icon grid + live tag
 * preview in the footer. "Colore sfondo": the full Airtable palette (10 families
 * × 4 tints) + a "Nessun colore" option, with a live preview. Reference:
 * GimmickModals.dc.html. The palette hexes are the system's — do NOT change.
 */
import * as React from 'react';
import { IconX, IconCheck } from '@tabler/icons-react';
import { Icon } from '@/components/shell';

// ─── Tag icon glyphs (verbatim 16px paths from the DC) ────────────────────────
const TAG_ICONS: Record<string, string> = {
  home: '<path d="M2.6 7.6 8 3.2l5.4 4.4M4 6.6V13h8V6.6"/>',
  briefcase: '<rect x="2.3" y="5" width="11.4" height="8" rx="1.5"/><path d="M5.5 5V3.9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V5M2.3 8.6h11.4"/>',
  person: '<circle cx="8" cy="5.4" r="2.4"/><path d="M3.6 13.2a4.4 4.4 0 0 1 8.8 0"/>',
  folder: '<path d="M2.3 5.2a1 1 0 0 1 1-1h2.7l1.4 1.6h4.3a1 1 0 0 1 1 1v5.4a1 1 0 0 1-1 1H3.3a1 1 0 0 1-1-1Z"/>',
  globe: '<circle cx="8" cy="8" r="5.5"/><path d="M2.6 8h10.8M8 2.5c1.6 1.7 2.4 3.6 2.4 5.5S9.6 11.8 8 13.5C6.4 11.8 5.6 9.9 5.6 8S6.4 4.2 8 2.5Z"/>',
  building: '<rect x="3.2" y="2.6" width="9.6" height="10.8" rx="1"/><path d="M5.7 5.3h1.3M9 5.3h1.3M5.7 7.9h1.3M9 7.9h1.3M7 13.4v-2.3h2v2.3"/>',
  sun: '<circle cx="8" cy="8" r="2.7"/><path d="M8 1.9v1.5M8 12.6v1.5M14.1 8h-1.5M3.4 8H1.9M12.3 3.7l-1 1M4.7 11.3l-1 1M12.3 12.3l-1-1M4.7 4.7l-1-1"/>',
  wave: '<path d="M1.9 6.2c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0 2.8-1.5 4.2 0M1.9 10c1.4-1.5 2.8-1.5 4.2 0s2.8 1.5 4.2 0 2.8-1.5 4.2 0"/>',
  euro: '<path d="M11.2 4.6a4 4 0 1 0 0 6.8M3.6 6.9h5M3.6 9.2h5"/>',
  calendar: '<rect x="2.4" y="3.4" width="11.2" height="10" rx="1.6"/><path d="M2.4 6.4h11.2M5.4 2.2v2.4M10.6 2.2v2.4"/>',
  clock: '<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.4"/>',
  note: '<path d="M4 2.6h6l2.6 2.6V13a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V3.2A.6.6 0 0 1 4 2.6Z"/><path d="M9.6 2.6v3h3M6 9h4M6 11h4"/>',
  todo: '<rect x="2.6" y="2.6" width="10.8" height="10.8" rx="2"/><path d="M5.4 8.2 7.2 10l3.6-4"/>',
  tag: '<path d="M2.6 7.7V3.3a.7.7 0 0 1 .7-.7h4.4a1 1 0 0 1 .7.3l5 5a1 1 0 0 1 0 1.4l-4.4 4.4a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1-.3-.7Z"/><circle cx="5.5" cy="5.5" r="0.7" fill="currentColor" stroke="none"/>',
  file: '<path d="M11.5 7.5 8 11a2.4 2.4 0 0 1-3.4-3.4l4-4a1.6 1.6 0 0 1 2.3 2.3l-4 4a.8.8 0 0 1-1.2-1.2L9 5.6"/>',
  photo: '<rect x="2.2" y="4" width="11.6" height="9" rx="1.8"/><circle cx="8" cy="8.4" r="2.4"/><path d="M5.6 4l.9-1.4h3l.9 1.4"/>',
  voice: '<rect x="6" y="2.2" width="4" height="7.2" rx="2"/><path d="M3.8 8a4.2 4.2 0 0 0 8.4 0M8 12.2v1.6"/>',
  doc: '<path d="M4 2.6h5.4L12.6 5.8V13a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V3.2A.6.6 0 0 1 4 2.6Z"/><path d="M9.2 2.6v3.2h3.2"/>',
  video: '<rect x="2.2" y="4.2" width="8.4" height="7.6" rx="1.6"/><path d="M10.6 6.6 13.8 5v6l-3.2-1.6z"/>',
  star: '<path d="M8 2.2 9.6 6l4.1.3-3.1 2.6 1 4-3.6-2.2-3.6 2.2 1-4L2.3 6.3 6.4 6Z"/>',
  heart: '<path d="M8 13.3 2.9 8.4a2.9 2.9 0 0 1 4.1-4.1l1 1 1-1a2.9 2.9 0 0 1 4.1 4.1z"/>',
  flag: '<path d="M3.5 13.5V2.8M3.5 3.2h8l-1.5 2.6 1.5 2.6H3.5"/>',
  bell: '<path d="M5 7a3 3 0 0 1 6 0c0 3 1.2 3.8 1.2 3.8H3.8S5 10 5 7ZM6.6 12.6a1.5 1.5 0 0 0 2.8 0"/>',
  bookmark: '<path d="M4 2.8h8v10.4l-4-2.6-4 2.6z"/>',
  pin: '<path d="M8 13.8s4.2-3.6 4.2-6.6a4.2 4.2 0 0 0-8.4 0c0 3 4.2 6.6 4.2 6.6Z"/><circle cx="8" cy="7.2" r="1.6"/>',
  car: '<path d="M2.6 9.4 4 5.6a1.4 1.4 0 0 1 1.3-.9h5.4a1.4 1.4 0 0 1 1.3.9l1.4 3.8M2.6 9.4h10.8v2.4H2.6Z"/><circle cx="5" cy="11.8" r="0.9"/><circle cx="11" cy="11.8" r="0.9"/>',
  plane: '<path d="M8 2.4c.7 0 1 1 1 2.2v1.6l4.4 2.6v1.4L9 9v2.4l1.4 1v1.2L8 13l-2.4.6v-1.2l1.4-1V9l-4.4 1.4V8.8L7 6.2V4.6C7 3.4 7.3 2.4 8 2.4Z"/>',
  cart: '<path d="M2.4 3h1.6l1.4 7h6l1.4-5H4.6M6 13a.8.8 0 1 0 0-.1M11 13a.8.8 0 1 0 0-.1"/>',
  key: '<circle cx="5.4" cy="5.4" r="2.8"/><path d="M7.4 7.4 13 13M11 11l1.4-1.4M9.4 9.4l1.4-1.4"/>',
  bulb: '<path d="M5.4 9.6a3.4 3.4 0 1 1 5.2 0c-.7.8-1 1.3-1.1 2.1H6.5c-.1-.8-.4-1.3-1.1-2.1ZM6.6 13.4h2.8"/>',
  coffee: '<path d="M3.4 5.5h8v3a3 3 0 0 1-3 3H6.4a3 3 0 0 1-3-3zM11.4 6.5h1.2a1.4 1.4 0 0 1 0 2.8h-1.2M5.5 2.6v1.4M8 2.6v1.4"/>',
  wrench: '<path d="M11.4 2.8a2.8 2.8 0 0 0-3.3 3.6L3 11.5l1.5 1.5 5.1-5.1a2.8 2.8 0 0 0 3.6-3.3L11.4 6 10 4.6Z"/>',
  leaf: '<path d="M3 13s-.6-5 2.4-7.6S13 3.4 13 3.4s.4 5.4-2.6 7.6S3 13 3 13ZM3 13l5-5"/>',
  flask: '<path d="M6.4 2.6v3.2L3.4 11a1.2 1.2 0 0 0 1 1.9h7.2a1.2 1.2 0 0 0 1-1.9L9.6 5.8V2.6M5.6 2.6h4.8M5.4 9h5.2"/>',
  book: '<path d="M3 3.4a1 1 0 0 1 1-1h3.5v10H4a1 1 0 0 0-1 1zM13 3.4a1 1 0 0 0-1-1H8.5v10H12a1 1 0 0 1 1 1z"/>',
  phone: '<path d="M3 3.4c-.4.4-.6 1-.5 1.6.5 3.2 3.3 6 6.5 6.5.6.1 1.2-.1 1.6-.5l.9-.9a.8.8 0 0 0-.1-1.2L9.6 7.3a.8.8 0 0 0-.9 0l-.6.4a7 7 0 0 1-2.5-2.5l.4-.6a.8.8 0 0 0 0-.9L4.4 2.9a.8.8 0 0 0-1.2-.1z"/>',
  music: '<path d="M6 12V4l7-1.4v8M6 12a1.6 1.6 0 1 1-1.6-1.6M13 10.6a1.6 1.6 0 1 1-1.6-1.6"/>',
  camera: '<rect x="2.2" y="4.6" width="11.6" height="8.2" rx="1.6"/><circle cx="8" cy="8.7" r="2.4"/><path d="M5.6 4.6 6.4 3h3.2l.8 1.6"/>',
};

const ICON_GRID = [
  'home', 'briefcase', 'person', 'folder', 'globe', 'building', 'sun', 'wave', 'euro', 'calendar',
  'clock', 'note', 'todo', 'tag', 'file', 'photo', 'voice', 'doc', 'video', 'star',
  'heart', 'flag', 'bell', 'bookmark', 'pin', 'car', 'plane', 'cart', 'key', 'bulb',
  'coffee', 'wrench', 'leaf', 'flask', 'book', 'phone', 'music', 'camera',
];

function TagGlyph({ name, size = 17 }: { name: string; size?: number }) {
  const inner = TAG_ICONS[name] ?? '';
  const svg = `<svg viewBox="0 0 16 16" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return <span style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

// ─── Airtable palette — exact system hexes, DO NOT modify ──────────────────────
const PALETTE: Array<{ name: string; t: [string, string, string, string] }> = [
  { name: 'Grigio', t: ['#eeeeee', '#cccccc', '#666666', '#444444'] },
  { name: 'Blu', t: ['#cfdfff', '#9cc7ff', '#2d7ff9', '#2750ae'] },
  { name: 'Ciano', t: ['#d0f0fd', '#77d1f3', '#18bfff', '#0b76b7'] },
  { name: 'Acqua', t: ['#c2f5e9', '#72ddc3', '#20d9d2', '#06a09b'] },
  { name: 'Verde', t: ['#d1f7c4', '#93e088', '#20c933', '#338a17'] },
  { name: 'Giallo', t: ['#ffeab6', '#ffd66e', '#fcb400', '#b87503'] },
  { name: 'Arancio', t: ['#fee2d5', '#ffa981', '#ff6f2c', '#d74d26'] },
  { name: 'Rosso', t: ['#ffdce5', '#ff9eb7', '#f82b60', '#ba1e45'] },
  { name: 'Magenta', t: ['#ffdaf6', '#f99de2', '#ff08c2', '#b2158b'] },
  { name: 'Viola', t: ['#ede2fe', '#cdb0ff', '#8b46ff', '#6b1cb0'] },
];

function readable(hex: string): string {
  const x = hex.replace('#', '');
  const r = parseInt(x.slice(0, 2), 16), g = parseInt(x.slice(2, 4), 16), b = parseInt(x.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#1b1923' : '#ffffff';
}

// ─── Shared chrome ────────────────────────────────────────────────────────────
function ModalCard({ width, title, children, footer }: { width: number; title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="ob-mcard" style={{ width }}>
      <div className="ob-mcard__header">
        <span className="ob-mcard__title">{title}</span>
        <button type="button" className="ob-mcard__close" aria-label="Chiudi"><IconX size={13} stroke={1.6} /></button>
      </div>
      {children}
      <div className="ob-mcard__footer">{footer}</div>
    </div>
  );
}

function Actions() {
  return (
    <>
      <div style={{ flex: 1 }} />
      <button type="button" className="ob-mcard__cancel">Annulla</button>
      <button type="button" className="ob-mcard__save">Salva</button>
    </>
  );
}

// ─── Icon modal ───────────────────────────────────────────────────────────────
const CATEGORIES = ['Tutte', 'Lavoro', 'Casa', 'Viaggio', 'Natura'];

export function IconPickerModal() {
  const [selected, setSelected] = React.useState('sun');
  const [cat, setCat] = React.useState('Tutte');

  return (
    <ModalCard
      width={372}
      title="Icona del tag"
      footer={
        <>
          <div className="ob-mcard__preview ob-mcard__preview--tint" style={{ ['--pv-c' as string]: 'var(--ob-accent)' }}>
            <span className="ob-mcard__preview-icon" style={{ color: 'var(--ob-accent)' }}><TagGlyph name={selected} size={14} /></span>
            <span className="ob-mcard__preview-name" style={{ color: 'var(--ob-text)' }}>Golfo del Sole</span>
          </div>
          <Actions />
        </>
      }
    >
      <div className="ob-mico__search">
        <span className="ob-mico__search-icon"><Icon name="search" size={14} /></span>
        Cerca icona…
      </div>
      <div className="ob-mico__chips">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={`ob-mico__chip${cat === c ? ' ob-mico__chip--active' : ''}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="ob-mico__grid">
        {ICON_GRID.map((ic) => (
          <button key={ic} type="button" className={`ob-mico__cell${ic === selected ? ' ob-mico__cell--on' : ''}`} onClick={() => setSelected(ic)} aria-label={ic}>
            <TagGlyph name={ic} size={17} />
          </button>
        ))}
      </div>
    </ModalCard>
  );
}

// ─── Color modal ──────────────────────────────────────────────────────────────
export function ColorPickerModal() {
  const [selected, setSelected] = React.useState('#2d7ff9');

  return (
    <ModalCard
      width={392}
      title="Colore sfondo"
      footer={
        <>
          <div className="ob-mcard__preview" style={{ background: selected }}>
            <span className="ob-mcard__preview-icon" style={{ color: readable(selected) }}><TagGlyph name="sun" size={14} /></span>
            <span className="ob-mcard__preview-name" style={{ color: readable(selected) }}>Golfo del Sole</span>
          </div>
          <Actions />
        </>
      }
    >
      <div className="ob-mcol__intro">
        <span className="ob-mcol__intro-label">PALETTE</span>
        <span className="ob-mcol__intro-hex">{selected.toUpperCase()}</span>
      </div>
      <div className="ob-mcol__grid">
        {[0, 1, 2, 3].map((row) =>
          PALETTE.map((fam, col) => {
            const hex = fam.t[row];
            const on = hex === selected;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                title={hex}
                aria-label={`${fam.name} ${hex}`}
                onClick={() => setSelected(hex)}
                className={`ob-mcol__sw${on ? ' ob-mcol__sw--on' : ''}`}
                style={{ background: hex }}
              >
                {on && <span style={{ color: readable(hex), display: 'inline-flex' }}><IconCheck size={13} stroke={2.2} /></span>}
              </button>
            );
          }),
        )}
      </div>
      <button type="button" className="ob-mcol__none" onClick={() => setSelected('')}>
        <span className="ob-mcol__none-sw" />
        <span className="ob-mcol__none-label">Nessun colore</span>
      </button>
    </ModalCard>
  );
}
