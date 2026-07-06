'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { IconX } from '@tabler/icons-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { MarkdownEditor } from './markdown-editor';

interface MarkdownEditorModalProps {
  open: boolean;
  initialValue: string;
  /** Commits the markdown back to the caller (persistenza). In modalità
   *  `autoSave` viene chiamata di continuo mentre l'utente scrive. */
  onSave: (markdown: string) => void;
  /** Discard changes & close (in autoSave: solo chiude, già salvato). */
  onCancel: () => void;
  title?: string;
  /** Salvataggio in tempo reale: ogni modifica persiste (debounce) senza il
   *  pulsante "Salva"; l'header mostra solo il bottone di chiusura. */
  autoSave?: boolean;
  /** Commit singolo alla chiusura: come autoSave mostra solo la X, ma NON
   *  persiste a ogni battitura — chiama `onSave(draft)` una sola volta quando
   *  la modale si chiude. Adatto ai flussi di *creazione* (es. "Nuovo testo"),
   *  dove un autosave per-battitura creerebbe spark duplicati. */
  commitOnClose?: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 400;

/**
 * Fullscreen-ish (90vw × 80vh) modal wrapping the MarkdownEditor.
 *
 * Due modalità:
 *  - Manuale (default): le modifiche vivono in stato locale e si committano solo
 *    con "Salva"; chiudere altrimenti le scarta.
 *  - `autoSave`: ogni battitura persiste in tempo reale (debounce ~400ms) e la
 *    pendenza viene "flushata" alla chiusura, così nulla va perso. In questa
 *    modalità Salva/Annulla lasciano il posto a un solo bottone di chiusura.
 */
export function MarkdownEditorModal({ open, initialValue, onSave, onCancel, title = 'Modifica testo', autoSave = false, commitOnClose = false }: MarkdownEditorModalProps) {
  const theme = usePixelTheme();
  const [draft, setDraft] = useState(initialValue);

  // Header senza "Salva" sia in autoSave (live) sia in commitOnClose (create).
  const closeOnly = autoSave || commitOnClose;

  // Ref sempre aggiornate per flush sicuri (chiusura/unmount) senza closure stale.
  const draftRef = useRef(initialValue);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita il doppio commit in commitOnClose: la chiusura di successo può
  // rifar scattare onOpenChange(false) → handleClose una seconda volta.
  const committedRef = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Reset draft each time the modal re-opens with a (possibly new) value.
  useEffect(() => {
    if (open) { setDraft(initialValue); draftRef.current = initialValue; dirtyRef.current = false; committedRef.current = false; }
  }, [open, initialValue]);

  // Persiste subito l'ultima modifica pendente (se presente).
  const flush = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (dirtyRef.current) { dirtyRef.current = false; onSaveRef.current(draftRef.current); }
  }, []);

  // Ogni modifica dell'editor: aggiorna la bozza e, in autoSave, programma il
  // salvataggio con debounce.
  const handleChange = useCallback((md: string) => {
    setDraft(md);
    draftRef.current = md;
    // Una nuova modifica riabilita il commit (es. retry dopo un errore di rete).
    committedRef.current = false;
    if (!autoSave) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      dirtyRef.current = false;
      onSaveRef.current(draftRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [autoSave]);

  // Chiusura (X, Esc, overlay):
  //  - autoSave: salva l'ultima pendenza, poi chiude;
  //  - commitOnClose: committa una sola volta (onSave gestisce anche il close);
  //  - manuale: scarta e chiude.
  const handleClose = useCallback(() => {
    if (autoSave) { flush(); onCancel(); return; }
    if (commitOnClose) {
      if (committedRef.current) return;
      committedRef.current = true;
      onSaveRef.current(draftRef.current);
      return;
    }
    onCancel();
  }, [autoSave, commitOnClose, flush, onCancel]);

  // Rete di sicurezza: se il componente viene smontato con un salvataggio
  // pendente, committalo prima di sparire.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (dirtyRef.current) { dirtyRef.current = false; onSaveRef.current(draftRef.current); }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className={'!max-w-[min(90vw,1024px)] !p-0 !gap-0 !border-0'}
        style={{
          width: 'min(90vw, 1024px)',
          height: '80vh',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          boxShadow: 'var(--ob-shadow-modal, var(--ob-shadow-card))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Accessibility: Radix requires a DialogTitle and recommends a
            DialogDescription. The visible custom header below carries the
            same label, so hide these via sr-only. */}
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">Editor di testo formattato</DialogDescription>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.bg2,
          }}
        >
          <span style={{
            fontFamily: 'var(--ob-font-sans)',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0,
            textTransform: 'none',
            color: theme.ink,
          }}>
            {title}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {closeOnly ? (
              // Salvataggio in tempo reale o alla chiusura → nessun "Salva": solo X.
              <button
                type="button"
                onClick={handleClose}
                aria-label="Chiudi"
                title="Chiudi"
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.surfaceVariant,
                  color: theme.ink2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 9,
                  cursor: 'pointer',
                }}
              >
                <IconX size={16} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    padding: '6px 12px',
                    background: theme.surfaceVariant,
                    color: theme.ink2,
                    border: `1px solid ${theme.border}`,
                    borderRadius: 9,
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0,
                    textTransform: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => onSave(draft)}
                  style={{
                    padding: '6px 12px',
                    background: theme.accent,
                    color: theme.onAccent,
                    border: `1px solid transparent`,
                    borderRadius: 9,
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0,
                    textTransform: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Salva
                </button>
              </>
            )}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <MarkdownEditor value={draft} onChange={handleChange} autoFocus className="w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
