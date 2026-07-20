'use client';

/**
 * Gimmick · Obsidian — Right Inspector (Sidebar Destra · dettaglio tile).
 *
 * Shell chrome for the tile detail: a top bar (panel toggle + Edit/List/Flow
 * segmented) and a scrollable body. Body content is passed as children so the
 * Inspector stays reusable; helper subcomponents (Section/Field/TagPill/Caps)
 * recreate the DC tile-editor look. Reference: GimmickInspector.dc.html.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/primitives';
import { Icon, type ShellIconName } from './icons';

export type InspectorMode = 'edit' | 'list' | 'flow';

export interface InspectorProps {
  mode?: InspectorMode;
  onModeChange?: (mode: InspectorMode) => void;
  onTogglePanel?: () => void;
  children?: React.ReactNode;
}

export function Inspector({ mode = 'edit', onModeChange, onTogglePanel, children }: InspectorProps) {
  return (
    <aside className="ob-insp">
      <div className="ob-insp__top">
        <button type="button" className="ob-insp__panel-toggle" aria-label="Comprimi pannello" onClick={onTogglePanel}>
          <Icon name="panel" size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <SegmentedControl
            aria-label="Vista inspector"
            value={mode}
            onChange={(v) => onModeChange?.(v as InspectorMode)}
            items={[
              { value: 'edit', label: <><Icon name="edit" size={13} /> Edit</> },
              { value: 'list', label: <><Icon name="list" size={13} /> List</> },
              { value: 'flow', label: <><Icon name="flow" size={13} /> Flow</> },
            ]}
          />
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
  { type: 'gallery', label: 'Gallery' },
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
