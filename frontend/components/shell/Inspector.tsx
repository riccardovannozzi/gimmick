'use client';

/**
 * Gimmick · Obsidian — Right Inspector (Sidebar Destra · dettaglio tile).
 *
 * Shell chrome for the tile detail: a top bar (panel toggle + Edit/List
 * segmented) and a scrollable body. Body content is passed as children so the
 * Inspector stays reusable; helper subcomponents (Section/Field/TagPill/Caps)
 * recreate the DC tile-editor look. Reference: GimmickInspector.dc.html.
 *
 * Le tab sono DUE. C'era anche "Flow", ed è stata tolta insieme al modello che
 * la alimentava: i passi di un flow sono voci della List, quindi un terzo tab
 * avrebbe mostrato la stessa cosa da un'altra porta. Questo componente è la
 * controparte di `TileSidebar` senza un tile selezionato: le due barre devono
 * combaciare, quindi se qui tornano tre tab, tornano anche là.
 */
import * as React from 'react';
import { IconLayoutSidebarRightCollapse, IconEdit, IconList } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Icon, type ShellIconName } from './icons';

export type InspectorMode = 'edit' | 'list';

export interface InspectorProps {
  mode?: InspectorMode;
  onModeChange?: (mode: InspectorMode) => void;
  onTogglePanel?: () => void;
  children?: React.ReactNode;
}

export function Inspector({ mode = 'edit', onModeChange, onTogglePanel, children }: InspectorProps) {
  return (
    <aside className="ob-insp">
      {/* Barra di testa IDENTICA a quella di `TileSidebar`: è la stessa sidebar
          destra, vista senza un tile selezionato. Prima qui c'era il primitivo
          `SegmentedControl`, che porta con sé un track a pillola con fondo e
          bordo; `.ob-insp-tab` invece è a tutta larghezza, senza track, e la
          sola cosa visibile è la pill del tab attivo. Anche i glifi sono gli
          stessi: il vocabolario `Icon` dello shell mappa altri tre disegni
          (matita semplice, affiliate) e le due barre non combaciavano. */}
      <div className="ob-insp__top">
        <button type="button" className="ob-insp__panel-toggle" aria-label="Comprimi pannello" title="Collassa sidebar" onClick={onTogglePanel}>
          <IconLayoutSidebarRightCollapse size={14} />
        </button>
        <div className="ob-insp-tabs">
          <button type="button" className={cn('ob-insp-tab', mode === 'edit' && 'ob-insp-tab--active')} onClick={() => onModeChange?.('edit')}><IconEdit size={14} />Edit</button>
          <button type="button" className={cn('ob-insp-tab', mode === 'list' && 'ob-insp-tab--active')} onClick={() => onModeChange?.('list')}><IconList size={14} />List</button>
        </div>
      </div>
      <div className="ob-insp__body ob-scroll">{children}</div>
    </aside>
  );
}

// ─── Inspector building blocks ────────────────────────────────────────────────
export function InspectorSection({
  eyebrow,
  children,
  style,
}: {
  eyebrow: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="ob-insp__section" style={style}>
      <div className="ob-insp__eyebrow">{eyebrow}</div>
      {children}
    </div>
  );
}

export function InspectorField({
  value,
  icon,
  iconColor,
  chevron,
  muted,
}: {
  value: React.ReactNode;
  icon?: ShellIconName;
  iconColor?: string;
  chevron?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="ob-insp-field">
      {icon && (
        <span className="ob-insp-field__icon" style={iconColor ? { color: iconColor } : undefined}>
          <Icon name={icon} size={15} />
        </span>
      )}
      <span className={cn('ob-insp-field__value', muted && 'ob-insp-field__value--muted')}>{value}</span>
      {chevron && <span className="ob-insp-field__chev"><Icon name="chevD" size={13} /></span>}
    </div>
  );
}

export function InspectorTagPill({ children, icon = 'tags' }: { children: React.ReactNode; icon?: ShellIconName }) {
  return (
    <div className="ob-insp-tag">
      <Icon name={icon} size={15} />
      {children}
    </div>
  );
}

export function InspectorDivider() {
  return <div className="ob-insp__divider" />;
}

export interface InspectorCap {
  type: 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
  label: string;
}

const DEFAULT_CAPS: InspectorCap[] = [
  { type: 'photo', label: 'Photo' },
  { type: 'video', label: 'Video' },
  { type: 'gallery', label: 'Image' },
  { type: 'text', label: 'Text' },
  { type: 'voice', label: 'Voice' },
  { type: 'file', label: 'File' },
];

export function InspectorCaps({ caps = DEFAULT_CAPS }: { caps?: InspectorCap[] }) {
  return (
    <div className="ob-insp-caps">
      {caps.map((c) => (
        <div key={c.type} className="ob-insp-cap">
          <span style={{ color: `var(--ob-type-${c.type})`, display: 'inline-flex' }}>
            <Icon name={c.type} size={16} />
          </span>
          <span className="ob-insp-cap__label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}
