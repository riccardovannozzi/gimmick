'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconChevronRight } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { statusesApi } from '@/lib/api';
import { StatusPreview, SHAPE_LABELS, ALL_SHAPES } from '@/components/statuses/status-preview';
import type { Status, StatusShape } from '@/types';

interface StatusesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatusesModal({ open, onOpenChange }: StatusesModalProps) {
  const theme = usePixelTheme();
  const [pickerStatus, setPickerStatus] = useState<Status | null>(null);

  const { data } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    enabled: open,
  });

  const statuses = data?.data || [];

  const systemDescriptions: Record<string, string> = {
    done: 'Applicato al completamento',
  };

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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} style={dialogStyle}>
          <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
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
              Statuses
            </h2>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
              Gestisci gli status visivi dei tile.
            </p>
          </div>

          <div style={{ padding: 14, maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {statuses.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                }}
              >
                <StatusPreview shape={s.shape} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-pixel-head)',
                        fontSize: 10,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: theme.ink,
                      }}
                    >
                      {s.name}
                    </span>
                    {s.name === 'done' && (
                      <span
                        style={{
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 8,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          background: theme.surface,
                          color: theme.ink3,
                          border: `2px solid ${theme.border}`,
                          padding: '1px 4px',
                        }}
                      >
                        auto
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3 }}>
                    {systemDescriptions[s.name] || ''}
                  </span>
                </div>
                <button
                  onClick={() => setPickerStatus(s)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-pixel-head)',
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.accent,
                    padding: 0,
                  }}
                >
                  Edit
                  <IconChevronRight size={11} />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <StatusShapePicker status={pickerStatus} onClose={() => setPickerStatus(null)} />
    </>
  );
}

function StatusShapePicker({ status, onClose }: { status: Status | null; onClose: () => void }) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const [shape, setShape] = useState<StatusShape>('solid');

  useEffect(() => {
    if (status) setShape(status.shape);
  }, [status]);

  const updateMutation = useMutation({
    mutationFn: () => statusesApi.update(status!.id, { shape }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
      toast.success('Status aggiornato');
      onClose();
    },
    onError: () => toast.error('Errore aggiornamento'),
  });

  const isOpen = status !== null;
  const dialogStyle: React.CSSProperties = {
    maxWidth: 384,
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    borderRadius: 0,
    color: theme.ink,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 0,
    gap: 0,
    display: 'block',
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} style={dialogStyle}>
        <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
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
            Edit status
          </h2>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
            Modifica la forma dello status.
          </p>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink3,
                display: 'block',
                marginBottom: 4,
              }}
            >
              Nome
            </label>
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink, margin: 0 }}>{status?.name}</p>
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
                marginBottom: 6,
              }}
            >
              Forma
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {ALL_SHAPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setShape(s)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: 8,
                    background: shape === s ? theme.surfaceVariant : 'transparent',
                    border: `2px solid ${shape === s ? theme.accent : theme.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <StatusPreview shape={s} size={56} selected={shape === s} />
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 8,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: theme.ink2,
                    }}
                  >
                    {SHAPE_LABELS[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: 12,
            borderTop: `2px solid ${theme.border}`,
            background: theme.surfaceVariant,
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 12px',
              height: 28,
              background: theme.surface,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={!shape || updateMutation.isPending}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 12px',
              height: 28,
              background: theme.accent,
              color: theme.onAccent,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: updateMutation.isPending ? 0.5 : 1,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            Salva
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
