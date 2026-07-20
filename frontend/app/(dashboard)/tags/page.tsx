'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash, IconTag, IconPencil, IconCheck, IconX, IconSettings, IconFilter, IconSearch, IconChevronDown } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { IconPicker } from '@/components/ui/icon-picker';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePixelTheme } from '@/components/pixel';
import { obsidianToolbarBtn } from '@/lib/pixel-toolbar';
import { tagsApi, tagTypesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { GIMMICK_PALETTE } from '@/lib/palette';
import type { Tag, TagTypeEntity } from '@/types';

// ─── Filter Popup ────────────────────────────────────────────
function FilterPopup({ anchorRef, open, onClose, children }: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = usePixelTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    const handleClick = (e: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
      }
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const handleScroll = (e: Event) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed"
      style={{
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
        padding: 10,
        maxHeight: 320,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── Filterable Header ───────────────────────────────────────
function FilterableHead({
  label,
  width,
  onResize,
  hasActiveFilter,
  onToggleFilter,
  headRef,
}: {
  label: string;
  width: number;
  onResize: (w: number) => void;
  hasActiveFilter: boolean;
  filterOpen: boolean;
  onToggleFilter: () => void;
  headRef: React.RefObject<HTMLTableCellElement | null>;
}) {
  const theme = usePixelTheme();
  const startX = useRef(0);
  const startW = useRef(width);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startW.current = width;
      const onMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX.current;
        onResize(Math.max(60, startW.current + diff));
      };
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [width, onResize]
  );

  return (
    <TableHead
      ref={headRef}
      className="relative"
      style={{
        width, minWidth: width, maxWidth: width,
        background: theme.surfaceVariant,
        borderRight: `1px solid ${theme.border}`,
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <button
        onClick={onToggleFilter}
        className="flex items-center gap-1 w-full text-left"
        style={{
          fontFamily: ('var(--ob-font-mono)'),
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink2,
        }}
      >
        <span className="truncate">{label}</span>
        <IconFilter size={11} className="shrink-0" style={{ color: hasActiveFilter ? theme.accent : theme.ink3 }} />
      </button>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize z-10"
        style={{ right: -2, width: 5 }}
        onMouseEnter={(e) => (e.currentTarget.style.background = `${theme.accent}66`)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      />
    </TableHead>
  );
}

// ─── Color Dot Picker ────────────────────────────────────────
function ColorDotPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: 36,
          height: 36,
          border: `1px solid ${theme.border}`,
          background: `${value}33`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{ width: 18, height: 18, background: value, border: `1px solid ${theme.border}` }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          style={{
            maxWidth: 240,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            color: theme.ink,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 0,
            gap: 0,
            display: 'block',
          }}
        >
          <DialogTitle asChild>
            <div
              style={{
                padding: '10px 12px',
                background: theme.surfaceVariant,
                borderBottom: `1px solid ${theme.border}`,
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink,
              }}
            >
              Scegli colore
            </div>
          </DialogTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, padding: 10 }}>
            {GIMMICK_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.name}
                onClick={() => { onChange(c.hex); setOpen(false); }}
                style={{
                  width: 36,
                  height: 36,
                  background: c.hex,
                  border: `2px solid ${value === c.hex ? theme.ink : theme.border}`,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Tag Type Pills ──────────────────────────────────────────
function TagTypePills({
  value,
  onChange,
  tagTypes,
}: {
  value: string;
  onChange: (slug: string) => void;
  tagTypes: TagTypeEntity[];
  getEmoji: (slug: string) => string;
  getName: (slug: string) => string;
}) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tagTypes.map((t) => {
        const isActive = value === t.slug;
        return (
          <button
            key={t.slug}
            type="button"
            onClick={() => onChange(t.slug)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: isActive ? theme.accent : theme.surfaceVariant,
              color: isActive ? theme.onAccent : theme.ink2,
              border: `1px solid ${theme.border}`,
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <TagTypeIcon emoji={t.emoji} size={14} color={isActive ? theme.onAccent : theme.ink2} />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

// Helper: render emoji string or Tabler icon component
function TagTypeIcon({ emoji, size = 20, color }: { emoji: string; size?: number; color?: string }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
    if (Comp) return <Comp size={size} style={{ color: color || '#D4D4D8' }} />;
  }
  return <span style={{ fontSize: size * 0.8, color: color || undefined }}>{emoji}</span>;
}

// ─── Tag Types Management Modal ──────────────────────────────
function TagTypesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const { tagTypes } = useTagTypes();
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('IconTag');
  const [newColor, setNewColor] = useState('#94A3B8');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editColor, setEditColor] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; emoji?: string; color?: string }) => {
      const res = await tagTypesApi.create(data);
      if (!res.success) throw new Error(res.error || 'Errore');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-types'] });
      setNewName('');
      setNewEmoji('IconTag');
      setNewColor('#94A3B8');
      toast.success('Tipo creato');
    },
    onError: (e: Error) => toast.error(e.message || 'Errore nella creazione'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; emoji?: string; color?: string } }) => {
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
    createMutation.mutate({ name, emoji: newEmoji, color: newColor });
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: ('var(--ob-font-mono)'),
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    padding: '6px 8px',
    color: theme.ink,
    fontFamily: ('var(--ob-font-sans)'),
    fontSize: 12,
    outline: 'none',
    height: 32,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        style={{
          maxWidth: 480,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          color: theme.ink,
          boxShadow: 'var(--ob-shadow-modal, var(--ob-shadow-card))',
          padding: 0,
          gap: 0,
          display: 'block',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: theme.surfaceVariant,
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <IconSettings size={14} style={{ color: theme.accent }} />
          <DialogTitle asChild>
            <span
              style={{
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.ink,
              }}
            >
              Tipi Tag
            </span>
          </DialogTitle>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Create new type */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Icona</label>
              <IconPicker value={newEmoji} onChange={setNewEmoji} />
            </div>
            <div>
              <label style={labelStyle}>Colore</label>
              <ColorDotPicker value={newColor} onChange={setNewColor} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Nome</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nuovo tipo..."
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="px-press"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme.accent,
                color: theme.onAccent,
                border: `1px solid ${theme.border}`,
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: !newName.trim() || createMutation.isPending ? 0.5 : 1,
                flexShrink: 0,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              <IconPlus size={14} />
            </button>
          </div>

          {/* Types list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto' }}>
            {tagTypes.map((tt) => (
              <div
                key={tt.id || tt.slug}
                className="group"
                style={{
                  padding: '8px 10px',
                  background: theme.surfaceVariant,
                  border: `1px solid ${theme.border}`,
                }}
              >
                {editingId === tt.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconPicker value={editEmoji} onChange={setEditEmoji} />
                    <ColorDotPicker value={editColor} onChange={setEditColor} />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji, color: editColor } });
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      style={{ ...inputStyle, height: 28, flex: 1 }}
                    />
                    <button
                      onClick={() => updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji, color: editColor } })}
                      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: '#1D9E75', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconCheck size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TagTypeIcon emoji={tt.emoji} size={16} color={theme.ink2} />
                    </span>
                    <div style={{ width: 14, height: 14, background: tt.color || '#94A3B8', border: `1px solid ${theme.border}`, flexShrink: 0 }} />
                    <span style={{ fontFamily: ('var(--ob-font-sans)'), fontSize: 12, color: theme.ink, flex: 1 }}>{tt.name}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setEditingId(tt.id);
                        setEditName(tt.name);
                        setEditEmoji(tt.emoji);
                        setEditColor(tt.color || '#94A3B8');
                      }}
                      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconPencil size={14} />
                    </button>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteMutation.mutate(tt.id)}
                      style={{ width: 28, height: 28, background: 'transparent', border: 'none', color: '#E24B4A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Tags Page ──────────────────────────────────────────
export default function TagsPage() {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const { tagTypes, getEmoji, getName, getColor } = useTagTypes();
  const [createOpen, setCreateOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagAliases, setNewTagAliases] = useState('');
  const [newTagType, setNewTagType] = useState('topic');
  // Inline cell editing
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'name' | 'type' | 'alias' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editAliasesList, setEditAliasesList] = useState<string[]>([]);
  const [newAliasInput, setNewAliasInput] = useState('');
  const aliasPopupRef = useRef<HTMLDivElement>(null);
  const [aliasPopupPos, setAliasPopupPos] = useState({ top: 0, left: 0 });

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState({ type: 200, name: 200, alias: 200 });
  const setColWidth = useCallback(
    (col: keyof typeof colWidths, w: number) => setColWidths((prev) => ({ ...prev, [col]: w })),
    []
  );

  // Column filters
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [aliasFilter, setAliasFilter] = useState('');

  // Header refs
  const typeHeadRef = useRef<HTMLTableCellElement>(null);
  const nameHeadRef = useRef<HTMLTableCellElement>(null);
  const aliasHeadRef = useRef<HTMLTableCellElement>(null);

  const { data: tagsResult, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const allTags = tagsResult?.data || [];
  const tags = allTags.filter((t) => {
    if (typeFilter.size > 0 && !typeFilter.has(t.tag_type || 'topic')) return false;
    if (nameFilter && !t.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (aliasFilter) {
      const hasMatch = (t.aliases || []).some((a) => a.toLowerCase().includes(aliasFilter.toLowerCase()));
      if (!hasMatch) return false;
    }
    return true;
  });

  const hasAnyFilter = typeFilter.size > 0 || !!nameFilter || !!aliasFilter;

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

  const startEditName = (tag: Tag) => {
    setEditingCell({ id: tag.id, field: 'name' });
    setEditValue(tag.name);
  };

  const commitName = (tagId: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) { setEditingCell(null); return; }
    updateMutation.mutate({ id: tagId, updates: { name: trimmed } });
    setEditingCell(null);
  };

  const [typeDropdownPos, setTypeDropdownPos] = useState({ top: 0, left: 0 });

  const startEditType = (tag: Tag, cellEl: HTMLTableCellElement) => {
    setEditingCell({ id: tag.id, field: 'type' });
    const rect = cellEl.getBoundingClientRect();
    const dropdownHeight = tagTypes.length * 32 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < dropdownHeight) {
      setTypeDropdownPos({ top: rect.top - dropdownHeight - 4, left: rect.left });
    } else {
      setTypeDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
  };

  const commitType = (tagId: string, slug: string) => {
    updateMutation.mutate({ id: tagId, updates: { tag_type: slug } });
    setEditingCell(null);
  };

  useEffect(() => {
    if (!editingCell || editingCell.field !== 'type') return;
    const handleClick = (e: MouseEvent) => {
      const el = document.getElementById('tag-type-dropdown');
      if (el) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
      }
      setEditingCell(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingCell]);

  const startEditAlias = (tag: Tag, cellEl: HTMLTableCellElement) => {
    setEditingCell({ id: tag.id, field: 'alias' });
    setEditAliasesList([...(tag.aliases || [])]);
    setNewAliasInput('');
    const rect = cellEl.getBoundingClientRect();
    const popupHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < popupHeight) {
      setAliasPopupPos({ top: rect.top - popupHeight - 4, left: rect.left });
    } else {
      setAliasPopupPos({ top: rect.bottom + 4, left: rect.left });
    }
  };

  const addAlias = () => {
    const v = newAliasInput.trim();
    if (!v || !editingCell) return;
    const next = [...editAliasesList, v];
    setEditAliasesList(next);
    setNewAliasInput('');
    updateMutation.mutate({ id: editingCell.id, updates: { aliases: next } });
  };

  const removeAlias = (index: number) => {
    if (!editingCell) return;
    const next = editAliasesList.filter((_, i) => i !== index);
    setEditAliasesList(next);
    updateMutation.mutate({ id: editingCell.id, updates: { aliases: next } });
  };

  useEffect(() => {
    if (!editingCell || editingCell.field !== 'alias') return;
    const handleClick = (e: MouseEvent) => {
      if (aliasPopupRef.current) {
        const rect = aliasPopupRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) return;
      }
      setEditingCell(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [editingCell]);

  const toggleFilter = useCallback((col: string) => {
    setOpenFilter((prev) => (prev === col ? null : col));
  }, []);

  const cellBorder: React.CSSProperties = {
    borderRight: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: ('var(--ob-font-mono)'),
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 6,
  };

  const modalInputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    padding: '8px 10px',
    color: theme.ink,
    fontFamily: ('var(--ob-font-sans)'),
    fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg1, ...({ flex: 1, minWidth: 0 }) }}>

      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconTag size={18} style={{ color: theme.accent }} />
            <span
              style={{
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
              }}
            >
              {allTags.length} tags
            </span>
          </div>
          {hasAnyFilter && (
            <button
              onClick={() => {
                setNameFilter('');
                setTypeFilter(new Set());
                setAliasFilter('');
              }}
              style={{
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.accent,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Rimuovi filtri
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="px-press"
            style={obsidianToolbarBtn(theme, true)}
          >
            <IconPlus size={12} />
            Add Tag
          </button>
          <button
            onClick={() => setTypesOpen(true)}
            className="px-press"
            style={obsidianToolbarBtn(theme, false)}
          >
            <IconPencil size={12} />
            Edit Tags
          </button>
        </div>

        {/* Table */}
        {isLoading ? (
          <p
            style={{
              textAlign: 'center',
              padding: '32px 0',
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            Caricamento...
          </p>
        ) : tags.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                background: theme.surfaceVariant,
                border: `1px solid ${theme.border}`,
                color: theme.ink3,
                marginBottom: 12,
              }}
            >
              <IconTag size={28} />
            </div>
            <p
              style={{
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink2,
              }}
            >
              {hasAnyFilter ? 'Nessun tag corrisponde ai filtri' : 'Nessun tag creato'}
            </p>
            {!hasAnyFilter && (
              <p style={{ fontFamily: ('var(--ob-font-sans)'), fontSize: 11, color: theme.ink3, marginTop: 6 }}>
                Crea il primo tag per organizzare le tue tiles
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            <div style={{ flex: 1, overflow: 'auto' }}>
              <Table style={{ tableLayout: 'fixed', width: colWidths.name + colWidths.type + colWidths.alias + 96, minWidth: colWidths.name + colWidths.type + colWidths.alias + 96 }}>
                <TableHeader className="sticky top-0 z-10" style={{ background: theme.surfaceVariant }}>
                  <TableRow style={{ background: 'transparent', borderBottom: 'none' }}>
                    <FilterableHead label="Name" width={colWidths.name} onResize={(w) => setColWidth('name', w)} hasActiveFilter={!!nameFilter} filterOpen={openFilter === 'name'} onToggleFilter={() => toggleFilter('name')} headRef={nameHeadRef} />
                    <FilterableHead label="Type" width={colWidths.type} onResize={(w) => setColWidth('type', w)} hasActiveFilter={typeFilter.size > 0} filterOpen={openFilter === 'type'} onToggleFilter={() => toggleFilter('type')} headRef={typeHeadRef} />
                    <FilterableHead label="Alias" width={colWidths.alias} onResize={(w) => setColWidth('alias', w)} hasActiveFilter={!!aliasFilter} filterOpen={openFilter === 'alias'} onToggleFilter={() => toggleFilter('alias')} headRef={aliasHeadRef} />
                    <TableHead
                      style={{
                        width: 96,
                        minWidth: 96,
                        maxWidth: 96,
                        background: theme.surfaceVariant,
                        borderRight: `1px solid ${theme.border}`,
                        borderBottom: `1px solid ${theme.border}`,
                      }}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} style={{ height: 44, maxHeight: 44, background: 'transparent' }}>
                      {/* Name */}
                      <TableCell
                        style={{
                          ...cellBorder,
                          width: colWidths.name,
                          minWidth: colWidths.name,
                          maxWidth: colWidths.name,
                          overflow: 'hidden',
                          cursor: tag.is_root ? 'default' : 'pointer',
                          padding: '0 12px',
                        }}
                        onClick={() => !tag.is_root && editingCell?.id !== tag.id && startEditName(tag)}
                      >
                        {editingCell?.id === tag.id && editingCell.field === 'name' ? (
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitName(tag.id);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            onBlur={() => commitName(tag.id)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              height: 28,
                              width: '100%',
                              background: theme.surfaceVariant,
                              border: `1px solid ${theme.border}`,
                              padding: '0 6px',
                              color: theme.ink,
                              fontFamily: ('var(--ob-font-sans)'),
                              fontSize: 12,
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontFamily: ('var(--ob-font-sans)'),
                              fontSize: 12,
                              color: theme.ink,
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.name}
                          </span>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell
                        style={{
                          ...cellBorder,
                          width: colWidths.type,
                          minWidth: colWidths.type,
                          maxWidth: colWidths.type,
                          overflow: 'visible',
                          cursor: tag.is_root ? 'default' : 'pointer',
                          padding: '0 12px',
                        }}
                        onClick={(e) => {
                          if (tag.is_root) return;
                          if (editingCell?.id === tag.id && editingCell.field === 'type') { setEditingCell(null); return; }
                          startEditType(tag, e.currentTarget);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <TagTypeIcon emoji={getEmoji(tag.tag_type || 'topic')} size={14} color={getColor(tag.tag_type || 'topic') || '#94A3B8'} />
                          <span
                            style={{
                              fontFamily: ('var(--ob-font-sans)'),
                              fontSize: 12,
                              color: theme.ink2,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {getName(tag.tag_type || 'topic')}
                          </span>
                          {!tag.is_root && <IconChevronDown size={12} style={{ color: theme.ink3, flexShrink: 0 }} />}
                        </div>
                      </TableCell>

                      {/* Alias */}
                      <TableCell
                        style={{
                          ...cellBorder,
                          width: colWidths.alias,
                          minWidth: colWidths.alias,
                          maxWidth: colWidths.alias,
                          overflow: 'hidden',
                          cursor: tag.is_root ? 'default' : 'pointer',
                          padding: '0 12px',
                        }}
                        onClick={(e) => {
                          if (tag.is_root) return;
                          if (editingCell?.id === tag.id && editingCell.field === 'alias') return;
                          startEditAlias(tag, e.currentTarget);
                        }}
                      >
                        {tag.aliases && tag.aliases.length > 0 ? (
                          <span
                            style={{
                              fontFamily: ('var(--ob-font-sans)'),
                              fontSize: 12,
                              color: theme.ink2,
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {tag.aliases.join(', ')}
                          </span>
                        ) : (
                          <span style={{ color: theme.ink3, fontFamily: ('var(--ob-font-sans)'), fontSize: 12 }}>—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell style={{ ...cellBorder, textAlign: 'right', padding: '0 8px' }}>
                        {tag.is_root ? (
                          <span
                            style={{
                              fontFamily: ('var(--ob-font-mono)'),
                              fontSize: 9,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              color: theme.ink3,
                              fontStyle: 'italic',
                            }}
                          >
                            Root
                          </span>
                        ) : (
                          <button
                            onClick={() => deleteMutation.mutate(tag.id)}
                            style={{
                              width: 28,
                              height: 28,
                              background: 'transparent',
                              border: 'none',
                              color: theme.ink3,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#E24B4A')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = theme.ink3)}
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </TableCell>
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
        <DialogContent
          showCloseButton={false}
          style={{
            maxWidth: 480,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            color: theme.ink,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 0,
            gap: 0,
            display: 'block',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              background: theme.surfaceVariant,
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <IconTag size={14} style={{ color: theme.accent }} />
            <DialogTitle asChild>
              <span
                style={{
                  fontFamily: ('var(--ob-font-mono)'),
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: theme.ink,
                }}
              >
                Nuovo Tag
              </span>
            </DialogTitle>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nome</label>
              <input
                placeholder="Nome del tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                style={modalInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Alias</label>
              <input
                placeholder="Alias separati da virgola..."
                value={newTagAliases}
                onChange={(e) => setNewTagAliases(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                style={modalInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <TagTypePills value={newTagType} onChange={setNewTagType} tagTypes={tagTypes} getEmoji={getEmoji} getName={getName} />
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              padding: 12,
              borderTop: `1px solid ${theme.border}`,
              background: theme.surfaceVariant,
            }}
          >
            <button
              onClick={() => setCreateOpen(false)}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 28,
                padding: '0 12px',
                background: theme.surface,
                color: theme.ink2,
                border: `1px solid ${theme.border}`,
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTagName.trim() || createMutation.isPending}
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 12px',
                background: theme.accent,
                color: theme.onAccent,
                border: `1px solid ${theme.border}`,
                fontFamily: ('var(--ob-font-mono)'),
                fontSize: 9,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: !newTagName.trim() || createMutation.isPending ? 0.5 : 1,
                boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
              }}
            >
              <IconPlus size={12} />
              Crea
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Type dropdown popup */}
      {editingCell?.field === 'type' && createPortal(
        <div
          id="tag-type-dropdown"
          className="fixed"
          style={{
            top: typeDropdownPos.top,
            left: typeDropdownPos.left,
            zIndex: 9999,
            width: 180,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 4,
          }}
        >
          {tagTypes.map((t) => {
            const isActive = (tags.find((tg) => tg.id === editingCell.id)?.tag_type || 'topic') === t.slug;
            return (
              <button
                key={t.slug}
                onClick={() => commitType(editingCell.id, t.slug)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  textAlign: 'left',
                  background: isActive ? theme.surfaceVariant : 'transparent',
                  border: `2px solid ${isActive ? theme.border : 'transparent'}`,
                  cursor: 'pointer',
                  fontFamily: ('var(--ob-font-sans)'),
                  fontSize: 12,
                  color: theme.ink2,
                }}
              >
                <div style={{ width: 12, height: 12, background: t.color || '#94A3B8', border: `1px solid ${theme.border}`, flexShrink: 0 }} />
                <TagTypeIcon emoji={t.emoji} size={14} color={theme.ink2} />
                <span style={{ flex: 1 }}>{t.name}</span>
                {isActive && <IconCheck size={12} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>,
        document.body
      )}

      {/* Alias edit popup */}
      {editingCell?.field === 'alias' && createPortal(
        <div
          ref={aliasPopupRef}
          className="fixed"
          style={{
            top: aliasPopupPos.top,
            left: aliasPopupPos.left,
            zIndex: 9999,
            width: 240,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            padding: 10,
          }}
        >
          <label
            style={{
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              display: 'block',
              marginBottom: 6,
            }}
          >
            Alias
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 132, overflowY: 'auto', marginBottom: 8 }}>
            {editAliasesList.length === 0 ? (
              <span style={{ fontFamily: ('var(--ob-font-sans)'), fontSize: 11, color: theme.ink3 }}>
                Nessun alias
              </span>
            ) : (
              editAliasesList.map((alias, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontFamily: ('var(--ob-font-sans)'),
                      fontSize: 12,
                      color: theme.ink2,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {alias}
                  </span>
                  <button
                    onClick={() => removeAlias(i)}
                    style={{ background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#E24B4A')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = theme.ink3)}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              value={newAliasInput}
              onChange={(e) => setNewAliasInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addAlias(); }}
              placeholder="Nuovo alias..."
              autoFocus
              style={{
                flex: 1,
                background: theme.surfaceVariant,
                border: `1px solid ${theme.border}`,
                padding: '6px 8px',
                color: theme.ink,
                fontFamily: ('var(--ob-font-sans)'),
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={addAlias}
              disabled={!newAliasInput.trim()}
              style={{
                width: 28,
                height: 28,
                background: newAliasInput.trim() ? theme.accent : theme.surfaceVariant,
                color: newAliasInput.trim() ? theme.onAccent : theme.ink3,
                border: `1px solid ${theme.border}`,
                cursor: newAliasInput.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconPlus size={14} />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Tag Types Management Modal */}
      <TagTypesModal open={typesOpen} onOpenChange={setTypesOpen} />

      {/* Column filter popups */}
      <FilterPopup anchorRef={typeHeadRef} open={openFilter === 'type'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 168, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label
            style={{
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 4,
            }}
          >
            Tipo tag
          </label>
          {tagTypes.map((tt) => {
            const active = typeFilter.has(tt.slug);
            return (
              <button
                key={tt.slug}
                onClick={() => {
                  setTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(tt.slug)) next.delete(tt.slug); else next.add(tt.slug);
                    return next;
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  textAlign: 'left',
                  background: active ? theme.surfaceVariant : 'transparent',
                  border: `2px solid ${active ? theme.border : 'transparent'}`,
                  cursor: 'pointer',
                  fontFamily: ('var(--ob-font-sans)'),
                  fontSize: 12,
                  color: theme.ink2,
                }}
              >
                <span style={{ width: 20, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TagTypeIcon emoji={tt.emoji} size={14} color={theme.ink2} />
                </span>
                <span style={{ flex: 1 }}>{tt.name}</span>
                {active && <IconCheck size={12} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={nameHeadRef} open={openFilter === 'name'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            Cerca nel nome
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.surfaceVariant, border: `1px solid ${theme.border}`, padding: '6px 8px' }}>
            <IconSearch size={12} style={{ color: theme.ink3, flexShrink: 0 }} />
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              style={{ background: 'transparent', color: theme.ink, width: '100%', outline: 'none', border: 'none', fontFamily: ('var(--ob-font-sans)'), fontSize: 11 }}
            />
            {nameFilter && (
              <button onClick={() => setNameFilter('')} style={{ background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex' }}>
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={aliasHeadRef} open={openFilter === 'alias'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{
              fontFamily: ('var(--ob-font-mono)'),
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            Cerca negli alias
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.surfaceVariant, border: `1px solid ${theme.border}`, padding: '6px 8px' }}>
            <IconSearch size={12} style={{ color: theme.ink3, flexShrink: 0 }} />
            <input
              type="text"
              value={aliasFilter}
              onChange={(e) => setAliasFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              style={{ background: 'transparent', color: theme.ink, width: '100%', outline: 'none', border: 'none', fontFamily: ('var(--ob-font-sans)'), fontSize: 11 }}
            />
            {aliasFilter && (
              <button onClick={() => setAliasFilter('')} style={{ background: 'transparent', border: 'none', color: theme.ink3, cursor: 'pointer', display: 'inline-flex' }}>
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>
    </div>
  );
}
