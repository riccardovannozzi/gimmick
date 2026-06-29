'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, IconCamera, IconPhoto, IconVideo, IconMicrophone, IconEdit, IconPaperclip, IconFileText, IconFile, IconPlayerPlay, IconTrash, IconExternalLink, IconBolt, IconClock, IconCalendar, IconArrowUp, IconMaximize, IconX, IconList, IconShare2, IconChevronDown } from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { toast } from 'sonner';
import { tilesApi, sparksApi, uploadApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';
import { useStatuses } from '@/store/statuses-store';
import { cn } from '@/lib/utils';
import { usePixelTheme, usePixelSettings } from '@/components/pixel';
import { resolveCaptureStyle } from '@/lib/pixel-theme';
import { useTypeIcons } from '@/store/type-icons-store';
import { useTagTypes } from '@/store/tag-types-store';
import { useActionColors } from '@/store/action-colors-store';
import { readableOn } from '@/lib/palette';
import type { StatusShape } from '@/types';
import { TimePicker } from '@/components/ui/time-picker';
import { SubtaskList } from '@/components/tileview/SubtaskList';
import { FlowCardList } from '@/components/flow/FlowCardList';
import { useFlow } from '@/lib/hooks/useFlow';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { MarkdownEditorModal } from '@/components/markdown/markdown-editor-modal';
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

// ─── Flag-aware style helpers (Obsidian nativo in shell, pixel arcade fuori) ──
// I colori arrivano già dal PixelTheme mappato sui token Obsidian quando lo
// shell è attivo; qui cambiamo la STRUTTURA (font Geist, hairline 1px + raggi,
// niente uppercase pixel né ombre dure).
type PT = ReturnType<typeof usePixelTheme>;

/** Eyebrow/section label (TITOLO, AZIONE, …). */
function obLabel(theme: PT): React.CSSProperties {
  return {
    fontFamily: 'var(--ob-font-mono)',
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: theme.ink3,
    display: 'block',
    marginBottom: 6,
  };
}

/** Field / select trigger box (input, dropdown trigger). */
function obField(theme: PT): React.CSSProperties {
  return {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    color: theme.ink,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 13.5,
  };
}

/** Dropdown row. */
function obPopupRow(theme: PT, active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 8px',
    textAlign: 'left',
    borderRadius: 6,
    background: active ? theme.surfaceVariant : 'transparent',
    border: `1px solid transparent`,
    color: active ? theme.ink : theme.ink2,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12,
    cursor: 'pointer',
  };
}

function TypeIconPicker({ tileId }: { tileId: string }) {
  const theme = usePixelTheme();
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

  const labelStyle = obLabel(theme);
  const popupItem = (active: boolean): React.CSSProperties => obPopupRow(theme, active);

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{'Tipo'}</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          ...obField(theme),
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: current?.color ? `${current.color}40` : (theme.surface),
          padding: '0 10px',
          height: 36,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {CurrentComp ? (
          <>
            <div
              style={{
                width: 18,
                height: 18,
                background: current?.color || theme.surfaceVariant,
                border: `1px solid ${theme.border}`,
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CurrentComp size={10} color={readableOn(current?.color || theme.surfaceVariant)} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{current!.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: 13.5 }}>Seleziona tipo...</span>
        )}
        {<IconChevronDown size={15} style={{ color: theme.ink3, flexShrink: 0 }} />}
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
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight:192,
            overflowY: 'auto',
          }}
        >
          <button onClick={() => { assignIcon(tileId, null); setOpen(false); }} style={popupItem(!currentIconId)}>
            <span style={{ width: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: theme.ink3 }}>—</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nessuno</span>
            {!currentIconId && (
              <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
          {icons.map((icon) => {
            const Comp = AllIcons[icon.icon];
            const selected = currentIconId === icon.id;
            return (
              <button
                key={icon.id}
                onClick={() => { assignIcon(tileId, icon.id); setOpen(false); }}
                style={popupItem(selected)}
              >
                {Comp && (
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      background: icon.color || theme.surfaceVariant,
                      border: `1px solid ${theme.border}`,
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
                {selected && (
                  <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  const theme = usePixelTheme();
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

  const labelStyle = obLabel(theme);
  const swatch: React.CSSProperties = {
    width: 18,
    height: 18,
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    borderRadius: 5,
  };
  const popupItem = (active: boolean): React.CSSProperties => obPopupRow(theme, active);

  return (
    <div>
      <label style={labelStyle}>{'Stato'}</label>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        style={{
          ...obField(theme),
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          height: 36,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {selected ? (
          <>
            <div style={swatch}>
              <InlineStatusSvg shape={selected.shape as StatusShape} color={theme.ink2} />
            </div>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, flex: 1, fontSize: 13.5 }}>{'Seleziona stato…'}</span>
        )}
        {<IconChevronDown size={15} style={{ color: theme.ink3, flexShrink: 0 }} />}
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
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight:192,
            overflowY: 'auto',
          }}
        >
          {statuses.map((p) => {
            const isSelected = value === p.id;
            return (
              <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }} style={popupItem(isSelected)}>
                <div style={swatch}>
                  <InlineStatusSvg shape={p.shape as StatusShape} color={theme.ink2} />
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                {isSelected && (
                  <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  const theme = usePixelTheme();
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

  const labelStyle = obLabel(theme);
  const popupItem = (active: boolean, busy: boolean): React.CSSProperties => ({
    ...obPopupRow(theme, active),
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
  });

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>Tag</label>
      <div
        ref={triggerRef}
        style={{
          ...obField(theme),
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 36,
          // TAG: in shell usa il tinta accent-soft come da design.
          background: `${theme.accent}1f`,
          color: theme.accent,
          padding: '0 10px',
          cursor: 'pointer',
        }}
        onClick={() => setOpen(!open)}
      >
        {selectedTag ? (
          <>
            <TagIcon
              emoji={getTypeEmoji(selectedTag.tag_type || 'topic')}
              color={getTypeColor(selectedTag.tag_type || 'topic') || theme.ink3}
              size={14}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTag.name}</span>
          </>
        ) : (
          <span style={{ color: theme.ink3, fontSize: 11 }}>Seleziona tag...</span>
        )}
      </div>
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
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            boxShadow: 'var(--ob-shadow-card)',
            padding: 4,
            maxHeight:256,
            overflowY: 'auto',
          }}
        >
          {allTags.length === 0 ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 11, color: theme.ink3, textAlign: 'center', padding: '12px 0', margin: 0 }}>Nessun tag</p>
          ) : (
            allTags.map((tag) => {
              const assigned = selectedTag?.id === tag.id;
              const busy = toggling === tag.id;
              const c = getTypeColor(tag.tag_type || 'topic') || theme.ink3;
              const emoji = getTypeEmoji(tag.tag_type || 'topic');
              return (
                <button
                  key={tag.id}
                  disabled={busy}
                  onClick={() => handleSelect(tag)}
                  style={popupItem(assigned, busy)}
                >
                  <TagIcon emoji={emoji} color={c} size={14} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</span>
                  {assigned && (
                    <svg width={12} height={12} style={{ color: theme.accent, flexShrink: 0 }} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
  const theme = usePixelTheme();
  const SparkIcon = SPARK_ICONS[spark.type] || IconFile;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editText, setEditText] = useState(spark.content || '');
  const textDirty = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  // Markdown editor modal for the inline text spark.
  const [textModalOpen, setTextModalOpen] = useState(false);

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

  const mediaWrap: React.CSSProperties = {
    overflow: 'hidden',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    borderRadius: 12,
    position: 'relative',
  };
  const overlayBtn = (danger: boolean): React.CSSProperties => ({
    padding: 4,
    background: danger ? '#E24B4A' : theme.surface,
    color: danger ? '#FFFFFF' : theme.ink2,
    border: `1px solid ${theme.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    display: 'inline-flex',
  });

  if (spark.type === 'text') {
    return (
      <div
        className="group"
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          padding: '10px 12px',
          position: 'relative',
          height: 128,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexShrink: 0 }}>
          <IconFileText size={11} style={{ color: theme.ink3 }} />
          <span style={obLabel(theme)}>
            Testo
          </span>
        </div>
        <div
          onClick={() => setTextModalOpen(true)}
          style={{
            flex: 1,
            overflow: 'auto',
            cursor: 'pointer',
            paddingRight: 4,
          }}
          title="Apri editor"
        >
          {editText.trim() ? (
            <MarkdownPreview markdown={editText} />
          ) : (
            <span style={{ color: theme.ink3, fontStyle: 'italic', fontSize: 12 }}>Vuoto — clicca per scrivere…</span>
          )}
        </div>
        {/* Action chips (edit + delete) appear on hover, top-right corner. */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}
        >
          <button
            onClick={() => setTextModalOpen(true)}
            style={{
              padding: 2,
              background: theme.surface,
              color: theme.ink2,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
            }}
            title="Modifica"
          >
            <IconMaximize size={11} />
          </button>
          <button
            onClick={handleDeleteClick}
            style={{
              padding: 2,
              background: confirmDelete ? '#E24B4A' : theme.surface,
              color: confirmDelete ? '#FFFFFF' : theme.ink2,
              border: `1px solid ${theme.border}`,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'inline-flex',
            }}
            title={confirmDelete ? 'Conferma eliminazione' : 'Elimina'}
          >
            <IconTrash size={11} />
          </button>
        </div>
        <MarkdownEditorModal
          open={textModalOpen}
          initialValue={editText}
          onSave={(md) => {
            setEditText(md);
            textDirty.current = false;
            onUpdateText(md);
            setTextModalOpen(false);
          }}
          onCancel={() => setTextModalOpen(false)}
          title="Modifica testo"
        />
      </div>
    );
  }

  if ((spark.type === 'photo' || spark.type === 'image') && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <img src={signedUrl} alt="" style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
          <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={overlayBtn(false)}>
            <IconExternalLink size={11} />
          </a>
          <button onClick={handleDeleteClick} style={overlayBtn(confirmDelete)}>
            <IconTrash size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (spark.type === 'video' && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <video src={signedUrl} style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: 8,
              background: theme.accent,
              color: theme.onAccent,
              border: `1px solid ${theme.border}`,
              display: 'inline-flex',
              cursor: 'pointer',
            }}
          >
            <IconPlayerPlay size={18} />
          </a>
        </div>
        <button
          onClick={handleDeleteClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
        >
          <IconTrash size={11} />
        </button>
      </div>
    );
  }

  // File: image preview if mime is image, otherwise icon thumbnail
  const isImageFile = spark.mime_type?.startsWith('image/');
  if (isImageFile && signedUrl) {
    return (
      <div className="group" style={mediaWrap}>
        <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
          <img src={signedUrl} alt={spark.file_name || ''} style={{ width: '100%', height: 128, objectFit: 'cover', display: 'block' }} />
        </a>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: `linear-gradient(to top, ${theme.surface}EE, transparent)`,
            padding: '4px 8px',
          }}
        >
          <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 10, color: theme.ink2, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {spark.file_name}
          </span>
        </div>
        <button
          onClick={handleDeleteClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
        >
          <IconTrash size={11} />
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
          className="group"
          style={{
            background: theme.surfaceVariant,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'zoom-in',
          }}
        >
          {/* Thumbnail — first page, interaction blocked so click falls through to wrapper */}
          <div style={{ position: 'relative', height: 96, background: theme.bg1, overflow: 'hidden', pointerEvents: 'none' }}>
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
              title={spark.file_name || 'PDF'}
              style={{ width: '100%', height: '100%', border: 0 }}
            />
            <div style={{ position: 'absolute', inset: 0 }} />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              borderTop: `1px solid ${theme.border}`,
              background: theme.surface,
            }}
          >
            <IconFileText size={11} style={{ color: theme.ink2, flexShrink: 0 }} />
            <span
              style={{
                fontFamily: 'var(--ob-font-sans)',
                fontSize: 10,
                color: theme.ink2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={spark.file_name || ''}
            >
              {spark.file_name}
            </span>
            <IconMaximize size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: theme.ink3, flexShrink: 0 }} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ position: 'absolute', top: 4, right: 4, ...overlayBtn(confirmDelete) }}
          >
            <IconTrash size={11} />
          </button>
        </div>

        {/* Expand modal */}
        {pdfModalOpen && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              padding: 16,
            }}
            onClick={() => setPdfModalOpen(false)}
          >
            <div
              style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 16,
                boxShadow: 'var(--ob-shadow-modal, var(--ob-shadow-card))',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                width: 'min(95vw, 1100px)',
                height: 'min(95vh, 900px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderBottom: `1px solid ${theme.border}`,
                  background: theme.surfaceVariant,
                  flexShrink: 0,
                }}
              >
                <IconFileText size={14} style={{ color: theme.ink2, flexShrink: 0 }} />
                <span
                  style={{
                    fontFamily: 'var(--ob-font-sans)',
                    fontSize: 13.5,
                    fontWeight: 600,
                    letterSpacing: 0,
                    textTransform: 'none',
                    color: theme.ink,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={spark.file_name || ''}
                >
                  {spark.file_name || 'PDF'}
                </span>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: 4, color: theme.ink2, background: 'transparent', display: 'inline-flex' }}
                  title="Apri in nuovo tab"
                >
                  <IconExternalLink size={14} />
                </a>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  style={{ padding: 4, color: theme.ink2, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }}
                  title="Chiudi"
                >
                  <IconX size={14} />
                </button>
              </div>
              <iframe
                src={signedUrl}
                title={spark.file_name || 'PDF'}
                style={{ flex: 1, width: '100%', background: theme.bg1, border: 0 }}
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
      className="group"
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        cursor: 'pointer',
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: theme.surfaceVariant,
          border: `1px solid ${theme.border}`,
          borderRadius: 9,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <SparkIcon size={18} style={{ color: theme.ink2 }} />
      </div>
      <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: theme.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {spark.file_name || spark.type}
      </span>
      {signedUrl && (
        <IconExternalLink size={11} className="opacity-0 group-hover:opacity-100" style={{ color: theme.ink3, flexShrink: 0 }} />
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteClick(); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          padding: 2,
          background: confirmDelete ? '#E24B4A' : 'transparent',
          color: confirmDelete ? '#FFFFFF' : theme.ink3,
          border: confirmDelete ? `1px solid ${theme.border}` : 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          flexShrink: 0,
          ...(confirmDelete ? { opacity: 1 } : {}),
        }}
      >
        <IconTrash size={11} />
      </button>
    </a>
  );
}

/**
 * Body of the "Flow" tab. Linear card list — one card per node, drag to
 * reorder, inline-editable status/contatto/data chips.
 *
 * (Previously this was a DAG inspector with a vertical track + per-node
 * inspector — replaced by FlowCardList after migration 030 linearised the
 * data model.)
 */
function FlowTab({ tileId }: { tileId: string }) {
  return (
    <div className="px-3 pb-4 pt-3 overflow-y-auto h-full">
      <FlowCardList tileId={tileId} />
    </div>
  );
}

export function TileSidebar({
  tileId,
  open,
  onToggle,
  invalidateKeys = ['tiles-calendar'],
  flowNodeId,
  onSelectFlowNode,
  forceFlowTab,
}: {
  tileId: string | null;
  open: boolean;
  onToggle: () => void;
  invalidateKeys?: string[];
  /** Optional external selection (e.g. from canvas) that overrides the tab's
   *  default node pick (focus node → first node). The Flow tab itself is now
   *  always visible — this prop only steers WHICH node is loaded inside it. */
  flowNodeId?: string | null;
  /** Called when the inspector wants to deselect or jump to another node. */
  onSelectFlowNode?: (id: string | null) => void;
  /** Counter incremented whenever an outside trigger (e.g. a FLOW badge in
   *  canvas/calendar/kanban) wants the sidebar to switch to the Flow tab
   *  without specifying a particular node. Any change > 0 jumps the active
   *  tab — useful because clicking the same badge twice still has to react. */
  forceFlowTab?: number;
}) {
  const theme = usePixelTheme();
  const { settings: pixelSettings } = usePixelSettings();
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

  const [activeTab, setActiveTab] = useState<'edit' | 'list' | 'flow'>('edit');

  // Auto-jump to the Flow tab when an external caller (canvas, etc.) selects
  // a flow node. We deliberately do NOT switch away when flowNodeId clears —
  // the Flow tab is permanent now and falls back to the tile's focus node.
  useEffect(() => {
    if (flowNodeId) setActiveTab('flow');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowNodeId]);

  // External `forceFlowTab` pulse — bumped by `useFlowOpenRequest` whenever a
  // FLOW badge anywhere in the app wants the sidebar to open at the Flow tab.
  useEffect(() => {
    if (forceFlowTab && forceFlowTab > 0) setActiveTab('flow');
  }, [forceFlowTab]);
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
  // Toggles the centered markdown editor modal for the in-progress new-text spark.
  const [newTextModalOpen, setNewTextModalOpen] = useState(false);
  const [dropTargetIcon, setDropTargetIcon] = useState<string | null>(null);
  const addTextMutation = useMutation({
    // Accept the content as a parameter so the modal can fire-and-save in one
    // gesture — otherwise we'd be reading a stale `newTextContent` from the
    // closure right after calling `setNewTextContent(md)`.
    mutationFn: async (contentOverride?: string) => {
      if (!tileId) throw new Error('Nessun tile selezionato');
      const content = (contentOverride ?? newTextContent).trim();
      if (!content) throw new Error('Testo vuoto');
      const res = await sparksApi.create({ tile_id: tileId, type: 'text', content });
      if (!res.success) throw new Error(res.error || 'Errore creazione spark');
      return res;
    },
    onSuccess: () => {
      invalidateAll();
      setNewTextContent('');
      setShowNewText(false);
      setNewTextModalOpen(false);
      toast.success('Testo aggiunto');
    },
    onError: (err: Error) => {
      console.error('[TileSidebar] addTextMutation failed:', err);
      toast.error(err.message || 'Errore salvataggio');
    },
  });

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '0 8px',
    height: 28,
    borderRadius: 7,
    background: active ? theme.surface : 'transparent',
    color: active ? theme.accent : theme.ink2,
    border: `1px solid ${active ? theme.border : 'transparent'}`,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'none',
    cursor: 'pointer',
    boxShadow: active ? 'var(--ob-shadow-card)' : 'none',
  });
  const labelStyle = obLabel(theme);

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.border}`,
        background: theme.bg2,
        transition: 'width 200ms',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        width: open ? 280 : 32,
      }}
    >
      {/* Header: collapse button — alone if no tile, inlined with tabs if tile selected */}
      {(!open || !tileId) && (
        <button
          onClick={onToggle}
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid ${theme.border}`,
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
      )}

      {open && (<>
        {/* Header bar — collapse button + Edit/List/Flow tabs */}
        {tileId && (
          <div
            style={{
              height: 48,
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderBottom: `1px solid ${theme.border}`,
              background: theme.bg2,
              flexShrink: 0,
            }}
          >
            <button
              onClick={onToggle}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'transparent',
                color: theme.ink2,
                border: `1px solid ${theme.border}`,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Collassa sidebar"
            >
              <IconLayoutSidebarRightCollapse size={14} />
            </button>
            {(
              <div style={{ flex: 1, display: 'flex', gap: 3, padding: 3, background: theme.surfaceVariant, borderRadius: 10 }}>
                <button onClick={() => setActiveTab('edit')} style={tabBtn(activeTab === 'edit')}><IconEdit size={14} />Edit</button>
                <button onClick={() => setActiveTab('list')} style={tabBtn(activeTab === 'list')}><IconList size={14} />List</button>
                <button onClick={() => setActiveTab('flow')} style={tabBtn(activeTab === 'flow')}><IconShare2 size={14} />Flow</button>
              </div>
            )}
          </div>
        )}
        <div
          className={cn('flex-1 overflow-hidden flex flex-col', activeTab !== 'flow' && 'overflow-y-auto')}
          style={activeTab !== 'flow' ? { padding: '12px' } : undefined}
        >
          {!tileId ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: theme.ink3, marginTop: 16 }}>Seleziona un tile</p>
          ) : isLoading ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: theme.ink3, marginTop: 16 }}>Caricamento...</p>
          ) : !tile ? (
            <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12, color: theme.ink3, marginTop: 16 }}>Tile non trovato</p>
          ) : activeTab === 'flow' ? (
            <FlowTab tileId={tileId} />
          ) : activeTab === 'list' ? (
            <SubtaskList tileId={tileId} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{'Titolo'}</label>
                <textarea
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); titleDirty.current = true; }}
                  onBlur={saveTitle}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTitle(); } }}
                  rows={2}
                  style={{
                    ...obField(theme),
                    width: '100%',
                    padding: '8px 10px',
                    lineHeight: '20px',
                    outline: 'none',
                    resize: 'none',
                  }}
                  placeholder={'Titolo…'}
                />
              </div>


              {/* Type selector */}
              <div>
                <label style={labelStyle}>{'Azione'}</label>
                {(() => {
                  const ac = actionColors;
                  // Same icon mapping used in tile renderers (kanban/calendar/canvas).
                  // Notes (none) shows no badge.
                  const TILE_ACTION_ICON: Record<string, typeof IconBolt | null> = {
                    none:     null,
                    anytime:  IconArrowUp,
                    deadline: IconBolt,
                    event:    IconClock,
                    allday:   IconCalendar,
                  };
                  const allOpts = [
                    { value: 'none', label: 'NOTES' },
                    { value: 'anytime', label: 'TO DO' },
                    { value: 'deadline', label: 'DUE' },
                    { value: 'event', label: 'ALL DAY', extra: { all_day: true } },
                    { value: 'event', label: 'TIMED', extra: { all_day: false } },
                  ] as const;
                  const row1 = allOpts.slice(0, 2);
                  const row2 = allOpts.slice(2);
                  // Etichette native Obsidian (immagine di design).
                  const OB_LABEL: Record<string, string> = {
                    'NOTES': 'Note', 'TO DO': 'To-do', 'DUE': 'Scadenza', 'ALL DAY': 'Giornata', 'TIMED': 'A orario',
                  };
                  const renderBtn = (opt: typeof allOpts[number]) => {
                    const isActive = opt.value === 'event'
                      ? tile.action_type === 'event' && ((opt as any).extra?.all_day ? !!tile.all_day : !tile.all_day)
                      : tile.action_type === opt.value;
                    const actionKey = opt.value === 'event' && (opt as any).extra?.all_day ? 'allday' : opt.value;
                    const actionColor = (ac as Record<string, string>)[actionKey] || theme.ink3;
                    const Icon = TILE_ACTION_ICON[actionKey];
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
                          cursor: 'pointer',
                          boxShadow: 'none',
                        }}
                      >
                        {Icon && ((
                          <Icon size={14} color={isActive ? theme.accent : theme.ink2} />
                        ))}
                        {(OB_LABEL[opt.label] ?? opt.label)}
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
                    {<label style={labelStyle}>Data e orario</label>}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                      {/* Date */}
                      <div style={{ flexShrink: 0, position: 'relative' }}>
                        {false}
                        {(
                          <IconCalendar
                            size={14}
                            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.ink3, pointerEvents: 'none' }}
                          />
                        )}
                        <input
                          type="date"
                          value={dateVal}
                          onChange={(e) => updateDate(e.target.value)}
                          onClick={(e) => { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); }}
                          className={'ob-ts-date'}
                          style={{
                            ...obField(theme),
                            padding: '0 8px 0 30px',
                            height: 36,
                            outline: 'none',
                            width: 'auto',
                            maxWidth: 138,
                            colorScheme: theme.mode,
                          }}
                        />
                      </div>
                      {/* Start/End time — only for timed */}
                      {isTimed && (
                        <>
                          <div style={{ flexShrink: 0 }}>
                            {false}
                            <TimePicker
                              value={startTime || '09:00'}
                              icon={<IconClock size={14} />}
                              onChange={(t) => { if (dateVal) updateTileMutation.mutate({ start_at: new Date(`${dateVal}T${t}`).toISOString() }); }}
                              compact
                            />
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            {false}
                            <TimePicker
                              value={endTime || '10:00'}
                              icon={<IconClock size={14} />}
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

              <div style={{ borderTop: `1px solid ${theme.border}` }} />

              <div>
                <div style={{ ...obLabel(theme), marginBottom: 8 }}>
                  {`Sparks · ${sparks.length}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: theme.surface,
                    marginBottom: 12,
                  }}
                >
                  {[
                    { id: 'photo', label: 'Photo', icon: IconCamera, capKey: 'photo' as const, accept: 'image/*' },
                    { id: 'video', label: 'Video', icon: IconVideo, capKey: 'video' as const, accept: 'video/*' },
                    { id: 'gallery', label: 'Gallery', icon: IconPhoto, capKey: 'gallery' as const, accept: 'image/*' },
                    { id: 'text', label: 'Text', icon: IconEdit, capKey: 'text' as const, accept: null },
                    { id: 'voice', label: 'Voice', icon: IconMicrophone, capKey: 'voice' as const, accept: 'audio/*' },
                    { id: 'file', label: 'File', icon: IconPaperclip, capKey: 'file' as const, accept: '*/*' },
                  ].map((opt) => {
                    const BtnIcon = opt.icon;
                    const isDropTarget = dropTargetIcon === opt.id;
                    const acceptsDrop = opt.id !== 'text';
                    const cap = theme.cap[opt.capKey];
                    const tint = theme.tint[opt.capKey];
                    const treatment = pixelSettings.captureTreatment ?? 'tinted';
                    const cstyle = resolveCaptureStyle(treatment, cap, tint, theme.surface, theme.border, theme.ink2);
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
                        className={undefined}
                        style={{
                          position: 'relative',
                          flex: 1,
                          minWidth: 0,
                          height: 56,
                          borderRadius: 0,
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: isDropTarget ? `${cap}1F` : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        title={opt.id}
                      >
                        <BtnIcon size={19} style={{ color: cap }} />
                        {(
                          <span style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 10, fontWeight: 500, color: theme.ink2, lineHeight: 1 }}>
                            {opt.label}
                          </span>
                        )}
                        {false}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Read-only markdown preview. Click anywhere on it (or on
                        the corner expand icon) to open the centered editor. */}
                    <button
                      type="button"
                      onClick={() => setNewTextModalOpen(true)}
                      style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: 80,
                        textAlign: 'left',
                        background: theme.surfaceVariant,
                        border: `1px solid ${theme.border}`,
                        padding: '8px 10px',
                        color: theme.ink,
                        fontFamily: 'var(--ob-font-sans)',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                      title="Apri editor"
                    >
                      {newTextContent.trim() ? (
                        <MarkdownPreview markdown={newTextContent} />
                      ) : (
                        <span style={{ color: theme.ink3, fontStyle: 'italic' }}>Clicca per scrivere…</span>
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 22,
                          height: 22,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: theme.surface,
                          border: `1px solid ${theme.border}`,
                          color: theme.ink2,
                        }}
                      >
                        <IconMaximize size={12} />
                      </span>
                    </button>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => newTextContent.trim() && addTextMutation.mutate(undefined)}
                        disabled={!newTextContent.trim()}
                        className="px-press"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 10px',
                          height: 26,
                          background: theme.accent,
                          color: theme.onAccent,
                          border: `1px solid ${theme.border}`,
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          cursor: !newTextContent.trim() ? 'not-allowed' : 'pointer',
                          opacity: !newTextContent.trim() ? 0.4 : 1,
                          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
                        }}
                      >
                        Salva
                      </button>
                      <button
                        onClick={() => { setShowNewText(false); setNewTextContent(''); }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '0 10px',
                          height: 26,
                          background: theme.surfaceVariant,
                          color: theme.ink2,
                          border: `1px solid ${theme.border}`,
                          fontFamily: 'var(--ob-font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        Annulla
                      </button>
                    </div>
                    <MarkdownEditorModal
                      open={newTextModalOpen}
                      initialValue={newTextContent}
                      onSave={(md) => {
                        // Persist the draft locally first (in case the API
                        // call fails we still show what the user wrote), then
                        // commit it as a spark in one shot — no second click.
                        setNewTextContent(md);
                        if (md.trim()) addTextMutation.mutate(md);
                        else setNewTextModalOpen(false);
                      }}
                      onCancel={() => setNewTextModalOpen(false)}
                      title="Nuovo testo"
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {tileId && tile && (
          <div style={{ padding: '8px 12px', flexShrink: 0, textAlign: 'right', borderTop: `1px solid ${theme.border}`, background: theme.surfaceVariant }}>
            <span
              style={{
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 8,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink3,
              }}
            >
              Created: {new Date(tile.created_at).toLocaleDateString('it-IT')}
            </span>
          </div>
        )}
      </>)}
    </div>
  );
}
