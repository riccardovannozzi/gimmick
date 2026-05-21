'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconCircle, IconBolt, IconClock, IconCalendar, IconSparkles, IconDeviceFloppy } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { tilesApi, tagsApi } from '@/lib/api';
import type { Tile, ActionType, Tag } from '@/types';

const ACTION_TYPE_CONFIG: {
  value: ActionType;
  label: string;
  icon: typeof IconCircle;
}[] = [
  { value: 'none', label: 'Appunto', icon: IconCircle },
  { value: 'anytime', label: 'Da fare', icon: IconBolt },
  { value: 'deadline', label: 'Scadenza', icon: IconClock },
  { value: 'event', label: 'Evento', icon: IconCalendar },
];

interface TileDetailModalProps {
  tile: Tile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TileDetailModal({ tile, open, onOpenChange }: TileDetailModalProps) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [actionType, setActionType] = useState<ActionType>('none');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });
  const allTags: Tag[] = tagsResult?.data || [];

  useEffect(() => {
    if (tile) {
      setTitle(tile.title || '');
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
        action_type: actionType,
      };
      if (actionType === 'event' || actionType === 'deadline') {
        if (startAt) updates.start_at = new Date(startAt).toISOString();
        if (endAt) updates.end_at = new Date(endAt).toISOString();
      }
      const result = await tilesApi.update(tile.id, updates as Parameters<typeof tilesApi.update>[1]);
      if (!result.success) throw new Error(result.error);

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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surfaceVariant,
    border: `2px solid ${theme.border}`,
    padding: '8px 10px',
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    outline: 'none',
    colorScheme: 'dark',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{
          maxWidth: 520,
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
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 40,
            padding: '0 12px',
            background: theme.surfaceVariant,
            borderBottom: `2px solid ${theme.border}`,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
            }}
          >
            Dettaglio Tile
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Action Type Selector */}
          <div>
            <label style={labelStyle}>Tipo azione</label>
            <div
              style={{
                display: 'flex',
                gap: 4,
                padding: 4,
                background: theme.surfaceVariant,
                border: `2px solid ${theme.border}`,
              }}
            >
              {ACTION_TYPE_CONFIG.map((opt) => {
                const Icon = opt.icon;
                const isSelected = actionType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setActionType(opt.value)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      background: isSelected ? theme.accent : 'transparent',
                      color: isSelected ? theme.onAccent : theme.ink2,
                      border: `2px solid ${isSelected ? theme.border : 'transparent'}`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={12} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {hasAiSuggestion && (
              <button
                onClick={() => setActionType(tile.action_type_ai!)}
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: theme.accent,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                }}
              >
                <IconSparkles size={12} />
                AI suggerisce: {ACTION_TYPE_CONFIG.find((c) => c.value === tile.action_type_ai)?.label} ({aiConfidencePercent}%)
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="tile-title" style={labelStyle}>Titolo</label>
            <input
              id="tile-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titolo tile..."
              style={inputStyle}
            />
          </div>

          {/* Date fields */}
          {(actionType === 'deadline' || actionType === 'event') && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>
                  {actionType === 'deadline' ? 'Scadenza' : 'Inizio'}
                </label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  style={inputStyle}
                />
              </div>
              {actionType === 'event' && (
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fine</label>
                  <input
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                    style={{
                      padding: '4px 8px',
                      background: isSelected ? theme.accent : theme.surfaceVariant,
                      color: isSelected ? theme.onAccent : theme.ink2,
                      border: `2px solid ${theme.border}`,
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sparks preview */}
          {tile?.sparks && tile.sparks.length > 0 && (
            <div>
              <label style={labelStyle}>Sparks ({tile.sparks.length})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tile.sparks.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      padding: '4px 8px',
                      background: theme.surfaceVariant,
                      color: theme.ink2,
                      border: `2px solid ${theme.border}`,
                      fontFamily: 'var(--font-pixel-body)',
                      fontSize: 11,
                    }}
                  >
                    {s.type}{s.file_name ? `: ${s.file_name}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: 12,
            borderTop: `2px solid ${theme.border}`,
            background: theme.surfaceVariant,
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 28,
              padding: '0 12px',
              background: theme.surface,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              padding: '0 12px',
              background: theme.accent,
              color: theme.onAccent,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: updateMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: updateMutation.isPending ? 0.6 : 1,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            <IconDeviceFloppy size={12} />
            {updateMutation.isPending ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
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
