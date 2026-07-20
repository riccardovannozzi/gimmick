'use client';

/**
 * Gimmick · Obsidian — View navigation bar.
 *
 * Two groups: data views (Sparks/Tiles/Tags/Flows) on the left, board/calendar
 * views (Chrono/Canvas/Kanban/Panopticon) on the right. Active tab uses the
 * accent-soft pill. Reference: GimmickApp.dc.html navbar.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon, type ShellIconName } from './icons';

export type ViewId =
  | 'sparks' | 'tiles' | 'tags' | 'flows'
  | 'chrono' | 'canvas' | 'kanban' | 'panopticon';

export interface ViewTab {
  id: ViewId;
  label: string;
  icon: ShellIconName;
}

export const DEFAULT_LEFT_VIEWS: ViewTab[] = [
  { id: 'sparks', label: 'Sparks', icon: 'sparkles' },
  { id: 'tiles', label: 'Tiles', icon: 'tiles' },
  { id: 'tags', label: 'Tags', icon: 'tags' },
  { id: 'flows', label: 'Flows', icon: 'flow' },
];

export const DEFAULT_RIGHT_VIEWS: ViewTab[] = [
  { id: 'chrono', label: 'Chrono', icon: 'chrono' },
  { id: 'canvas', label: 'Canvas', icon: 'canvas' },
  { id: 'kanban', label: 'Kanban', icon: 'kanban' },
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
