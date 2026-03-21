'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCircle, IconBolt, IconClock, IconCalendar, IconSparkles, IconDeviceFloppy } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { tilesApi, tagsApi } from '@/lib/api';
import type { Tile, ActionType, Tag } from '@/types';

const ACTION_TYPE_CONFIG: {
  value: ActionType;
  label: string;
  icon: typeof IconCircle;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  { value: 'none', label: 'Appunto', icon: IconCircle, color: 'text-zinc-400', bgColor: 'bg-zinc-800', borderColor: 'border-zinc-600' },
  { value: 'anytime', label: 'Da fare', icon: IconBolt, color: 'text-green-400', bgColor: 'bg-green-500/15', borderColor: 'border-green-500/40' },
  { value: 'deadline', label: 'Scadenza', icon: IconClock, color: 'text-amber-400', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500/40' },
  { value: 'event', label: 'Evento', icon: IconCalendar, color: 'text-blue-400', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500/40' },
];

interface TileDetailModalProps {
  tile: Tile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TileDetailModal({ tile, open, onOpenChange }: TileDetailModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionType, setActionType] = useState<ActionType>('none');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });
  const allTags: Tag[] = tagsResult?.data || [];

  // Sync form when tile changes
  useEffect(() => {
    if (tile) {
      setTitle(tile.title || '');
      setDescription(tile.description || '');
      setActionType(tile.action_type || 'none');
      setStartAt(tile.start_at ? toLocalDatetime(tile.start_at) : '');
      setEndAt(tile.end_at ? toLocalDatetime(tile.end_at) : '');
      setSelectedTagIds(new Set(tile.tags?.map((t) => t.id) || []));
    }
  }, [tile]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!tile) return;
      const updates: Record<string, unknown> = {
        title: title || undefined,
        description: description || undefined,
        action_type: actionType,
      };
      if (actionType === 'event' || actionType === 'deadline') {
        if (startAt) updates.start_at = new Date(startAt).toISOString();
        if (endAt) updates.end_at = new Date(endAt).toISOString();
      }
      const result = await tilesApi.update(tile.id, updates as Parameters<typeof tilesApi.update>[1]);
      if (!result.success) throw new Error(result.error);

      // Sync tags — add new, remove old
      const currentTagIds = new Set(tile.tags?.map((t) => t.id) || []);
      const toAdd = [...selectedTagIds].filter((id) => !currentTagIds.has(id));
      const toRemove = [...currentTagIds].filter((id) => !selectedTagIds.has(id));

      await Promise.all([
        ...toAdd.map((tagId) => tagsApi.tagTiles(tagId, [tile.id])),
        ...toRemove.map((tagId) => tagsApi.untagTile(tagId, tile.id)),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      toast.success('Tile aggiornato');
      onOpenChange(false);
    },
    onError: () => toast.error('Errore aggiornamento tile'),
  });

  const hasAiSuggestion = tile && !tile.action_type_reviewed && tile.action_type_ai;
  const aiConfidencePercent = tile?.action_type_confidence ? Math.round(tile.action_type_confidence * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Dettaglio Tile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Action Type Selector */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">Tipo azione</Label>
            <div className="flex gap-1 p-1 rounded-lg bg-zinc-800/50">
              {ACTION_TYPE_CONFIG.map((opt) => {
                const Icon = opt.icon;
                const isSelected = actionType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setActionType(opt.value)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                      isSelected
                        ? `${opt.bgColor} ${opt.color} border ${opt.borderColor}`
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* AI suggestion badge */}
            {hasAiSuggestion && (
              <button
                onClick={() => setActionType(tile.action_type_ai!)}
                className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <IconSparkles className="h-3 w-3" />
                AI suggerisce: {ACTION_TYPE_CONFIG.find((c) => c.value === tile.action_type_ai)?.label} ({aiConfidencePercent}%)
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="tile-title" className="text-xs text-zinc-400">Titolo</Label>
            <Input
              id="tile-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo tile..."
              className="mt-1 bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="tile-desc" className="text-xs text-zinc-400">Descrizione</Label>
            <Textarea
              id="tile-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrizione..."
              rows={2}
              className="mt-1 bg-zinc-800 border-zinc-700 text-white resize-none"
            />
          </div>

          {/* Date fields (conditional) */}
          {(actionType === 'deadline' || actionType === 'event') && (
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-zinc-400">
                  {actionType === 'deadline' ? 'Scadenza' : 'Inizio'}
                </Label>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              {actionType === 'event' && (
                <div className="flex-1">
                  <Label className="text-xs text-zinc-400">Fine</Label>
                  <Input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <Label className="text-xs text-zinc-400 mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTagIds(new Set());
                      } else {
                        setSelectedTagIds(new Set([tag.id]));
                      }
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs border transition-all',
                      isSelected
                        ? 'border-opacity-60'
                        : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: '#94A3B820',
                            color: '#94A3B8',
                            borderColor: '#94A3B860',
                          }
                        : undefined
                    }
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sparks preview (read-only) */}
          {tile?.sparks && tile.sparks.length > 0 && (
            <div>
              <Label className="text-xs text-zinc-400 mb-2 block">
                Sparks ({tile.sparks.length})
              </Label>
              <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
                {tile.sparks.map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="border-zinc-700 text-zinc-400"
                  >
                    {s.type}{s.file_name ? `: ${s.file_name}` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-300"
          >
            Annulla
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <IconDeviceFloppy className="h-4 w-4 mr-1.5" />
            {updateMutation.isPending ? 'Salvataggio...' : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalDatetime(isoString: string): string {
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
