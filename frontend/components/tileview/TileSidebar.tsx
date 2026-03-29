'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { tilesApi, sparksApi, uploadApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';
import { usePatterns } from '@/store/patterns-store';
import { cn } from '@/lib/utils';
import { useStatusIcons } from '@/store/status-icons-store';
import { useTagTypes } from '@/store/tag-types-store';
import type { PatternShape } from '@/types';
import type { Tile, Spark } from '@/types';

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SPARK_ICONS: Record<string, typeof IconFile> = {
  photo: IconCamera,
  image: IconPhoto,
  video: IconVideo,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function StatusIconPicker({ tileId }: { tileId: string }) {
  const { icons, tileIcons, assignIcon } = useStatusIcons();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const currentIconId = tileIcons[tileId] || '';
  const current = icons.find((i) => i.id === currentIconId);
  const CurrentComp = current?.icon ? AllIcons[current.icon] : null;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (icons.length === 0) return null;

  return (
    <div className="relative">
      <label className="text-[11px] text-zinc-500 mb-1 block">Status</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        {CurrentComp ? (
          <>
            <CurrentComp size={14} className="text-zinc-200 shrink-0" />
            <span className="truncate flex-1 text-left">{current!.name}</span>
          </>
        ) : (
          <span className="text-zinc-500 flex-1 text-left text-[11px]">Seleziona status...</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          <button
            onClick={() => { assignIcon(tileId, null); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
              !currentIconId && 'bg-zinc-700/30'
            )}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center text-zinc-500">—</span>
            <span className="text-zinc-400 truncate flex-1">Nessuno</span>
            {!currentIconId && (
              <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = currentIconId === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => { assignIcon(tileId, icon.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                  selected && 'bg-zinc-700/30'
                )}
              >
                {Comp && <Comp size={14} className="text-zinc-200 shrink-0" />}
                <span className="text-zinc-300 truncate flex-1">{icon.name}</span>
                {selected && (
                  <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function InlinePatternSvg({ shape, color }: { shape: PatternShape; color: string }) {
  const o = 0.35;
  switch (shape) {
    case 'solid': return null;
    case 'diagonal_ltr': return <svg className="absolute inset-0 w-full h-full"><defs><pattern id={`pp-ltr-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#pp-ltr-${color.replace('#','')})`} /></svg>;
    case 'diagonal_rtl': return <svg className="absolute inset-0 w-full h-full"><defs><pattern id={`pp-rtl-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(-60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#pp-rtl-${color.replace('#','')})`} /></svg>;
    case 'vertical': return <svg className="absolute inset-0 w-full h-full"><defs><pattern id={`pp-vert-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={16} height={20}><line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#pp-vert-${color.replace('#','')})`} /></svg>;
    case 'bubble': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="xMidYMid meet"><circle cx={15} cy={10} r={6} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={40} cy={18} r={8} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={65} cy={8} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /></svg>;
    default: return null;
  }
}

function PatternPickerField({ patterns, value, tagColor, onChange }: {
  patterns: { id: string; name: string; shape: string }[];
  value: string | null;
  tagColor: string;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = patterns.find((p) => p.id === value) || null;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div>
      <label className="text-[11px] text-zinc-500 mb-1 block">Pattern</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors relative overflow-hidden"
      >
        {selected ? (
          <>
            <InlinePatternSvg shape={selected.shape as PatternShape} color={tagColor} />
            <span className="relative z-10 truncate flex-1 text-left">{selected.name}</span>
          </>
        ) : (
          <span className="text-zinc-500 flex-1 text-left text-[11px]">Seleziona pattern...</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={cn(
              'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
              !value && 'bg-zinc-700/30'
            )}
          >
            <span className="text-zinc-400 truncate flex-1">Nessuno</span>
            {!value && (
              <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
          {patterns.map((p) => {
            const isSelected = value === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors relative overflow-hidden',
                  isSelected && 'bg-zinc-700/30'
                )}
              >
                <InlinePatternSvg shape={p.shape as PatternShape} color={tagColor} />
                <span className="relative z-10 text-zinc-300 truncate flex-1">{p.name}</span>
                {isSelected && (
                  <svg className="relative z-10 w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function TagIcon({ emoji, color, size = 14 }: { emoji: string; color: string; size?: number }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
    if (Comp) return <Comp size={size} style={{ color }} />;
  }
  if (emoji) return <span style={{ fontSize: size * 0.85, lineHeight: 1 }}>{emoji}</span>;
  return <span className="rounded-full shrink-0" style={{ width: size * 0.55, height: size * 0.55, backgroundColor: color }} />;
}

function TagPicker({ tileId, tileTags, onChanged, queryClient }: { tileId: string; tileTags: { id: string; name: string; tag_type?: string }[]; onChanged: () => void; queryClient: ReturnType<typeof useQueryClient> }) {
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Position dropdown and handle outside clicks
  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
    staleTime: 60_000,
  });
  const allTags: Tag[] = (tagsData as { data?: Tag[] })?.data || [];
  const selectedTag = tileTags[0] || null;

  // Optimistic update helper: patch tag in all cached tile queries
  const optimisticUpdateTag = (newTag: { id: string; name: string; tag_type?: string } | null) => {
    const newTags = newTag ? [{ id: newTag.id, name: newTag.name, tag_type: newTag.tag_type }] : [];
    // Update tile-detail cache
    queryClient.setQueriesData({ queryKey: ['tile-detail', tileId] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: { ...old.data, tags: newTags } };
    });
    // Update calendar-events cache
    queryClient.setQueriesData({ queryKey: ['calendar-events'] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t: any) => t.id === tileId ? { ...t, tags: newTags } : t) };
    });
    // Update tiles-calendar cache
    queryClient.setQueriesData({ queryKey: ['tiles-calendar'] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t: any) => t.id === tileId ? { ...t, tags: newTags } : t) };
    });
  };

  const handleSelect = async (tag: Tag) => {
    setToggling(tag.id);
    const isAssigned = selectedTag?.id === tag.id;
    // Optimistic: update UI immediately
    optimisticUpdateTag(isAssigned ? null : tag);
    setOpen(false);
    try {
      if (isAssigned) {
        await tagsApi.untagTile(tag.id, tileId);
      } else {
        if (selectedTag) {
          await tagsApi.untagTile(selectedTag.id, tileId);
        }
        await tagsApi.tagTiles(tag.id, [tileId]);
      }
      onChanged();
    } catch (err) {
      console.error('Tag toggle failed:', err);
      // Revert on error
      optimisticUpdateTag(isAssigned ? tag : selectedTag);
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="relative">
      <label className="text-[11px] text-zinc-500 mb-1 block">Tag</label>
      <div
        ref={triggerRef}
        className="flex items-center gap-2 min-h-[28px] bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1 cursor-pointer hover:border-zinc-600 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {selectedTag ? (
          <>
            <TagIcon
              emoji={getTypeEmoji(selectedTag.tag_type || 'topic')}
              color={getTypeColor(selectedTag.tag_type || 'topic') || '#64748B'}
              size={14}
            />
            <span className="text-xs text-zinc-200 truncate">{selectedTag.name}</span>
          </>
        ) : (
          <span className="text-[11px] text-zinc-500">Seleziona tag...</span>
        )}
      </div>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-64 overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          {allTags.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-3">Nessun tag</p>
          ) : (
            allTags.map((tag) => {
              const assigned = selectedTag?.id === tag.id;
              const busy = toggling === tag.id;
              const c = getTypeColor(tag.tag_type || 'topic') || '#64748B';
              const emoji = getTypeEmoji(tag.tag_type || 'topic');
              return (
                <button
                  key={tag.id}
                  disabled={busy}
                  onClick={() => handleSelect(tag)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                    assigned && 'bg-zinc-700/30',
                    busy && 'opacity-50'
                  )}
                >
                  <TagIcon emoji={emoji} color={c} size={14} />
                  <span className={cn('truncate flex-1', assigned ? 'text-zinc-200' : 'text-zinc-400')}>{tag.name}</span>
                  {assigned && (
                    <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function SparkEditor({
  spark,
  onDelete,
  onUpdateText,
}: {
  spark: Spark;
  onDelete: () => void;
  onUpdateText: (content: string) => void;
}) {
  const SparkIcon = SPARK_ICONS[spark.type] || IconFile;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editText, setEditText] = useState(spark.content || '');
  const textDirty = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (spark.storage_path && ['photo', 'image', 'video'].includes(spark.type)) {
      uploadApi.getSignedUrl(spark.storage_path).then((res) => {
        if (res.data?.url) setSignedUrl(res.data.url);
      }).catch(() => {});
    }
  }, [spark.storage_path, spark.type]);

  const handleDeleteClick = () => {
    if (confirmDelete) { onDelete(); setConfirmDelete(false); }
    else setConfirmDelete(true);
  };

  if (spark.type === 'text') {
    return (
      <div className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 group relative">
        <div className="flex items-center gap-1 mb-1">
          <IconFileText className="h-3 w-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase">Testo</span>
        </div>
        <textarea
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            textDirty.current = true;
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={() => { if (textDirty.current) { onUpdateText(editText); textDirty.current = false; } }}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          className="w-full bg-transparent text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none overflow-hidden"
        />
        <button
          onClick={handleDeleteClick}
          className={cn(
            'absolute top-1 right-1 p-0.5 rounded transition-all',
            confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
          )}
          title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if ((spark.type === 'photo' || spark.type === 'image') && signedUrl) {
    return (
      <div className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative">
        <img src={signedUrl} alt="" className="w-full h-32 object-cover" />
        <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-1 bg-zinc-900/80 rounded text-zinc-300 hover:text-white">
            <IconExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={handleDeleteClick}
            className={cn('p-1 rounded', confirmDelete ? 'bg-red-600 text-white' : 'bg-zinc-900/80 text-zinc-300 hover:text-red-400')}
          >
            <IconTrash className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  if (spark.type === 'video' && signedUrl) {
    return (
      <div className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative">
        <video src={signedUrl} className="w-full h-32 object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-900/70 rounded-full text-white hover:bg-zinc-900/90">
            <IconPlayerPlay className="h-5 w-5" />
          </a>
        </div>
        <button
          onClick={handleDeleteClick}
          className={cn(
            'absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
            confirmDelete ? 'bg-red-600 text-white' : 'bg-zinc-900/80 text-zinc-300 hover:text-red-400'
          )}
        >
          <IconTrash className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 flex items-center gap-2 group relative">
      <SparkIcon className="h-4 w-4 text-zinc-400 shrink-0" />
      <span className="text-xs text-zinc-400 truncate flex-1">{spark.file_name || spark.type}</span>
      {signedUrl && (
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100">
          <IconExternalLink className="h-3 w-3" />
        </a>
      )}
      <button
        onClick={handleDeleteClick}
        className={cn(
          'p-0.5 rounded transition-all',
          confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
        )}
      >
        <IconTrash className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TileSidebar({
  tileId,
  open,
  onToggle,
  invalidateKeys = ['tiles-calendar'],
}: {
  tileId: string | null;
  open: boolean;
  onToggle: () => void;
  invalidateKeys?: string[];
}) {
  const queryClient = useQueryClient();
  const { customPatterns } = usePatterns();
  const { getColor: getTypeColor } = useTagTypes();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId!),
    enabled: !!tileId,
    staleTime: 30_000,
  });

  const tile = data?.data;
  const sparks: Spark[] = (tile as Tile & { sparks?: Spark[] })?.sparks || [];

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const titleDirty = useRef(false);
  const descDirty = useRef(false);

  useEffect(() => {
    if (tile) {
      setEditTitle(tile.title || '');
      setEditDesc(tile.description || '');
      titleDirty.current = false;
      descDirty.current = false;
    }
  }, [tile?.id, tile?.title, tile?.description]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
    invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient, tileId, invalidateKeys]);

  // Optimistic: patch tile fields in all cached queries immediately
  const optimisticPatchTile = useCallback((updates: Record<string, unknown>) => {
    const patch = (t: any) => (t.id === tileId ? { ...t, ...updates } : t);
    queryClient.setQueriesData({ queryKey: ['tile-detail', tileId] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: { ...old.data, ...updates } };
    });
    queryClient.setQueriesData({ queryKey: ['calendar-events'] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map(patch) };
    });
    queryClient.setQueriesData({ queryKey: ['tiles-calendar'] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map(patch) };
    });
  }, [queryClient, tileId]);

  const updateTileMutation = useMutation({
    mutationFn: (updates: Record<string, unknown>) =>
      tilesApi.update(tileId!, updates as Parameters<typeof tilesApi.update>[1]),
    onMutate: (updates) => optimisticPatchTile(updates),
    onSuccess: invalidateAll,
  });

  const saveTitle = useCallback(() => {
    if (!titleDirty.current || !tileId) return;
    updateTileMutation.mutate({ title: editTitle.trim() });
    titleDirty.current = false;
  }, [editTitle, tileId, updateTileMutation]);

  const saveDesc = useCallback(() => {
    if (!descDirty.current || !tileId) return;
    updateTileMutation.mutate({ description: editDesc.trim() });
    descDirty.current = false;
  }, [editDesc, tileId, updateTileMutation]);

  const updateSparkMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      sparksApi.update(id, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] }),
  });

  const deleteSparkMutation = useMutation({
    mutationFn: (id: string) => sparksApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Contenuto eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || !tileId) return;
    for (const file of Array.from(files)) {
      const mime = file.type;
      let sparkType: string = 'file';
      let folder = 'files';
      if (mime.startsWith('image/')) { sparkType = 'photo'; folder = 'photos'; }
      else if (mime.startsWith('video/')) { sparkType = 'video'; folder = 'videos'; }
      else if (mime.startsWith('audio/')) { sparkType = 'audio_recording'; folder = 'audio'; }
      try {
        const uploadRes = await uploadApi.uploadFile(file, folder);
        if (!uploadRes.data) throw new Error('Upload failed');
        await sparksApi.create({
          tile_id: tileId,
          type: sparkType as Spark['type'],
          storage_path: uploadRes.data.path,
          file_name: uploadRes.data.file_name,
          mime_type: uploadRes.data.mime_type,
          file_size: uploadRes.data.file_size,
        });
        toast.success('File aggiunto');
      } catch {
        toast.error('Errore upload');
      }
    }
    invalidateAll();
  }, [tileId, invalidateAll]);

  const [showNewText, setShowNewText] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const addTextMutation = useMutation({
    mutationFn: () => sparksApi.create({ tile_id: tileId!, type: 'text', content: newTextContent.trim() }),
    onSuccess: () => {
      invalidateAll();
      setNewTextContent('');
      setShowNewText(false);
      toast.success('Testo aggiunto');
    },
  });

  return (
    <div className={cn(
      'border-l border-zinc-800 bg-zinc-900/50 transition-all duration-200 flex flex-col shrink-0',
      open ? 'w-60' : 'w-8'
    )}>
      <button
        onClick={onToggle}
        className="h-10 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0"
      >
        {open
          ? <IconLayoutSidebarRightCollapse className="h-4 w-4 text-zinc-400" />
          : <IconLayoutSidebarRightExpand className="h-4 w-4 text-zinc-400" />
        }
      </button>

      {open && (<>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {!tileId ? (
            <p className="text-xs text-zinc-500 mt-4">Seleziona un tile</p>
          ) : isLoading ? (
            <p className="text-xs text-zinc-500 mt-4">Caricamento...</p>
          ) : !tile ? (
            <p className="text-xs text-zinc-500 mt-4">Tile non trovato</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-500">Titolo</label>
                <input
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); titleDirty.current = true; }}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 mt-0.5"
                  placeholder="Titolo..."
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-500">Descrizione</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => {
                    setEditDesc(e.target.value);
                    descDirty.current = true;
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onBlur={saveDesc}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 mt-0.5 resize-none overflow-hidden"
                  placeholder="Descrizione..."
                />
              </div>

              {/* Type selector */}
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Tipo</label>
                <div className="flex flex-wrap gap-1">
                  {([
                    { value: 'none', label: 'NOTES' },
                    { value: 'anytime', label: 'TO DO' },
                    { value: 'deadline', label: 'DEADLINE' },
                    { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
                    { value: 'event', label: 'TIMED', extra: { all_day: false } },
                  ] as const).map((opt) => {
                    const isActive = opt.value === 'event'
                      ? tile.action_type === 'event' && (opt.extra.all_day ? !!tile.all_day : !tile.all_day)
                      : tile.action_type === opt.value;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const updates: Record<string, unknown> = { action_type: opt.value };
                          if (opt.value === 'event') {
                            updates.all_day = opt.extra.all_day;
                            updates.is_event = true;
                          } else {
                            updates.is_event = false;
                            updates.all_day = false;
                          }
                          updateTileMutation.mutate(updates);
                        }}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] font-medium border transition-all',
                          isActive
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-zinc-800/60 border-zinc-700 text-zinc-500 hover:border-zinc-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date/time fields — shown for deadline, all day, timed */}
              {(tile.action_type === 'deadline' || tile.action_type === 'event') && (() => {
                const dateRef = tile.action_type === 'deadline' ? tile.end_at : tile.start_at;
                const dateVal = dateRef ? toLocalInput(dateRef).slice(0, 10) : '';
                const startTime = tile.start_at ? toLocalInput(tile.start_at).slice(11, 16) : '';
                const endTime = tile.end_at ? toLocalInput(tile.end_at).slice(11, 16) : '';
                const isTimed = tile.action_type === 'event' && !tile.all_day;

                const updateDate = (newDate: string) => {
                  if (!newDate) return;
                  if (tile.action_type === 'deadline') {
                    updateTileMutation.mutate({ end_at: new Date(`${newDate}T${endTime || '23:59'}`).toISOString() });
                  } else if (isTimed) {
                    const updates: Record<string, string> = {
                      start_at: new Date(`${newDate}T${startTime || '09:00'}`).toISOString(),
                    };
                    if (endTime) updates.end_at = new Date(`${newDate}T${endTime}`).toISOString();
                    updateTileMutation.mutate(updates);
                  } else {
                    updateTileMutation.mutate({
                      start_at: new Date(`${newDate}T00:00:00`).toISOString(),
                      end_at: new Date(`${newDate}T23:59:59`).toISOString(),
                    });
                  }
                };

                return (
                  <div className="space-y-2">
                    {/* Date */}
                    <div>
                      <label className="text-[11px] text-zinc-500 mb-0.5 block">
                        {tile.action_type === 'deadline' ? 'Scadenza' : 'Data'}
                      </label>
                      <input
                        type="date"
                        value={dateVal}
                        onChange={(e) => updateDate(e.target.value)}
                        className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    {/* Start/End time — only for timed */}
                    {isTimed && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Inizio</label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => {
                              if (!e.target.value || !dateVal) return;
                              updateTileMutation.mutate({ start_at: new Date(`${dateVal}T${e.target.value}`).toISOString() });
                            }}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] text-zinc-500 mb-0.5 block">Fine</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => {
                              if (!e.target.value || !dateVal) return;
                              updateTileMutation.mutate({ end_at: new Date(`${dateVal}T${e.target.value}`).toISOString() });
                            }}
                            className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tags */}
              <TagPicker tileId={tile.id} tileTags={tile.tags || []} onChanged={invalidateAll} queryClient={queryClient} />

              {/* Status Icon */}
              <StatusIconPicker tileId={tile.id} />

              {/* Pattern */}
              {customPatterns.length > 0 && (
                <PatternPickerField
                  patterns={customPatterns}
                  value={tile.pattern_id || null}
                  tagColor={(() => {
                    const tt = tile.tags?.[0]?.tag_type || 'topic';
                    return getTypeColor(tt) || '#64748B';
                  })()}
                  onChange={(id) => updateTileMutation.mutate({ pattern_id: id })}
                />
              )}

              {/* Done */}
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!tile.is_completed} onChange={(e) => updateTileMutation.mutate({ is_completed: e.target.checked })} className="accent-green-500 w-3.5 h-3.5" />
                  <span className="text-[11px] text-zinc-400">Done</span>
                </label>
              </div>

              {/* Creato */}
              <div className="text-[11px] text-zinc-500">
                Creato: <span className="text-zinc-300">{new Date(tile.created_at).toLocaleDateString('it-IT')}</span>
              </div>

              <div className="border-t border-zinc-800" />

              <div>
                <div className="text-[11px] text-zinc-500 mb-2">Contenuti ({sparks.length})</div>
                <div className="space-y-2">
                  {sparks.map((spark) => (
                    <SparkEditor
                      key={spark.id}
                      spark={spark}
                      onDelete={() => deleteSparkMutation.mutate(spark.id)}
                      onUpdateText={(content) => updateSparkMutation.mutate({ id: spark.id, content })}
                    />
                  ))}
                </div>

                {showNewText && (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={newTextContent}
                      onChange={(e) => setNewTextContent(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 resize-y"
                      placeholder="Scrivi testo..."
                    />
                    <div className="flex gap-1">
                      <button onClick={() => newTextContent.trim() && addTextMutation.mutate()} disabled={!newTextContent.trim()} className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-40">Salva</button>
                      <button onClick={() => { setShowNewText(false); setNewTextContent(''); }} className="text-[11px] text-zinc-400 hover:text-zinc-300 px-2 py-1">Annulla</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {tileId && tile && (
          <div className="border-t border-zinc-800 px-2 py-2 shrink-0">
            <div className="flex gap-1 justify-center">
              {[
                { id: 'photo', icon: IconCamera, color: '#5B8DEF', bg: '#1A2540', accept: 'image/*' },
                { id: 'video', icon: IconVideo, color: '#E87DA0', bg: '#2D1A22', accept: 'video/*' },
                { id: 'gallery', icon: IconPhoto, color: '#AB9FF2', bg: '#241E35', accept: 'image/*' },
                { id: 'text', icon: IconEdit, color: '#6FCF97', bg: '#1A2D1E', accept: null },
                { id: 'voice', icon: IconMicrophone, color: '#EF4444', bg: '#2D1A1A', accept: 'audio/*' },
                { id: 'file', icon: IconPaperclip, color: '#F2C94C', bg: '#2D2A1A', accept: '*/*' },
              ].map((opt) => {
                const BtnIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (opt.id === 'text') {
                        setShowNewText(true);
                      } else {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.multiple = true;
                        input.accept = opt.accept || '*/*';
                        input.onchange = () => { handleFileSelect(input.files); };
                        input.click();
                      }
                    }}
                    className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                    style={{ backgroundColor: opt.bg, borderWidth: 1, borderColor: `${opt.color}40` }}
                    title={opt.id}
                  >
                    <BtnIcon style={{ color: opt.color }} className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
