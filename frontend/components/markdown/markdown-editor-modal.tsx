'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { MarkdownEditor } from './markdown-editor';

interface MarkdownEditorModalProps {
  open: boolean;
  initialValue: string;
  /** Saving the modal commits the new markdown back to the caller. */
  onSave: (markdown: string) => void;
  /** Discard changes & close. */
  onCancel: () => void;
  title?: string;
}

/**
 * Fullscreen-ish (90vw × 80vh) modal wrapping the MarkdownEditor.
 * Edits live in local state and are only committed when the user presses
 * "Salva" — closing the modal otherwise drops them, so the sidebar preview
 * never reflects a half-baked draft.
 */
export function MarkdownEditorModal({ open, initialValue, onSave, onCancel, title = 'Modifica testo' }: MarkdownEditorModalProps) {
  const theme = usePixelTheme();
  const [draft, setDraft] = useState(initialValue);

  // Reset draft each time the modal re-opens with a (possibly new) value.
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[min(90vw,1024px)] !p-0 !gap-0 !rounded-none !border-0"
        style={{
          width: 'min(90vw, 1024px)',
          height: '80vh',
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: `2px solid ${theme.border}`,
            background: theme.bg2,
          }}
        >
          <span style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink }}>
            {title}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '4px 10px',
                background: theme.surfaceVariant,
                color: theme.ink,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              style={{
                padding: '4px 10px',
                background: theme.accent,
                color: theme.onAccent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Salva
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <MarkdownEditor value={draft} onChange={setDraft} autoFocus className="w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
