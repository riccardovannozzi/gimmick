'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconCalendarEvent, IconClock, IconChecklist, IconNote } from '@tabler/icons-react';
import { Header } from '@/components/layout/header';
import { tilesApi } from '@/lib/api';
import { useTagTypes } from '@/store/tag-types-store';
import { cn } from '@/lib/utils';
import type { Tile } from '@/types';

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
  switch (actionType) {
    case 'none':
      return null;
    case 'anytime':
      return null;
    case 'deadline':
      return (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
          <line x1={-10} y1={0} x2={80} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={10} y1={-10} x2={100} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={-30} y1={0} x2={60} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={30} y1={-10} x2={120} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={50} y1={-10} x2={140} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </svg>
      );
    case 'event':
      return (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
          <line x1={80} y1={0} x2={-10} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={100} y1={0} x2={10} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={60} y1={-10} x2={-20} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={120} y1={0} x2={30} y2={90} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
          <line x1={40} y1={-10} x2={-40} y2={80} stroke={color} strokeWidth={5} strokeOpacity={0.18} />
        </svg>
      );
    case 'call_to_action':
      return (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
          <circle cx={40} cy={40} r={22} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={40} r={13} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.3} />
          <circle cx={40} cy={40} r={5} fill={color} fillOpacity={0.4} />
        </svg>
      );
    default:
      return null;
  }
}

function CompletedPattern({ color }: { color: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
      <line x1={10} y1={10} x2={70} y2={70} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
      <line x1={70} y1={10} x2={10} y2={70} stroke={color} strokeWidth={5} strokeOpacity={0.4} strokeLinecap="round" />
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

function TileSquare({
  title,
  subtitle,
  color,
  actionType,
  completed,
  highlight,
  tagIcon,
  tagName,
}: {
  title: string;
  subtitle?: string;
  color: string;
  actionType: string;
  completed: boolean;
  highlight?: boolean;
  tagIcon?: string;
  tagName?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-24 h-24 rounded-sm overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-transform',
        completed && 'opacity-50'
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
      <div className="absolute inset-0 flex flex-col justify-end p-1.5 pt-3">
        <span className={cn('text-[10px] font-medium text-zinc-400 leading-tight line-clamp-2', completed && 'line-through')}>
          {title}
        </span>
        {subtitle && (
          <span className="text-[9px] text-zinc-400 leading-tight truncate">{subtitle}</span>
        )}
      </div>
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
}: {
  tiles: Tile[];
  dateField: 'start_at' | 'end_at';
  actionType: 'event' | 'deadline';
  getTagColor: (tile: Tile) => string;
  getTagInfo: (tile: Tile) => { icon: string; name: string };
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
}: {
  tiles: Tile[];
  getTagColor: (tile: Tile) => string;
  getTagInfo: (tile: Tile) => { icon: string; name: string };
  draggable?: boolean;
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

// ─── Main Page ───
export default function TileViewPage() {
  const { getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();
  const [splitPercent, setSplitPercent] = useState(50);
  const splitDragging = useRef(false);

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

  return (
    <div className="flex flex-col h-full">
      <Header title="Timeline" />

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
              />
            </div>

            {/* Band 3 — Todos + Notes side by side */}
            <div className="py-4 flex" style={{ minHeight: 200 }}>
              {/* Left: Da fare */}
              <div style={{ width: `${splitPercent}%` }} className="overflow-hidden">
                <BandHeader color={BAND_COLORS.todos} label="DA FARE" icon={IconChecklist} badge={`${activeTodos} attivi`} />
                <TodoBand tiles={todos} getTagColor={getTagColor} getTagInfo={getTagInfo} draggable />
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
                <TodoBand tiles={notes} getTagColor={getTagColor} getTagInfo={getTagInfo} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
