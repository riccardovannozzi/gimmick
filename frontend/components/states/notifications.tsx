'use client';

/**
 * Gimmick · Obsidian — Notification center.
 *
 * Panel with a header (bell + "Notifiche" + "Segna lette") and notification
 * rows (colored icon, title, body, time; unread → accent bullet + tint).
 * Reference: GimmickStates.dc.html (centro notifiche). Styling in
 * app/obsidian-states.css.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconBell } from '@tabler/icons-react';

export interface NotificationItem {
  id: string;
  /** Icon color (a token string, e.g. 'var(--ob-success)'). */
  color: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
}

export interface NotificationCenterProps extends React.HTMLAttributes<HTMLDivElement> {
  items: NotificationItem[];
  onMarkRead?: () => void;
  title?: string;
}

export function NotificationCenter({ items, onMarkRead, title = 'Notifiche', className, ...rest }: NotificationCenterProps) {
  return (
    <div className={cn('ob-notif', className)} {...rest}>
      <div className="ob-notif__head">
        <IconBell size={16} stroke={1.8} style={{ color: 'var(--ob-text)' }} />
        <span className="ob-notif__title">{title}</span>
        <button type="button" className="ob-notif__mark" onClick={onMarkRead}>Segna lette</button>
      </div>
      {items.map((n) => (
        <div key={n.id} className={cn('ob-notif__row', n.unread && 'ob-notif__row--unread')}>
          {n.unread && <span className="ob-notif__bullet" />}
          <span className="ob-notif__icon" style={{ ['--nc' as string]: n.color }}>{n.icon}</span>
          <div style={{ flex: 1 }}>
            <div className="ob-notif__r-title">{n.title}</div>
            <div className="ob-notif__r-body">{n.body}</div>
            <div className="ob-notif__r-time">{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
