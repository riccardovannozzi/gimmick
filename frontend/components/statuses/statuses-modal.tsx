'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconX, IconPlus, IconChevronRight } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { statusesApi } from '@/lib/api';
import { StatusPreview, SHAPE_LABELS, ALL_SHAPES } from '@/components/statuses/status-preview';
import type { Status, StatusShape } from '@/types';

interface StatusesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatusesModal({ open, onOpenChange }: StatusesModalProps) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'create' | 'edit'>('create');
  const [pickerStatus, setPickerStatus] = useState<Status | null>(null);

  const { data } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    enabled: open,
  });

  const statuses = data?.data || [];
  const systemStatuses = statuses.filter((s) => s.category === 'system');
  const customStatuses = statuses.filter((s) => s.category === 'custom');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => statusesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
      toast.success('Status eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  const openPicker = (mode: 'create' | 'edit', status?: Status) => {
    setPickerMode(mode);
    setPickerStatus(status || null);
    setPickerOpen(true);
  };

  const handlePickerSave = () => {
    queryClient.invalidateQueries({ queryKey: ['statuses'] });
    setPickerOpen(false);
  };

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

          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {/* System Statuses */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">System Statuses</span>
              <div className="mt-2 space-y-2">
                {systemStatuses.map((s) => (
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
                    <div className="flex items-center gap-10">
                      <button
                        onClick={() => openPicker('edit', s)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Edit
                        <IconChevronRight className="h-3 w-3" />
                      </button>
                      <div className="w-[22px]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-800" />

            {/* Custom Statuses */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Custom Statuses</span>
              <div className="mt-2 space-y-2">
                <button
                  onClick={() => openPicker('create')}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-md border border-dashed border-zinc-600 flex items-center justify-center">
                    <IconPlus className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Add status</span>
                </button>

                {customStatuses.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                    <StatusPreview shape={s.shape} size={40} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{s.name}</span>
                      <div className="text-[11px] text-zinc-500">
                        {SHAPE_LABELS[s.shape]}
                        {s.action_type && <span className="ml-1 text-blue-400">→ {s.action_type}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <button
                        onClick={() => openPicker('edit', s)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Edit
                        <IconChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Eliminare lo status "${s.name}"?`)) {
                            deleteMutation.mutate(s.id);
                          }
                        }}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StatusPickerModal
        open={pickerOpen}
        mode={pickerMode}
        status={pickerStatus}
        onSave={handlePickerSave}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

// ─── Status Picker Modal ───
function StatusPickerModal({
  open,
  mode,
  status,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  status: Status | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [shape, setShape] = useState<StatusShape>('solid');

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && status) {
      setName(status.name);
      setShape(status.shape);
    } else if (isOpen) {
      setName('');
      setShape('solid');
    }
    if (!isOpen) onClose();
  };

  if (open && mode === 'edit' && status && name === '' && shape === 'solid') {
    setName(status.name);
    setShape(status.shape);
  }

  const createMutation = useMutation({
    mutationFn: () => statusesApi.create({ name: name.trim(), shape }),
    onSuccess: () => {
      toast.success('Status creato');
      onSave();
    },
    onError: () => toast.error('Errore creazione'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const updates: { name?: string; shape?: string } = { shape };
      if (status?.category === 'custom') updates.name = name.trim();
      return statusesApi.update(status!.id, updates);
    },
    onSuccess: () => {
      toast.success('Status aggiornato');
      onSave();
    },
    onError: () => toast.error('Errore aggiornamento'),
  });

  const isSystem = status?.category === 'system';
  const canSave = mode === 'create' ? (name.trim() && shape) : !!shape;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' ? 'New status' : 'Edit status'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {mode === 'create' ? 'Crea un nuovo status custom.' : 'Modifica la forma dello status.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isSystem ? (
            <div>
              <label className="text-[11px] text-zinc-500">Nome</label>
              <p className="text-sm text-zinc-300 mt-0.5">{status?.name}</p>
            </div>
          ) : (
            <div>
              <label className="text-[11px] text-zinc-500">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Urgente, In attesa, Bozza…"
                className="bg-zinc-800 border-zinc-700 text-white text-sm mt-0.5"
              />
            </div>
          )}

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
              onClick={() => mode === 'create' ? createMutation.mutate() : updateMutation.mutate()}
              disabled={!canSave}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {mode === 'create' ? 'Crea' : 'Salva'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
