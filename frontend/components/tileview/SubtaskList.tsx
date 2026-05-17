'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subtasksApi } from '@/lib/api';
import type { Subtask } from '@/types';
import { cn } from '@/lib/utils';
import {
  IconPlus,
  IconTrash,
  IconCopy,
  IconCheck,
  IconGripVertical,
} from '@tabler/icons-react';

interface SubtaskListProps {
  tileId: string;
}

export function SubtaskList({ tileId }: SubtaskListProps) {
  const queryClient = useQueryClient();
  const queryKey = ['subtasks', tileId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => subtasksApi.list(tileId),
    enabled: !!tileId,
  });

  const subtasks: Subtask[] = data?.data || [];

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const addMutation = useMutation({
    mutationFn: () => subtasksApi.create({ tile_id: tileId, content: '' }),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { content?: string; is_done?: boolean } }) =>
      subtasksApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((s: Subtask) => s.id === id ? { ...s, ...updates } : s) };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subtasksApi.delete(id),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) => subtasksApi.reorder(items),
    onSuccess: invalidate,
  });

  const moveByIndex = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= subtasks.length || to >= subtasks.length) return;
    const reordered = [...subtasks];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const items = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
    queryClient.setQueryData(queryKey, { data: reordered.map((s, i) => ({ ...s, sort_order: i })) });
    reorderMutation.mutate(items);
  }, [subtasks, reorderMutation, queryClient, queryKey]);

  const copy = useCallback(async (content: string) => {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
  }, []);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (isLoading) {
    return <p className="text-xs text-zinc-500 mt-4">Caricamento...</p>;
  }

  return (
    <div className="space-y-2">
      {subtasks.length === 0 && (
        <p className="text-[11px] text-zinc-500 text-center py-2">Nessun elemento</p>
      )}
      {subtasks.map((s, i) => (
        <SubtaskRow
          key={s.id}
          subtask={s}
          index={i}
          isDragging={dragIndex === i}
          isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
          onToggle={() => updateMutation.mutate({ id: s.id, updates: { is_done: !s.is_done } })}
          onChange={(content) => updateMutation.mutate({ id: s.id, updates: { content } })}
          onDelete={() => deleteMutation.mutate(s.id)}
          onCopy={() => copy(s.content)}
          onDragStart={() => setDragIndex(i)}
          onDragOver={() => setDropIndex(i)}
          onDragEnd={() => {
            if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
              moveByIndex(dragIndex, dropIndex);
            }
            setDragIndex(null);
            setDropIndex(null);
          }}
        />
      ))}
      <button
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending}
        className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 text-[11px] transition-colors disabled:opacity-40"
      >
        <IconPlus className="h-3 w-3" />
        Aggiungi elemento
      </button>
    </div>
  );
}

interface SubtaskRowProps {
  subtask: Subtask;
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

function SubtaskRow({ subtask, isDragging, isDropTarget, onToggle, onChange, onDelete, onCopy, onDragStart, onDragOver, onDragEnd }: SubtaskRowProps) {
  const [value, setValue] = useState(subtask.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Sync from server when not dirty
  useEffect(() => {
    if (!dirty.current) setValue(subtask.content);
  }, [subtask.content]);

  // Auto-resize textarea to content
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handleDeleteClick = () => {
    if (confirmDelete) onDelete();
    else setConfirmDelete(true);
  };

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(); }}
      onDragEnd={onDragEnd}
      onDrop={(e) => { e.preventDefault(); onDragEnd(); }}
      className={cn(
        'rounded border border-zinc-800 bg-zinc-900/40 p-1.5 group relative transition-all',
        isDragging && 'opacity-40',
        isDropTarget && 'border-blue-500 border-t-2'
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 mt-0.5 shrink-0" title="Trascina per riordinare">
          <IconGripVertical className="h-3.5 w-3.5" />
        </div>

        {/* Check */}
        <button
          onClick={onToggle}
          className={cn(
            'h-4 w-4 rounded shrink-0 flex items-center justify-center border transition-colors mt-0.5',
            subtask.is_done ? 'bg-blue-500 border-blue-500' : 'border-zinc-600 hover:border-zinc-400'
          )}
          title={subtask.is_done ? 'Segna come da fare' : 'Segna come fatto'}
        >
          {subtask.is_done && <IconCheck className="h-3 w-3 text-white" stroke={3} />}
        </button>

        {/* Auto-resize textarea */}
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); dirty.current = true; }}
          onBlur={() => { if (dirty.current) { onChange(value); dirty.current = false; } }}
          rows={1}
          placeholder="Scrivi..."
          className={cn(
            'flex-1 bg-transparent text-xs text-zinc-300 resize-none focus:outline-none overflow-hidden leading-snug min-w-0',
            subtask.is_done && 'line-through text-zinc-500'
          )}
        />
      </div>

      {/* Actions toolbar */}
      <div className="flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onCopy}
          className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          title="Copia"
        >
          <IconCopy className="h-3 w-3" />
        </button>
        <div className="flex-1" />
        <button
          onClick={handleDeleteClick}
          className={cn(
            'p-0.5 rounded transition-colors',
            confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800'
          )}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}