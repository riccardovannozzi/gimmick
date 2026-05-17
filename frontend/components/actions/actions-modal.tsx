'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconArrowUp, IconBolt, IconClock, IconCalendar } from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';
import { useActionColorsQuery } from '@/store/action-colors-store';
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
  const { actionColors, updateActionColor } = useActionColorsQuery();
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Style of actions</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Associa un colore a ogni tipo di azione.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {ACTION_LABELS.map(({ type, label, icon: ActionIcon }) => {
              const color = actionColors[type];
              const isNotes = type === 'none';
              return (
                <button
                  key={type}
                  onClick={() => setEditingAction(type)}
                  className="flex items-center gap-3 w-full rounded-lg bg-zinc-800/30 hover:bg-zinc-800/60 px-3 py-2 transition-colors text-left"
                >
                  {isNotes || !ActionIcon ? (
                    <div className="w-7 h-7 shrink-0" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      <ActionIcon className="h-4 w-4" color={readableOn(color)} />
                    </div>
                  )}
                  <span className="text-sm font-medium text-zinc-200 flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor sub-dialog */}
      <Dialog open={editingAction !== null} onOpenChange={(o) => !o && setEditingAction(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          {editingAction && (() => {
            const def = ACTION_LABELS.find((a) => a.type === editingAction)!;
            const color = actionColors[editingAction];
            const ActionIcon = def.icon;
            const isNotes = editingAction === 'none';
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    {!isNotes && ActionIcon && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                        <ActionIcon className="h-3.5 w-3.5" color={readableOn(color)} />
                      </div>
                    )}
                    {def.label}
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Colore associato a questa action.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {isNotes ? (
                    <p className="text-xs text-zinc-500 italic text-center py-4">
                      Notes non ha un colore personalizzato.
                    </p>
                  ) : (
                    <>
                      <div className="flex justify-center py-2">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
                          {ActionIcon && <ActionIcon className="h-7 w-7" color={readableOn(color)} />}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 mb-2 block uppercase tracking-wide">Colore</label>
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
