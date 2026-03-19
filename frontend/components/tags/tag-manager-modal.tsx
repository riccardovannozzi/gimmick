'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tag as TagIcon, Pencil, Check, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { tagsApi } from '@/lib/api';
import type { Tag, TagType } from '@/types';

const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#22C55E', '#06B6D4', '#F97316',
];

const TAG_TYPE_EMOJI: Record<TagType, string> = {
  project: '\u{1F3D7}\uFE0F',
  person: '\u{1F464}',
  context: '\u{1F30D}',
  place: '\u{1F4CD}',
  topic: '\u{1F3F7}\uFE0F',
};

const TAG_TYPE_LABEL: Record<TagType, string> = {
  project: 'Progetto',
  person: 'Persona',
  context: 'Contesto',
  place: 'Luogo',
  topic: 'Tema',
};

const TAG_TYPES: TagType[] = ['project', 'person', 'context', 'place', 'topic'];

interface TagManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManagerModal({ open, onOpenChange }: TagManagerModalProps) {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagAliases, setNewTagAliases] = useState('');
  const [newTagType, setNewTagType] = useState<TagType>('topic');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editTagType, setEditTagType] = useState<TagType>('topic');

  const { data: tagsResult, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    enabled: open,
  });

  const tags = tagsResult?.data || [];

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      setNewTagAliases('');
      setNewTagType('topic');
      toast.success('Tag creato');
    },
    onError: () => toast.error('Errore nella creazione del tag'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; color?: string; aliases?: string[]; tag_type?: TagType } }) =>
      tagsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setEditingId(null);
      toast.success('Tag aggiornato');
    },
    onError: () => toast.error("Errore nell'aggiornamento"),
  });

  const deleteMutation = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag eliminato');
    },
    onError: () => toast.error("Errore nell'eliminazione"),
  });

  const parseAliases = (input: string): string[] =>
    input.split(',').map((s) => s.trim()).filter(Boolean);

  const handleCreate = () => {
    const name = newTagName.trim();
    if (!name) return;
    createMutation.mutate({ name, color: newTagColor, aliases: parseAliases(newTagAliases), tag_type: newTagType });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || TAG_COLORS[0]);
    setEditAliases((tag.aliases || []).join(', '));
    setEditTagType(tag.tag_type || 'topic');
  };

  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      updates: { name: editName.trim(), color: editColor, aliases: parseAliases(editAliases), tag_type: editTagType },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-blue-400" />
            Gestione Tag
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Crea e gestisci i tag per organizzare le tue tiles.
          </DialogDescription>
        </DialogHeader>

        {/* Create new tag */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nome del tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <Button
              onClick={handleCreate}
              disabled={!newTagName.trim() || createMutation.isPending}
              size="icon"
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Input
            placeholder="Alias (separati da virgola)..."
            value={newTagAliases}
            onChange={(e) => setNewTagAliases(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
          />

          {/* Tag type pills */}
          <div className="flex gap-1.5 flex-wrap">
            {TAG_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNewTagType(t)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                  newTagType === t
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                )}
              >
                {TAG_TYPE_EMOJI[t]} {TAG_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Color picker */}
          <div className="flex gap-2">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className="w-6 h-6 rounded-full transition-transform"
                style={{
                  backgroundColor: color,
                  transform: newTagColor === color ? 'scale(1.25)' : 'scale(1)',
                  boxShadow: newTagColor === color ? `0 0 0 2px ${color}40` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Tag list */}
        <div className="space-y-1 max-h-72 overflow-y-auto mt-2">
          {isLoading ? (
            <p className="text-sm text-zinc-500 text-center py-4">Caricamento...</p>
          ) : tags.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-4">Nessun tag creato</p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                className="px-3 py-2 rounded-lg bg-zinc-800/50 group"
              >
                {editingId === tag.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                        className="h-7 bg-zinc-700 border-zinc-600 text-white text-sm"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-400 hover:text-green-300 shrink-0"
                        onClick={confirmEdit}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-zinc-400 hover:text-zinc-300 shrink-0"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={editAliases}
                      onChange={(e) => setEditAliases(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                      placeholder="Alias (separati da virgola)..."
                      className="h-7 bg-zinc-700 border-zinc-600 text-white text-sm placeholder:text-zinc-500"
                    />
                    {/* Tag type pills (hide for root tags) */}
                    {!tag.is_root && (
                      <div className="flex gap-1.5 flex-wrap">
                        {TAG_TYPES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setEditTagType(t)}
                            className={cn(
                              'rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                              editTagType === t
                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                                : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                            )}
                          >
                            {TAG_TYPE_EMOJI[t]} {TAG_TYPE_LABEL[t]}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditColor(color)}
                          className="w-4 h-4 rounded-full"
                          style={{
                            backgroundColor: color,
                            outline: editColor === color ? `2px solid ${color}` : 'none',
                            outlineOffset: '1px',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color || TAG_COLORS[0] }}
                      />
                      <span className="text-xs" title={TAG_TYPE_LABEL[tag.tag_type || 'topic']}>
                        {TAG_TYPE_EMOJI[tag.tag_type || 'topic']}
                      </span>
                      <span className="text-sm text-white flex-1 truncate">{tag.name}</span>
                      {!tag.is_root && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(tag)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteMutation.mutate(tag.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    {tag.aliases && tag.aliases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 ml-5">
                        {tag.aliases.map((alias) => (
                          <Badge
                            key={alias}
                            className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0"
                          >
                            {alias}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
