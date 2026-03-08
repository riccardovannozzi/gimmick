'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Tag as TagIcon, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tagsApi } from '@/lib/api';
import type { Tag } from '@/types';

const TAG_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#22C55E', '#06B6D4', '#F97316',
];

export default function TagsPage() {
  const queryClient = useQueryClient();
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagAliases, setNewTagAliases] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAliases, setEditAliases] = useState('');

  const { data: tagsResult, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const tags = tagsResult?.data || [];

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setNewTagName('');
      setNewTagAliases('');
      toast.success('Tag creato');
    },
    onError: () => toast.error('Errore nella creazione del tag'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; color?: string; aliases?: string[] } }) =>
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
    createMutation.mutate({ name, color: newTagColor, aliases: parseAliases(newTagAliases) });
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || TAG_COLORS[0]);
    setEditAliases((tag.aliases || []).join(', '));
  };

  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      updates: { name: editName.trim(), color: editColor, aliases: parseAliases(editAliases) },
    });
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="flex flex-col h-full">
      <Header title="Tags" />

      <div className="flex-1 p-6 space-y-6">
        {/* Create new tag */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <h3 className="text-sm font-medium text-zinc-300">Nuovo tag</h3>
          <div className="flex gap-3">
            <Input
              placeholder="Nome del tag..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <Input
              placeholder="Alias (separati da virgola)..."
              value={newTagAliases}
              onChange={(e) => setNewTagAliases(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <Button
              onClick={handleCreate}
              disabled={!newTagName.trim() || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Crea
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">Colore:</span>
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
        </div>

        {/* Tags info */}
        <div className="flex items-center gap-2 text-zinc-400">
          <TagIcon className="h-5 w-5" />
          <span className="text-sm">{tags.length} tags</span>
        </div>

        {/* Tags table */}
        {isLoading ? (
          <p className="text-center text-zinc-400 py-8">Caricamento...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-16">
            <TagIcon className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Nessun tag creato</p>
            <p className="text-sm text-zinc-500 mt-1">
              Crea il primo tag per organizzare le tue tiles
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 w-10">Colore</TableHead>
                  <TableHead className="text-zinc-400">Nome</TableHead>
                  <TableHead className="text-zinc-400">Alias</TableHead>
                  <TableHead className="text-zinc-400">Data</TableHead>
                  <TableHead className="text-zinc-400 text-right w-24">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id} className="border-zinc-800">
                    {editingId === tag.id ? (
                      <>
                        <TableCell>
                          <div className="flex gap-1">
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
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-400 hover:text-green-300"
                              onClick={confirmEdit}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-400 hover:text-zinc-300"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: tag.color || TAG_COLORS[0] }}
                          />
                        </TableCell>
                        <TableCell className="text-white font-medium">{tag.name}</TableCell>
                        <TableCell>
                          {tag.aliases && tag.aliases.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tag.aliases.map((alias) => (
                                <Badge
                                  key={alias}
                                  className="text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0"
                                >
                                  {alias}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {new Date(tag.created_at).toLocaleDateString('it-IT')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                              onClick={() => startEdit(tag)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-zinc-500 hover:text-red-400"
                              onClick={() => deleteMutation.mutate(tag.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
