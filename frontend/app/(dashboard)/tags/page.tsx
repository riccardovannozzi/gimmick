'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash, IconTag, IconPencil, IconCheck, IconX, IconSettings } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { IconPicker } from '@/components/ui/icon-picker';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { tagsApi, tagTypesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import type { Tag, TagTypeEntity } from '@/types';

// ─── Tag Type Picker (reusable pills) ────────────────────────
function TagTypePills({
  value,
  onChange,
  tagTypes,
  getEmoji,
  getName,
}: {
  value: string;
  onChange: (slug: string) => void;
  tagTypes: TagTypeEntity[];
  getEmoji: (slug: string) => string;
  getName: (slug: string) => string;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tagTypes.map((t) => (
        <button
          key={t.slug}
          type="button"
          onClick={() => onChange(t.slug)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-all',
            value === t.slug
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
          )}
        >
          <span className="inline-flex items-center gap-1"><TagTypeIcon emoji={t.emoji} size={14} /> {t.name}</span>
        </button>
      ))}
    </div>
  );
}

// Helper: render emoji string or Tabler icon component
function TagTypeIcon({ emoji, size = 20 }: { emoji: string; size?: number }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[emoji];
    if (Comp) return <Comp size={size} className="text-zinc-300" />;
  }
  return <span style={{ fontSize: size * 0.8 }}>{emoji}</span>;
}

// ─── Tag Types Management Modal ──────────────────────────────
function TagTypesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { tagTypes } = useTagTypes();
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('IconTag');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; emoji?: string }) => {
      const res = await tagTypesApi.create(data);
      if (!res.success) throw new Error(res.error || 'Errore');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      setNewName('');
      setNewEmoji('IconTag');
      toast.success('Tipo creato');
    },
    onError: (e: Error) => toast.error(e.message || 'Errore nella creazione'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; emoji?: string } }) => {
      const res = await tagTypesApi.update(id, updates);
      if (!res.success) throw new Error(res.error || 'Errore');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      setEditingId(null);
      toast.success('Tipo aggiornato');
    },
    onError: (e: Error) => toast.error(e.message || 'Errore'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await tagTypesApi.delete(id);
      if (!res.success) throw new Error(res.error || 'Errore');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      toast.success('Tipo eliminato');
    },
    onError: (e: Error) => toast.error(e.message || 'Errore'),
  });

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createMutation.mutate({ name, emoji: newEmoji });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <IconSettings className="h-5 w-5 text-zinc-400" />
            Tipi Tag
          </DialogTitle>
        </DialogHeader>

        {/* Create new type */}
        <div className="flex gap-2 items-end">
          <div>
            <Label className="text-zinc-500 text-[11px]">Icona</Label>
            <IconPicker value={newEmoji} onChange={setNewEmoji} />
          </div>
          <div className="flex-1">
            <Label className="text-zinc-500 text-[11px]">Nome</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Nuovo tipo..."
              className="h-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || createMutation.isPending}
            size="icon"
            className="h-9 w-9 bg-blue-600 hover:bg-blue-700 shrink-0"
          >
            <IconPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Types list */}
        <div className="space-y-1 max-h-72 overflow-y-auto mt-2">
          {tagTypes.map((tt) => (
            <div key={tt.id || tt.slug} className="px-3 py-2 rounded-lg bg-zinc-800/50 group">
              {editingId === tt.id ? (
                <div className="flex items-center gap-2">
                  <IconPicker value={editEmoji} onChange={setEditEmoji} />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji } });
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 flex-1 bg-zinc-700 border-zinc-600 text-white text-sm"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-400 hover:text-green-300 shrink-0"
                    onClick={() => updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji } })}
                  >
                    <IconCheck className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-400 hover:text-zinc-300 shrink-0"
                    onClick={() => setEditingId(null)}
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-8 text-center flex items-center justify-center"><TagTypeIcon emoji={tt.emoji} size={18} /></span>
                  <span className="text-sm text-white flex-1">{tt.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditingId(tt.id);
                      setEditName(tt.name);
                      setEditEmoji(tt.emoji);
                    }}
                  >
                    <IconPencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteMutation.mutate(tt.id)}
                  >
                    <IconTrash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tags Page ──────────────────────────────────────────
export default function TagsPage() {
  const queryClient = useQueryClient();
  const { tagTypes, getEmoji, getName } = useTagTypes();
  const [createOpen, setCreateOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagAliases, setNewTagAliases] = useState('');
  const [newTagType, setNewTagType] = useState('topic');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editTagType, setEditTagType] = useState('topic');
  const [filterTagType, setFilterTagType] = useState<string>('all');

  const { data: tagsResult, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const allTags = tagsResult?.data || [];
  const tags = filterTagType === 'all' ? allTags : allTags.filter((t) => (t.tag_type || 'topic') === filterTagType);

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      setNewTagAliases('');
      setNewTagType('topic');
      setCreateOpen(false);
      toast.success('Tag creato');
    },
    onError: () => toast.error('Errore nella creazione del tag'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; aliases?: string[]; tag_type?: string } }) =>
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
    createMutation.mutate({ name, aliases: parseAliases(newTagAliases), tag_type: newTagType });
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditAliases((tag.aliases || []).join(', '));
    setEditTagType(tag.tag_type || 'topic');
  };

  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      updates: { name: editName.trim(), aliases: parseAliases(editAliases), tag_type: editTagType },
    });
  };

  const cancelEdit = () => setEditingId(null);

  // Filter options from dynamic tag types
  const filterOptions = [
    { value: 'all', label: 'Tutti' },
    ...tagTypes.map((t) => ({ value: t.slug, label: `${t.emoji} ${t.name}` })),
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="Tags" />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* Tags info + buttons + filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-zinc-400">
            <IconTag className="h-5 w-5" />
            <span className="text-sm">{allTags.length} tags</span>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
          >
            <IconPlus className="h-3.5 w-3.5 mr-1.5" />
            Aggiungi Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTypesOpen(true)}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-300 text-xs h-8"
          >
            <IconSettings className="h-3.5 w-3.5 mr-1.5" />
            Tipi Tag
          </Button>
          <div className="flex-1" />
          <div className="flex gap-1.5 flex-wrap">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterTagType(opt.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                  filterTagType === opt.value
                    ? 'bg-zinc-800 border-zinc-600 text-white'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-400'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags table */}
        {isLoading ? (
          <p className="text-center text-zinc-400 py-8">Caricamento...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-16">
            <IconTag className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">
              {filterTagType === 'all' ? 'Nessun tag creato' : 'Nessun tag di questo tipo'}
            </p>
            {filterTagType === 'all' && (
              <p className="text-sm text-zinc-500 mt-1">
                Crea il primo tag per organizzare le tue tiles
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col flex-1 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-12">Tipo</TableHead>
                  <TableHead className="text-zinc-400">Nome</TableHead>
                  <TableHead className="text-zinc-400">Alias</TableHead>
                  <TableHead className="text-zinc-400">Data</TableHead>
                  <TableHead className="text-zinc-400 text-right w-24">Azioni</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} className="border-zinc-800">
                      {editingId === tag.id ? (
                        <>
                          <TableCell>
                            {!tag.is_root && (
                              <TagTypePills value={editTagType} onChange={setEditTagType} tagTypes={tagTypes} getEmoji={getEmoji} getName={getName} />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="h-8 bg-zinc-800 border-zinc-700 text-white text-sm"
                              autoFocus
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editAliases}
                              onChange={(e) => setEditAliases(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder="Alias separati da virgola..."
                              className="h-8 bg-zinc-800 border-zinc-700 text-white text-sm placeholder:text-zinc-500"
                            />
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-400 hover:text-green-300" onClick={confirmEdit}>
                                <IconCheck className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-300" onClick={cancelEdit}>
                                <IconX className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center" title={getName(tag.tag_type || 'topic')}>
                            <TagTypeIcon emoji={getEmoji(tag.tag_type || 'topic')} size={16} />
                          </TableCell>
                          <TableCell className="text-white font-medium">{tag.name}</TableCell>
                          <TableCell>
                            {tag.aliases && tag.aliases.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tag.aliases.map((alias) => (
                                  <Badge key={alias} className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0">{alias}</Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-zinc-500 text-sm">&mdash;</span>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">
                            {new Date(tag.created_at).toLocaleDateString('it-IT')}
                          </TableCell>
                          <TableCell className="text-right">
                            {tag.is_root ? (
                              <span className="text-xs text-zinc-500 italic">Root</span>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300" onClick={() => startEdit(tag)}>
                                  <IconPencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => deleteMutation.mutate(tag.id)}>
                                  <IconTrash className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Create Tag Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <IconTag className="h-5 w-5 text-blue-400" />
              Nuovo Tag
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">Nome</Label>
              <Input
                placeholder="Nome del tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">Alias</Label>
              <Input
                placeholder="Alias separati da virgola..."
                value={newTagAliases}
                onChange={(e) => setNewTagAliases(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">Tipo</Label>
              <TagTypePills value={newTagType} onChange={setNewTagType} tagTypes={tagTypes} getEmoji={getEmoji} getName={getName} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="border-zinc-700 text-zinc-300">
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={!newTagName.trim() || createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
              <IconPlus className="h-4 w-4 mr-1.5" />
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Types Management Modal */}
      <TagTypesModal open={typesOpen} onOpenChange={setTypesOpen} />
    </div>
  );
}
