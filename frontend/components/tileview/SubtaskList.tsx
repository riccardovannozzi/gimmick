'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subtasksApi } from '@/lib/api';
import type { Subtask } from '@/types';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
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
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
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
    return (
      <p style={{ fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, marginTop: 16 }}>
        Caricamento...
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {subtasks.length === 0 && (
        <p
          style={{
            fontFamily: inShell ? 'var(--ob-font-mono)' : 'var(--font-pixel-head)',
            fontSize: inShell ? 11 : 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: theme.ink3,
            textAlign: 'center',
            padding: '8px 0',
            margin: 0,
          }}
        >
          Nessun elemento
        </p>
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
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: inShell ? '9px 8px' : '6px 8px',
          background: 'transparent',
          color: inShell ? theme.ink2 : theme.ink3,
          border: `${inShell ? 1 : 2}px dashed ${theme.border}`,
          borderRadius: inShell ? 10 : 0,
          fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-head)',
          fontSize: inShell ? 12.5 : 9,
          fontWeight: inShell ? 600 : undefined,
          letterSpacing: inShell ? 0 : '0.08em',
          textTransform: inShell ? 'none' : 'uppercase',
          cursor: addMutation.isPending ? 'not-allowed' : 'pointer',
          opacity: addMutation.isPending ? 0.4 : 1,
        }}
      >
        <IconPlus size={inShell ? 14 : 11} />
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
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
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
      className="group"
      style={{
        background: inShell ? theme.surface : theme.surfaceVariant,
        border: `${inShell ? 1 : 2}px solid ${theme.border}`,
        borderRadius: inShell ? 10 : 0,
        padding: inShell ? 10 : 8,
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        borderTopWidth: isDropTarget ? (inShell ? 2 : 4) : (inShell ? 1 : 2),
        borderTopColor: isDropTarget ? theme.accent : theme.border,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {/* Drag handle */}
        <div
          style={{ cursor: 'grab', color: theme.ink3, marginTop: 2, flexShrink: 0 }}
          title="Trascina per riordinare"
        >
          <IconGripVertical size={14} />
        </div>

        {/* Check */}
        <button
          onClick={onToggle}
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: subtask.is_done ? theme.accent : 'transparent',
            border: `${inShell ? 1.5 : 2}px solid ${subtask.is_done ? (inShell ? theme.accent : theme.border) : theme.ink3}`,
            borderRadius: inShell ? 5 : 0,
            cursor: 'pointer',
            marginTop: 2,
          }}
          title={subtask.is_done ? 'Segna come da fare' : 'Segna come fatto'}
        >
          {subtask.is_done && <IconCheck size={10} color={theme.onAccent} stroke={3} />}
        </button>

        {/* Auto-resize textarea */}
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); dirty.current = true; }}
          onBlur={() => { if (dirty.current) { onChange(value); dirty.current = false; } }}
          rows={1}
          placeholder="Scrivi..."
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            color: subtask.is_done ? theme.ink3 : theme.ink,
            fontFamily: inShell ? 'var(--ob-font-sans)' : 'var(--font-pixel-body)',
            fontSize: 12,
            lineHeight: 1.3,
            resize: 'none',
            outline: 'none',
            border: 'none',
            overflow: 'hidden',
            textDecoration: subtask.is_done ? 'line-through' : 'none',
          }}
        />
      </div>

      {/* Actions toolbar */}
      <div
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 4 }}
      >
        <button
          onClick={onCopy}
          style={{
            padding: 2,
            background: 'transparent',
            color: theme.ink3,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
          }}
          title="Copia"
        >
          <IconCopy size={11} />
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleDeleteClick}
          style={{
            padding: 2,
            background: confirmDelete ? '#E24B4A' : 'transparent',
            color: confirmDelete ? '#FFFFFF' : theme.ink3,
            border: confirmDelete ? `${inShell ? 1 : 2}px solid ${theme.border}` : 'none',
            borderRadius: inShell ? 5 : 0,
            cursor: 'pointer',
            display: 'inline-flex',
            ...(confirmDelete ? { opacity: 1 } : {}),
          }}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash size={11} />
        </button>
      </div>
    </div>
  );
}
