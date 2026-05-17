'use client';

import { useState } from 'react';
import { IconPlus, IconTrash, IconChevronRight } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPicker } from '@/components/ui/icon-picker';
import { useTypeIcons, type TypeIcon } from '@/store/type-icons-store';
import { readableOn } from '@/lib/palette';
import { ColorPickerGrid } from '@/components/ui/color-picker-grid';

type IconComp = React.ComponentType<{ size?: number; className?: string; color?: string; style?: React.CSSProperties }>;
const Icons = TablerIcons as unknown as Record<string, IconComp>;

function RenderIcon({ name, size = 20, className, color }: { name: string; size?: number; className?: string; color?: string }) {
  if (!name) return <span className="text-zinc-500 text-xs">?</span>;
  const Comp = Icons[name];
  if (!Comp) return <span className="text-zinc-500 text-xs">?</span>;
  return <Comp size={size} className={className} color={color} />;
}

interface TypeIconsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TypeIconsModal({ open, onOpenChange }: TypeIconsModalProps) {
  const { icons, addIcon, updateIcon, removeIcon } = useTypeIcons();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingIcon, setEditingIcon] = useState<TypeIcon | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  const openEditor = (ti?: TypeIcon) => {
    if (ti) {
      setEditingIcon(ti);
      setName(ti.name);
      setIcon(ti.icon);
      setColor(ti.color || '');
    } else {
      setEditingIcon(null);
      setName('');
      setIcon('');
      setColor('');
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !icon) return;
    if (editingIcon) {
      await updateIcon(editingIcon.id, { name: name.trim(), icon, color: color || undefined });
    } else {
      await addIcon({ name: name.trim(), icon, color: color || undefined });
    }
    setEditorOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Tile Type Icons</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Gestisci le icone di tipo dei tile.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Custom Icons</span>
              <div className="mt-2 space-y-2">
                {/* Add button */}
                <button
                  onClick={() => openEditor()}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center">
                    <IconPlus className="h-4 w-4" />
                  </div>
                  <span className="text-sm">Add type icon</span>
                </button>

                {icons.map((ti) => (
                  <div key={ti.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/50">
                    <div
                      className="w-10 h-10 rounded-lg border border-zinc-700 flex items-center justify-center"
                      style={{ backgroundColor: ti.color || '#27272A' }}
                    >
                      <RenderIcon name={ti.icon} size={22} color={readableOn(ti.color || '#27272A')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white block truncate">{ti.name}</span>
                      <span className="text-[11px] text-zinc-500">{(ti.icon || '').replace(/^Icon/, '')}</span>
                    </div>
                    <div className="flex items-center gap-10">
                      <button
                        onClick={() => openEditor(ti)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                      >
                        Edit
                        <IconChevronRight className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeIcon(ti.id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {icons.length === 0 && (
                  <p className="text-xs text-zinc-500 text-center py-4">Nessuna icona di tipo definita</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor sub-dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingIcon ? 'Modifica icona' : 'Nuova icona di tipo'}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {editingIcon ? 'Modifica nome, icona e colore.' : 'Crea una nuova icona di tipo personalizzata.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview */}
            <div className="flex justify-center">
              <div
                className="w-16 h-16 rounded-xl border border-zinc-700 flex items-center justify-center"
                style={{ backgroundColor: color || '#27272A' }}
              >
                {icon ? <RenderIcon name={icon} size={36} color={readableOn(color || '#27272A')} /> : <span className="text-zinc-500 text-2xl">?</span>}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nome</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. In lavorazione"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            {/* Icon picker */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Icona</label>
              <IconPicker
                value={icon}
                onChange={setIcon}
                trigger={
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 transition-colors cursor-pointer w-full">
                    {icon ? (
                      <>
                        <RenderIcon name={icon} size={18} className="text-white" />
                        <span className="text-xs text-zinc-300">{icon.replace(/^Icon/, '')}</span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">Scegli icona...</span>
                    )}
                  </div>
                }
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Colore sfondo</label>
              <ColorPickerGrid
                selectedColor={color || null}
                onSelect={(hex) => setColor(hex || '')}
                showReset
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditorOpen(false)}
                className="text-zinc-400 border-zinc-700"
              >
                Annulla
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!name.trim() || !icon}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingIcon ? 'Salva' : 'Crea'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
