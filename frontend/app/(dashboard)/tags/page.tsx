'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash, IconTag, IconPencil, IconCheck, IconX, IconSettings, IconFilter, IconSearch, IconChevronDown } from '@tabler/icons-react';
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
import { GIMMICK_PALETTE } from '@/lib/palette';
import type { Tag, TagTypeEntity } from '@/types';

// ─── Filter Popup ────────────────────────────────────────────
function FilterPopup({ anchorRef, open, onClose, children }: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
      className="fixed rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3 max-h-72 overflow-y-auto"
      style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
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
  className,
  hasActiveFilter,
  filterOpen,
  onToggleFilter,
  headRef,
}: {
  label: string;
  width: number;
  onResize: (w: number) => void;
  className?: string;
  hasActiveFilter: boolean;
  filterOpen: boolean;
  onToggleFilter: () => void;
  headRef: React.RefObject<HTMLTableCellElement | null>;
}) {
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
    <TableHead ref={headRef} className={cn('relative', className)} style={{ width, minWidth: width, maxWidth: width }}>
      <button
        onClick={onToggleFilter}
        className="flex items-center gap-1 w-full text-left"
      >
        <span className="truncate">{label}</span>
        <IconFilter className={cn('h-3 w-3 shrink-0 transition-colors', hasActiveFilter ? 'text-blue-400' : 'text-zinc-600')} />
      </button>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
        style={{ right: -2, width: 5 }}
      />
    </TableHead>
  );
}

// ─── Color Dot Picker (opens Dialog with palette grid) ───────
function ColorDotPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${value}20` }}
      >
        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: value }} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 sm:max-w-[220px] p-4">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Scegli colore</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-[2px]">
            {GIMMICK_PALETTE.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.name}
                onClick={() => { onChange(c.hex); setOpen(false); }}
                className="w-9 h-9 rounded-sm transition-transform hover:scale-110"
                style={{
                  backgroundColor: c.hex,
                  outline: value === c.hex ? '2px solid #fff' : 'none',
                  outlineOffset: '-2px',
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
          <div>
            <Label className="text-zinc-500 text-[11px]">Colore</Label>
            <ColorDotPicker value={newColor} onChange={setNewColor} />
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
                  <ColorDotPicker value={editColor} onChange={setEditColor} />
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji, color: editColor } });
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="h-7 flex-1 bg-zinc-700 border-zinc-600 text-white text-sm"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-400 hover:text-green-300 shrink-0"
                    onClick={() => updateMutation.mutate({ id: tt.id, updates: { name: editName.trim(), emoji: editEmoji, color: editColor } })}
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
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: tt.color || '#94A3B8' }} />
                  <span className="text-sm text-white flex-1">{tt.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditingId(tt.id);
                      setEditName(tt.name);
                      setEditEmoji(tt.emoji);
                      setEditColor(tt.color || '#94A3B8');
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
  const editCellRef = useRef<HTMLTableCellElement>(null);
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

  // Close type dropdown on outside click
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

  // Close alias popup on outside click
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
          {hasAnyFilter && (
            <button
              onClick={() => {
                setNameFilter('');
                setTypeFilter(new Set());
                setAliasFilter('');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 ml-2"
            >
              Rimuovi filtri
            </button>
          )}
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 border border-blue-500/20 text-xs h-8"
          >
            <IconPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Tag
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTypesOpen(true)}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-300 text-xs h-8"
          >
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Edit Tags
          </Button>
          <div className="flex-1" />
        </div>

        {/* Tags table */}
        {isLoading ? (
          <p className="text-center text-zinc-400 py-8">Caricamento...</p>
        ) : tags.length === 0 ? (
          <div className="text-center py-16">
            <IconTag className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">
              {hasAnyFilter ? 'Nessun tag corrisponde ai filtri' : 'Nessun tag creato'}
            </p>
            {!hasAnyFilter && (
              <p className="text-sm text-zinc-500 mt-1">
                Crea il primo tag per organizzare le tue tiles
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <Table style={{ tableLayout: 'fixed', width: colWidths.name + colWidths.type + colWidths.alias + 96, minWidth: colWidths.name + colWidths.type + colWidths.alias + 96 }}>
                <TableHeader className="sticky top-0 z-10 bg-zinc-900">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <FilterableHead label="Name" width={colWidths.name} onResize={(w) => setColWidth('name', w)} className="text-zinc-400 border-r border-zinc-800" hasActiveFilter={!!nameFilter} filterOpen={openFilter === 'name'} onToggleFilter={() => toggleFilter('name')} headRef={nameHeadRef} />
                    <FilterableHead label="Type" width={colWidths.type} onResize={(w) => setColWidth('type', w)} className="text-zinc-400 border-r border-zinc-800" hasActiveFilter={typeFilter.size > 0} filterOpen={openFilter === 'type'} onToggleFilter={() => toggleFilter('type')} headRef={typeHeadRef} />
                    <FilterableHead label="Alias" width={colWidths.alias} onResize={(w) => setColWidth('alias', w)} className="text-zinc-400 border-r border-zinc-800" hasActiveFilter={!!aliasFilter} filterOpen={openFilter === 'alias'} onToggleFilter={() => toggleFilter('alias')} headRef={aliasHeadRef} />

                    <TableHead className="border-r border-zinc-800" style={{ width: 96, minWidth: 96, maxWidth: 96 }} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} className="border-zinc-800 h-12 overflow-hidden" style={{ height: 48, maxHeight: 48 }}>
                      {/* Nome — click to edit inline */}
                      <TableCell
                        className="border-r border-zinc-800 overflow-hidden cursor-pointer hover:bg-zinc-800/40 transition-colors"
                        style={{ width: colWidths.name, minWidth: colWidths.name, maxWidth: colWidths.name }}
                        onClick={() => !tag.is_root && editingCell?.id !== tag.id && startEditName(tag)}
                      >
                        {editingCell?.id === tag.id && editingCell.field === 'name' ? (
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitName(tag.id);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            onBlur={() => commitName(tag.id)}
                            className="h-7 bg-zinc-800 border-zinc-700 text-white text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="text-xs text-zinc-300 truncate block">{tag.name}</span>
                        )}
                      </TableCell>

                      {/* Tipo — click to show portal dropdown */}
                      <TableCell
                        className="border-r border-zinc-800 overflow-visible cursor-pointer hover:bg-zinc-800/40 transition-colors"
                        style={{ width: colWidths.type, minWidth: colWidths.type, maxWidth: colWidths.type }}
                        onClick={(e) => {
                          if (tag.is_root) return;
                          if (editingCell?.id === tag.id && editingCell.field === 'type') { setEditingCell(null); return; }
                          startEditType(tag, e.currentTarget);
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColor(tag.tag_type || 'topic') || '#94A3B8' }} />
                          <TagTypeIcon emoji={getEmoji(tag.tag_type || 'topic')} size={14} />
                          <span className="text-xs text-zinc-400 truncate flex-1">{getName(tag.tag_type || 'topic')}</span>
                          {!tag.is_root && <IconChevronDown className="h-3 w-3 text-zinc-600 shrink-0" />}
                        </div>
                      </TableCell>

                      {/* Alias — click to open popup */}
                      <TableCell
                        className="border-r border-zinc-800 overflow-hidden cursor-pointer hover:bg-zinc-800/40 transition-colors"
                        style={{ width: colWidths.alias, minWidth: colWidths.alias, maxWidth: colWidths.alias }}
                        onClick={(e) => {
                          if (tag.is_root) return;
                          if (editingCell?.id === tag.id && editingCell.field === 'alias') return;
                          startEditAlias(tag, e.currentTarget);
                        }}
                      >
                        {tag.aliases && tag.aliases.length > 0 ? (
                          <span className="text-xs text-zinc-400 truncate block">{tag.aliases.join(', ')}</span>
                        ) : (
                          <span className="text-zinc-500 text-xs">&mdash;</span>
                        )}
                      </TableCell>



                      {/* Azioni — solo delete */}
                      <TableCell className="text-right border-r border-zinc-800">
                        {tag.is_root ? (
                          <span className="text-xs text-zinc-500 italic">Root</span>
                        ) : (
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400" onClick={() => deleteMutation.mutate(tag.id)}>
                              <IconTrash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Type dropdown popup */}
      {editingCell?.field === 'type' && createPortal(
        <div
          id="tag-type-dropdown"
          className="fixed w-40 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1"
          style={{ top: typeDropdownPos.top, left: typeDropdownPos.left, zIndex: 9999 }}
        >
          {tagTypes.map((t) => {
            const isActive = (tags.find((tg) => tg.id === editingCell.id)?.tag_type || 'topic') === t.slug;
            return (
              <button
                key={t.slug}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 transition-colors',
                  isActive && 'bg-zinc-800'
                )}
                onClick={() => commitType(editingCell.id, t.slug)}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color || '#94A3B8' }} />
                <TagTypeIcon emoji={t.emoji} size={14} />
                <span className="text-zinc-300 flex-1">{t.name}</span>
                {isActive && <IconCheck className="h-3 w-3 text-blue-400" />}
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
          className="fixed rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-3 w-56"
          style={{ top: aliasPopupPos.top, left: aliasPopupPos.left, zIndex: 9999 }}
        >
          <label className="text-[11px] text-zinc-500 mb-2 block">Alias</label>
          <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto mb-2">
            {editAliasesList.length === 0 ? (
              <span className="text-xs text-zinc-500">Nessun alias</span>
            ) : (
              editAliasesList.map((alias, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-zinc-300 flex-1 truncate">{alias}</span>
                  <button onClick={() => removeAlias(i)} className="text-zinc-500 hover:text-red-400 shrink-0">
                    <IconX className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newAliasInput}
              onChange={(e) => setNewAliasInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addAlias(); }}
              placeholder="Nuovo alias..."
              autoFocus
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-zinc-600"
            />
            <button
              onClick={addAlias}
              disabled={!newAliasInput.trim()}
              className="text-blue-400 hover:text-blue-300 disabled:text-zinc-600"
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Tag Types Management Modal */}
      <TagTypesModal open={typesOpen} onOpenChange={setTypesOpen} />

      {/* Column filter popups */}
      <FilterPopup anchorRef={typeHeadRef} open={openFilter === 'type'} onClose={() => setOpenFilter(null)}>
        <div className="w-40 flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 mb-1">Tipo tag</label>
          {tagTypes.map((tt) => {
            const active = typeFilter.has(tt.slug);
            return (
              <button
                key={tt.slug}
                className={cn('flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded transition-colors', active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50')}
                onClick={() => {
                  setTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(tt.slug)) next.delete(tt.slug); else next.add(tt.slug);
                    return next;
                  });
                }}
              >
                <span className="w-5 text-center"><TagTypeIcon emoji={tt.emoji} size={14} /></span>
                <span className="text-zinc-300 flex-1">{tt.name}</span>
                {active && <IconCheck className="h-3 w-3 text-blue-400" />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={nameHeadRef} open={openFilter === 'name'} onClose={() => setOpenFilter(null)}>
        <div className="w-48 flex flex-col gap-2">
          <label className="text-[11px] text-zinc-500">Cerca nel nome</label>
          <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5">
            <IconSearch className="h-3 w-3 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              className="bg-transparent text-xs text-white w-full focus:outline-none placeholder:text-zinc-600"
            />
            {nameFilter && (
              <button onClick={() => setNameFilter('')} className="text-zinc-500 hover:text-zinc-300">
                <IconX className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={aliasHeadRef} open={openFilter === 'alias'} onClose={() => setOpenFilter(null)}>
        <div className="w-48 flex flex-col gap-2">
          <label className="text-[11px] text-zinc-500">Cerca negli alias</label>
          <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5">
            <IconSearch className="h-3 w-3 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={aliasFilter}
              onChange={(e) => setAliasFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              className="bg-transparent text-xs text-white w-full focus:outline-none placeholder:text-zinc-600"
            />
            {aliasFilter && (
              <button onClick={() => setAliasFilter('')} className="text-zinc-500 hover:text-zinc-300">
                <IconX className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>

    </div>
  );
}
