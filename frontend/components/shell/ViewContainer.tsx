'use client';

/**
 * Gimmick · Obsidian — View container.
 *
 * The flex-1 middle region between Sidebar and Inspector that hosts the active
 * view (Chrono/Tiles/Canvas/…). Optional thin toolbar with a leading action and
 * trailing meta. Reference: GimmickApp.dc.html chrono toolbar.
 */
import * as React from 'react';

export interface ViewContainerProps {
  /** Leading toolbar content (e.g. a "+ Tile" button). */
  toolbar?: React.ReactNode;
  /** Trailing toolbar meta (e.g. "5 tile · 19 spark"). */
  meta?: React.ReactNode;
  /** Hide the toolbar entirely. */
  hideToolbar?: boolean;
  children?: React.ReactNode;
}

export function ViewContainer({ toolbar, meta, hideToolbar, children }: ViewContainerProps) {
  return (
    <main className="ob-view">
      {!hideToolbar && (
        <div className="ob-view__toolbar">
          {toolbar}
          <div style={{ flex: 1 }} />
          {meta != null && <span className="ob-view__title">{meta}</span>}
        </div>
      )}
      <div className="ob-view__body">{children}</div>
    </main>
  );
}
