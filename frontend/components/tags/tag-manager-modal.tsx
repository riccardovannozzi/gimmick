'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash, IconTag, IconPencil, IconCheck, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { tagsApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import type { Tag } from '@/types';

interface TagManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManagerModal({ open, onOpenChange }: TagManagerModalProps) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const { tagTypes, getEmoji, getName } = useTagTypes();
  const [newTagName, setNewTagName] = useState('');
  const [newTagAliases, setNewTagAliases] = useState('');
  const [newTagType, setNewTagType] = useState('topic');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAliases, setEditAliases] = useState('');
  const [editTagType, setEditTagType] = useState('topic');

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
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

  const inputStyle: React.CSSProperties = {
    background: theme.surfaceVariant,
    border: `2px solid ${theme.border}`,
    padding: '0 8px',
    height: 30,
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    outline: 'none',
  };
  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 8px',
    background: active ? theme.accent : theme.surfaceVariant,
    color: active ? theme.onAccent : theme.ink2,
    border: `2px solid ${theme.border}`,
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  });
  const iconBtn = (danger: boolean = false): React.CSSProperties => ({
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: danger ? '#E24B4A' : theme.ink2,
    flexShrink: 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{
          maxWidth: 440,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          borderRadius: 0,
          color: theme.ink,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          padding: 0,
          gap: 0,
          display: 'block',
        }}
      >
        <div style={{ padding: '10px 14px', background: theme.surfaceVariant, borderBottom: `2px solid ${theme.border}` }}>
          <h2
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <IconTag size={14} style={{ color: theme.accent }} />
            Gestione Tag
          </h2>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
            Crea e gestisci i tag per organizzare le tue tiles.
          </p>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Create new tag */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="Nome del tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleCreate}
                disabled={!newTagName.trim() || createMutation.isPending}
                className="px-press"
                style={{
                  width: 30,
                  height: 30,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.accent,
                  color: theme.onAccent,
                  border: `2px solid ${theme.border}`,
                  cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  opacity: (!newTagName.trim() || createMutation.isPending) ? 0.5 : 1,
                  boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                }}
              >
                <IconPlus size={14} />
              </button>
            </div>

            <input
              placeholder="Alias (separati da virgola)..."
              value={newTagAliases}
              onChange={(e) => setNewTagAliases(e.target.value)}
              onKeyDown={handleKeyDown}
              style={inputStyle}
            />

            {/* Tag type pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tagTypes.map((t) => (
                <button key={t.slug} type="button" onClick={() => setNewTagType(t.slug)} style={pillBtn(newTagType === t.slug)}>
                  {t.emoji} {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tag list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
            {isLoading ? (
              <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Caricamento...
              </p>
            ) : tags.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Nessun tag creato
              </p>
            ) : (
              tags.map((tag) => (
                <div
                  key={tag.id}
                  className="group"
                  style={{
                    padding: '8px 10px',
                    background: theme.surfaceVariant,
                    border: `2px solid ${theme.border}`,
                  }}
                >
                  {editingId === tag.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                          autoFocus
                          style={{ ...inputStyle, height: 28, flex: 1, background: theme.surface }}
                        />
                        <button onClick={confirmEdit} style={{ ...iconBtn(false), color: '#1D9E75' }}>
                          <IconCheck size={13} />
                        </button>
                        <button onClick={() => setEditingId(null)} style={iconBtn(false)}>
                          <IconX size={13} />
                        </button>
                      </div>
                      <input
                        value={editAliases}
                        onChange={(e) => setEditAliases(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                        placeholder="Alias (separati da virgola)..."
                        style={{ ...inputStyle, height: 28, background: theme.surface }}
                      />
                      {!tag.is_root && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {tagTypes.map((t) => (
                            <button key={t.slug} type="button" onClick={() => setEditTagType(t.slug)} style={pillBtn(editTagType === t.slug)}>
                              {t.emoji} {t.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12 }} title={getName(tag.tag_type || 'topic')}>
                          {getEmoji(tag.tag_type || 'topic')}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-pixel-body)',
                            fontSize: 12,
                            color: theme.ink,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tag.name}
                        </span>
                        {!tag.is_root && (
                          <>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={iconBtn(false)}
                              onClick={() => startEdit(tag)}
                            >
                              <IconPencil size={13} />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={iconBtn(true)}
                              onClick={() => deleteMutation.mutate(tag.id)}
                            >
                              <IconTrash size={13} />
                            </button>
                          </>
                        )}
                      </div>
                      {tag.aliases && tag.aliases.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, marginLeft: 20 }}>
                          {tag.aliases.map((alias) => (
                            <span
                              key={alias}
                              style={{
                                padding: '2px 6px',
                                background: theme.surface,
                                color: theme.ink2,
                                border: `2px solid ${theme.border}`,
                                fontFamily: 'var(--font-pixel-body)',
                                fontSize: 11,
                              }}
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
