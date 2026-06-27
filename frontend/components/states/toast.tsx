'use client';

/**
 * Gimmick · Obsidian — Toast (dark chip).
 *
 * The canonical toast: a dark chip with a colored icon, title, optional
 * subtitle, and either an action or a close affordance. Tones: success / undo /
 * ai / error. Reference: GimmickStates.dc.html (toasts). Styling in
 * app/obsidian-states.css.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconArrowBackUp, IconSparkles, IconAlertTriangle, IconX } from '@tabler/icons-react';

export type ToastTone = 'success' | 'undo' | 'ai' | 'error' | 'default';

const TONE: Record<ToastTone, { color: string; Icon: typeof IconCheck }> = {
  success: { color: 'var(--ob-success)', Icon: IconCheck },
  undo: { color: 'var(--ob-accent)', Icon: IconArrowBackUp },
  ai: { color: 'var(--ob-accent)', Icon: IconSparkles },
  error: { color: 'var(--ob-error)', Icon: IconAlertTriangle },
  default: { color: 'var(--ob-accent)', Icon: IconCheck },
};

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: ToastTone;
  /** Override the tone's default icon. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Action label (e.g. "Annulla"). When omitted, a close button shows instead. */
  action?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  onClose?: () => void;
}

export function Toast({ tone = 'default', icon, title, sub, action, actionIcon, onAction, onClose, className, ...rest }: ToastProps) {
  const t = TONE[tone];
  return (
    <div className={cn('ob-dtoast', className)} role="status" style={{ ['--tc' as string]: t.color }} {...rest}>
      <span className="ob-dtoast__icon">{icon ?? <t.Icon size={16} stroke={1.8} />}</span>
      <div className="ob-dtoast__body">
        <div className="ob-dtoast__title">{title}</div>
        {sub != null && <div className="ob-dtoast__sub">{sub}</div>}
      </div>
      {action ? (
        <button type="button" className="ob-dtoast__action" onClick={onAction}>
          {actionIcon}
          {action}
        </button>
      ) : (
        <button type="button" className="ob-dtoast__close" aria-label="Chiudi" onClick={onClose}>
          <IconX size={18} stroke={1.8} />
        </button>
      )}
    </div>
  );
}

/** Bottom-right viewport stack for toasts. */
export function ToastViewport({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 60, display: 'flex', flexDirection: 'column', gap: 12 }}
      {...rest}
    >
      {children}
    </div>
  );
}
