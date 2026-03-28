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
import { patternsApi } from '@/lib/api';
import { PatternPreview, SHAPE_LABELS, ALL_SHAPES } from '@/components/patterns/pattern-preview';
import type { Pattern, PatternShape } from '@/types';

interface PatternsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatternsModal({ open, onOpenChange }: PatternsModalProps) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'create' | 'edit'>('create');
  const [pickerPattern, setPickerPattern] = useState<Pattern | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => patternsApi.list(),
    enabled: open,
  });

  const patterns = data?.data || [];
  const systemPatterns = patterns.filter((p) => p.category === 'system' && p.name !== 'Call to action');
  const customPatterns = patterns.filter((p) => p.category === 'custom');

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patternsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patterns'] });
      toast.success('Pattern eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  const openPicker = (mode: 'create' | 'edit', pattern?: Pattern) => {
    setPickerMode(mode);
    setPickerPattern(pattern || null);
    setPickerOpen(true);
  };

  const handlePickerSave = () => {
    queryClient.invalidateQueries({ queryKey: ['patterns'] });
    setPickerOpen(false);
  };

  const systemDescriptions: Record<string, string> = {
    Done: 'Applicato al completamento',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Patterns</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Gestisci i pattern visivi dei tile.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            {/* System Patterns */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">System Patterns</span>
              <div className="mt-2 space-y-2">
                {systemPatterns.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                    <PatternPreview shape={p.shape} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{p.name}</span>
                        {p.name === 'Done' && (
                          <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">auto</span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">{systemDescriptions[p.name] || ''}</span>
                    </div>
                    <div className="flex items-center gap-10">
                      <button
                        onClick={() => openPicker('edit', p)}
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

            {/* Custom Patterns */}
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Custom Patterns</span>
              <div className="mt-2 space-y-2">
                {/* Add button */}
                <button
                  onClick={() => openPicker('create')}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-md border border-dashed border-zinc-600 flex items-center justify-center">
                    <IconPlus className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Add pattern</span>
                </button>

                {customPatterns.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                    <PatternPreview shape={p.shape} size={40} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <div className="text-[11px] text-zinc-500">
                        {SHAPE_LABELS[p.shape]}
                        {p.action_type && <span className="ml-1 text-blue-400">→ {p.action_type}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-10">
                      <button
                        onClick={() => openPicker('edit', p)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Edit
                        <IconChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Eliminare il pattern "${p.name}"?`)) {
                            deleteMutation.mutate(p.id);
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

      {/* Pattern Picker Modal */}
      <PatternPickerModal
        open={pickerOpen}
        mode={pickerMode}
        pattern={pickerPattern}
        onSave={handlePickerSave}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}

// ─── Pattern Picker Modal ───
function PatternPickerModal({
  open,
  mode,
  pattern,
  onSave,
  onClose,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  pattern: Pattern | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [shape, setShape] = useState<PatternShape>('solid');

  // Reset form when opening
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && pattern) {
      setName(pattern.name);
      setShape(pattern.shape);
    } else if (isOpen) {
      setName('');
      setShape('solid');
    }
    if (!isOpen) onClose();
  };

  // Initialize on open
  if (open && mode === 'edit' && pattern && name === '' && shape === 'solid') {
    setName(pattern.name);
    setShape(pattern.shape);
  }

  const createMutation = useMutation({
    mutationFn: () => patternsApi.create({ name: name.trim(), shape }),
    onSuccess: () => {
      toast.success('Pattern creato');
      onSave();
    },
    onError: () => toast.error('Errore creazione'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const updates: { name?: string; shape?: string } = { shape };
      if (pattern?.category === 'custom') updates.name = name.trim();
      return patternsApi.update(pattern!.id, updates);
    },
    onSuccess: () => {
      toast.success('Pattern aggiornato');
      onSave();
    },
    onError: () => toast.error('Errore aggiornamento'),
  });

  const isSystem = pattern?.category === 'system';
  const canSave = mode === 'create' ? (name.trim() && shape) : !!shape;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'create' ? 'New pattern' : 'Edit pattern'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {mode === 'create' ? 'Crea un nuovo pattern custom.' : 'Modifica la forma del pattern.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          {isSystem ? (
            <div>
              <label className="text-[11px] text-zinc-500">Nome</label>
              <p className="text-sm text-zinc-300 mt-0.5">{pattern?.name}</p>
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

          {/* Shape grid */}
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
                  <PatternPreview shape={s} size={56} selected={shape === s} />
                  <span className="text-[10px] text-zinc-400">{SHAPE_LABELS[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
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
