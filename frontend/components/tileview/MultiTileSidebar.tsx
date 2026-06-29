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
import { useTypeIcons } from '@/store/type-icons-store';
import { useStatuses } from '@/store/statuses-store';
import { useActionColors } from '@/store/action-colors-store';
import { usePixelTheme } from '@/components/pixel';
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
  const theme = usePixelTheme();
  const bW = 1;
  const queryClient = useQueryClient();
  const { statuses: allStatuses } = useStatuses();
  const actionColors = useActionColors();
  const { icons: typeIcons, tileIcons, assignIcon } = useTypeIcons();

  const ids = tiles.map((t) => t.id);

  const allActionsSame = tiles.length > 0 && tiles.every((t) => actionKey(t) === actionKey(tiles[0]));
  const commonActionKey = allActionsSame ? actionKey(tiles[0]) : null;

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

  const allStatusSame = tiles.length > 0 && tiles.every((t) => (t.status_id || null) === (tiles[0].status_id || null));
  const commonStatusId: string | null = allStatusSame ? (tiles[0]?.status_id || null) : null;

  const allIconsSame = tiles.length > 0 && tiles.every((t) => (tileIcons[t.id] || '') === (tileIcons[tiles[0].id] || ''));
  const commonIconId: string | null = allIconsSame ? (tileIcons[tiles[0]?.id] || null) : null;

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
      bulkUpdate({
        start_at: new Date(`${newDate}T09:00:00`).toISOString(),
        end_at: new Date(`${newDate}T10:00:00`).toISOString(),
      });
    }
  };

  const setStatus = (id: string | null) => bulkUpdate({ status_id: id });
  const setIcon = (iconId: string | null) => { ids.forEach((id) => assignIcon(id, iconId)); };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };

  return (
    <div
      style={{
        borderLeft: `${bW}px solid ${theme.border}`,
        background: theme.bg2,
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 240 : 32,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          borderBottom: `${bW}px solid ${theme.border}`,
          cursor: 'pointer',
          flexShrink: 0,
          color: theme.ink2,
        }}
      >
        {open
          ? <IconLayoutSidebarRightCollapse size={16} />
          : <IconLayoutSidebarRightExpand size={16} />
        }
      </button>

      {open && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: theme.accent,
              }}
            >
              {tiles.length} tile selezionati
            </div>
            {onClearSelection && (
              <button
                onClick={onClearSelection}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--ob-font-mono)',
                  fontSize: 8,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.ink3,
                  padding: 0,
                }}
              >
                Annulla
              </button>
            )}
          </div>

          {/* Action type */}
          <div>
            <label style={labelStyle}>
              Action {!allActionsSame && <span style={{ color: '#F5A623', textTransform: 'none' }}>— misto</span>}
            </label>
            {(() => {
              const row1 = ACTION_OPTS.slice(0, 2);
              const row2 = ACTION_OPTS.slice(2);
              const renderBtn = (opt: typeof ACTION_OPTS[number]) => {
                const isActive = commonActionKey === opt.key;
                const OptIcon = opt.icon;
                const styleKey = opt.action_type === 'event' && opt.all_day ? 'allday' : opt.action_type;
                const actionColor = (actionColors as Record<string, string>)[styleKey] || theme.ink3;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAction(opt)}
                    disabled={saving}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      height: 34,
                      borderRadius: 9,
                      background: isActive ? `${theme.accent}22` : 'transparent',
                      color: isActive ? theme.accent : theme.ink2,
                      border: `1px solid ${isActive ? theme.accent : theme.border}`,
                      fontFamily: 'var(--ob-font-sans)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      letterSpacing: 0,
                      textTransform: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      position: 'relative',
                      boxShadow: 'none',
                    }}
                  >
                    {(
                      <OptIcon size={14} color={isActive ? theme.accent : theme.ink2} />
                    )}
                    {({ 'NOTES': 'Note', 'TO DO': 'To-do', 'DUE': 'Scadenza', 'ALL DAY': 'Giornata', 'TIMED': 'A orario' } as Record<string, string>)[opt.label] ?? opt.label}
                  </button>
                );
              };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4 }}>{row1.map(renderBtn)}</div>
                  <div style={{ display: 'flex', gap: 4 }}>{row2.map(renderBtn)}</div>
                </div>
              );
            })()}
          </div>

          {/* Date — only when action is unified and supports a date */}
          {showDate && (
            <div>
              <label style={labelStyle}>
                Date {dateMixed && <span style={{ color: '#F5A623', textTransform: 'none' }}>— misto</span>}
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDate(e.target.value)}
                disabled={saving}
                placeholder={dateMixed ? 'Misto' : ''}
                style={{
                  width: '100%',
                  background: theme.surface,
                  border: `${bW}px solid ${theme.border}`,
                  borderRadius: 10,
                  padding: '0 10px',
                  height: 36,
                  color: theme.ink,
                  fontFamily: 'var(--ob-font-sans)',
                  fontSize: 13,
                  outline: 'none',
                  colorScheme: theme.mode,
                }}
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

          <div
            style={{
              fontFamily: 'var(--ob-font-sans)',
              fontSize: 11,
              fontStyle: 'italic',
              color: theme.ink3,
              paddingTop: 8,
              borderTop: `${bW}px solid ${theme.border}`,
              lineHeight: 1.5,
            }}
          >
            Title, tag e contenuti sono modificabili solo aprendo un singolo tile.
          </div>
        </div>
      )}
    </div>
  );
}

function MixedTypeIconPicker({
  icons, currentId, mixed, onChange, disabled,
}: {
  icons: { id: string; icon: string; color?: string; name: string }[];
  currentId: string | null;
  mixed: boolean;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const theme = usePixelTheme();
  const bW = 1;
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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };
  const popupItem = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    borderRadius: 6,
    background: active ? theme.surfaceVariant : 'transparent',
    border: `${bW}px solid transparent`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12,
    cursor: 'pointer',
  });

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>
        Type {mixed && <span style={{ color: '#F5A623', textTransform: 'none' }}>— misto</span>}
      </label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: current?.color ? `${current.color}40` : (theme.surface),
          border: `${bW}px solid ${theme.border}`,
          borderRadius: 10,
          padding: '0 10px',
          height: 36,
          color: theme.ink,
          fontFamily: 'var(--ob-font-sans)',
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {mixed ? (
          <span style={{ color: '#F5A623', flex: 1, fontSize: 11 }}>Misto</span>
        ) : CurrentComp && current ? (
          <>
            <div
              style={{
                width: 18,
                height: 18,
                background: current.color || theme.surfaceVariant,
                border: `${bW}px solid ${theme.border}`,
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CurrentComp size={10} color={readableOn(current.color || theme.surfaceVariant)} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{current.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: 11 }}>Nessuno</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `${bW}px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight: 192,
            overflowY: 'auto',
          }}
        >
          <button onClick={() => { onChange(null); setOpen(false); }} style={popupItem(false)}>
            <span style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3 }}>—</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nessuno</span>
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = !mixed && currentId === icon.id;
            return (
              <button key={icon.id} onClick={() => { onChange(icon.id); setOpen(false); }} style={popupItem(selected)}>
                {Comp && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      background: icon.color || theme.surfaceVariant,
                      border: `${bW}px solid ${theme.border}`,
                      borderRadius: 5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Comp size={10} color={readableOn(icon.color || theme.surfaceVariant)} />
                  </div>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon.name}</span>
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
  const theme = usePixelTheme();
  const bW = 1;
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

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 9,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 4,
  };
  const popupItem = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    borderRadius: 6,
    background: active ? theme.surfaceVariant : 'transparent',
    border: `${bW}px solid transparent`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12,
    cursor: 'pointer',
  });

  return (
    <div>
      <label style={labelStyle}>
        Status {mixed && <span style={{ color: '#F5A623', textTransform: 'none' }}>— misto</span>}
      </label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: theme.surface,
          border: `${bW}px solid ${theme.border}`,
          borderRadius: 10,
          padding: '0 10px',
          height: 36,
          color: theme.ink,
          fontFamily: 'var(--ob-font-sans)',
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {mixed ? (
          <span style={{ color: '#F5A623', flex: 1, fontSize: 11 }}>Misto</span>
        ) : selected ? (
          <span style={{ position: 'relative', zIndex: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{selected.name}</span>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: 11 }}>Nessuno</span>
        )}
      </button>
      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: theme.surface,
            border: `${bW}px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight: 192,
            overflowY: 'auto',
          }}
        >
          {statuses.map((p) => {
            const isSel = !mixed && value === p.id;
            return (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }} style={popupItem(isSel)}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
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
