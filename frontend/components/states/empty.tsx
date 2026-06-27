'use client';

/**
 * Gimmick · Obsidian — EmptyState / ErrorState.
 *
 * Centered icon + title + description + actions. `tone="error"` switches the
 * icon box to the error color (used for offline/error). Reference:
 * GimmickStates.dc.html (empty + offline). Styling in app/obsidian-states.css.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description?: string;
  tone?: 'default' | 'error';
  /** Action buttons (e.g. <Button>…). */
  actions?: React.ReactNode;
}

export function EmptyState({ icon, title, description, tone = 'default', actions, className, ...rest }: EmptyStateProps) {
  return (
    <div className={cn('ob-empty', className)} {...rest}>
      <div className={cn('ob-empty__icon', tone === 'error' && 'ob-empty__icon--error')}>{icon}</div>
      <div className="ob-empty__title">{title}</div>
      {description && <div className="ob-empty__desc">{description}</div>}
      {actions && <div className="ob-empty__actions">{actions}</div>}
    </div>
  );
}
