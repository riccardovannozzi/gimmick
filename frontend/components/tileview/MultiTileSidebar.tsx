'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconPin, IconBolt, IconClock, IconCalendarEvent, IconCalendar,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { tilesApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTypeIcons } from '@/store/type-icons-store';
import { useStatuses } from '@/store/statuses-store';
import { useActionColors } from '@/store/action-colors-store';
import { readableOn } from '@/lib/palette';
import type { Tile, ActionType, StatusShape } from '@/types';

const AllIcons = TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string; color?: string }>>;

function toLocalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Composite action key so "all-day event" and "timed event" are distinct
function actionKey(t: Tile): string {
  if (t.action_type === 'event') return t.all_day ? 'event:allday' : 'event:timed';
  return t.action_type || 'none';
}

const ACTION_OPTS = [
  { key: 'none', label: 'NOTES', icon: IconPin, action_type: 'none' as ActionType, all_day: false, is_event: false },
  { key: 'anytime', label: 'TO DO', icon: IconBolt, action_type: 'anytime' as ActionType, all_day: false, is_event: false },
  { key: 'deadline', label: 'DUE', icon: IconClock, action_type: 'deadline' as ActionType, all_day: false, is_event: false },
  { key: 'event:allday', label: 'ALL DAY', icon: IconCalendarEvent, action_type: 'event' as ActionType, all_day: true, is_event: true },
  { key: 'event:timed', label: 'TIMED', icon: IconCalendar, action_type: 'event' as ActionType, all_day: false, is_event: true },
] as const;

interface Props {
  tiles: Tile[];
  open: boolean;
  onToggle: () => void;
  invalidateKeys?: string[];
  onClearSelection?: () => void;
}

export function MultiTileSidebar({ tiles, open, onToggle, invalidateKeys = ['tiles-calendar'], onClearSelection }: Props) {
  const queryClient = useQueryClient();
  const { statuses: allStatuses } = useStatuses();
  const actionColors = useActionColors();
  const { icons: typeIcons, tileIcons, assignIcon } = useTypeIcons();

  const ids = tiles.map((t) => t.id);

  // Action type (composite)
  const allActionsSame = tiles.length > 0 && tiles.every((t) => actionKey(t) === actionKey(tiles[0]));
  const commonActionKey = allActionsSame ? actionKey(tiles[0]) : null;

  // Date — only shown if all tiles share an action with a date concept
  const showDate = allActionsSame && tiles.length > 0 && (tiles[0].action_type === 'deadline' || tiles[0].action_type === 'event');
  const isDeadline = showDate && tiles[0].action_type === 'deadline';
  const isAllDay = showDate && tiles[0].action_type === 'event' && !!tiles[0].all_day;
  const dateField: keyof Tile = isDeadline ? 'end_at' : 'start_at';
  const dateValue = (() => {
    if (!showDate) return '';
    const refs = tiles.map((t) => (t[dateField] as string | undefined) || (isDeadline ? (t.start_at as string | undefined) : (t.end_at as string | undefined)));
    if (refs.some((r) => !r)) return '';
    const days = refs.map((r) => toLocalDate(r as string));
    if (!days.every((d) => d === days[0])) return '';
    return days[0];
  })();
  const dateMixed = showDate && !dateValue;

  // Status
  const allStatusSame = tiles.length > 0 && tiles.every((t) => (t.status_id || null) === (tiles[0].status_id || null));
  const commonStatusId: string | null = allStatusSame ? (tiles[0]?.status_id || null) : null;


  // Type icon
  const allIconsSame = tiles.length > 0 && tiles.every((t) => (tileIcons[t.id] || '') === (tileIcons[tiles[0].id] || ''));
  const commonIconId: string | null = allIconsSame ? (tileIcons[tiles[0]?.id] || null) : null;

  // ── Bulk update helpers ──
  const patchCaches = useCallback((updates: Record<string, unknown>) => {
    const idSet = new Set(ids);
    const patch = (t: any) => (t && idSet.has(t.id) ? { ...t, ...updates } : t);
    ids.forEach((id) => {
      queryClient.setQueriesData({ queryKey: ['tile-detail', id] }, (old: any) => {
        if (!old?.data) return old;
        return { ...old, data: { ...old.data, ...updates } };
      });
    });
    const patchList = (key: string) => {
      queryClient.setQueriesData({ queryKey: [key] }, (old: any) => {
        if (!old) return old;
        if (old.pages) return { ...old, pages: old.pages.map((p: any) => ({ ...p, data: (p.data || []).map(patch) })) };
        if (Array.isArray(old.data)) return { ...old, data: old.data.map(patch) };
        return old;
      });
    };
    patchList('calendar-events');
    patchList('tiles-calendar');
    patchList('tiles');
    invalidateKeys.forEach(patchList);
  }, [queryClient, ids, invalidateKeys]);

  const invalidateAll = useCallback(() => {
    ids.forEach((id) => queryClient.invalidateQueries({ queryKey: ['tile-detail', id] }));
    invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  }, [queryClient, ids, invalidateKeys]);

  const [saving, setSaving] = useState(false);
  const bulkUpdate = useCallback(async (updates: Parameters<typeof tilesApi.update>[1]) => {
    if (ids.length === 0) return;
    patchCaches(updates as Record<string, unknown>);
    setSaving(true);
    try {
      await Promise.all(ids.map((id) => tilesApi.update(id, updates).catch(() => null)));
    } finally {
      setSaving(false);
      invalidateAll();
    }
  }, [ids, patchCaches, invalidateAll]);

  // ── Field handlers ──
  const setAction = (opt: typeof ACTION_OPTS[number]) => {
    bulkUpdate({ action_type: opt.action_type, is_event: opt.is_event, all_day: opt.all_day });
  };

  const setDate = (newDate: string) => {
    if (!showDate || !newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    if (isDeadline) {
      bulkUpdate({ end_at: new Date(`${newDate}T23:59:59`).toISOString() });
    } else if (isAllDay) {
      bulkUpdate({
        start_at: new Date(`${newDate}T00:00:00`).toISOString(),
        end_at: new Date(`${newDate}T23:59:59`).toISOString(),
      });
    } else {
      // timed event — keep individual times if all tiles already share them, otherwise default 09:00–10:00
      bulkUpdate({
        start_at: new Date(`${newDate}T09:00:00`).toISOString(),
        end_at: new Date(`${newDate}T10:00:00`).toISOString(),
      });
    }
  };

  const setStatus = (id: string | null) => bulkUpdate({ status_id: id });
  const setIcon = (iconId: string | null) => { ids.forEach((id) => assignIcon(id, iconId)); };

  // Action button styling helper (mirrors TileSidebar) — plain solid 1.5px border.
  const getBorderStyle = (at: string): React.CSSProperties => {
    const c = (actionColors as Record<string, string>)[at] || '#3F3F46';
    return { border: `1.5px solid ${c}` };
  };

  // ── Render ──
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

      {open && (
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wide text-blue-400 font-medium">
              {tiles.length} tile selezionati
            </div>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Annulla
              </button>
            )}
          </div>

          {/* Action type */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">
              Action {!allActionsSame && <span className="text-amber-400 normal-case">— misto</span>}
            </label>
            {(() => {
              const row1 = ACTION_OPTS.slice(0, 2);
              const row2 = ACTION_OPTS.slice(2);
              const renderBtn = (opt: typeof ACTION_OPTS[number]) => {
                const isActive = commonActionKey === opt.key;
                const OptIcon = opt.icon;
                const styleKey = opt.action_type === 'event' && opt.all_day ? 'allday' : opt.action_type;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAction(opt)}
                    disabled={saving}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] font-medium transition-all relative',
                      isActive
                        ? 'bg-zinc-800/60 text-zinc-200'
                        : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800 opacity-70'
                    )}
                    style={getBorderStyle(styleKey)}
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

          {/* Date — only when action is unified and supports a date */}
          {showDate && (
            <div>
              <label className="text-[11px] text-zinc-500 mb-0.5 block">
                Date {dateMixed && <span className="text-amber-400">— misto</span>}
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                placeholder={dateMixed ? 'Misto' : ''}
                className="bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-blue-500"
                style={{ width: '100%', colorScheme: 'dark' }}
              />
            </div>
          )}

          {/* Type icon */}
          {typeIcons.length > 0 && (
            <MixedTypeIconPicker
              icons={typeIcons}
              currentId={commonIconId}
              mixed={!allIconsSame}
              onChange={setIcon}
              disabled={saving}
            />
          )}

          {/* Status */}
          {allStatuses.length > 0 && (
            <MixedStatusPicker
              statuses={allStatuses}
              value={commonStatusId}
              mixed={!allStatusSame}
              onChange={setStatus}
              disabled={saving}
            />
          )}

          <div className="text-[10px] text-zinc-600 italic pt-2 border-t border-zinc-800 leading-relaxed">
            Title, tag e contenuti sono modificabili solo aprendo un singolo tile.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline pickers (simpler than the single-tile versions; aware of "mixed" state) ──

function MixedTypeIconPicker({
  icons, currentId, mixed, onChange, disabled,
}: {
  icons: { id: string; icon: string; color?: string; name: string }[];
  currentId: string | null;
  mixed: boolean;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = currentId ? icons.find((i) => i.id === currentId) : null;
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

  return (
    <div className="relative">
      <label className="text-[11px] text-zinc-500 mb-1 block">
        Type {mixed && <span className="text-amber-400">— misto</span>}
      </label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center gap-2 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
        style={{ backgroundColor: current?.color ? current.color + '40' : 'rgba(39,39,42,0.6)' }}
      >
        {mixed ? (
          <span className="text-amber-400 flex-1 text-left text-[11px]">Misto</span>
        ) : CurrentComp && current ? (
          <>
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: current.color || '#27272A' }}>
              <CurrentComp size={12} color={readableOn(current.color || '#27272A')} />
            </div>
            <span className="truncate flex-1 text-left">{current.name}</span>
          </>
        ) : (
          <span className="text-zinc-500 flex-1 text-left text-[11px]">Nessuno</span>
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
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center text-zinc-500">—</span>
            <span className="text-zinc-400 truncate flex-1">Nessuno</span>
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = !mixed && currentId === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => { onChange(icon.id); setOpen(false); }}
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
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

function MixedStatusPicker({
  statuses, value, mixed, onChange, disabled,
}: {
  statuses: { id: string; name: string; shape: string }[];
  value: string | null;
  mixed: boolean;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = !mixed && value ? statuses.find((p) => p.id === value) || null : null;

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
      <label className="text-[11px] text-zinc-500 mb-1 block">
        Status {mixed && <span className="text-amber-400">— misto</span>}
      </label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center gap-2 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 transition-colors relative overflow-hidden"
      >
        {mixed ? (
          <span className="text-amber-400 flex-1 text-left text-[11px]">Misto</span>
        ) : selected ? (
          <span className="relative z-10 truncate flex-1 text-left">{selected.name}</span>
        ) : (
          <span className="text-zinc-500 flex-1 text-left text-[11px]">Nessuno</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          {statuses.map((p) => {
            const isSel = !mixed && value === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={cn(
                  'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs hover:bg-zinc-700/50 transition-colors',
                  isSel && 'bg-zinc-700/30'
                )}
              >
                <span className="text-zinc-300 truncate flex-1">{p.name}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

// Suppress unused-shape-type warning while keeping the type meaningful for future renderers
type _MaybeUsed = StatusShape;
