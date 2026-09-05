'use client';

/**
 * Gimmick · Obsidian — View navigation bar.
 *
 * Two groups: data views (Sparks/Tiles/Tags) on the left, board/calendar
 * views (Chrono/Canvas/Kanban/Panopticon) on the right. Active tab uses the
 * accent-soft pill. Reference: GimmickApp.dc.html navbar.
 *
 * C'era anche "Flows", una board a quattro corsie sui nodi di un modello a sé.
 * È uscita di scena col modello: un flow è un tile con `action_type = 'flow'`,
 * quindi si guarda dove si guardano i tile — la colonna FLOW di Chrono, il
 * Kanban, il Canvas — senza una vista che sappia solo di lui.
 *
 * Al suo posto c'è il COCKPIT, e la differenza non è nel nome: quella board
 * elencava i BEAT raggruppati per stato del beat, questa elenca i FLOW
 * raggruppati per l'unica domanda che si ha in testa aprendola — di chi è la
 * palla. Ha potuto esistere solo da quando quel dato ha un comando che lo
 * scrive (`is_theirs` + il contatto sul passo, migration 049).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon, type ShellIconName } from './icons';

export type ViewId =
  | 'sparks' | 'tiles' | 'tags'
  | 'chrono' | 'canvas' | 'kanban' | 'cockpit' | 'panopticon';

export interface ViewTab {
  id: ViewId;
  label: string;
  icon: ShellIconName;
}

export const DEFAULT_LEFT_VIEWS: ViewTab[] = [
  { id: 'sparks', label: 'Sparks', icon: 'sparkles' },
  { id: 'tiles', label: 'Tiles', icon: 'tiles' },
  { id: 'tags', label: 'Tags', icon: 'tags' },
];

export const DEFAULT_RIGHT_VIEWS: ViewTab[] = [
  { id: 'chrono', label: 'Chrono', icon: 'chrono' },
  { id: 'canvas', label: 'Canvas', icon: 'canvas' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban' },
  { id: 'cockpit', label: 'Cockpit', icon: 'cockpit' },
  { id: 'panopticon', label: 'Panopticon', icon: 'panopticon' },
];

export interface ViewTabsProps {
  active: ViewId;
  onChange?: (id: ViewId) => void;
  leftViews?: ViewTab[];
  rightViews?: ViewTab[];
}

export function ViewTabs({
  active,
  onChange,
  leftViews = DEFAULT_LEFT_VIEWS,
  rightViews = DEFAULT_RIGHT_VIEWS,
}: ViewTabsProps) {
  const renderTab = (t: ViewTab) => {
    const isActive = t.id === active;
    return (
      <button
        key={t.id}
        type="button"
        className={cn('ob-tab', isActive && 'ob-tab--active')}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onChange?.(t.id)}
      >
        <span className="ob-tab__icon"><Icon name={t.icon} size={16} /></span>
        {t.label}
      </button>
    );
  };

  return (
    <nav className="ob-tabs">
      <div className="ob-tabs__group">{leftViews.map(renderTab)}</div>
      <div className="ob-tabs__spacer" />
      <div className="ob-tabs__group">{rightViews.map(renderTab)}</div>
    </nav>
  );
}
