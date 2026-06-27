'use client';

/**
 * Gimmick · Obsidian — Overlay primitives.
 *
 * Modal (centered dialog) and Sheet (right-side drawer). Both portal to
 * <body>, close on Escape and backdrop click, and lock body scroll while open.
 * Styling in app/obsidian-primitives.css.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { IconButton } from './controls';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface BaseOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Trailing header content (before the close button). */
  headerExtra?: React.ReactNode;
  className?: string;
  /** Hide the default close button. */
  hideClose?: boolean;
}

/** Shared overlay scaffold: portal + Escape + scroll lock + backdrop. */
function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return mounted;
}

export interface ModalProps extends BaseOverlayProps {
  /** Max width of the dialog in px. */
  maxWidth?: number;
}

export function Modal({ open, onClose, title, children, headerExtra, hideClose, className, maxWidth }: ModalProps) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="ob-overlay ob-overlay--center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn('ob-modal', className)}
        role="dialog"
        aria-modal="true"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {(title || headerExtra || !hideClose) && (
          <div className="ob-modal__header">
            <div className="ob-modal__title">{title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {headerExtra}
              {!hideClose && (
                <IconButton aria-label="Chiudi" size="sm" onClick={onClose}>
                  <CloseIcon />
                </IconButton>
              )}
            </div>
          </div>
        )}
        <div className="ob-modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export type SheetProps = BaseOverlayProps;

export function Sheet({ open, onClose, title, children, headerExtra, hideClose, className }: SheetProps) {
  const mounted = useOverlay(open, onClose);
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="ob-overlay ob-overlay--right"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={cn('ob-sheet', className)} role="dialog" aria-modal="true">
        {(title || headerExtra || !hideClose) && (
          <div className="ob-sheet__header">
            <div className="ob-sheet__title">{title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {headerExtra}
              {!hideClose && (
                <IconButton aria-label="Chiudi" size="sm" onClick={onClose}>
                  <CloseIcon />
                </IconButton>
              )}
            </div>
          </div>
        )}
        <div className="ob-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
