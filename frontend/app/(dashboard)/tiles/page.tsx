'use client';

import { useState, useMemo, Fragment, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Trash2, FileText, Image as ImageIcon, Mic, Film, File as FileIcon, Paperclip, X, Check, CheckCheck, Pin, Zap, Clock, Calendar, Sparkles, ChevronDown, CircleCheck, Circle as CircleIcon, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { typeLabels } from '@/lib/spark-utils';
import { SparkViewer } from '@/components/spark/spark-viewer';
import type { Spark, SparkType, Tile, Tag, ActionType } from '@/types';
import { TileDetailModal } from '@/components/tiles/tile-detail-modal';

const ACTION_TYPE_BADGE: Record<ActionType, { icon: typeof Pin; color: string; label: string }> = {
  none: { icon: Pin, color: 'text-pink-400', label: 'Appunto' },
  anytime: { icon: Zap, color: 'text-green-400', label: 'Da fare' },
  deadline: { icon: Clock, color: 'text-amber-400', label: 'Scadenza' },
  event: { icon: Calendar, color: 'text-blue-400', label: 'Evento' },
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
        <Filter className={cn('h-3 w-3 shrink-0 transition-colors', hasActiveFilter ? 'text-blue-400' : 'text-zinc-600')} />
      </button>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
        style={{ right: -2, width: 5 }}
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

  const at = tile.action_type || 'none';
  const cfg = ACTION_TYPE_BADGE[at];
  const Icon = cfg.icon;
  const subtitle = formatActionSubtitle(tile);
  const hasAiHint = !tile.action_type_reviewed && tile.action_type_ai;

  const showPortal = open || pickerMode;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex flex-col items-start gap-0 w-full text-left"
      >
        <div className="flex items-center gap-1">
          <Icon className={cn('h-3 w-3', cfg.color)} />
          <span className={cn('text-xs', cfg.color)}>{cfg.label}</span>
          <ChevronDown className="h-3 w-3 text-zinc-500" />
          {hasAiHint && <Sparkles className="h-2.5 w-2.5 text-purple-400" />}
        </div>
        {subtitle && (
          <span className="text-[11px] text-zinc-500 leading-tight truncate max-w-full">
            {subtitle}
          </span>
        )}
      </button>
      {showPortal && createPortal(
        <div
          ref={popoverRef}
          className="fixed rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
          style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          {/* Action type options */}
          {open && (
            <div className="w-36 py-1">
              {(['none', 'anytime', 'deadline', 'event'] as ActionType[]).map((opt) => {
                const optCfg = ACTION_TYPE_BADGE[opt];
                const OptIcon = optCfg.icon;
                const isActive = at === opt;
                return (
                  <button
                    key={opt}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-zinc-800 transition-colors',
                      isActive && 'bg-zinc-800'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOption(opt);
                    }}
                  >
                    <OptIcon className={cn('h-3.5 w-3.5', optCfg.color)} />
                    <span className="text-zinc-300">{optCfg.label}</span>
                    {isActive && <Check className="h-3 w-3 text-blue-400 ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Date picker for deadline */}
          {pickerMode === 'deadline' && (
            <div className="w-56 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">Scadenza</span>
              </div>
              <label className="text-[11px] text-zinc-500">Data</label>
              <input
                type="date"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handlePickerConfirm}
                className="mt-1 w-full bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium py-1.5 rounded transition-colors"
              >
                Conferma
              </button>
            </div>
          )}

          {/* Date picker for event */}
          {pickerMode === 'event' && (
            <div className="w-60 p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-400">Evento</span>
              </div>
              <label className="text-[11px] text-zinc-500">Data</label>
              <input
                type="date"
                value={pickerDate}
                onChange={(e) => setPickerDate(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={pickerAllDay}
                  onChange={(e) => setPickerAllDay(e.target.checked)}
                  className="accent-blue-500"
                />
                <span className="text-xs text-zinc-300">Tutto il giorno</span>
              </label>
              {!pickerAllDay && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-zinc-500">Inizio</label>
                    <input
                      type="time"
                      value={pickerTime}
                      onChange={(e) => setPickerTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-zinc-500">Fine</label>
                    <input
                      type="time"
                      value={pickerEndTime}
                      onChange={(e) => setPickerEndTime(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              <button
                onClick={handlePickerConfirm}
                className="mt-1 w-full bg-blue-500 hover:bg-blue-400 text-white text-xs font-medium py-1.5 rounded transition-colors"
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

const typeIcons: Record<SparkType, typeof FileText> = {
  photo: ImageIcon,
  image: ImageIcon,
  video: Film,
  audio_recording: Mic,
  text: FileText,
  file: FileIcon,
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
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const tagMutation = useMutation({
    mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
      if (action === 'add') {
        return tagsApi.tagTiles(tagId, tileIds);
      } else {
        await Promise.all(tileIds.map((id) => tagsApi.untagTile(tagId, id)));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiles'] });
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

  const tileTagIds = new Set(tileTags.map((t) => t.id));
  const isBulk = tileIds.length > 1;

  return createPortal(
    <div
      ref={ref}
      className="fixed w-48 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl py-1 max-h-64 overflow-y-auto"
      style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      {isBulk && (
        <p className="text-xs text-blue-400 px-3 py-1.5 border-b border-zinc-800">
          {tileIds.length} tile selezionati
        </p>
      )}
      {allTags.length === 0 ? (
        <p className="text-xs text-zinc-500 px-3 py-2">Nessun tag disponibile</p>
      ) : (
        allTags.map((tag) => {
          const isAssigned = tileTagIds.has(tag.id);
          return (
            <button
              key={tag.id}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-800 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                tagMutation.mutate({ tagId: tag.id, action: isAssigned ? 'remove' : 'add' });
              }}
            >
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color || '#3B82F6' }}
              />
              <span className="text-zinc-300 flex-1 truncate">{tag.name}</span>
              {isAssigned && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
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
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    uploadApi.getSignedUrl(path).then((res) => {
      if (res.success && res.data) setUrl(res.data.url);
    }).catch(() => {});
  }, [path]);
  if (!url) return <div className="h-8 w-8 rounded bg-zinc-700 animate-pulse shrink-0" />;
  return (
    <img
      src={url}
      alt=""
      className="h-8 w-8 rounded object-cover shrink-0"
    />
  );
}

// ─── Spark chip (inline preview per spark) ───
function SparkChip({ spark }: { spark: { id: string; type: SparkType; content?: string; storage_path?: string; file_name?: string } }) {
  const t = spark.type;

  // Photo / Image → small thumbnail
  if (t === 'photo' || t === 'image') {
    const thumbPath = spark.storage_path;
    if (thumbPath) return <SparkThumbnail path={thumbPath} />;
    return (
      <div className="h-8 w-8 rounded bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
        <ImageIcon className="h-3.5 w-3.5 text-blue-400" />
      </div>
    );
  }

  // Video → icon
  if (t === 'video') {
    return (
      <div className="h-8 w-8 rounded bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
        <Film className="h-3.5 w-3.5 text-orange-400" />
      </div>
    );
  }

  // Audio → icon
  if (t === 'audio_recording') {
    return (
      <div className="h-8 w-8 rounded bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
        <Mic className="h-3.5 w-3.5 text-red-400" />
      </div>
    );
  }

  // Text → excerpt
  if (t === 'text' && spark.content) {
    return (
      <div className="px-2 py-1 rounded bg-zinc-500/10 border border-zinc-500/20 shrink-0 max-w-[200px]">
        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-tight">
          {spark.content}
        </p>
      </div>
    );
  }

  // File → attachment icon + name
  if (t === 'file') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20 shrink-0 max-w-[160px]">
        <Paperclip className="h-3 w-3 text-yellow-400 shrink-0" />
        <span className="text-[11px] text-yellow-300/80 truncate">
          {spark.file_name || 'file'}
        </span>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-8 w-8 rounded bg-zinc-700/50 border border-zinc-600 flex items-center justify-center shrink-0">
      <FileText className="h-3.5 w-3.5 text-zinc-400" />
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
    <TableHead className={cn('relative', className)} style={{ width, minWidth: width, maxWidth: width }}>
      <span className="truncate">{children}</span>
      <div
        onMouseDown={onMouseDown}
        className="absolute top-0 bottom-0 cursor-col-resize hover:bg-blue-500/40 transition-colors z-10"
        style={{ right: -2, width: 5 }}
      />
    </TableHead>
  );
}

function TileRow({
  tile,
  selected,
  selectedIds,
  allTags,
  colWidths,
  onSelect,
  onSparkClick,
  onTileClick,
  onActionTypeChange,
  onToggleCompleted,
}: {
  tile: Tile;
  selected: boolean;
  selectedIds: Set<string>;
  allTags: Tag[];
  colWidths: { title: number; actionType: number; sparks: number; tags: number };
  onSelect: (id: string, checked: boolean) => void;
  onSparkClick: (spark: Spark) => void;
  onTileClick: (tile: Tile) => void;
  onActionTypeChange: (tileId: string, data: { action_type: ActionType; start_at?: string | null; end_at?: string | null; is_event?: boolean; all_day?: boolean }) => void;
  onToggleCompleted: (tileId: string, completed: boolean) => void;
}) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagCellRef = useRef<HTMLDivElement>(null);
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

  return (
    <Fragment>
      <TableRow
        className={cn("border-zinc-800 cursor-pointer h-12 group/row", tile.is_completed && "bg-green-950/30")}
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
        <TableCell className="border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(tile.id, !selected); }}
            className={cn(
              'h-4 w-4 rounded flex items-center justify-center border transition-colors',
              selected
                ? 'bg-blue-500 border-blue-500'
                : 'bg-transparent border-zinc-600 opacity-0 group-hover/row:opacity-100'
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </button>
        </TableCell>
        <TableCell
          className="border-r border-zinc-800 cursor-pointer"
          style={{ width: 40, minWidth: 40, maxWidth: 40 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompleted(tile.id, !tile.is_completed);
          }}
        >
          <div className="flex items-center justify-center">
            {tile.is_completed ? (
              <CircleCheck className="h-4 w-4 text-green-500" />
            ) : (
              <CircleIcon className="h-4 w-4 text-zinc-600 hover:text-zinc-400 transition-colors" />
            )}
          </div>
        </TableCell>
        <TableCell className={cn('text-xs border-r border-zinc-800 truncate', tile.is_completed ? 'text-zinc-500 line-through' : isUnread ? 'text-red-400' : 'text-zinc-300')} style={{ width: colWidths.title, minWidth: colWidths.title, maxWidth: colWidths.title }}>
          {tile.title || `Tile ${tile.id.slice(0, 8)}`}
        </TableCell>
        <TableCell className="border-r border-zinc-800 overflow-visible" style={{ width: colWidths.actionType, minWidth: colWidths.actionType, maxWidth: colWidths.actionType }}>
          <InlineActionDropdown
            tile={tile}
            onUpdate={(data) => onActionTypeChange(tile.id, data)}
          />
        </TableCell>
        <TableCell className="border-r border-zinc-800 overflow-hidden py-1" style={{ width: colWidths.sparks, minWidth: colWidths.sparks, maxWidth: colWidths.sparks }}>
          {tile.sparks && tile.sparks.length > 0 ? (
            <div className="flex gap-1.5 items-center overflow-hidden">
              {tile.sparks.map((spark) => (
                <button
                  key={spark.id}
                  className="hover:opacity-80 hover:scale-105 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSparkClick(spark as Spark);
                  }}
                >
                  <SparkChip spark={spark} />
                </button>
              ))}
            </div>
          ) : (
            <span className="text-zinc-600 text-sm">—</span>
          )}
        </TableCell>
        <TableCell
          className="border-r border-zinc-800 overflow-hidden py-1 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          style={{ width: colWidths.tags, minWidth: colWidths.tags, maxWidth: colWidths.tags }}
          onClick={(e) => {
            e.stopPropagation();
            setTagDropdownOpen(!tagDropdownOpen);
          }}
        >
          <div ref={tagCellRef} className="relative">
            {tile.tags && tile.tags.length > 0 ? (
              <div className="flex gap-1 overflow-hidden">
                {tile.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="text-xs px-1.5 py-0"
                    style={{
                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                      color: tag.color || undefined,
                      borderColor: tag.color ? `${tag.color}40` : undefined,
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-zinc-600 text-sm">—</span>
            )}
            <TagDropdown
              tileIds={selected && selectedIds.size > 1 ? Array.from(selectedIds) : [tile.id]}
              tileTags={tile.tags || []}
              allTags={allTags}
              open={tagDropdownOpen}
              onClose={() => setTagDropdownOpen(false)}
              anchorRef={tagCellRef}
            />
          </div>
        </TableCell>
        <TableCell className="text-zinc-400 text-xs border-r border-zinc-800" style={{ width: 80, minWidth: 80, maxWidth: 80 }}>
          {new Date(tile.created_at).toLocaleDateString('it-IT')}
        </TableCell>
        <TableCell className="text-right border-r border-zinc-800" style={{ width: 56, minWidth: 56, maxWidth: 56 }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-500 hover:text-red-400"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(tile.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>
    </Fragment>
  );
}

export default function TilesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedMemo, setSelectedMemo] = useState<Spark | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { tileIds: aiFilterIds, clearFilter } = useFilterStore();

  // Column filters
  const [titleFilter, setTitleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<Set<ActionType>>(new Set());
  const [sparkTypeFilter, setSparkTypeFilter] = useState<Set<SparkType>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [completedFilter, setCompletedFilter] = useState<'all' | 'done' | 'todo'>('all');

  // Filter popup open state
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const titleHeadRef = useRef<HTMLTableCellElement>(null);
  const actionHeadRef = useRef<HTMLTableCellElement>(null);
  const sparksHeadRef = useRef<HTMLTableCellElement>(null);
  const tagsHeadRef = useRef<HTMLTableCellElement>(null);
  const dateHeadRef = useRef<HTMLTableCellElement>(null);
  const completedHeadRef = useRef<HTMLTableCellElement>(null);

  // Column widths (resizable)
  const [colWidths, setColWidths] = useState({
    title: 220,
    actionType: 140,
    sparks: 340,
    tags: 160,
  });
  const setColWidth = useCallback(
    (col: keyof typeof colWidths, w: number) =>
      setColWidths((prev) => ({ ...prev, [col]: w })),
    []
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tiles', { page }],
    queryFn: () => tilesApi.list({ page, limit: 50 }),
  });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tiles'] }),
    onError: () => toast.error('Errore aggiornamento azione'),
  });

  const handleActionTypeChange = useCallback((tileId: string, data: { action_type: ActionType; start_at?: string | null; end_at?: string | null; is_event?: boolean; all_day?: boolean }) => {
    actionTypeMutation.mutate({ tileId, updates: data });
  }, [actionTypeMutation]);

  const completedMutation = useMutation({
    mutationFn: async ({ tileId, completed }: { tileId: string; completed: boolean }) => {
      const result = await tilesApi.update(tileId, { is_completed: completed });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async ({ tileId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tiles'] });
      const prev = queryClient.getQueryData(['tiles', { page }]);
      queryClient.setQueryData(['tiles', { page }], (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((t: Tile) => t.id === tileId ? { ...t, is_completed: completed } : t) };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['tiles', { page }], ctx.prev);
      toast.error('Errore aggiornamento');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tiles'] }),
  });

  const handleToggleCompleted = useCallback((tileId: string, completed: boolean) => {
    completedMutation.mutate({ tileId, completed });
  }, [completedMutation]);

  const allTags = tagsResult?.data || [];
  const allTiles = data?.data || [];
  const pagination = data?.pagination;

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
    if (completedFilter === 'done') {
      result = result.filter((t) => t.is_completed);
    } else if (completedFilter === 'todo') {
      result = result.filter((t) => !t.is_completed);
    }
    return result;
  }, [allTiles, aiFilterIds, titleFilter, actionFilter, sparkTypeFilter, tagFilter, dateFrom, dateTo, completedFilter]);

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
    <div className="flex flex-col h-full">
      <Header
        title="Tiles"
        actions={selectedIds.size > 0 ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/20 text-blue-400">
              {selectedIds.size} selezionat{selectedIds.size === 1 ? 'o' : 'i'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
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
              className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-8 px-3"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Elimina ({selectedIds.size})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const { markRead } = useTileNotificationStore.getState();
                selectedIds.forEach((id) => markRead(id));
                setSelectedIds(new Set());
                toast.success(`${selectedIds.size} tile segnat${selectedIds.size === 1 ? 'o' : 'i'} come lett${selectedIds.size === 1 ? 'o' : 'i'}`);
              }}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 h-8 px-3"
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Segna come letti
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 hover:text-zinc-300 h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : undefined}
      />

      <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
        {/* AI Filter Banner */}
        {aiFilterIds && (
          <div className="flex items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2.5">
            <p className="text-sm text-purple-400">
              Filtro AI attivo — {tiles.length} tile trovati
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilter}
              className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 h-7 px-2"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Rimuovi filtro
            </Button>
          </div>
        )}

        {/* Tile count + active filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <LayoutGrid className="h-5 w-5 text-zinc-400" />
          <span className="text-sm text-zinc-400">
            {tiles.length}{pagination?.total ? ` / ${pagination.total}` : ''} tiles
          </span>
          {(titleFilter || actionFilter.size > 0 || sparkTypeFilter.size > 0 || tagFilter.size > 0 || dateFrom || dateTo || completedFilter !== 'all') && (
            <button
              onClick={() => {
                setTitleFilter('');
                setActionFilter(new Set());
                setSparkTypeFilter(new Set());
                setTagFilter(new Set());
                setDateFrom('');
                setDateTo('');
                setCompletedFilter('all');
              }}
              className="text-xs text-blue-400 hover:text-blue-300 ml-2"
            >
              Rimuovi filtri
            </button>
          )}
        </div>

        {/* Tiles table */}
        {isLoading ? (
          <p className="text-center text-zinc-400 py-8">Caricamento...</p>
        ) : tiles.length === 0 ? (
          <div className="text-center py-16">
            <LayoutGrid className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">Nessun tile trovato</p>
            <p className="text-sm text-zinc-500 mt-1">
              I tiles vengono creati automaticamente quando invii più memo insieme
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <Table style={{ tableLayout: 'fixed', width: colWidths.title + colWidths.actionType + colWidths.sparks + colWidths.tags + 40 + 40 + 40 + 80 + 56, minWidth: colWidths.title + colWidths.actionType + colWidths.sparks + colWidths.tags + 40 + 40 + 40 + 80 + 56 }}>
                <TableHeader className="sticky top-0 z-10 bg-zinc-900">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="border-r border-zinc-800" style={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                      <button
                        onClick={() => handleSelectAll(!allSelected)}
                        className={`h-4 w-4 rounded flex items-center justify-center border transition-colors ${
                          allSelected
                            ? 'bg-blue-500 border-blue-500'
                            : someSelected
                              ? 'bg-blue-500/50 border-blue-500'
                              : 'bg-transparent border-zinc-300'
                        }`}
                      >
                        {(allSelected || someSelected) && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </button>
                    </TableHead>
                    <TableHead
                      ref={completedHeadRef}
                      className="border-r border-zinc-800"
                      style={{ width: 40, minWidth: 40, maxWidth: 40 }}
                    >
                      <button
                        onClick={() => setOpenFilter(openFilter === 'completed' ? null : 'completed')}
                        className="flex items-center justify-center w-full"
                      >
                        <Filter className={cn('h-3 w-3 transition-colors', completedFilter !== 'all' ? 'text-blue-400' : 'text-zinc-600')} />
                      </button>
                    </TableHead>
                    <FilterableHead
                      label="Titolo"
                      width={colWidths.title}
                      onResize={(w) => setColWidth('title', w)}
                      className="text-zinc-400 border-r border-zinc-800"
                      hasActiveFilter={!!titleFilter}
                      filterOpen={openFilter === 'title'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'title' ? null : 'title')}
                      headRef={titleHeadRef}
                    />
                    <FilterableHead
                      label="Azione"
                      width={colWidths.actionType}
                      onResize={(w) => setColWidth('actionType', w)}
                      className="text-zinc-400 border-r border-zinc-800"
                      hasActiveFilter={actionFilter.size > 0}
                      filterOpen={openFilter === 'action'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'action' ? null : 'action')}
                      headRef={actionHeadRef}
                    />
                    <FilterableHead
                      label="Sparks"
                      width={colWidths.sparks}
                      onResize={(w) => setColWidth('sparks', w)}
                      className="text-zinc-400 text-left border-r border-zinc-800"
                      hasActiveFilter={sparkTypeFilter.size > 0}
                      filterOpen={openFilter === 'sparks'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'sparks' ? null : 'sparks')}
                      headRef={sparksHeadRef}
                    />
                    <FilterableHead
                      label="Tags"
                      width={colWidths.tags}
                      onResize={(w) => setColWidth('tags', w)}
                      className="text-zinc-400 text-left border-r border-zinc-800"
                      hasActiveFilter={tagFilter.size > 0}
                      filterOpen={openFilter === 'tags'}
                      onToggleFilter={() => setOpenFilter(openFilter === 'tags' ? null : 'tags')}
                      headRef={tagsHeadRef}
                    />
                    <TableHead
                      ref={dateHeadRef}
                      className="text-zinc-400 border-r border-zinc-800"
                      style={{ width: 80, minWidth: 80, maxWidth: 80 }}
                    >
                      <button
                        onClick={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
                        className="flex items-center gap-1 w-full text-left"
                      >
                        <span className="truncate">Data</span>
                        <Filter className={cn('h-3 w-3 shrink-0 transition-colors', (dateFrom || dateTo) ? 'text-blue-400' : 'text-zinc-600')} />
                      </button>
                    </TableHead>
                    <TableHead className="text-zinc-400 text-right border-r border-zinc-800" style={{ width: 56, minWidth: 56, maxWidth: 56 }} />
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
                      onSparkClick={setSelectedMemo}
                      onTileClick={setSelectedTile}
                      onActionTypeChange={handleActionTypeChange}
                      onToggleCompleted={handleToggleCompleted}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              Pagina {pagination.page} di {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="border-zinc-800"
              >
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
                className="border-zinc-800"
              >
                Successiva
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Column filter popups */}
      <FilterPopup anchorRef={completedHeadRef} open={openFilter === 'completed'} onClose={() => setOpenFilter(null)}>
        <div className="w-36 flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 mb-1">Stato</label>
          {([['all', 'Tutti'], ['done', 'Completati'], ['todo', 'Da completare']] as const).map(([val, label]) => (
            <button
              key={val}
              className={cn('flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded transition-colors', completedFilter === val ? 'bg-zinc-800' : 'hover:bg-zinc-800/50')}
              onClick={() => setCompletedFilter(val)}
            >
              {val === 'done' && <CircleCheck className="h-3.5 w-3.5 text-green-500" />}
              {val === 'todo' && <CircleIcon className="h-3.5 w-3.5 text-zinc-500" />}
              {val === 'all' && <CircleIcon className="h-3.5 w-3.5 text-zinc-600" />}
              <span className="text-zinc-300 flex-1">{label}</span>
              {completedFilter === val && <Check className="h-3 w-3 text-blue-400" />}
            </button>
          ))}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={titleHeadRef} open={openFilter === 'title'} onClose={() => setOpenFilter(null)}>
        <div className="w-48 flex flex-col gap-2">
          <label className="text-[11px] text-zinc-500">Cerca nel titolo</label>
          <div className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5">
            <Search className="h-3 w-3 text-zinc-500 shrink-0" />
            <input
              type="text"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              placeholder="Filtra..."
              autoFocus
              className="bg-transparent text-xs text-white w-full focus:outline-none placeholder:text-zinc-600"
            />
            {titleFilter && (
              <button onClick={() => setTitleFilter('')} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={actionHeadRef} open={openFilter === 'action'} onClose={() => setOpenFilter(null)}>
        <div className="w-40 flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 mb-1">Tipo azione</label>
          {(['none', 'anytime', 'deadline', 'event'] as ActionType[]).map((at) => {
            const cfg = ACTION_TYPE_BADGE[at];
            const Icon = cfg.icon;
            const active = actionFilter.has(at);
            return (
              <button
                key={at}
                className={cn('flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded transition-colors', active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50')}
                onClick={() => {
                  setActionFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(at)) next.delete(at); else next.add(at);
                    return next;
                  });
                }}
              >
                <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                <span className="text-zinc-300 flex-1">{cfg.label}</span>
                {active && <Check className="h-3 w-3 text-blue-400" />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={sparksHeadRef} open={openFilter === 'sparks'} onClose={() => setOpenFilter(null)}>
        <div className="w-40 flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 mb-1">Tipo spark</label>
          {SPARK_TYPE_OPTIONS.map((opt) => {
            const active = sparkTypeFilter.has(opt.value);
            const TypeIcon = typeIcons[opt.value];
            const iconColor = typeIconColors[opt.value];
            return (
              <button
                key={opt.value}
                className={cn('flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded transition-colors', active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50')}
                onClick={() => {
                  setSparkTypeFilter((prev) => {
                    const next = new Set(prev);
                    if (next.has(opt.value)) next.delete(opt.value); else next.add(opt.value);
                    return next;
                  });
                }}
              >
                <TypeIcon className={cn('h-3.5 w-3.5', iconColor)} />
                <span className="text-zinc-300 flex-1">{opt.label}</span>
                {active && <Check className="h-3 w-3 text-blue-400" />}
              </button>
            );
          })}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={tagsHeadRef} open={openFilter === 'tags'} onClose={() => setOpenFilter(null)}>
        <div className="w-48 flex flex-col gap-1">
          <label className="text-[11px] text-zinc-500 mb-1">Tags</label>
          {allTags.length === 0 ? (
            <p className="text-xs text-zinc-500 py-1">Nessun tag</p>
          ) : (
            allTags.map((tag) => {
              const active = tagFilter.has(tag.id);
              return (
                <button
                  key={tag.id}
                  className={cn('flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded transition-colors', active ? 'bg-zinc-800' : 'hover:bg-zinc-800/50')}
                  onClick={() => {
                    setTagFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag.id)) next.delete(tag.id); else next.add(tag.id);
                      return next;
                    });
                  }}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#3B82F6' }} />
                  <span className="text-zinc-300 flex-1 truncate">{tag.name}</span>
                  {active && <Check className="h-3 w-3 text-blue-400" />}
                </button>
              );
            })
          )}
        </div>
      </FilterPopup>

      <FilterPopup anchorRef={dateHeadRef} open={openFilter === 'date'} onClose={() => setOpenFilter(null)}>
        <div className="w-52 flex flex-col gap-2">
          <label className="text-[11px] text-zinc-500">Intervallo date</label>
          <div className="flex flex-col gap-1.5">
            <div>
              <label className="text-[11px] text-zinc-500">Da</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500">A</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-blue-400 hover:text-blue-300 text-left"
            >
              Rimuovi
            </button>
          )}
        </div>
      </FilterPopup>

      <SparkViewer
        spark={selectedMemo}
        open={selectedMemo !== null}
        onOpenChange={(open) => { if (!open) setSelectedMemo(null); }}
      />

      <TileDetailModal
        tile={selectedTile}
        open={selectedTile !== null}
        onOpenChange={(open) => { if (!open) setSelectedTile(null); }}
      />
    </div>
  );
}
