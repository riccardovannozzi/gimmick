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

/**
 * Pila degli overlay aperti, dal più esterno al più interno.
 *
 * Serve da quando le impostazioni sono una modale: dentro ce n'è un'altra (il
 * dettaglio di un beniamino, `mascot-roster-panel.tsx`). Ogni overlay aperto
 * ascolta l'Escape, quindi senza pila un solo tasto chiudeva ENTRAMBI — quello
 * che stavi guardando e la cornice che lo conteneva. Chiude solo chi sta in
 * cima; il click sullo sfondo non ha il problema, perché guarda il bersaglio.
 */
const overlayStack: object[] = [];

/** Shared overlay scaffold: portal + Escape + scroll lock + backdrop. */
function useOverlay(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  /** Identità stabile di QUESTO overlay: la sua posizione nella pila. */
  const id = React.useRef({}).current;
  /* `onClose` passa quasi sempre come arrow inline, cioè cambia a ogni render.
     Se stesse fra le dipendenze dell'effect, ogni render dell'overlay esterno
     lo toglierebbe e rimetterebbe in cima alla pila, scavalcando quello interno
     — l'esatto contrario di quello che la pila serve a garantire. Quindi
     l'effect dipende solo da `open`, e la callback si legge da un ref. */
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!open) return;
    overlayStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (overlayStack[overlayStack.length - 1] !== id) return;
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      const i = overlayStack.indexOf(id);
      if (i !== -1) overlayStack.splice(i, 1);
    };
  }, [open, id]);

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
