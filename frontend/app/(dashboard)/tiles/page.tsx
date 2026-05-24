'use client';

import { useState, useMemo, Fragment, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IconLayoutGrid, IconTrash, IconFileText, IconPhoto, IconMicrophone, IconMovie, IconFile, IconPaperclip, IconX, IconCheck, IconChecks, IconPin, IconBolt, IconClock, IconCalendar, IconCalendarEvent, IconSparkles, IconChevronDown, IconFilter, IconSearch, IconFocus, IconTarget, IconPlus } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePixelTheme, PixelCard, PixelButton, PixelBadge } from '@/components/pixel';
import { pixelToolbarBtn } from '@/lib/pixel-toolbar';
import type { CaptureKey } from '@/lib/pixel-theme';
import { useFilterStore } from '@/store/filter-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { tilesApi, tagsApi, uploadApi } from '@/lib/api';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { useActionColors } from '@/store/action-colors-store';
import { typeLabels } from '@/lib/spark-utils';
import { readableOn } from '@/lib/palette';

import type { Spark, SparkType, Tile, Tag, ActionType, StatusShape } from '@/types';
import { StatusPattern } from '@/components/statuses/status-pattern';
import { ActionBadge } from '@/components/actions/action-badge';
import { TileDetailModal } from '@/components/tiles/tile-detail-modal';
import { TileSidebar } from '@/components/tileview/TileSidebar';
import { useTagTypes } from '@/store/tag-types-store';
import { useTypeIcons } from '@/store/type-icons-store';
import { useStatuses } from '@/store/statuses-store';
// helper inline: a tile is "done" when status_id points to the system 'done' row
const isTileDone = (tile: Tile, doneStatusId: string | undefined) =>
  !!doneStatusId && tile.status_id === doneStatusId;
import { TimePicker } from '@/components/ui/time-picker';

// Helper: render emoji string or Tabler icon component
function TagTypeIcon({ emoji, size = 16, color }: { emoji: string; size?: number; color?: string }) {
  if (emoji.startsWith('Icon')) {
    const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
    if (Comp) return <Comp size={size} style={color ? { color } : { color: '#D4D4D8' }} />;
  }
  return <span style={{ fontSize: size * 0.8, color: color || undefined }}>{emoji}</span>;
}

const ACTION_TYPE_BADGE: Record<ActionType, { icon: typeof IconPin; label: string }> = {
  none: { icon: IconPin, label: 'Notes' },
  anytime: { icon: IconBolt, label: 'To Do' },
  deadline: { icon: IconClock, label: 'Due' },
  event: { icon: IconCalendar, label: 'Timed' },
  allday: { icon: IconCalendarEvent, label: 'All Day' },
};

const SPARK_TYPE_OPTIONS: { value: SparkType; label: string }[] = [
  { value: 'photo', label: 'Foto' },
  { value: 'image', label: 'Immagine' },
  { value: 'video', label: 'Video' },
  { value: 'audio_recording', label: 'Audio' },
  { value: 'text', label: 'Testo' },
  { value: 'file', label: 'File' },
];

// --- Filter popup wrapper ---
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
        border: `2px solid ${theme.border}`,
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

// --- Filterable header ---
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
      className={cn('relative', className)}
      style={{
        width, minWidth: width, maxWidth: width,
        background: theme.surfaceVariant,
        borderRight: `2px solid ${theme.border}`,
        borderBottom: `2px solid ${theme.border}`,
      }}
    >
      <button
        onClick={onToggleFilter}
        className="flex items-center gap-1 w-full text-left"
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink2,
        }}
      >
        <span className="truncate">{label}</span>
        <IconFilter
          size={11}
          className="shrink-0"
          style={{ color: hasActiveFilter ? theme.accent : theme.ink3 }}
        />
      </button>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize z-10 transition-colors"
        style={{
          right: -2,
          width: 5,
          background: 'transparent',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${theme.accent}66`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      />
    </TableHead>
  );
}

function formatActionSubtitle(tile: Tile): string | null {
  if (!tile.start_at) return null;
  const d = new Date(tile.start_at);
  const dateStr = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  if (tile.action_type === 'deadline') {
    return `entro il ${dateStr}`;
  }
  if (tile.action_type === 'event') {
    if (tile.all_day) return `${dateStr} \u00b7 tutto il giorno`;
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    let dur = '';
    if (tile.end_at) {
      const mins = Math.round((new Date(tile.end_at).getTime() - d.getTime()) / 60000);
      if (mins < 60) dur = `${mins}min`;
      else if (mins % 60 === 0) dur = `${mins / 60}h`;
      else dur = `${Math.floor(mins / 60)}h${mins % 60}`;
    }
    return [dateStr, time, dur].filter(Boolean).join(' \u00b7 ');
  }
  return null;
}

function InlineActionDropdown({
  tile,
  onUpdate,
}: {
  tile: Tile;
  onUpdate: (data: { action_type: ActionType; start_at?: string | null; end_at?: string | null; is_event?: boolean; all_day?: boolean }) => void;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'deadline' | 'event' | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Date picker state
  const [pickerDate, setPickerDate] = useState('');
  const [pickerTime, setPickerTime] = useState('09:00');
  const [pickerEndTime, setPickerEndTime] = useState('10:00');
  const [pickerAllDay, setPickerAllDay] = useState(false);

  useEffect(() => {
    if (!open && !pickerMode) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setPickerMode(null);
      }
    };
    const handleScroll = () => { setOpen(false); setPickerMode(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open, pickerMode]);

  const computePos = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) computePos();
    setOpen(!open);
    setPickerMode(null);
  };

  const handleSelectOption = (opt: ActionType) => {
    setOpen(false);
    if (opt === 'none' || opt === 'anytime') {
      onUpdate({ action_type: opt, start_at: null, end_at: null, is_event: false, all_day: false });
    } else {
      // Show date picker
      const today = new Date().toISOString().slice(0, 10);
      setPickerDate(tile.start_at ? new Date(tile.start_at).toISOString().slice(0, 10) : today);
      if (tile.start_at) {
        const d = new Date(tile.start_at);
        setPickerTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setPickerTime('09:00');
      }
      if (tile.end_at) {
        const d = new Date(tile.end_at);
        setPickerEndTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setPickerEndTime('10:00');
      }
      setPickerAllDay(tile.all_day ?? false);
      setPickerMode(opt === 'deadline' ? 'deadline' : 'event');
      computePos();
    }
  };

  const handlePickerConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pickerMode === 'deadline') {
      const startAt = new Date(`${pickerDate}T23:59:59`);
      onUpdate({ action_type: 'deadline', start_at: startAt.toISOString(), end_at: null, is_event: false, all_day: true });
    } else {
      const startAt = pickerAllDay
        ? new Date(`${pickerDate}T00:00:00`)
        : new Date(`${pickerDate}T${pickerTime}:00`);
      const endAt = pickerAllDay
        ? new Date(`${pickerDate}T23:59:59`)
        : new Date(`${pickerDate}T${pickerEndTime}:00`);
      onUpdate({ action_type: 'event', start_at: startAt.toISOString(), end_at: endAt.toISOString(), is_event: true, all_day: pickerAllDay });
    }
    setPickerMode(null);
  };

  const actionColors = useActionColors();
  const at = tile.action_type || 'none';
  const isAllDay = at === 'event' && tile.all_day;
  const displayAt = isAllDay ? 'allday' as ActionType : at;
  const cfg = ACTION_TYPE_BADGE[displayAt];
  const atColor = actionColors[displayAt];
  const subtitle = formatActionSubtitle(tile);
  const hasAiHint = !tile.action_type_reviewed && tile.action_type_ai && tile.action_type_ai !== (tile.action_type || 'none');

  const showPortal = open || pickerMode;

  // Shared chrome for any inline option button inside the popup.
  const popupItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 12px',
    background: active ? theme.surfaceMuted : 'transparent',
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 11,
    cursor: 'pointer',
    border: 'none',
    textAlign: 'left' as const,
  });

  // Shared chrome for date/time inputs in the picker popup.
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    padding: '6px 8px',
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 11,
    colorScheme: 'dark',
    outline: 'none',
  };

  return (
    <div className="relative">
      {/* Trigger — pixel border colored by action type, body font label */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex flex-col justify-center w-full text-left px-1.5"
        style={{
          border: `2px solid ${atColor}`,
          minHeight: 36,
          background: theme.surfaceVariant,
        }}
      >
        <div className="flex items-center gap-1.5 w-full">
          <ActionBadge actionKey={displayAt} size={18} keepSpace />
          <span
            className="flex-1"
            style={{
              fontFamily: 'var(--font-pixel-body)',
              fontSize: 11,
              color: theme.ink2,
            }}
          >
            {cfg.label}
          </span>
          {hasAiHint && <IconSparkles size={10} style={{ color: theme.accent }} />}
          <IconChevronDown size={11} style={{ color: theme.ink3 }} />
        </div>
      </button>
      {showPortal && createPortal(
        <div
          ref={popoverRef}
          className="fixed"
          style={{
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: theme.surface,
            border: `2px solid ${theme.border}`,
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          }}
        >
          {/* Action type options */}
          {open && (
            <div style={{ width: 152, padding: '4px 0' }}>
              {([
                { value: 'none' as ActionType, label: 'NOTES', allDay: false },
                { value: 'anytime' as ActionType, label: 'TO DO', allDay: false },
                { value: 'deadline' as ActionType, label: 'DUE', allDay: false },
                { value: 'event' as ActionType, label: 'ALL DAY', allDay: true },
                { value: 'event' as ActionType, label: 'TIMED', allDay: false },
              ]).map((opt) => {
                const isActive = opt.value === 'event'
                  ? at === 'event' && (opt.allDay ? !!tile.all_day : !tile.all_day)
                  : at === opt.value;
                const colorKey = opt.allDay ? 'allday' : opt.value;
                return (
                  <button
                    key={opt.label}
                    style={{
                      ...popupItemStyle(isActive),
                      fontFamily: 'var(--font-pixel-head)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (opt.value === 'event') {
                        setOpen(false);
                        if (opt.allDay) {
                          const today = new Date().toISOString().slice(0, 10);
                          onUpdate({
                            action_type: 'event',
                            is_event: true,
                            all_day: true,
                            start_at: tile.start_at || new Date(`${today}T00:00:00`).toISOString(),
                            end_at: tile.end_at || new Date(`${today}T23:59:59`).toISOString(),
                          });
                        } else {
                          setPickerAllDay(false);
                          handleSelectOption('event');
                        }
                      } else {
                        handleSelectOption(opt.value);
                      }
                    }}
                  >
                    <ActionBadge actionKey={colorKey} size={18} keepSpace />
                    <span>{opt.label}</span>
                    {isActive && <IconCheck size={11} style={{ color: theme.accent, marginLeft: 'auto' }} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Date picker for deadline */}
          {pickerMode === 'deadline' && (
            <div style={{ width: 232, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconClock size={13} style={{ color: '#FFB400' }} />
                <span
                  style={{
                    fontFamily: 'var(--font-pixel-head)', fontSize: 9,
                    letterSpacing: '0.08em', color: '#FFB400',
                  }}
                >
                  SCADENZA
                </span>
              </div>
              <label style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 8, letterSpacing: '0.08em', color: theme.ink2 }}>
                DATA
              </label>
              <input
                type="date"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={inputStyle}
              />
              <button
                onClick={handlePickerConfirm}
                className="px-press"
                style={{
                  marginTop: 4,
                  width: '100%',
                  background: '#FFB400', color: '#000',
                  border: `2px solid ${theme.border}`,
                  padding: '8px 0',
                  fontFamily: 'var(--font-pixel-head)', fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Conferma
              </button>
            </div>
          )}

          {/* Date picker for event */}
          {pickerMode === 'event' && (
            <div style={{ width: 240, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconCalendar size={13} style={{ color: theme.accent }} />
                <span
                  style={{
                    fontFamily: 'var(--font-pixel-head)', fontSize: 9,
                    letterSpacing: '0.08em', color: theme.accent,
                  }}
                >
                  EVENTO
                </span>
              </div>
              <label style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 8, letterSpacing: '0.08em', color: theme.ink2 }}>
                DATA
              </label>
              <input
                type="date"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={inputStyle}
              />
              <label
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={pickerAllDay}
                  onChange={(e) => setPickerAllDay(e.target.checked)}
                  style={{ accentColor: theme.accent }}
                />
                <span style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink }}>
                  Tutto il giorno
                </span>
              </label>
              {!pickerAllDay && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 8, letterSpacing: '0.08em', color: theme.ink2 }}>
                      INIZIO
                    </label>
                    <input
                      type="time"
                      value={pickerTime}
                      onChange={(e) => setPickerTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 8, letterSpacing: '0.08em', color: theme.ink2 }}>
                      FINE
                    </label>
                    <input
                      type="time"
                      value={pickerEndTime}
                      onChange={(e) => setPickerEndTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handlePickerConfirm}
                className="px-press"
                style={{
                  marginTop: 4,
                  width: '100%',
                  background: theme.accent, color: theme.onAccent,
                  border: `2px solid ${theme.border}`,
                  padding: '8px 0',
                  fontFamily: 'var(--font-pixel-head)', fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Conferma
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

const typeIcons: Record<SparkType, typeof IconFileText> = {
  photo: IconPhoto,
  image: IconPhoto,
  video: IconMovie,
  audio_recording: IconMicrophone,
  text: IconFileText,
  file: IconFile,
};

const typeIconColors: Record<SparkType, string> = {
  photo: 'text-blue-400',
  image: 'text-green-400',
  video: 'text-orange-400',
  audio_recording: 'text-red-400',
  text: 'text-zinc-400',
  file: 'text-yellow-400',
};

function TagDropdown({
  tileIds,
  tileTags,
  allTags,
  open,
  onClose,
  anchorRef,
}: {
  tileIds: string[];
  tileTags: { id: string; name: string; color?: string }[];
  allTags: Tag[];
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const theme = usePixelTheme();
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { getEmoji: getTypeEmoji, getColor: getTypeColor } = useTagTypes();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const tagMutation = useMutation({
    mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        // Single-tag mode: remove all existing tags first, then add the new one
        for (const existingTag of tileTags) {
          await Promise.all(tileIds.map((id) => tagsApi.untagTile(existingTag.id, id)));
        }
        return tagsApi.tagTiles(tagId, tileIds);
      } else {
        await Promise.all(tileIds.map((id) => tagsApi.untagTile(tagId, id)));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      onClose();
    },
    onError: () => toast.error('Errore aggiornamento tag'),
  });

  useEffect(() => {
    if (!open) return;
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    const handleClick = (e: MouseEvent) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (inside) return;
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

  // Only show the first non-root tag as assigned (single-tag mode)
  const rootTagIds = new Set(allTags.filter((t) => t.is_root).map((t) => t.id));
  const nonRootTileTags = tileTags.filter((t) => !rootTagIds.has(t.id));
  const assignedTagId = nonRootTileTags.length > 0 ? nonRootTileTags[0].id : null;
  const isBulk = tileIds.length > 1;
  // Filter out root tags from the dropdown
  const visibleTags = allTags.filter((t) => !t.is_root);

  return createPortal(
    <div
      ref={ref}
      className="fixed overflow-y-auto"
      style={{
        top: pos.top, left: pos.left, zIndex: 9999,
        width: 200, maxHeight: 256,
        background: theme.surface,
        border: `2px solid ${theme.border}`,
        boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
      }}
    >
      {isBulk && (
        <p
          style={{
            padding: '6px 12px',
            borderBottom: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)', fontSize: 9,
            letterSpacing: '0.08em', color: theme.accent,
          }}
        >
          {tileIds.length} TILE SELEZIONATI
        </p>
      )}
      {visibleTags.length === 0 ? (
        <p
          style={{
            padding: '8px 12px',
            fontFamily: 'var(--font-pixel-body)', fontSize: 11,
            color: theme.ink3,
          }}
        >
          Nessun tag disponibile
        </p>
      ) : (
        visibleTags.map((tag) => {
          const isAssigned = tag.id === assignedTagId;
          return (
            <button
              key={tag.id}
              onClick={(e) => {
                e.stopPropagation();
                tagMutation.mutate({ tagId: tag.id, action: isAssigned ? 'remove' : 'add' });
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = theme.surfaceMuted; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isAssigned ? theme.surfaceMuted : 'transparent'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 12px',
                background: isAssigned ? theme.surfaceMuted : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <TagTypeIcon emoji={getTypeEmoji(tag.tag_type || 'topic')} size={13} />
              <span
                className="flex-1 truncate"
                style={{
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  fontWeight: isAssigned ? 600 : 400,
                  color: isAssigned ? getTypeColor(tag.tag_type || 'topic') || theme.ink : theme.ink2,
                }}
              >
                {tag.name}
              </span>
              {isAssigned && <IconCheck size={11} style={{ color: theme.accent, flexShrink: 0 }} />}
            </button>
          );
        })
      )}
    </div>,
    document.body
  );
}

// ─── Spark thumbnail (loads signed URL for images) ───
function SparkThumbnail({ path }: { path: string }) {
  const theme = usePixelTheme();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    uploadApi.getSignedUrl(path).then((res) => {
      if (res.success && res.data) setUrl(res.data.url);
    }).catch(() => {});
  }, [path]);
  if (!url) {
    return (
      <div
        className="animate-pulse shrink-0"
        style={{
          height: 40, width: 40,
          background: theme.surfaceMuted,
          border: `2px solid ${theme.border}`,
        }}
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="shrink-0 object-cover"
      style={{
        height: 40, width: 40,
        border: `2px solid ${theme.border}`,
      }}
    />
  );
}

// ─── Spark chip (inline preview per spark) ───
function SparkChip({ spark }: { spark: { id: string; type: SparkType; content?: string; storage_path?: string; file_name?: string } }) {
  const theme = usePixelTheme();
  const t = spark.type;

  // Tinted square 40×40 wrapper used by all icon variants. Picks the bg
  // from `theme.tint` (palette pastel) and the icon stroke from `theme.cap`
  // (palette saturated). 2px hard border = pixel chrome.
  const iconSquare = (
    typeKey: 'photo' | 'video' | 'voice' | 'file' | 'gallery' | 'text',
    Icon: typeof IconPhoto,
  ) => (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        height: 40, width: 40,
        background: theme.tint[typeKey],
        border: `2px solid ${theme.cap[typeKey]}`,
      }}
    >
      <Icon size={14} style={{ color: theme.cap[typeKey] }} />
    </div>
  );

  // Photo → thumbnail when available, else icon square (theme.cap.photo)
  if (t === 'photo' || t === 'image') {
    const thumbPath = spark.storage_path;
    if (thumbPath) return <SparkThumbnail path={thumbPath} />;
    return iconSquare(t === 'image' ? 'gallery' : 'photo', IconPhoto);
  }

  // Video → cap.video square
  if (t === 'video') return iconSquare('video', IconMovie);

  // Audio → cap.voice square
  if (t === 'audio_recording') return iconSquare('voice', IconMicrophone);

  // Text → excerpt card (no rounded; pixel border + body font)
  if (t === 'text' && spark.content) {
    return (
      <div
        className="overflow-hidden text-left w-full"
        style={{
          padding: '6px 8px',
          background: theme.tint.text,
          border: `2px solid ${theme.cap.text}`,
        }}
      >
        <p
          className="line-clamp-2 whitespace-normal"
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            lineHeight: 1.4,
            color: theme.ink,
            wordBreak: 'break-word',
          }}
        >
          {spark.content}
        </p>
      </div>
    );
  }

  // File → label chip with cap.file color
  if (t === 'file') {
    return (
      <div
        className="flex items-center gap-1 shrink-0"
        style={{
          padding: '0 8px',
          height: 40,
          maxWidth: 160,
          background: theme.tint.file,
          border: `2px solid ${theme.cap.file}`,
        }}
      >
        <IconPaperclip size={11} style={{ color: theme.cap.file, flexShrink: 0 }} />
        <span
          className="truncate"
          style={{
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink,
          }}
        >
          {spark.file_name || 'file'}
        </span>
      </div>
    );
  }

  // Fallback: neutral pixel square
  return (
    <div
      className="flex items-center justify-center shrink-0"
      style={{
        height: 32, width: 32,
        background: theme.surfaceMuted,
        border: `2px solid ${theme.border}`,
      }}
    >
      <IconFileText size={13} style={{ color: theme.ink2 }} />
    </div>
  );
}

// ─── Resizable column header ───
function ResizableHead({
  children,
  width,
  onResize,
  className,
}: {
  children?: React.ReactNode;
  width: number;
  onResize: (w: number) => void;
  className?: string;
}) {
  const theme = usePixelTheme();
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startX.current = e.clientX;
      startW.current = width;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        onResize(Math.max(40, startW.current + delta));
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
      className={cn('relative', className)}
      style={{
        width, minWidth: width, maxWidth: width,
        background: theme.surfaceVariant,
        borderRight: `2px solid ${theme.border}`,
        borderBottom: `2px solid ${theme.border}`,
      }}
    >
      <span
        className="truncate"
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: theme.ink2,
        }}
      >
        {children}
      </span>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize z-10 transition-colors"
        style={{
          right: -2,
          width: 5,
          background: 'transparent',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = `${theme.accent}66`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      />
    </TableHead>
  );
}

const TYPE_LABELS: Record<string, string> = { none: 'NOTES', anytime: 'TO DO', deadline: 'DUE', event: 'TIMED', allday: 'ALL DAY' };
const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; color?: string; style?: React.CSSProperties }>>;

function TipoTypeStatusCells({ tile, colWidths, onUpdate, getColor }: { tile: Tile; colWidths: { dataScad: number; type: number; status: number }; onUpdate: (tileId: string, updates: Record<string, unknown>) => void; getColor: (type: string) => string | undefined }) {
  const theme = usePixelTheme();
  const typeIcons = useTypeIcons((s) => s.icons);
  const typeTileIcons = useTypeIcons((s) => s.tileIcons);
  const assignIcon = useTypeIcons((s) => s.assignIcon);
  const { statuses } = useStatuses();

  const tiId = typeTileIcons[tile.id];
  const ti = tiId ? typeIcons.find((i) => i.id === tiId) : null;
  const TiComp = ti?.icon ? AllIcons[ti.icon] : null;

  const status = tile.status_id ? statuses.find((s) => s.id === tile.status_id) : null;

  const typeLabel = tile.all_day ? 'ALL DAY' : (TYPE_LABELS[tile.action_type || 'none'] || tile.action_type);

  const hasDate = tile.action_type === 'deadline' || tile.action_type === 'event';
  const dateRef = tile.action_type === 'deadline' ? tile.end_at : tile.start_at;
  const dateVal = dateRef ? (() => { const d = new Date(dateRef); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : '';
  const startH = tile.start_at ? String(new Date(tile.start_at).getHours()).padStart(2, '0') : '';
  const startM = tile.start_at ? String(new Date(tile.start_at).getMinutes()).padStart(2, '0') : '';
  const endH = tile.end_at ? String(new Date(tile.end_at).getHours()).padStart(2, '0') : '';
  const endM = tile.end_at ? String(new Date(tile.end_at).getMinutes()).padStart(2, '0') : '';
  const isTimed = tile.action_type === 'event' && !tile.all_day;
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const mins = ['00', '15', '30', '45'];
  const selCls = "w-full bg-transparent text-[10px] text-zinc-300 focus:outline-none cursor-pointer";

  const updateDate = (newDate: string) => {
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    if (tile.action_type === 'deadline') {
      onUpdate(tile.id, { end_at: new Date(`${newDate}T23:59:59`).toISOString() });
    } else if (isTimed) {
      onUpdate(tile.id, { start_at: new Date(`${newDate}T${startH || '09'}:${startM || '00'}`).toISOString(), end_at: tile.end_at ? new Date(`${newDate}T${endH || '10'}:${endM || '00'}`).toISOString() : undefined });
    } else {
      onUpdate(tile.id, { start_at: new Date(`${newDate}T00:00:00`).toISOString(), end_at: new Date(`${newDate}T23:59:59`).toISOString() });
    }
  };

  // Shared cell border (matches TileRow.cellBorder).
  const cellBorder = { borderRight: `2px solid ${theme.border}`, borderBottom: `2px solid ${theme.border}` };

  return (
    <>
      {/* Type — inline picker */}
      <TableCell
        className="overflow-visible"
        style={{ width: colWidths.type, minWidth: colWidths.type, maxWidth: colWidths.type, ...cellBorder }}
      >
        <InlineTypePicker
          icons={typeIcons}
          currentIconId={tiId || null}
          onChange={(id) => assignIcon(tile.id, id)}
        />
      </TableCell>
      {/* Status — inline picker */}
      <TableCell
        className="overflow-visible"
        style={{ width: colWidths.status, minWidth: colWidths.status, maxWidth: colWidths.status, ...cellBorder }}
      >
        <InlineStatusPicker
          statuses={statuses}
          currentStatusId={tile.status_id || null}
          onChange={(id) => onUpdate(tile.id, { status_id: id })}
        />
      </TableCell>
    </>
  );
}

// Generic shared popup chrome used by both Type and Status pickers — mirrors
// the look of InlineActionDropdown so all three column selectors feel the same.
function inlinePickerTrigger(theme: ReturnType<typeof usePixelTheme>): React.CSSProperties {
  return {
    width: '100%',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: theme.surfaceVariant,
    border: `2px solid ${theme.border}`,
    padding: '0 6px',
    minHeight: 30,
    color: theme.ink,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function inlinePickerPopup(theme: ReturnType<typeof usePixelTheme>): React.CSSProperties {
  return {
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 4,
    maxHeight: 240,
    overflowY: 'auto',
  };
}

function inlinePickerItem(theme: ReturnType<typeof usePixelTheme>, active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    background: active ? theme.surfaceVariant : 'transparent',
    border: `2px solid ${active ? theme.border : 'transparent'}`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--font-pixel-body)',
    fontSize: 12,
    cursor: 'pointer',
  };
}

function InlineTypePicker({
  icons,
  currentIconId,
  onChange,
}: {
  icons: { id: string; name: string; icon: string; color?: string }[];
  currentIconId: string | null;
  onChange: (id: string | null) => void;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const current = icons.find((i) => i.id === currentIconId);
  const CurrentComp = current?.icon ? AllIcons[current.icon] : null;

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(180, r.width) });
    }
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={inlinePickerTrigger(theme)}>
        {current && CurrentComp ? (
          <>
            <div style={{ width: 18, height: 18, background: current.color || theme.surfaceVariant, border: `2px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CurrentComp size={10} color={readableOn(current.color || theme.surfaceVariant)} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{current.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1 }}>—</span>
        )}
        <IconChevronDown size={11} style={{ color: theme.ink3, flexShrink: 0 }} />
      </button>
      {open && pos && createPortal(
        <div ref={dropRef} className="fixed" style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, ...inlinePickerPopup(theme) }}>
          <button onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }} style={inlinePickerItem(theme, !currentIconId)}>
            <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3 }}>—</span>
            <span style={{ flex: 1 }}>Nessuno</span>
            {!currentIconId && <IconCheck size={11} style={{ color: theme.accent }} />}
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const isSel = icon.id === currentIconId;
            return (
              <button key={icon.id} onClick={(e) => { e.stopPropagation(); onChange(icon.id); setOpen(false); }} style={inlinePickerItem(theme, isSel)}>
                {Comp && (
                  <div style={{ width: 18, height: 18, background: icon.color || theme.surfaceVariant, border: `2px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Comp size={10} color={readableOn(icon.color || theme.surfaceVariant)} />
                  </div>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon.name}</span>
                {isSel && <IconCheck size={11} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function InlineStatusPicker({
  statuses,
  currentStatusId,
  onChange,
}: {
  statuses: { id: string; name: string; shape: string }[];
  currentStatusId: string | null;
  onChange: (id: string | null) => void;
}) {
  const theme = usePixelTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const current = statuses.find((s) => s.id === currentStatusId);

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(180, r.width) });
    }
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (dropRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const renderShape = (shape: string) => (
    <div style={{ width: 18, height: 18, background: theme.surfaceVariant, border: `2px solid ${theme.border}`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <StatusPattern shape={shape as StatusShape} color={theme.ink} bg={theme.surfaceVariant} />
    </div>
  );

  return (
    <>
      <button ref={triggerRef} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} style={inlinePickerTrigger(theme)}>
        {current ? (
          <>
            {renderShape(current.shape)}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{current.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1 }}>—</span>
        )}
        <IconChevronDown size={11} style={{ color: theme.ink3, flexShrink: 0 }} />
      </button>
      {open && pos && createPortal(
        <div ref={dropRef} className="fixed" style={{ top: pos.top, left: pos.left, width: pos.width, zIndex: 9999, ...inlinePickerPopup(theme) }}>
          <button onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }} style={inlinePickerItem(theme, !currentStatusId)}>
            <span style={{ width: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3 }}>—</span>
            <span style={{ flex: 1 }}>Nessuno</span>
            {!currentStatusId && <IconCheck size={11} style={{ color: theme.accent }} />}
          </button>
          {statuses.map((s) => {
            const isSel = s.id === currentStatusId;
            return (
              <button key={s.id} onClick={(e) => { e.stopPropagation(); onChange(s.id); setOpen(false); }} style={inlinePickerItem(theme, isSel)}>
                {renderShape(s.shape)}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{s.name}</span>
                {isSel && <IconCheck size={11} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function TileRow({
  tile,
  selected,
  selectedIds,
  allTags,
  colWidths,
  isDone,
  onSelect,
  onSparkClick,
  onTileClick,
  onActionTypeChange,
  getEmoji,
  getColor,
}: {
  tile: Tile;
  selected: boolean;
  selectedIds: Set<string>;
  allTags: Tag[];
  colWidths: { title: number; actionType: number; sparks: number; tags: number; dataScad: number; type: number; status: number };
  isDone: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onSparkClick: (spark: Spark) => void;
  onTileClick: (tile: Tile) => void;
  onActionTypeChange: (tileId: string, data: { action_type: ActionType; start_at?: string | null; end_at?: string | null; is_event?: boolean; all_day?: boolean }) => void;
  getEmoji: (slug: string) => string;
  getColor: (slug: string) => string | undefined;
}) {
  const theme = usePixelTheme();
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagCellRef = useRef<HTMLTableCellElement>(null);
  const queryClient = useQueryClient();
  const markRead = useTileNotificationStore((s) => s.markRead);
  const lastSeen = useTileNotificationStore((s) => s.lastSeen);
  const readIds = useTileNotificationStore((s) => s.readIds);
  const isUnread = new Date(tile.created_at) > new Date(lastSeen) && !readIds.includes(tile.id);

  const deleteMutation = useMutation({
    mutationFn: tilesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      toast.success('Tile eliminato');
    },
    onError: () => toast.error("Errore durante l'eliminazione"),
  });

  // Shared cell style — 2px hard bottom + right border (Pixel chrome), zero
  // border-radius. Applied via inline style so it wins over shadcn classes.
  const cellBorder = { borderRight: `2px solid ${theme.border}`, borderBottom: `2px solid ${theme.border}` };

  // Title color: unread → red (kept as-is, semantic), done → ink3 (dimmed),
  // default → ink2.
  const titleColor = isDone ? theme.ink3 : isUnread ? '#E24B4A' : theme.ink2;

  return (
    <Fragment>
      <TableRow
        className={cn("cursor-pointer h-12 group/row", isDone && "[&>td]:opacity-40")}
        style={{ height: 48, maxHeight: 48 }}
        onClick={() => {
          if (selectedIds.size > 0) {
            onSelect(tile.id, !selected);
          } else {
            if (isUnread) markRead(tile.id);
            onTileClick(tile);
          }
        }}
      >
        {/* Selection checkbox — square pixel-style, accent when checked */}
        <TableCell style={{ width: 40, minWidth: 40, maxWidth: 40, ...cellBorder }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(tile.id, !selected); }}
            className={cn('flex items-center justify-center transition-opacity', !selected && 'opacity-0 group-hover/row:opacity-100')}
            style={{
              width: 16,
              height: 16,
              background: selected ? theme.accent : 'transparent',
              border: `2px solid ${selected ? theme.accent : theme.border}`,
            }}
          >
            {selected && <IconCheck className="h-3 w-3" stroke={3} style={{ color: theme.onAccent }} />}
          </button>
        </TableCell>

        {/* Title cell — pixel body font for legibility on long titles */}
        <TableCell
          className="truncate"
          style={{
            width: colWidths.title, minWidth: colWidths.title, maxWidth: colWidths.title,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 12,
            color: titleColor,
            ...cellBorder,
          }}
        >
          {tile.title || `Tile ${tile.id.slice(0, 8)}`}
        </TableCell>

        {/* Action type dropdown — InlineActionDropdown retains its internal
            styling; the cell just provides the 2px border chrome. */}
        <TableCell
          className="overflow-visible"
          style={{ width: colWidths.actionType, minWidth: colWidths.actionType, maxWidth: colWidths.actionType, ...cellBorder }}
        >
          <InlineActionDropdown
            tile={tile}
            onUpdate={(data) => onActionTypeChange(tile.id, data)}
          />
        </TableCell>

        {/* Schedule (Date / Start / End) */}
        <TableCell
          className="p-0.5"
          style={{ width: colWidths.dataScad, minWidth: colWidths.dataScad, maxWidth: colWidths.dataScad, ...cellBorder }}
        >
          {(() => {
            const hasDate = tile.action_type === 'deadline' || tile.action_type === 'event';
            const dateRef = tile.action_type === 'deadline' ? tile.end_at : tile.start_at;
            const dateVal = dateRef ? (() => { const d = new Date(dateRef); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() : '';
            const isTimed = tile.action_type === 'event' && !tile.all_day;
            const startH = tile.start_at ? String(new Date(tile.start_at).getHours()).padStart(2, '0') : '';
            const startM = tile.start_at ? String(new Date(tile.start_at).getMinutes()).padStart(2, '0') : '';
            const endH = tile.end_at ? String(new Date(tile.end_at).getHours()).padStart(2, '0') : '';
            const endM = tile.end_at ? String(new Date(tile.end_at).getMinutes()).padStart(2, '0') : '';
            const updateDate = (newDate: string) => {
              if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
              if (tile.action_type === 'deadline') {
                onActionTypeChange(tile.id, { action_type: 'deadline', end_at: new Date(`${newDate}T23:59:59`).toISOString() } as any);
              } else if (isTimed) {
                onActionTypeChange(tile.id, { action_type: 'event', start_at: new Date(`${newDate}T${startH || '09'}:${startM || '00'}`).toISOString(), end_at: tile.end_at ? new Date(`${newDate}T${endH || '10'}:${endM || '00'}`).toISOString() : undefined } as any);
              } else {
                onActionTypeChange(tile.id, { action_type: 'event', start_at: new Date(`${newDate}T00:00:00`).toISOString(), end_at: new Date(`${newDate}T23:59:59`).toISOString() } as any);
              }
            };
            if (!hasDate) return <span style={{ color: theme.ink3, fontSize: 11, padding: '0 4px' }}>—</span>;
            return (
              <div className="flex flex-col">
                <input
                  type="date"
                  value={dateVal}
                  onChange={(e) => updateDate(e.target.value)}
                  className="w-full bg-transparent px-1 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60"
                  style={{
                    colorScheme: 'dark',
                    fontFamily: 'var(--font-pixel-body)',
                    fontSize: 11,
                    color: theme.ink2,
                  }}
                />
                {isTimed && (
                  <div className="flex items-center px-1">
                    <TimePicker
                      value={`${startH || '09'}:${startM || '00'}`}
                      onChange={(t) => { if (dateVal) onActionTypeChange(tile.id, { action_type: 'event', start_at: new Date(`${dateVal}T${t}`).toISOString() } as any); }}
                      borderless
                    />
                    <span style={{ color: theme.ink3, fontSize: 10, margin: '0 2px' }}>-</span>
                    <TimePicker
                      value={`${endH || '10'}:${endM || '00'}`}
                      onChange={(t) => { if (dateVal) onActionTypeChange(tile.id, { action_type: 'event', end_at: new Date(`${dateVal}T${t}`).toISOString() } as any); }}
                      borderless
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </TableCell>

        {/* Tag cell — hover uses theme.surfaceMuted instead of zinc */}
        <TableCell
          ref={tagCellRef}
          className="overflow-visible py-1 cursor-pointer transition-colors"
          style={{
            width: colWidths.tags, minWidth: colWidths.tags, maxWidth: colWidths.tags,
            ...cellBorder,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLTableCellElement).style.background = theme.surfaceMuted; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLTableCellElement).style.background = 'transparent'; }}
          onClick={(e) => {
            e.stopPropagation();
            setTagDropdownOpen(!tagDropdownOpen);
          }}
        >
          <div className="flex items-center gap-1.5">
            {(() => {
              const rootIds = new Set(allTags.filter((t) => t.is_root).map((t) => t.id));
              const displayTag = tile.tags?.find((t) => !rootIds.has(t.id)) || tile.tags?.[0];
              if (displayTag) {
                return (
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <TagTypeIcon emoji={getEmoji((displayTag as { tag_type?: string }).tag_type || 'topic')} size={16} color={getColor((displayTag as { tag_type?: string }).tag_type || 'topic') || theme.ink3} />
                    <span
                      className="truncate flex-1"
                      style={{
                        fontFamily: 'var(--font-pixel-body)',
                        fontSize: 12,
                        color: theme.ink2,
                      }}
                    >
                      {displayTag.name}
                    </span>
                  </div>
                );
              }
              return <span style={{ color: theme.ink3, fontSize: 11, flex: 1 }}>—</span>;
            })()}
            <IconChevronDown size={11} style={{ color: theme.ink3, flexShrink: 0 }} />
          </div>
          <TagDropdown
            tileIds={selected && selectedIds.size > 1 ? Array.from(selectedIds) : [tile.id]}
            tileTags={tile.tags || []}
            allTags={allTags}
            open={tagDropdownOpen}
            onClose={() => setTagDropdownOpen(false)}
            anchorRef={tagCellRef}
          />
        </TableCell>

        <TipoTypeStatusCells tile={tile} colWidths={colWidths} onUpdate={(id, updates) => onActionTypeChange(id, updates as any)} getColor={getColor} />

        {/* Sparks cell */}
        <TableCell
          className="overflow-hidden py-1"
          style={{ width: colWidths.sparks, maxWidth: colWidths.sparks, ...cellBorder }}
        >
          {tile.sparks && tile.sparks.length > 0 ? (
            <div className="flex gap-1.5 items-center min-w-0 w-full">
              {tile.sparks.map((spark) => (
                <div
                  key={spark.id}
                  className={cn(spark.type === 'text' ? 'flex-1 w-0 overflow-hidden' : 'shrink-0')}
                >
                  <SparkChip spark={spark} />
                </div>
              ))}
            </div>
          ) : (
            <span style={{ color: theme.ink3, fontSize: 12 }}>—</span>
          )}
        </TableCell>

        {/* Created date */}
        <TableCell
          style={{
            width: 80, minWidth: 80, maxWidth: 80,
            fontFamily: 'var(--font-pixel-body)',
            fontSize: 11,
            color: theme.ink2,
            ...cellBorder,
          }}
        >
          {new Date(tile.created_at).toLocaleDateString('it-IT')}
        </TableCell>

        {/* Delete button — pixel square */}
        <TableCell
          className="text-right"
          style={{ width: 56, minWidth: 56, maxWidth: 56, ...cellBorder }}
        >
          <button
            aria-label="Elimina tile"
            className="px-press"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(tile.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              background: theme.surface,
              color: '#E24B4A',
              border: `2px solid ${theme.border}`,
              cursor: 'pointer',
            }}
          >
            <IconTrash size={13} />
          </button>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export default function TilesPage() {
  const theme = usePixelTheme();
  const queryClient = useQueryClient();
  const actionColors = useActionColors();
  const { getEmoji, getColor } = useTagTypes();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [sidebarTileId, setSidebarTileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { tileIds: aiFilterIds, clearFilter } = useFilterStore();

  // Column filters
  const [titleFilter, setTitleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<Set<ActionType>>(new Set());
  const [sparkTypeFilter, setSparkTypeFilter] = useState<Set<SparkType>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Single source of truth for "done": status_id pointing to the system 'done' row.
  const { doneStatusId } = useStatuses();

  // Filter popup open state
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const titleHeadRef = useRef<HTMLTableCellElement>(null);
  const actionHeadRef = useRef<HTMLTableCellElement>(null);
  const sparksHeadRef = useRef<HTMLTableCellElement>(null);
  const tagsHeadRef = useRef<HTMLTableCellElement>(null);
  const dateHeadRef = useRef<HTMLTableCellElement>(null);

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState({
    title: 220,
    actionType: 140,
    sparks: 340,
    tags: 160,
    dataScad: 95,
    type: 160,
    status: 80,
  });
  const setColWidth = useCallback(
    (col: keyof typeof colWidths, w: number) =>
      setColWidths((prev) => ({ ...prev, [col]: w })),
    []
  );

  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['tiles'],
    queryFn: ({ pageParam = 1 }) => tilesApi.list({ page: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination) return undefined;
      const { page: p, totalPages } = lastPage.pagination;
      return p < totalPages ? p + 1 : undefined;
    },
    initialPageParam: 1,
  });

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: tagsResult } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const actionTypeMutation = useMutation({
    mutationFn: async ({ tileId, updates }: { tileId: string; updates: Parameters<typeof tilesApi.update>[1] }) => {
      const result = await tilesApi.update(tileId, updates);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
      queryClient.invalidateQueries({ queryKey: ['tile-detail'] });
    },
    onError: () => toast.error('Errore aggiornamento azione'),
  });

  const handleActionTypeChange = useCallback((tileId: string, data: { action_type: ActionType; start_at?: string | null; end_at?: string | null; is_event?: boolean; all_day?: boolean }) => {
    actionTypeMutation.mutate({ tileId, updates: data });
  }, [actionTypeMutation]);

  const handleAddTile = useCallback(async () => {
    try {
      const res = await tilesApi.create({ title: 'New tile' });
      const newTile = res?.data;
      if (newTile) {
        // Assign GIMMICK root tag
        const allTagsList = tagsResult?.data || [];
        const rootTag = allTagsList.find((t) => t.is_root);
        if (rootTag) {
          await tagsApi.tagTiles(rootTag.id, [newTile.id]);
        }
        // Refresh and open sidebar
        await queryClient.invalidateQueries({ queryKey: ['tiles'] });
        queryClient.setQueryData(['tile-detail', newTile.id], { data: newTile });
        setSidebarTileId(newTile.id);
        setSidebarOpen(true);
      }
    } catch {
      toast.error('Errore creazione tile');
    }
  }, [queryClient, tagsResult, setSidebarTileId, setSidebarOpen]);

  const allTags = tagsResult?.data || [];
  const allTiles = useMemo(() => infiniteData?.pages.flatMap((p) => p.data) || [], [infiniteData]);
  const totalCount = infiniteData?.pages[0]?.pagination?.total;

  const tiles = useMemo(() => {
    let result = allTiles;
    if (aiFilterIds) {
      const idSet = new Set(aiFilterIds);
      result = result.filter((t) => idSet.has(t.id));
    }
    if (titleFilter) {
      const q = titleFilter.toLowerCase();
      result = result.filter((t) => (t.title || '').toLowerCase().includes(q));
    }
    if (actionFilter.size > 0) {
      result = result.filter((t) => actionFilter.has((t.action_type || 'none') as ActionType));
    }
    if (sparkTypeFilter.size > 0) {
      result = result.filter((t) => t.sparks?.some((s) => sparkTypeFilter.has(s.type as SparkType)));
    }
    if (tagFilter.size > 0) {
      result = result.filter((t) => t.tags?.some((tag) => tagFilter.has(tag.id)));
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((t) => new Date(t.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      result = result.filter((t) => new Date(t.created_at) <= to);
    }
    return result;
  }, [allTiles, aiFilterIds, titleFilter, actionFilter, sparkTypeFilter, tagFilter, dateFrom, dateTo]);

  const allSelected = tiles.length > 0 && tiles.every((t) => selectedIds.has(t.id));
  const someSelected = tiles.some((t) => selectedIds.has(t.id));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tiles.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: theme.bg1 }}>
      <Header
        title="Tiles"
        actions={selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <PixelBadge bg={theme.accent} color={theme.onAccent}>
              {selectedIds.size} SEL.
            </PixelBadge>
            <button
              className="px-press"
              onClick={async () => {
                const ids = Array.from(selectedIds);
                const results = await Promise.all(ids.map((id) => tilesApi.delete(id)));
                const failed = results.filter((r) => !r.success).length;
                const succeeded = ids.length - failed;
                if (succeeded > 0) {
                  queryClient.invalidateQueries({ queryKey: ['tiles'] });
                  setSelectedIds(new Set());
                  toast.success(`${succeeded} tile eliminat${succeeded === 1 ? 'o' : 'i'}`);
                }
                if (failed > 0) {
                  toast.error(`${failed} tile non eliminat${failed === 1 ? 'o' : 'i'}`);
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 28, padding: '0 10px',
                background: theme.surfaceVariant, color: '#E24B4A',
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)', fontSize: 9,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <IconTrash size={12} />
              Elimina ({selectedIds.size})
            </button>
            <button
              className="px-press"
              onClick={() => {
                const { markRead } = useTileNotificationStore.getState();
                selectedIds.forEach((id) => markRead(id));
                setSelectedIds(new Set());
                toast.success(`${selectedIds.size} tile segnat${selectedIds.size === 1 ? 'o' : 'i'} come lett${selectedIds.size === 1 ? 'o' : 'i'}`);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 28, padding: '0 10px',
                background: theme.surfaceVariant, color: theme.accent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)', fontSize: 9,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <IconChecks size={12} />
              Letti
            </button>
            <button
              aria-label="Deseleziona"
              className="px-press"
              onClick={() => setSelectedIds(new Set())}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28,
                background: theme.surfaceVariant, color: theme.ink2,
                border: `2px solid ${theme.border}`, cursor: 'pointer',
              }}
            >
              <IconX size={13} />
            </button>
          </div>
        ) : undefined}
      />

      <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* AI Filter banner — accent pixel card, identical pattern to Sparks */}
        {aiFilterIds && (
          <PixelCard
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: `${theme.accent}22`,
              border: `2px solid ${theme.accent}`,
            }}
          >
            <p style={{
              fontFamily: 'var(--font-pixel-head)', fontSize: 10,
              letterSpacing: '0.06em', color: theme.accent,
            }}>
              FILTRO AI ATTIVO — {tiles.length} TILE TROVATI
            </p>
            <button
              onClick={clearFilter}
              className="px-press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 28, padding: '0 10px',
                background: 'transparent', color: theme.accent,
                border: `2px solid ${theme.accent}`,
                fontFamily: 'var(--font-pixel-head)', fontSize: 8,
                letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              <IconX size={11} />
              Rimuovi filtro
            </button>
          </PixelCard>
        )}

        {/* Toolbar — count, add tile, clear filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <IconLayoutGrid size={16} style={{ color: theme.ink2 }} />
          <span style={{
            fontFamily: 'var(--font-pixel-head)', fontSize: 10,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink2,
          }}>
            {tiles.length}{totalCount ? ` / ${totalCount}` : ''} tiles
          </span>
          <button onClick={handleAddTile} className="px-press" style={pixelToolbarBtn(theme, true)}>
            <IconPlus size={12} />
            Add Tile
          </button>
          {(titleFilter || actionFilter.size > 0 || sparkTypeFilter.size > 0 || tagFilter.size > 0 || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setTitleFilter('');
                setActionFilter(new Set());
                setSparkTypeFilter(new Set());
                setTagFilter(new Set());
                setDateFrom('');
                setDateTo('');
              }}
              style={{
                fontFamily: 'var(--font-pixel-head)', fontSize: 9,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: theme.accent, marginLeft: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              Rimuovi filtri
            </button>
          )}
        </div>

        {/* Tiles table */}
        {isLoading ? (
          <p style={{
            textAlign: 'center', padding: '32px 0',
            fontFamily: 'var(--font-pixel-head)', fontSize: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.ink2,
          }}>
            Caricamento...
          </p>
        ) : tiles.length === 0 ? (
          <div className="text-center" style={{ padding: '64px 0' }}>
            <IconLayoutGrid size={48} style={{ color: theme.ink3, margin: '0 auto 16px' }} />
            <p style={{
              fontFamily: 'var(--font-pixel-head)', fontSize: 10,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink2,
            }}>
              Nessun tile trovato
            </p>
            <p style={{
              fontFamily: 'var(--font-pixel-body)', fontSize: 12,
              color: theme.ink3, marginTop: 6,
            }}>
              I tiles vengono creati automaticamente quando invii più memo insieme
            </p>
          </div>
        ) : (
          <PixelCard
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', minHeight: 0,
              padding: 0, overflow: 'hidden',
            }}
          >
            <div className="flex-1 overflow-auto">
              <Table style={{ tableLayout: 'fixed', width: colWidths.title + colWidths.actionType + colWidths.sparks + colWidths.tags + colWidths.dataScad + colWidths.type + colWidths.status + 40 + 60 + 80 + 56, minWidth: colWidths.title + colWidths.actionType + colWidths.sparks + colWidths.tags + colWidths.dataScad + colWidths.type + colWidths.status + 40 + 60 + 80 + 56 }}>
                <TableHeader
                  className="sticky top-0 z-10"
                  style={{ background: theme.surfaceVariant }}
                >
                  <TableRow className="hover:bg-transparent" style={{ borderColor: theme.border }}>
                    <TableHead
                      style={{
                        width: 40, minWidth: 40, maxWidth: 40,
                        background: theme.surfaceVariant,
                        borderRight: `2px solid ${theme.border}`,
                        borderBottom: `2px solid ${theme.border}`,
                      }}
                    >
                      <button
                        onClick={() => handleSelectAll(!allSelected)}
                        className="flex items-center justify-center transition-colors"
                        style={{
                          width: 16, height: 16,
                          background: allSelected ? theme.accent : someSelected ? `${theme.accent}99` : 'transparent',
                          border: `2px solid ${allSelected || someSelected ? theme.accent : theme.border}`,
                        }}
                      >
                        {(allSelected || someSelected) && <IconCheck size={11} stroke={3} style={{ color: theme.onAccent }} />}
                      </button>
                    </TableHead>
                    <FilterableHead
                      label="Title"
                      width={colWidths.title}
                      onResize={(w) => setColWidth('title', w)}
                      className="text-zinc-400 border-r border-zinc-800 text-xs"
                      hasActiveFilter={!!titleFilter}
                      filterOpen={openFilter === 'title'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'title' ? null : 'title')}
                      headRef={titleHeadRef}
                    />
                    <FilterableHead
                      label="Action"
                      width={colWidths.actionType}
                      onResize={(w) => setColWidth('actionType', w)}
                      className="text-zinc-400 border-r border-zinc-800 text-xs"
                      hasActiveFilter={actionFilter.size > 0}
                      filterOpen={openFilter === 'action'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'action' ? null : 'action')}
                      headRef={actionHeadRef}
                    />
                    <ResizableHead width={colWidths.dataScad} onResize={(w) => setColWidth('dataScad', w)} className="text-zinc-400 border-r border-zinc-800 text-xs">Schedule</ResizableHead>
                    <FilterableHead
                      label="Tags"
                      width={colWidths.tags}
                      onResize={(w) => setColWidth('tags', w)}
                      className="text-zinc-400 text-left border-r border-zinc-800 text-xs"
                      hasActiveFilter={tagFilter.size > 0}
                      filterOpen={openFilter === 'tags'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'tags' ? null : 'tags')}
                      headRef={tagsHeadRef}
                    />
                    <ResizableHead width={colWidths.type} onResize={(w) => setColWidth('type', w)} className="text-zinc-400 border-r border-zinc-800 text-xs">Type</ResizableHead>
                    <ResizableHead width={colWidths.status} onResize={(w) => setColWidth('status', w)} className="text-zinc-400 border-r border-zinc-800 text-xs">Status</ResizableHead>
                    <FilterableHead
                      label="Sparks"
                      width={colWidths.sparks}
                      onResize={(w) => setColWidth('sparks', w)}
                      className="text-zinc-400 text-left border-r border-zinc-800 text-xs"
                      hasActiveFilter={sparkTypeFilter.size > 0}
                      filterOpen={openFilter === 'sparks'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'sparks' ? null : 'sparks')}
                      headRef={sparksHeadRef}
                    />
                    <TableHead
                      ref={dateHeadRef}
                      style={{
                        width: 80, minWidth: 80, maxWidth: 80,
                        background: theme.surfaceVariant,
                        borderRight: `2px solid ${theme.border}`,
                        borderBottom: `2px solid ${theme.border}`,
                      }}
                    >
                      <button
                        onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
                        className="flex items-center gap-1 w-full text-left"
                        style={{
                          fontFamily: 'var(--font-pixel-head)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: theme.ink2,
                        }}
                      >
                        <span className="truncate">Created</span>
                        <IconFilter
                          size={11}
                          className="shrink-0"
                          style={{ color: (dateFrom || dateTo) ? theme.accent : theme.ink3 }}
                        />
                      </button>
                    </TableHead>
                    <TableHead
                      className="text-right"
                      style={{
                        width: 56, minWidth: 56, maxWidth: 56,
                        background: theme.surfaceVariant,
                        borderRight: `2px solid ${theme.border}`,
                        borderBottom: `2px solid ${theme.border}`,
                      }}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiles.map((tile) => (
                    <TileRow
                      key={tile.id}
                      tile={tile}
                      selected={selectedIds.has(tile.id)}
                      selectedIds={selectedIds}
                      allTags={allTags}
                      colWidths={colWidths}
                      onSelect={handleSelect}
                      onSparkClick={() => {}}
                      onTileClick={(tile) => {
                        // Merge with cached data to preserve sparks already fetched
                        queryClient.setQueryData(['tile-detail', tile.id], (old: any) => ({
                          data: { ...tile, sparks: old?.data?.sparks }
                        }));
                        // Force a refresh so we get the authoritative sparks list
                        queryClient.invalidateQueries({ queryKey: ['tile-detail', tile.id] });
                        setSidebarTileId(tile.id);
                        setSidebarOpen(true);
                      }}
                      onActionTypeChange={handleActionTypeChange}
                      isDone={isTileDone(tile, doneStatusId)}
                      getEmoji={getEmoji}
                      getColor={getColor}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </PixelCard>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="h-4">
          {isFetchingNextPage && (
            <div className="flex justify-center py-2">
              <div className="h-4 w-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Column filter popups */}
      <FilterPopup anchorRef={titleHeadRef} open={openFilter === 'title'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            Cerca nel titolo
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: theme.surfaceVariant,
              border: `2px solid ${theme.border}`,
              padding: '6px 8px',
            }}
          >
            <IconSearch size={12} style={{ color: theme.ink3, flexShrink: 0 }} />
            <input
              type="text"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              style={{
                background: 'transparent',
                color: theme.ink,
                width: '100%',
                outline: 'none',
                border: 'none',
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 11,
              }}
            />
            {titleFilter && (
              <button
                onClick={() => setTitleFilter('')}
                style={{ color: theme.ink3, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={actionHeadRef} open={openFilter === 'action'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 168, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 4,
            }}
          >
            Tipo azione
          </label>
          {(['none', 'anytime', 'deadline', 'event'] as ActionType[]).map((at) => {
            const cfg = ACTION_TYPE_BADGE[at];
            const Icon = cfg.icon;
            const active = actionFilter.has(at);
            return (
              <button
                key={at}
                onClick={() => {
                  setActionFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(at)) next.delete(at); else next.add(at);
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
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  color: theme.ink2,
                }}
              >
                <Icon size={14} style={{ color: actionColors[at] }} />
                <span style={{ flex: 1 }}>{cfg.label}</span>
                {active && <IconCheck size={12} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={sparksHeadRef} open={openFilter === 'sparks'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 168, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 4,
            }}
          >
            Tipo spark
          </label>
          {SPARK_TYPE_OPTIONS.map((opt) => {
            const active = sparkTypeFilter.has(opt.value);
            const TypeIcon = typeIcons[opt.value];
            const typeKey: CaptureKey | null =
              opt.value === 'photo' || opt.value === 'image' ? 'photo'
              : opt.value === 'video' ? 'video'
              : opt.value === 'audio_recording' ? 'voice'
              : opt.value === 'text' ? 'text'
              : opt.value === 'file' ? 'file'
              : null;
            const iconColor = typeKey ? theme.cap[typeKey] : theme.ink2;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setSparkTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
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
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  color: theme.ink2,
                }}
              >
                <TypeIcon size={14} style={{ color: iconColor }} />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {active && <IconCheck size={12} style={{ color: theme.accent }} />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={tagsHeadRef} open={openFilter === 'tags'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
              marginBottom: 4,
            }}
          >
            Tags
          </label>
          {allTags.length === 0 ? (
            <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, padding: '4px 0' }}>
              Nessun tag
            </p>
          ) : (
            allTags.map((tag) => {
              const active = tagFilter.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => {
                    setTagFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id);
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
                    fontFamily: 'var(--font-pixel-body)',
                    fontSize: 11,
                    color: theme.ink2,
                  }}
                >
                  <div style={{ width: 10, height: 10, background: theme.accent, border: `2px solid ${theme.border}`, flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                  {active && <IconCheck size={12} style={{ color: theme.accent }} />}
                </button>
              );
            })
          )}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={dateHeadRef} open={openFilter === 'date'} onClose={() => setOpenFilter(null)}>
        <div style={{ width: 216, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.ink3,
            }}
          >
            Intervallo date
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                Da
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: '100%',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  padding: '6px 8px',
                  color: theme.ink,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                A
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: '100%',
                  background: theme.surfaceVariant,
                  border: `2px solid ${theme.border}`,
                  padding: '6px 8px',
                  color: theme.ink,
                  fontFamily: 'var(--font-pixel-body)',
                  fontSize: 11,
                  outline: 'none',
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              style={{
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.accent,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
              }}
            >
              Rimuovi
            </button>
          )}
        </div>
      </FilterPopup>


      <TileDetailModal
        tile={selectedTile}
        open={selectedTile !== null}
        onOpenChange={(open) => { if (!open) setSelectedTile(null); }}
      />
      <TileSidebar
        tileId={sidebarTileId}
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        invalidateKeys={['tiles']}
      />
    </div>
    </div>
  );
}
