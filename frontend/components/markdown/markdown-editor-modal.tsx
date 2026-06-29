'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
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
  const inShell = isObsidianShellEnabled();
  const [draft, setDraft] = useState(initialValue);

  // Reset draft each time the modal re-opens with a (possibly new) value.
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        showCloseButton={false}
        className={inShell ? '!max-w-[min(90vw,1024px)] !p-0 !gap-0 !border-0' : '!max-w-[min(90vw,1024px)] !p-0 !gap-0 !rounded-none !border-0'}
        style={{
          width: 'min(90vw, 1024px)',
          height: '80vh',
          background: theme.surface,
          border: `${inShell ? 1 : 2}px solid ${theme.border}`,
          borderRadius: inShell ? 16 : 0,
          boxShadow: inShell ? 'var(--ob-shadow-modal, var(--ob-shadow-card))' : undefined,
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
            borderBottom: `${inShell ? 1 : 2}px solid ${theme.border}`,
            background: theme.bg2,
          }}
        >
          <span style={{
            fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-head)',
            fontSize: inShell ? 14 : 11,
            fontWeight: inShell ? 600 : undefined,
            letterSpacing: inShell ? 0 : '0.08em',
            textTransform: inShell ? 'none' : 'uppercase',
            color: theme.ink,
          }}>
            {title}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: inShell ? '6px 12px' : '4px 10px',
                background: theme.surfaceVariant,
                color: inShell ? theme.ink2 : theme.ink,
                border: `${inShell ? 1 : 2}px solid ${theme.border}`,
                borderRadius: inShell ? 9 : 0,
                fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-head)',
                fontSize: inShell ? 13 : 10,
                fontWeight: inShell ? 600 : undefined,
                letterSpacing: inShell ? 0 : '0.08em',
                textTransform: inShell ? 'none' : 'uppercase',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              style={{
                padding: inShell ? '6px 12px' : '4px 10px',
                background: theme.accent,
                color: theme.onAccent,
                border: `${inShell ? 1 : 2}px solid ${inShell ? 'transparent' : theme.border}`,
                borderRadius: inShell ? 9 : 0,
                fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-head)',
                fontSize: inShell ? 13 : 10,
                fontWeight: inShell ? 600 : undefined,
                letterSpacing: inShell ? 0 : '0.08em',
                textTransform: inShell ? 'none' : 'uppercase',
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
