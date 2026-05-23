'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconArrowUp, IconBolt, IconClock, IconCalendar } from '@tabler/icons-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';
import { usePixelTheme } from '@/components/pixel';
import { useActionColorsQuery } from '@/store/action-colors-store';
import { ActionBadge } from '@/components/actions/action-badge';
import { readableOn } from '@/lib/palette';
import type { ActionType } from '@/types';

type ActionDef = { type: ActionType; label: string; icon: typeof IconArrowUp | null };
const ACTION_LABELS: ActionDef[] = [
  { type: 'none',     label: 'Notes',    icon: null },
  { type: 'anytime',  label: 'To Do',    icon: IconArrowUp },
  { type: 'deadline', label: 'Due', icon: IconBolt },
  { type: 'allday',   label: 'All Day',  icon: IconCalendar },
  { type: 'event',    label: 'Timed',    icon: IconClock },
];

interface ActionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionsModal({ open, onOpenChange }: ActionsModalProps) {
  const theme = usePixelTheme();
  const { actionColors, updateActionColor } = useActionColorsQuery();
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);

  const dialogStyle: React.CSSProperties = {
    maxWidth: 440,
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    borderRadius: 0,
    color: theme.ink,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 0,
    gap: 0,
    display: 'block',
  };
  const headerStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: theme.surfaceVariant,
    borderBottom: `2px solid ${theme.border}`,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} style={dialogStyle}>
          <div style={headerStyle}>
            <h2
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: 0,
              }}
            >
              Style of actions
            </h2>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
              Associa un colore a ogni tipo di azione.
            </p>
          </div>
          <div style={{ padding: 14, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ACTION_LABELS.map(({ type, label }) => {
              const color = actionColors[type];
              return (
                <button
                  key={type}
                  onClick={() => setEditingAction(type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    background: theme.surfaceVariant,
                    border: `2px solid ${theme.border}`,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <ActionBadge actionKey={type} size={28} color={color} keepSpace />
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 10,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: theme.ink,
                      flex: 1,
                    }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor sub-dialog */}
      <Dialog open={editingAction !== null} onOpenChange={(o) => !o && setEditingAction(null)}>
        <DialogContent showCloseButton={false} style={dialogStyle}>
          {editingAction && (() => {
            const def = ACTION_LABELS.find((a) => a.type === editingAction)!;
            const color = actionColors[editingAction];
            const ActionIcon = def.icon;
            const isNotes = editingAction === 'none';
            return (
              <>
                <div style={headerStyle}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: theme.ink,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {!isNotes && ActionIcon && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          background: color,
                          border: `2px solid ${theme.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ActionIcon size={12} color={readableOn(color)} />
                      </div>
                    )}
                    {def.label}
                  </h2>
                  <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
                    Colore associato a questa action.
                  </p>
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {isNotes ? (
                    <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, fontStyle: 'italic', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                      Notes non ha un colore personalizzato.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            background: color,
                            border: `2px solid ${theme.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                          }}
                        >
                          {ActionIcon && <ActionIcon size={28} color={readableOn(color)} />}
                        </div>
                      </div>
                      <div>
                        <label
                          style={{
                            fontFamily: 'var(--font-pixel-head)',
                            fontSize: 9,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            color: theme.ink3,
                            display: 'block',
                            marginBottom: 8,
                          }}
                        >
                          Colore
                        </label>
                        <ColorPickerGrid
                          selectedColor={color}
                          onSelect={(hex) => {
                            if (!hex) return;
                            updateActionColor(editingAction, hex);
                            toast.success('Colore aggiornato');
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
