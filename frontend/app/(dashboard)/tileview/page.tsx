'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconCalendarEvent, IconClock, IconChecklist, IconNote, IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconPhoto, IconVideo, IconMicrophone, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink, IconCamera, IconEdit, IconPaperclip } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { tilesApi, sparksApi, uploadApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { cn } from '@/lib/utils';
import type { Tile, Spark } from '@/types';

// ─── Constants ───
const FALLBACK_COLOR = '#94A3B8';

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
const BAND_COLORS = {
  events: '#D85A30',
  deadlines: '#BA7517',
  todos: '#94A3B8',
};

// ─── Helpers ───
function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (target.getTime() - today.getTime()) / 86400000;
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Domani';
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function getDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function generateDays(count: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
}

function groupByDay(tiles: Tile[], dateField: 'start_at' | 'end_at'): Record<string, Tile[]> {
  const groups: Record<string, Tile[]> = {};
  tiles.forEach((t) => {
    const val = dateField === 'start_at' ? t.start_at : t.end_at;
    if (!val) return;
    const day = getDayKey(val);
    if (!groups[day]) groups[day] = [];
    groups[day].push(t);
  });
  return groups;
}

// ─── SVG Patterns ───
function TilePattern({ actionType, color }: { actionType: string; color: string }) {
  // Patterns are positioned below the header (top-4) and above the footer (bottom-3)
  const svgClass = "absolute top-4 bottom-3 left-0 right-0 w-full";
  switch (actionType) {
    case 'none':
      return null;
    case 'anytime':
      return null;
    case 'deadline':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <line x1={-10} y1={0} x2={80} y2={78} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={10} y1={-10} x2={100} y2={68} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={-30} y1={0} x2={60} y2={78} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={30} y1={-10} x2={120} y2={68} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={50} y1={-10} x2={140} y2={68} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </svg>
      );
    case 'event':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="none">
          <line x1={80} y1={0} x2={-10} y2={78} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={100} y1={0} x2={10} y2={78} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={60} y1={-10} x2={-20} y2={68} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={120} y1={0} x2={30} y2={78} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={40} y1={-10} x2={-40} y2={68} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </svg>
      );
    case 'call_to_action':
      return (
        <svg className={svgClass} viewBox="0 0 80 68" preserveAspectRatio="xMidYMid meet">
          <circle cx={40} cy={34} r={20} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={12} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={34} r={4} fill={color} fillOpacity={0.4} />
        </svg>
      );
    default:
      return null;
  }
}

function CompletedPattern({ color }: { color: string }) {
  return (
    <svg className="absolute top-4 bottom-3 left-0 right-0 w-full" viewBox="0 0 80 68" preserveAspectRatio="none">
      <line x1={10} y1={6} x2={70} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
      <line x1={70} y1={6} x2={10} y2={62} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
    </svg>
  );
}

// ─── TileSquare ───
function TagTypeIcon({ emoji, size = 10 }: { emoji: string; size?: number }) {
  if (emoji && emoji.startsWith('Icon')) {
    const TablerIcons = require('@tabler/icons-react');
    const Comp = TablerIcons[emoji];
    if (Comp) return <Comp size={size} className="shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }} />;
  }
  if (emoji) return <span style={{ fontSize: size * 0.8 }}>{emoji}</span>;
  return null;
}

function getSparkCounts(tile: Tile): Record<string, number> {
  const counts: Record<string, number> = {};
  (tile.sparks || []).forEach((s) => {
    counts[s.type] = (counts[s.type] || 0) + 1;
  });
  return counts;
}

const SPARK_TYPE_ICONS: Record<string, { icon: typeof IconCamera; color: string }> = {
  photo: { icon: IconCamera, color: '#5B8DEF' },
  image: { icon: IconPhoto, color: '#AB9FF2' },
  video: { icon: IconVideo, color: '#E87DA0' },
  audio_recording: { icon: IconMicrophone, color: '#EF4444' },
  text: { icon: IconEdit, color: '#6FCF97' },
  file: { icon: IconPaperclip, color: '#F2C94C' },
};

function TileSquare({
  title,
  subtitle,
  color,
  actionType,
  completed,
  highlight,
  tagIcon,
  tagName,
  selected,
  onClick,
  sparkCounts,
}: {
  title: string;
  subtitle?: string;
  color: string;
  actionType: string;
  completed: boolean;
  highlight?: boolean;
  tagIcon?: string;
  tagName?: string;
  selected?: boolean;
  onClick?: () => void;
  sparkCounts?: Record<string, number>;
}) {
  const countEntries = sparkCounts ? Object.entries(sparkCounts).filter(([, c]) => c > 0) : [];

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative w-24 h-24 rounded-sm overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform',
        completed && 'opacity-50',
        selected && 'ring-2 ring-blue-500'
      )}
      style={{
        border: highlight ? '1.5px solid #E24B4A' : '0.5px solid #3f3f46',
      }}
    >
      {/* Color stripe with tag icon + name */}
      <div className="absolute top-0 left-0 right-0 h-4 flex items-center gap-1 px-1.5" style={{ backgroundColor: color }}>
        {tagIcon && <TagTypeIcon emoji={tagIcon} size={10} />}
        {tagName && <span className="text-[9px] truncate font-semibold" style={{ color: isLightColor(color) ? '#1a1a1a' : '#ffffff' }}>{tagName}</span>}
      </div>
      {/* Pattern */}
      {completed ? <CompletedPattern color={color} /> : <TilePattern actionType={actionType} color={color} />}
      {/* Text */}
      <div className="absolute inset-0 flex flex-col justify-start p-1.5 pt-6">
        <span className={cn('text-[10px] font-medium text-zinc-400 leading-tight line-clamp-2', completed && 'line-through')}>
          {title}
        </span>
        {subtitle && (
          <span className="text-[9px] text-zinc-400 leading-tight truncate">{subtitle}</span>
        )}
      </div>
      {/* Footer — spark type icons + counts */}
      {countEntries.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1.5 py-0.5">
          {countEntries.map(([type, count]) => {
            const cfg = SPARK_TYPE_ICONS[type];
            if (!cfg) return null;
            const SIcon = cfg.icon;
            return (
              <div key={type} className="flex items-center gap-px">
                <SIcon className="h-2.5 w-2.5" style={{ color: cfg.color }} />
                {count > 1 && <span className="text-[8px] text-zinc-500">{count}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Day Separator ───
function DaySeparator({ label, today }: { label: string; today: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 mx-2 shrink-0 h-16 justify-center">
      <div className={cn('w-px h-full', today ? 'bg-blue-500' : 'bg-zinc-700')} />
      <span
        className={cn(
          'text-[10px] uppercase tracking-wider whitespace-nowrap -rotate-90 origin-center',
          today ? 'text-white font-semibold' : 'text-zinc-500'
        )}
        style={{ width: 50, textAlign: 'center' }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Band Header ───
function BandHeader({ color, label, icon: Icon, badge }: { color: string; label: string; icon: typeof IconCalendarEvent; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <Icon className="h-4 w-4" style={{ color }} />
      <span className="text-xs font-bold tracking-widest text-zinc-300">{label}</span>
      {badge && <span className="text-xs text-zinc-500 ml-auto">{badge}</span>}
    </div>
  );
}

// ─── Horizontal Band (Events / Deadlines) ───
function HorizontalBand({
  tiles,
  dateField,
  actionType,
  getTagColor,
  getTagInfo,
  selectedId,
  onTileClick,
}: {
  tiles: Tile[];
  dateField: 'start_at' | 'end_at';
  actionType: 'event' | 'deadline';
  getTagColor: (tile: Tile) => string;
  getTagInfo: (tile: Tile) => { icon: string; name: string };
  selectedId?: string | null;
  onTileClick?: (id: string) => void;
}) {
  const days = useMemo(() => generateDays(14), []);
  const grouped = useMemo(() => groupByDay(tiles, dateField), [tiles, dateField]);

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center px-3 min-h-[112px] gap-1">
        {days.map((day) => {
          const dayTiles = grouped[day] || [];
          const today = isToday(day);
          return (
            <div key={day} className="flex items-center gap-1">
              <DaySeparator label={formatDay(day)} today={today} />
              {dayTiles.map((tile) => {
                const tileColor = getTagColor(tile);
                const deadlineToday = actionType === 'deadline' && isToday(tile.start_at || '');
                let subtitle: string | undefined;
                if (actionType === 'event' && tile.start_at) {
                  subtitle = formatTime(tile.start_at);
                } else if (actionType === 'deadline') {
                  if (isToday(tile.start_at || '')) subtitle = 'Scade oggi';
                  else {
                    const d = new Date(tile.start_at || '');
                    const now = new Date();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    if (d.toDateString() === tomorrow.toDateString()) subtitle = 'Scade domani';
                    else subtitle = `Scade ${d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}`;
                  }
                }
                const info = getTagInfo(tile);
                return (
                  <TileSquare
                    key={tile.id}
                    title={tile.title || 'Senza titolo'}
                    subtitle={subtitle}
                    color={tileColor}
                    actionType={actionType}
                    completed={!!tile.is_completed}
                    highlight={deadlineToday}
                    tagIcon={info.icon}
                    tagName={info.name}
                    selected={selectedId === tile.id}
                    onClick={() => onTileClick?.(tile.id)}
                    sparkCounts={getSparkCounts(tile)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Todo Band (with drag-and-drop reorder) ───
function TodoBand({
  tiles,
  getTagColor,
  getTagInfo,
  draggable = false,
  selectedId,
  onTileClick,
}: {
  tiles: Tile[];
  getTagColor: (tile: Tile) => string;
  getTagInfo: (tile: Tile) => { icon: string; name: string };
  draggable?: boolean;
  selectedId?: string | null;
  onTileClick?: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overInfo, setOverInfo] = useState<{ id: string; side: 'left' | 'right' } | null>(null);

  const sorted = useMemo(() => {
    const withOrder = tiles.map((t, i) => ({ ...t, _order: t.sort_order ?? i }));
    const active = withOrder.filter((t) => !t.is_completed).sort((a, b) => a._order - b._order);
    const done = withOrder.filter((t) => t.is_completed).sort((a, b) => a._order - b._order);
    return [...active, ...done];
  }, [tiles]);

  const saveMutation = useMutation({
    mutationFn: async (reordered: { id: string; sort_order: number }[]) => {
      await Promise.all(reordered.map((r) => tilesApi.update(r.id, { sort_order: r.sort_order })));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tiles-tileview'] }),
  });

  const handleDrop = useCallback((targetId: string, side: 'left' | 'right') => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverInfo(null); return; }
    const ids = sorted.map((t) => t.id);
    const fromIdx = ids.indexOf(dragId);
    let toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    // Adjust index: if dropping on the right side, insert after
    if (side === 'right') toIdx = Math.min(toIdx + 1, ids.length);
    else toIdx = Math.max(0, toIdx);
    // Recalculate toIdx after removal
    if (fromIdx < toIdx) toIdx--;
    ids.splice(toIdx, 0, dragId);
    const reordered = ids.map((id, i) => ({ id, sort_order: i }));
    saveMutation.mutate(reordered);
    setDragId(null);
    setOverInfo(null);
  }, [dragId, sorted, saveMutation]);

  return (
    <div className="flex flex-wrap gap-1.5 px-3 py-2">
      {sorted.length === 0 ? (
        <span className="text-xs text-zinc-500 py-4 px-2">Nessun task</span>
      ) : (
        sorted.map((tile) => {
          const tileColor = getTagColor(tile);
          const info = getTagInfo(tile);
          const isDragging = dragId === tile.id;
          const showLeft = overInfo?.id === tile.id && overInfo.side === 'left' && dragId !== tile.id;
          const showRight = overInfo?.id === tile.id && overInfo.side === 'right' && dragId !== tile.id;
          return (
            <div
              key={tile.id}
              className="flex items-stretch"
            >
              {/* Left drop indicator */}
              <div className={cn('w-0.5 shrink-0 rounded-full transition-all', showLeft ? 'bg-blue-500' : 'bg-transparent')} />
              <div
                draggable={draggable && !tile.is_completed}
                onDragStart={() => setDragId(tile.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const midX = rect.left + rect.width / 2;
                  setOverInfo({ id: tile.id, side: e.clientX < midX ? 'left' : 'right' });
                }}
                onDragLeave={() => setOverInfo(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const midX = rect.left + rect.width / 2;
                  handleDrop(tile.id, e.clientX < midX ? 'left' : 'right');
                }}
                onDragEnd={() => { setDragId(null); setOverInfo(null); }}
                className={cn(
                  'transition-all',
                  isDragging && 'opacity-30 scale-95',
                )}
              >
              <TileSquare
                title={tile.title || 'Senza titolo'}
                color={tileColor}
                actionType={tile.is_cta ? 'call_to_action' : (tile.action_type || 'none')}
                completed={!!tile.is_completed}
                tagIcon={info.icon}
                tagName={info.name}
                selected={selectedId === tile.id}
                onClick={() => onTileClick?.(tile.id)}
                sparkCounts={getSparkCounts(tile)}
              />
              </div>
              {/* Right drop indicator */}
              <div className={cn('w-0.5 shrink-0 rounded-full transition-all', showRight ? 'bg-blue-500' : 'bg-transparent')} />
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Spark type icons ───
const SPARK_ICONS: Record<string, typeof IconFileText> = {
  photo: IconPhoto,
  image: IconPhoto,
  video: IconVideo,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

// ─── Tile Sidebar (Editor) ───
function TileSidebar({
  tileId,
  open,
  onToggle,
}: {
  tileId: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId!),
    enabled: !!tileId,
    staleTime: 30_000,
  });

  const tile = data?.data;
  const sparks: Spark[] = (tile as Tile & { sparks?: Spark[] })?.sparks || [];

  // Title edit
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

  const updateTileMutation = useMutation({
    mutationFn: (updates: { title?: string; description?: string }) =>
      tilesApi.update(tileId!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
      queryClient.invalidateQueries({ queryKey: ['tiles-tileview'] });
    },
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

  // Spark text edit
  const updateSparkMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      sparksApi.update(id, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] }),
  });

  // Delete spark
  const deleteSparkMutation = useMutation({
    mutationFn: (id: string) => sparksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
      queryClient.invalidateQueries({ queryKey: ['tiles-tileview'] });
      toast.success('Contenuto eliminato');
    },
    onError: () => toast.error('Errore eliminazione'),
  });

  // Add spark (file upload)
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
    queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
    queryClient.invalidateQueries({ queryKey: ['tiles-tileview'] });
  }, [tileId, queryClient]);

  // Add text spark
  const [showNewText, setShowNewText] = useState(false);
  const [newTextContent, setNewTextContent] = useState('');
  const addTextMutation = useMutation({
    mutationFn: () => sparksApi.create({ tile_id: tileId!, type: 'text', content: newTextContent.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tile-detail', tileId] });
      queryClient.invalidateQueries({ queryKey: ['tiles-tileview'] });
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
      {/* Toggle button */}
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
              {/* Title (editable) */}
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

              {/* Description (editable) */}
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

              {/* Meta (read-only) */}
              <div className="space-y-1 text-[11px] text-zinc-500">
                {tile.action_type && tile.action_type !== 'none' && (
                  <div>Azione: <span className="text-zinc-300">{tile.action_type}</span></div>
                )}
                {tile.start_at && (
                  <div>Inizio: <span className="text-zinc-300">{new Date(tile.start_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                )}
                {tile.end_at && (
                  <div>Fine: <span className="text-zinc-300">{new Date(tile.end_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                )}
                <div>Creato: <span className="text-zinc-300">{new Date(tile.created_at).toLocaleDateString('it-IT')}</span></div>
              </div>

              {/* Tags */}
              {tile.tags && tile.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tile.tags.map((tag) => (
                    <span key={tag.id} className="text-[11px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">{tag.name}</span>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-zinc-800" />

              {/* Sparks */}
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

                {/* New text spark */}
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
                      <button
                        onClick={() => newTextContent.trim() && addTextMutation.mutate()}
                        disabled={!newTextContent.trim()}
                        className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-40"
                      >
                        Salva
                      </button>
                      <button
                        onClick={() => { setShowNewText(false); setNewTextContent(''); }}
                        className="text-[11px] text-zinc-400 hover:text-zinc-300 px-2 py-1"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </div>

        {/* Capture buttons — fixed bottom */}
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

// ─── Spark Editor ───
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

  // Text spark — auto-expand textarea
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

  // Photo/Image
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

  // Video
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

  // Audio / File / fallback
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

// ─── Main Page ───
export default function TileViewPage() {
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const [splitPercent, setSplitPercent] = useState(50);
  const splitDragging = useRef(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const getTagColor = (tile: Tile): string => {
    const tagType = tile.tags?.[0]?.tag_type || '';
    if (tagType) {
      const c = getTypeColor(tagType);
      if (c) return c;
    }
    return FALLBACK_COLOR;
  };

  const getTagInfo = (tile: Tile): { icon: string; name: string } => {
    const tag = tile.tags?.[0];
    if (!tag) return { icon: '', name: '' };
    const tagType = tag.tag_type || '';
    return { icon: tagType ? getTypeEmoji(tagType) : '', name: tag.name };
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tiles-tileview'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    staleTime: 60_000,
  });

  const allTiles = data?.data || [];

  const { events, deadlines, todos, notes } = useMemo(() => {
    const events: Tile[] = [];
    const deadlines: Tile[] = [];
    const todos: Tile[] = [];
    const notes: Tile[] = [];
    allTiles.forEach((t) => {
      if (t.action_type === 'event') events.push(t);
      else if (t.action_type === 'deadline') deadlines.push(t);
      else if (t.action_type === 'anytime') todos.push(t);
      else notes.push(t);
    });
    return { events, deadlines, todos, notes };
  }, [allTiles]);

  const activeTodos = todos.filter((t) => !t.is_completed).length;

  const handleTileClick = useCallback((id: string) => {
    setSelectedTileId(id);
    if (!sidebarOpen) setSidebarOpen(true);
  }, [sidebarOpen]);

  return (
    <div className="flex flex-col h-full">
      <Header title="Timeline" />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-zinc-400">Caricamento...</span>
            </div>
          ) : (
            <div className="py-4 divide-y divide-zinc-800">
              {/* Band 1 — Events */}
              <div className="py-4">
                <BandHeader color={BAND_COLORS.events} label="EVENTI" icon={IconCalendarEvent} />
                <HorizontalBand
                  tiles={events}
                  dateField="start_at"
                  actionType="event"
                  getTagColor={getTagColor}
                  getTagInfo={getTagInfo}
                  selectedId={selectedTileId}
                  onTileClick={handleTileClick}
                />
              </div>

              {/* Band 2 — Deadlines */}
              <div className="py-4">
                <BandHeader color={BAND_COLORS.deadlines} label="SCADENZE" icon={IconClock} />
                <HorizontalBand
                  tiles={deadlines}
                  dateField="start_at"
                  actionType="deadline"
                  getTagColor={getTagColor}
                  getTagInfo={getTagInfo}
                  selectedId={selectedTileId}
                  onTileClick={handleTileClick}
                />
              </div>

              {/* Band 3 — Todos + Notes side by side */}
              <div className="py-4 flex" style={{ minHeight: 200 }}>
                {/* Left: Da fare */}
                <div style={{ width: `${splitPercent}%` }} className="overflow-hidden">
                  <BandHeader color={BAND_COLORS.todos} label="DA FARE" icon={IconChecklist} badge={`${activeTodos} attivi`} />
                  <TodoBand tiles={todos} getTagColor={getTagColor} getTagInfo={getTagInfo} draggable selectedId={selectedTileId} onTileClick={handleTileClick} />
                </div>

                {/* Resize handle */}
                <div
                  className="w-1 cursor-col-resize hover:bg-blue-500/40 bg-zinc-800 transition-colors shrink-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    splitDragging.current = true;
                    const container = (e.target as HTMLElement).parentElement!;
                    const startX = e.clientX;
                    const startPercent = splitPercent;
                    const containerWidth = container.offsetWidth;
                    const onMove = (ev: MouseEvent) => {
                      if (!splitDragging.current) return;
                      const diff = ev.clientX - startX;
                      const newPercent = Math.max(20, Math.min(80, startPercent + (diff / containerWidth) * 100));
                      setSplitPercent(newPercent);
                    };
                    const onUp = () => {
                      splitDragging.current = false;
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                      document.body.style.cursor = '';
                      document.body.style.userSelect = '';
                    };
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                />

                {/* Right: Appunti */}
                <div style={{ width: `${100 - splitPercent}%` }} className="overflow-hidden">
                  <BandHeader color="#64748B" label="APPUNTI" icon={IconNote} badge={`${notes.length}`} />
                  <TodoBand tiles={notes} getTagColor={getTagColor} getTagInfo={getTagInfo} draggable selectedId={selectedTileId} onTileClick={handleTileClick} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <TileSidebar
          tileId={selectedTileId}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>
    </div>
  );
}
