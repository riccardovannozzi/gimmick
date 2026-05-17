'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconChevronRight } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { statusesApi } from '@/lib/api';
import { StatusPreview, SHAPE_LABELS, ALL_SHAPES } from '@/components/statuses/status-preview';
import type { Status, StatusShape } from '@/types';

interface StatusesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal for editing the visual shape of the canonical system statuses.
 * Custom user-created statuses were removed (migration 029); only the
 * seeded `(active, done, paused, blocked, cancelled)` rows are managed
 * here, and only their `shape` is mutable — names are stable.
 */
export function StatusesModal({ open, onOpenChange }: StatusesModalProps) {
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Statuses</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Gestisci gli status visivi dei tile.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                <StatusPreview shape={s.shape} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.name}</span>
                    {s.name === 'done' && (
                      <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">auto</span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">{systemDescriptions[s.name] || ''}</span>
                </div>
                <button
                  onClick={() => setPickerStatus(s)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Edit
                  <IconChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <StatusShapePicker
        status={pickerStatus}
        onClose={() => setPickerStatus(null)}
      />
    </>
  );
}

// ─── Shape picker — only the visual shape is editable for system rows. ───
function StatusShapePicker({ status, onClose }: { status: Status | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [shape, setShape] = useState<StatusShape>('solid');

  // Seed local state when the picker opens for a status.
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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Edit status</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Modifica la forma dello status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] text-zinc-500">Nome</label>
            <p className="text-sm text-zinc-300 mt-0.5">{status?.name}</p>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500">Forma</label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {ALL_SHAPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setShape(s)}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors',
                    shape === s
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  )}
                >
                  <StatusPreview shape={s} size={56} selected={shape === s} />
                  <span className="text-[10px] text-zinc-400">{SHAPE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} className="text-zinc-400">
              Annulla
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!shape || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Salva
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
