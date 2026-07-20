'use client';

/**
 * Gimmick · Obsidian — Desktop AppShell.
 *
 * Composes the shell: Header + ViewTabs on top, then Sidebar · ViewContainer ·
 * Inspector. Each region is overridable; sensible defaults are provided so the
 * shell renders standalone. Reference layout: GimmickApp.dc.html.
 *
 * `mode` sets `data-theme` on the frame, so the whole shell switches light/dark
 * independently of the app's global theme — handy for the preview and for
 * scoped theming during the strangler migration.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ObsidianMode } from '@/lib/theme/obsidian';
import { Header, type HeaderProps } from './Header';
import type { ViewId } from './ViewTabs';

export interface AppShellProps {
  /** Scopes the shell to a theme via `data-theme`. Omit to inherit ancestor. */
  mode?: ObsidianMode;
  /** Window-chrome frame (rounded border + shadow) — for previews. */
  framed?: boolean;
  /** Fill the viewport height. */
  fill?: boolean;
  header?: HeaderProps;
  /** Hide the header (and its view tabs). */
  hideHeader?: boolean;
  activeView: ViewId;
  onViewChange?: (id: ViewId) => void;
  sidebar?: React.ReactNode;
  inspector?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AppShell({
  mode,
  framed,
  fill,
  header,
  hideHeader,
  activeView,
  onViewChange,
  sidebar,
  inspector,
  children,
  className,
  style,
}: AppShellProps) {
  return (
    <div
      data-theme={mode}
      className={cn('ob-shell', framed && 'ob-shell--framed', fill && 'ob-shell--fill', className)}
      style={style}
    >
      {!hideHeader && <Header {...header} activeView={activeView} onViewChange={onViewChange} />}
      <div className="ob-shell__body">
        {sidebar}
        {children}
        {inspector}
      </div>
    </div>
  );
}
