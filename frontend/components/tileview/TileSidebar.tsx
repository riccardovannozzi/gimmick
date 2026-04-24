'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink, IconPin, IconBolt, IconClock, IconCalendarEvent, IconCalendar, IconMaximize, IconX } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { tilesApi, sparksApi, uploadApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';
import { useStatuses } from '@/store/statuses-store';
import { cn } from '@/lib/utils';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { readableOn } from '@/lib/palette';
import type { StatusShape } from '@/types';
import { TimePicker } from '@/components/ui/time-picker';
import { SubtaskList } from '@/components/tileview/SubtaskList';
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

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; color?: string }>>;

function TypeIconPicker({ tileId }: { tileId: string }) {
  const { icons, tileIcons, assignIcon } = useTypeIcons();
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
      <label className="text-[11px] text-zinc-500 mb-1 block">Type</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 border border-zinc-700 rounded px-2 h-8 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
        style={{ backgroundColor: current?.color ? current.color + '40' : 'rgba(39,39,42,0.6)' }}
      >
        {CurrentComp ? (
          <>
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: current?.color || '#27272A' }}>
              <CurrentComp size={12} color={readableOn(current?.color || '#27272A')} />
            </div>
            <span className="truncate flex-1 text-left">{current!.name}</span>
          </>
        ) : (
          <span className="text-zinc-500 flex-1 text-left text-[11px]">Seleziona tipo...</span>
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
                {Comp && (
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: icon.color || '#27272A' }}>
                    <Comp size={12} color={readableOn(icon.color || '#27272A')} />
                  </div>
                )}
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

function InlineStatusSvg({ shape, color }: { shape: StatusShape; color: string }) {
  const o = 0.35;
  switch (shape) {
    case 'solid': return null;
    case 'diagonal_ltr': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="none"><defs><pattern id={`pp-ltr-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect x={5} y={5} width={70} height={20} rx={2} fill={`url(#pp-ltr-${color.replace('#','')})`} /></svg>;
    case 'diagonal_rtl': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="none"><defs><pattern id={`pp-rtl-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(-60)"><line x1={0} y1={0} x2={0} y2={10} stroke={color} strokeWidth={5} strokeOpacity={o} /></pattern></defs><rect x={5} y={5} width={70} height={20} rx={2} fill={`url(#pp-rtl-${color.replace('#','')})`} /></svg>;
    case 'vertical': return <svg className="absolute inset-0 w-full h-full"><defs><pattern id={`pp-vert-${color.replace('#','')}`} patternUnits="userSpaceOnUse" width={16} height={20}><line x1={8} y1={0} x2={8} y2={20} stroke={color} strokeWidth={6} strokeOpacity={o} /></pattern></defs><rect width="100%" height="100%" fill={`url(#pp-vert-${color.replace('#','')})`} /></svg>;
    case 'bubble': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="none"><circle cx={14} cy={12} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.08} /><circle cx={28} cy={14} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={42} cy={13} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.05} /><circle cx={56} cy={15} r={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o + 0.05} /><circle cx={68} cy={13} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.08} /><circle cx={20} cy={22} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.05} /><circle cx={36} cy={20} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.1} /><circle cx={50} cy={22} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o} /><circle cx={64} cy={20} r={3} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={o - 0.1} /></svg>;
    case 'cross': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="none"><line x1={10} y1={10} x2={70} y2={20} stroke={color} strokeWidth={4} strokeOpacity={o + 0.2} strokeLinecap="round" /><line x1={70} y1={10} x2={10} y2={20} stroke={color} strokeWidth={4} strokeOpacity={o + 0.2} strokeLinecap="round" /></svg>;
    case 'hourglass': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 20 20" preserveAspectRatio="xMidYMid meet"><path d="M5,4 L15,4 L10,10 L15,16 L5,16 L10,10 Z" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>;
    case 'pause_bars': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 20 20" preserveAspectRatio="xMidYMid meet"><rect x={6.5} y={4} width={2.5} height={12} rx={0.5} fill={color} /><rect x={11} y={4} width={2.5} height={12} rx={0.5} fill={color} /></svg>;
    case 'lock': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 20 20" preserveAspectRatio="xMidYMid meet"><path d="M7,10 V7 a3,3 0 0 1 6,0 V10" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" /><rect x={5} y={10} width={10} height={7} rx={1} fill={color} /></svg>;
    case 'shade': return <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 30" preserveAspectRatio="none"><rect width={80} height={30} fill="#000000" opacity={0.5} /></svg>;
    default: return null;
  }
}

function StatusPickerField({ statuses, value, onChange }: {
  statuses: { id: string; name: string; shape: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selected = statuses.find((p) => p.id === value) || null;

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
      <label className="text-[11px] text-zinc-500 mb-1 block">Status</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 h-8 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
      >
        {selected ? (
          <>
            <div className="w-5 h-5 rounded overflow-hidden shrink-0 relative" style={{ backgroundColor: '#27272A' }}>
              <InlineStatusSvg shape={selected.shape as StatusShape} color="#a1a1aa" />
            </div>
            <span className="truncate flex-1 text-left">{selected.name}</span>
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
          {statuses.map((p) => {
            const isSelected = value === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                  isSelected && 'bg-zinc-700/30'
                )}
              >
                <div className="w-5 h-5 rounded overflow-hidden shrink-0 relative" style={{ backgroundColor: '#27272A' }}>
                  <InlineStatusSvg shape={p.shape as StatusShape} color="#a1a1aa" />
                </div>
                <span className="text-zinc-300 truncate flex-1">{p.name}</span>
                {isSelected && (
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

function TagIcon({ emoji, color, size = 14 }: { emoji: string; color: string; size?: number }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
    if (Comp) return <Comp size={size} style={{ color }} />;
  }
  if (emoji) return <span style={{ fontSize: size * 0.85, lineHeight: 1 }}>{emoji}</span>;
  return <span className="rounded-full shrink-0" style={{ width: size * 0.55, height: size * 0.55, backgroundColor: color }} />;
}

function TagPicker({ tileId, tileTags, onChanged, queryClient, invalidateKeys = [] }: { tileId: string; tileTags: { id: string; name: string; tag_type?: string }[]; onChanged: () => void; queryClient: ReturnType<typeof useQueryClient>; invalidateKeys?: string[] }) {
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
  const rootTagIds = new Set(allTags.filter((t) => t.is_root).map((t) => t.id));
  const selectedTag = tileTags.find((t) => !rootTagIds.has(t.id)) || tileTags[0] || null;

  // Optimistic update helper: patch tag in all cached tile queries
  const optimisticUpdateTag = (newTag: { id: string; name: string; tag_type?: string } | null) => {
    const newTags = newTag ? [{ id: newTag.id, name: newTag.name, tag_type: newTag.tag_type }] : [];
    const patch = (t: any) => (t.id === tileId ? { ...t, tags: newTags } : t);
    // tile-detail cache (single object)
    queryClient.setQueriesData({ queryKey: ['tile-detail', tileId] }, (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: { ...old.data, tags: newTags } };
    });
    const patchListCache = (key: string) => {
      queryClient.setQueriesData({ queryKey: [key] }, (old: any) => {
        if (!old) return old;
        if (old.pages) {
          return { ...old, pages: old.pages.map((p: any) => ({ ...p, data: (p.data || []).map(patch) })) };
        }
        if (Array.isArray(old.data)) {
          return { ...old, data: old.data.map(patch) };
        }
        return old;
      });
    };
    // Built-in caches
    patchListCache('calendar-events');
    patchListCache('tiles-calendar');
    patchListCache('tiles');
    // Caller-specific caches (kanban, canvas, etc.)
    invalidateKeys.forEach(patchListCache);
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
        className="flex items-center gap-2 h-8 bg-zinc-800/60 border border-zinc-700 rounded px-2 cursor-pointer hover:border-zinc-600 transition-colors"
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
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Close PDF modal on Escape
  useEffect(() => {
    if (!pdfModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPdfModalOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pdfModalOpen]);

  useEffect(() => {
    if (spark.storage_path && ['photo', 'image', 'video', 'file', 'audio_recording'].includes(spark.type)) {
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
      <div className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 group relative h-32 flex flex-col">
        <div className="flex items-center gap-1 mb-1 shrink-0">
          <IconFileText className="h-3 w-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-500 uppercase">Testo</span>
        </div>
        <textarea
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            textDirty.current = true;
          }}
          onBlur={() => { if (textDirty.current) { onUpdateText(editText); textDirty.current = false; } }}
          className="w-full flex-1 bg-transparent text-xs text-zinc-300 leading-relaxed resize-none focus:outline-none overflow-y-auto"
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

  // File: image preview if mime is image, otherwise icon thumbnail
  const isImageFile = spark.mime_type?.startsWith('image/');
  if (isImageFile && signedUrl) {
    return (
      <div className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative">
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img src={signedUrl} alt={spark.file_name || ''} className="w-full h-32 object-cover" />
        </a>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-900/90 to-transparent px-2 py-1">
          <span className="text-[10px] text-zinc-300 truncate block">{spark.file_name}</span>
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

  // PDF: compact thumbnail in the sidebar, click to open full-size modal
  const isPdfFile = spark.mime_type === 'application/pdf' || spark.file_name?.toLowerCase().endsWith('.pdf');
  if (isPdfFile && signedUrl) {
    return (
      <>
        <div
          onClick={() => setPdfModalOpen(true)}
          className="rounded border border-zinc-700 overflow-hidden bg-zinc-800/40 group relative cursor-zoom-in hover:border-zinc-600 transition-colors"
        >
          {/* Thumbnail — first page, interaction blocked so click falls through to wrapper */}
          <div className="relative h-24 bg-zinc-900 overflow-hidden pointer-events-none">
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
              title={spark.file_name || 'PDF'}
              className="w-full h-full border-0"
            />
            <div className="absolute inset-0" /> {/* overlay to block iframe events */}
          </div>
          <div className="flex items-center gap-2 px-2 py-1 border-t border-zinc-700/60 bg-zinc-900/70">
            <IconFileText className="h-3 w-3 text-zinc-400 shrink-0" />
            <span
              className="text-[10px] text-zinc-300 truncate flex-1"
              title={spark.file_name || ''}
            >
              {spark.file_name}
            </span>
            <IconMaximize className="h-3 w-3 text-zinc-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
            className={cn(
              'absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
              confirmDelete ? 'bg-red-600 text-white' : 'bg-zinc-900/80 text-zinc-300 hover:text-red-400'
            )}
          >
            <IconTrash className="h-3 w-3" />
          </button>
        </div>

        {/* Expand modal */}
        {pdfModalOpen && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setPdfModalOpen(false)}
          >
            <div
              className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
              style={{ width: 'min(95vw, 1100px)', height: 'min(95vh, 900px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 shrink-0">
                <IconFileText className="h-4 w-4 text-zinc-400 shrink-0" />
                <span className="text-sm font-medium text-white truncate flex-1" title={spark.file_name || ''}>
                  {spark.file_name || 'PDF'}
                </span>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  title="Apri in nuovo tab"
                >
                  <IconExternalLink className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  title="Chiudi"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
              <iframe
                src={signedUrl}
                title={spark.file_name || 'PDF'}
                className="flex-1 w-full bg-zinc-900 border-0"
              />
            </div>
          </div>,
          document.body,
        )}
      </>
    );
  }

  return (
    <a
      href={signedUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { if (!signedUrl) e.preventDefault(); }}
      className="rounded border border-zinc-700 bg-zinc-800/40 px-2.5 py-2 flex items-center gap-2 group relative hover:bg-zinc-800/70 transition-colors cursor-pointer"
    >
      <div className="w-10 h-10 rounded bg-zinc-700/50 flex items-center justify-center shrink-0">
        <SparkIcon className="h-5 w-5 text-zinc-400" />
      </div>
      <span className="text-xs text-zinc-300 truncate flex-1">{spark.file_name || spark.type}</span>
      {signedUrl && (
        <IconExternalLink className="h-3 w-3 text-zinc-500 opacity-0 group-hover:opacity-100 shrink-0" />
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(); }}
        className={cn(
          'p-0.5 rounded transition-all shrink-0',
          confirmDelete ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
        )}
      >
        <IconTrash className="h-3 w-3" />
      </button>
    </a>
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
  const { statuses: allStatuses } = useStatuses();
  const actionColors = useActionColors();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId!),
    enabled: !!tileId,
    staleTime: 30_000,
  });

  const tile = data?.data;
  const sparks: Spark[] = (tile as Tile & { sparks?: Spark[] })?.sparks || [];

  const [activeTab, setActiveTab] = useState<'edit' | 'list'>('edit');
  const [editTitle, setEditTitle] = useState('');
  const titleDirty = useRef(false);

  useEffect(() => {
    if (tile) {
      setEditTitle(tile.title || '');
      titleDirty.current = false;
    }
  }, [tile?.id, tile?.title]);

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
    const patchListCache = (key: string) => {
      queryClient.setQueriesData({ queryKey: [key] }, (old: any) => {
        if (!old) return old;
        // Paginated (infinite) cache shape
        if (old.pages) {
          return { ...old, pages: old.pages.map((p: any) => ({ ...p, data: (p.data || []).map(patch) })) };
        }
        // Flat { data: Tile[] } cache shape
        if (Array.isArray(old.data)) {
          return { ...old, data: old.data.map(patch) };
        }
        return old;
      });
    };
    // Built-in queries we always patch
    patchListCache('calendar-events');
    patchListCache('tiles-calendar');
    patchListCache('tiles');
    // Plus any caller-specific caches (kanban, canvas, etc.)
    invalidateKeys.forEach(patchListCache);
  }, [queryClient, tileId, invalidateKeys]);

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
  const [dropTargetIcon, setDropTargetIcon] = useState<string | null>(null);
  const addTextMutation = useMutation({
    mutationFn: async () => {
      if (!tileId) throw new Error('Nessun tile selezionato');
      const res = await sparksApi.create({ tile_id: tileId, type: 'text', content: newTextContent.trim() });
      if (!res.success) throw new Error(res.error || 'Errore creazione spark');
      return res;
    },
    onSuccess: () => {
      invalidateAll();
      setNewTextContent('');
      setShowNewText(false);
      toast.success('Testo aggiunto');
    },
    onError: (err: Error) => {
      console.error('[TileSidebar] addTextMutation failed:', err);
      toast.error(err.message || 'Errore salvataggio');
    },
  });

  return (
    <div className={cn(
      'border-l border-zinc-800 bg-zinc-900/50 transition-all duration-200 flex flex-col shrink-0',
      open ? 'w-60' : 'w-8'
    )}>
      {/* Header: collapse button — alone if no tile, inlined with tabs if tile selected */}
      {(!open || !tileId) && (
        <button
          onClick={onToggle}
          className="h-10 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0"
        >
          {open
            ? <IconLayoutSidebarRightCollapse className="h-4 w-4 text-zinc-400" />
            : <IconLayoutSidebarRightExpand className="h-4 w-4 text-zinc-400" />
          }
        </button>
      )}

      {open && (<>
        {/* Tab bar — collapse button inline on the left to save vertical space */}
        {tileId && (
          <div className="flex border-b border-zinc-800 shrink-0">
            <button
              onClick={onToggle}
              className="px-2 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0 border-b-2 border-transparent"
              title="Collassa sidebar"
            >
              <IconLayoutSidebarRightCollapse className="h-4 w-4 text-zinc-400" />
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={cn(
                'flex-1 text-[11px] font-medium py-2 transition-colors border-b-2',
                activeTab === 'edit'
                  ? 'text-zinc-200 border-blue-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              )}
            >
              Edit
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={cn(
                'flex-1 text-[11px] font-medium py-2 transition-colors border-b-2',
                activeTab === 'list'
                  ? 'text-zinc-200 border-blue-500'
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
              )}
            >
              List
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          {!tileId ? (
            <p className="text-xs text-zinc-500 mt-4">Seleziona un tile</p>
          ) : isLoading ? (
            <p className="text-xs text-zinc-500 mt-4">Caricamento...</p>
          ) : !tile ? (
            <p className="text-xs text-zinc-500 mt-4">Tile non trovato</p>
          ) : activeTab === 'list' ? (
            <SubtaskList tileId={tileId} />
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-500">Title</label>
                <textarea
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); titleDirty.current = true; }}
                  onBlur={saveTitle}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } }}
                  rows={2}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs leading-6 text-zinc-200 focus:outline-none focus:border-blue-500 mt-0.5 resize-none"
                  placeholder="Title..."
                />
              </div>


              {/* Type selector */}
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Action</label>
                {(() => {
                  const ac = actionColors;
                  const getBorderStyle = (at: string): React.CSSProperties => {
                    const c = (ac as Record<string, string>)[at] || '#3F3F46';
                    return { border: `1.5px solid ${c}` };
                  };
                  const allOpts = [
                    { value: 'none', label: 'NOTES', icon: IconPin },
                    { value: 'anytime', label: 'TO DO', icon: IconBolt },
                    { value: 'deadline', label: 'DEADLINE', icon: IconClock },
                    { value: 'event', label: 'ALL DAY', icon: IconCalendarEvent, extra: { all_day: true } },
                    { value: 'event', label: 'TIMED', icon: IconCalendar, extra: { all_day: false } },
                  ] as const;
                  const row1 = allOpts.slice(0, 2);
                  const row2 = allOpts.slice(2);
                  const renderBtn = (opt: typeof allOpts[number]) => {
                    const isActive = opt.value === 'event'
                      ? tile.action_type === 'event' && ((opt as any).extra?.all_day ? !!tile.all_day : !tile.all_day)
                      : tile.action_type === opt.value;
                    const OptIcon = opt.icon;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => {
                          const updates: Record<string, unknown> = { action_type: opt.value };
                          if (opt.value === 'event') {
                            updates.all_day = (opt as any).extra.all_day;
                            updates.is_event = true;
                          } else {
                            updates.is_event = false;
                            updates.all_day = false;
                          }
                          updateTileMutation.mutate(updates);
                        }}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] font-medium transition-all relative',
                          isActive
                            ? 'bg-zinc-800/60 text-zinc-200'
                            : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800 opacity-70'
                        )}
                        style={getBorderStyle(opt.value === 'event' && (opt as any).extra?.all_day ? 'allday' : opt.value)}
                      >
                        {isActive && <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-white" />}
                        <OptIcon size={11} />
                        {opt.label}
                      </button>
                    );
                  };
                  return (
                    <div className="flex flex-col" style={{ gap: 12 }}>
                      <div className="flex gap-1">{row1.map(renderBtn)}</div>
                      <div className="flex gap-1">{row2.map(renderBtn)}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Date/time fields — shown for deadline, all day, timed */}
              {(tile.action_type === 'deadline' || tile.action_type === 'event') && (() => {
                // Deadline primarily lives in end_at, but fall back to start_at so a
                // date still surfaces even when the tile is mis-scheduled (and matches
                // what the kanban column shows).
                const dateRef = tile.action_type === 'deadline'
                  ? (tile.end_at || tile.start_at)
                  : tile.start_at;
                const dateVal = dateRef ? toLocalInput(dateRef).slice(0, 10) : '';
                const startTime = tile.start_at ? toLocalInput(tile.start_at).slice(11, 16) : '';
                const endTime = tile.end_at ? toLocalInput(tile.end_at).slice(11, 16) : '';
                const isTimed = tile.action_type === 'event' && !tile.all_day;

                const safeTime = (t: string, fallback: string) => /^\d{2}:\d{2}$/.test(t) ? t : fallback;

                const updateDate = (newDate: string) => {
                  if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
                  if (tile.action_type === 'deadline') {
                    updateTileMutation.mutate({ end_at: new Date(`${newDate}T${safeTime(endTime, '23:59')}`).toISOString() });
                  } else if (isTimed) {
                    const updates: Record<string, string> = {
                      start_at: new Date(`${newDate}T${safeTime(startTime, '09:00')}`).toISOString(),
                    };
                    if (endTime) updates.end_at = new Date(`${newDate}T${safeTime(endTime, '10:00')}`).toISOString();
                    updateTileMutation.mutate(updates);
                  } else {
                    updateTileMutation.mutate({
                      start_at: new Date(`${newDate}T00:00:00`).toISOString(),
                      end_at: new Date(`${newDate}T23:59:59`).toISOString(),
                    });
                  }
                };

                return (
                  <div>
                    <div className="flex items-end justify-between">
                      {/* Date */}
                      <div className="shrink-0">
                        <label className="text-[11px] text-zinc-500 mb-0.5 block">Date</label>
                        <input
                          type="date"
                          value={dateVal}
                          onChange={(e) => updateDate(e.target.value)}
                          className="bg-zinc-800/60 border border-zinc-700 rounded px-2 h-8 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500"
                          style={{ width: 'auto', maxWidth: 110, colorScheme: 'dark' }}
                        />
                      </div>
                      {/* Start/End time — only for timed */}
                      {isTimed && (
                        <>
                          <div className="shrink-0">
                            <label className="text-[11px] text-zinc-500 mb-0.5 block">Start</label>
                            <TimePicker
                              value={startTime || '09:00'}
                              onChange={(t) => { if (dateVal) updateTileMutation.mutate({ start_at: new Date(`${dateVal}T${t}`).toISOString() }); }}
                              compact
                            />
                          </div>
                          <div className="shrink-0">
                            <label className="text-[11px] text-zinc-500 mb-0.5 block">End</label>
                            <TimePicker
                              value={endTime || '10:00'}
                              onChange={(t) => { if (dateVal) updateTileMutation.mutate({ end_at: new Date(`${dateVal}T${t}`).toISOString() }); }}
                              compact
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Tags */}
              <TagPicker tileId={tile.id} tileTags={tile.tags || []} onChanged={invalidateAll} queryClient={queryClient} invalidateKeys={invalidateKeys} />

              {/* Type Icon */}
              <TypeIconPicker tileId={tile.id} />

              {/* Status */}
              {allStatuses.length > 0 && (
                <StatusPickerField
                  statuses={allStatuses}
                  value={tile.status_id || null}
                  onChange={(id) => updateTileMutation.mutate({ status_id: id })}
                />
              )}

              <div className="border-t border-zinc-800" />

              <div>
                <div className="text-[11px] text-zinc-500 mb-2">Sparks ({sparks.length})</div>
                <div className="flex gap-1 justify-center mb-3">
                  {[
                    { id: 'photo', icon: IconCamera, color: '#5B8DEF', bg: '#1A2540', accept: 'image/*' },
                    { id: 'video', icon: IconVideo, color: '#E87DA0', bg: '#2D1A22', accept: 'video/*' },
                    { id: 'gallery', icon: IconPhoto, color: '#AB9FF2', bg: '#241E35', accept: 'image/*' },
                    { id: 'text', icon: IconEdit, color: '#6FCF97', bg: '#1A2D1E', accept: null },
                    { id: 'voice', icon: IconMicrophone, color: '#EF4444', bg: '#2D1A1A', accept: 'audio/*' },
                    { id: 'file', icon: IconPaperclip, color: '#F2C94C', bg: '#2D2A1A', accept: '*/*' },
                  ].map((opt) => {
                    const BtnIcon = opt.icon;
                    const isDropTarget = dropTargetIcon === opt.id;
                    const acceptsDrop = opt.id !== 'text';
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
                        onDragOver={acceptsDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } : undefined}
                        onDragEnter={acceptsDrop ? (e) => { e.preventDefault(); setDropTargetIcon(opt.id); } : undefined}
                        onDragLeave={acceptsDrop ? () => setDropTargetIcon((v) => (v === opt.id ? null : v)) : undefined}
                        onDrop={acceptsDrop ? (e) => {
                          e.preventDefault();
                          setDropTargetIcon(null);
                          if (e.dataTransfer.files?.length) handleFileSelect(e.dataTransfer.files);
                        } : undefined}
                        className={cn(
                          'w-8 h-8 rounded flex items-center justify-center transition-all',
                          isDropTarget && 'ring-2 ring-offset-1 ring-offset-zinc-900/50 scale-110',
                        )}
                        style={{
                          backgroundColor: opt.bg,
                          borderWidth: 1,
                          borderColor: isDropTarget ? opt.color : `${opt.color}40`,
                          ...(isDropTarget ? { boxShadow: `0 0 0 2px ${opt.color}` } : {}),
                        }}
                        title={opt.id}
                      >
                        <BtnIcon style={{ color: opt.color }} className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
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
          <div className="px-3 py-2 shrink-0 text-right">
            <span className="text-[11px] text-zinc-500">Created: {new Date(tile.created_at).toLocaleDateString('it-IT')}</span>
          </div>
        )}
      </>)}
    </div>
  );
}
