'use client';

/**
 * Gimmick · Obsidian — Desktop Header (unified top bar).
 *
 * Single row: logo · view tabs (data views ← → board views) · Ask Gimmick ·
 * bell · gear · avatar. The view navigation lives here (the separate navbar row
 * was merged in); the search field and the capture-buffer button were removed.
 * Reference: GimmickApp.dc.html (header + navbar, unified).
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/primitives';
import { Icon } from './icons';
import {
  type ViewId, type ViewTab,
  DEFAULT_LEFT_VIEWS, DEFAULT_RIGHT_VIEWS,
} from './ViewTabs';

export interface HeaderProps {
  appName?: string;
  /** Active view tab. */
  activeView?: ViewId;
  onViewChange?: (id: ViewId) => void;
  /** Hover su un tab → prefetch dei dati della vista (navigazione più rapida). */
  onHoverView?: (id: ViewId) => void;
  leftViews?: ViewTab[];
  rightViews?: ViewTab[];
  userInitials?: string;
  onAsk?: () => void;
  onBell?: () => void;
  onSettings?: () => void;
  onAvatar?: () => void;
}

export function Header({
  appName = 'Gimmick',
  activeView,
  onViewChange,
  onHoverView,
  leftViews = DEFAULT_LEFT_VIEWS,
  rightViews = DEFAULT_RIGHT_VIEWS,
  userInitials = 'RI',
  onAsk,
  onBell,
  onSettings,
  onAvatar,
}: HeaderProps) {
  const renderTab = (t: ViewTab) => {
    const isActive = t.id === activeView;
    return (
      <button
        key={t.id}
        type="button"
        className={cn('ob-tab', isActive && 'ob-tab--active')}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onViewChange?.(t.id)}
        onMouseEnter={() => onHoverView?.(t.id)}
        onFocus={() => onHoverView?.(t.id)}
      >
        <span className="ob-tab__icon"><Icon name={t.icon} size={16} /></span>
        {t.label}
      </button>
    );
  };

  return (
    <header className="ob-hd">
      <div className="ob-hd__logo">
        <div className="ob-hd__logo-mark" aria-hidden />
        <span className="ob-hd__logo-name">{appName}</span>
      </div>

      <div className="ob-tabs__group">{leftViews.map(renderTab)}</div>
      <div className="ob-hd__spacer" />
      <div className="ob-tabs__group">{rightViews.map(renderTab)}</div>

      <Button variant="primary" size="sm" icon={<Icon name="sparkles" size={13} />} onClick={onAsk}>
        Ask Gimmick
      </Button>

      <IconButton aria-label="Notifiche" solid onClick={onBell}><Icon name="bell" size={15} /></IconButton>
      <IconButton aria-label="Impostazioni" solid onClick={onSettings}><Icon name="gear" size={15} /></IconButton>

      <button type="button" className="ob-hd__avatar" onClick={onAvatar} aria-label="Profilo">
        {userInitials}
      </button>
    </header>
  );
}
