'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  IconX,
  IconChevronDown,
  IconFolder,
  IconUser,
  IconTag,
  IconMapPin,
  IconBookmark,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconLayoutBoard,
  IconPin,
  IconPinFilled,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { usePixelTheme } from '@/components/pixel';
import { MascotSprite } from '@/components/cards/mascot-sprite';
import { MASCOTS } from '@/lib/mascots';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useTagTypes } from '@/store/tag-types-store';
import { tilesApi, tagsApi, settingsApi } from '@/lib/api';
import type { Tag } from '@/types';

// ─── Tag type config ───
const TAG_TYPE_ORDER = ['project', 'person', 'context', 'place', 'topic'] as const;

const TAG_TYPE_ICONS: Record<string, typeof IconFolder> = {
  project: IconFolder,
  person: IconUser,
  context: IconTag,
  place: IconMapPin,
  topic: IconBookmark,
};

const TAG_TYPE_LABELS: Record<string, string> = {
  project: 'PROGETTO',
  person: 'PERSONA',
  context: 'CONTESTO',
  place: 'LUOGO',
  topic: 'TOPIC',
};

// ─── Persist expand/collapse state ───
const STORAGE_KEY = 'sidebar_groups_state';

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Collapsible group with drag-and-drop reorder ───
function TagSidebarGroup({
  tagType,
  label: labelProp,
  tags,
  selectedTagIds,
  onToggle,
  isOpen,
  onToggleGroup,
  onReorder,
  onOpenCanvas,
  color,
  emoji,
  pinnedIds,
  onTogglePin,
}: {
  tagType: string;
  label?: string;
  tags: Tag[];
  selectedTagIds: Set<string>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  onToggleGroup: () => void;
  onReorder: (tagType: string, fromIndex: number, toIndex: number) => void;
  onOpenCanvas: (tagId: string) => void;
  color?: string;
  emoji?: string;
  pinnedIds: Set<string>;
  onTogglePin: (tagId: string) => void;
}) {
  const theme = usePixelTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number | undefined>(undefined);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // Measure content height for animation
  useEffect(() => {
    if (contentRef.current) {
      setMaxH(contentRef.current.scrollHeight);
    }
  }, [tags.length, isOpen]);

  const label = labelProp || TAG_TYPE_LABELS[tagType] || tagType.toUpperCase();

  // Resolve icon: use emoji from tag type (could be Tabler icon name like "IconFolder" or unicode emoji)
  const resolveIcon = () => {
    if (emoji) {
      if (emoji.startsWith('Icon')) {
        const Comp = (TablerIcons as unknown as Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>>)[emoji];
        if (Comp) return <Comp size={13} style={color ? { color } : undefined} />;
      }
      return <span style={{ fontSize: 11, color: color || undefined }}>{emoji}</span>;
    }
    const FallbackIcon = TAG_TYPE_ICONS[tagType] || IconTag;
    return <FallbackIcon size={13} style={color ? { color } : undefined} />;
  };

  return (
    <div className="mb-0.5">
      {/* Group header — pixel font, hard surface, no rounded corners */}
      <button
        onClick={onToggleGroup}
        className="w-full h-8 flex items-center justify-between px-2 transition-colors"
        style={{
          background: theme.surfaceVariant,
          color: theme.ink2,
          border: `2px solid ${theme.border}`,
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <span className="flex items-center gap-1.5">
          {resolveIcon()}
          {label}
        </span>
        <IconChevronDown
          size={11}
          className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
        />
      </button>

      {/* Collapsible tag list */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? (maxH ?? 1000) : 0 }}
      >
        {tags.map((tag, idx) => {
          const isSelected = selectedTagIds.has(tag.id);
          const isPinned = pinnedIds.has(tag.id);
          return (
            <div
              key={tag.id}
              draggable
              onDragStart={(e) => { e.stopPropagation(); setDragIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverIdx(idx); }}
              onDragLeave={() => setOverIdx((v) => v === idx ? null : v)}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) {
                  onReorder(tagType, dragIdx, idx);
                }
                setDragIdx(null);
                setOverIdx(null);
              }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              style={{
                cursor: 'grab',
                borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? `2px solid ${theme.accent}` : '2px solid transparent',
              }}
            >
              <div
                className="group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: 30,
                  // Tag selezionato: "slot scuro" della palette in entrambi i
                  // mode (theme.ink nel light, theme.surface nel dark), così
                  // resta scuro+pop ovunque. Hardcodare theme.ink darebbe in
                  // dark mode bianco/giallo/rosa bright bg = collide col TYPE
                  // chip pastel.
                  background: isSelected
                    ? (theme.mode === 'dark' ? theme.surface : theme.ink)
                    : 'transparent',
                  border: `2px solid ${isSelected ? theme.border : 'transparent'}`,
                  opacity: dragIdx === idx ? 0.4 : 1,
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(tag.id); }}
                  className={isPinned ? '' : 'opacity-0 group-hover:opacity-100'}
                  style={{
                    width: 14,
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginLeft: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: isPinned ? '#F5A623' : theme.ink3,
                  }}
                  title={isPinned ? 'Rimuovi pin' : 'Aggiungi pin'}
                >
                  {isPinned ? <IconPinFilled size={10} /> : <IconPin size={10} />}
                </button>
                <button
                  onClick={() => onToggle(tag.id)}
                  style={{
                    flex: 1,
                    height: '100%',
                    textAlign: 'left',
                    paddingLeft: 8,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    fontFamily: 'var(--font-pixel-body)',
                    fontSize: 12,
                    // Inversione mode-aware: su bg "slot scuro" usiamo lo
                    // "slot chiaro" del mode (vedi pixel-toolbar.ts).
                    color: isSelected
                      ? (theme.mode === 'dark' ? theme.ink : theme.surface)
                      : theme.ink2,
                    fontWeight: isSelected ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {tag.name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenCanvas(tag.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: theme.surface,
                    border: `2px solid ${theme.border}`,
                    marginRight: 6,
                    flexShrink: 0,
                    cursor: 'pointer',
                    color: theme.ink2,
                  }}
                  title="Apri in Canvas"
                >
                  <IconLayoutBoard size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Sidebar ───

export function Sidebar() {
  const theme = usePixelTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { selectedTagIds: filterTagIds, toggle, clear } = useTagFilterStore();
  const { tagTypes, getColor: getTypeColor, getEmoji: getTypeEmoji } = useTagTypes();

  // Su /canvas e /graph la tag "corrente" sta nella query string (?tag=ID),
  // non nel filter store (il click su un tag su queste pagine navighi via
  // router invece di toggleare il filtro). Per far apparire il pulsante
  // selezionato nella sidebar in modo coerente con quello che la pagina sta
  // mostrando, faccio l'union del filter store + l'eventuale ?tag= URL.
  const selectedTagIds = useMemo(() => {
    const isRouteWithUrlTag = pathname === '/canvas' || pathname === '/graph';
    if (!isRouteWithUrlTag) return filterTagIds;
    const urlTag = searchParams?.get('tag');
    if (!urlTag) return filterTagIds;
    if (filterTagIds.has(urlTag)) return filterTagIds;
    return new Set([...filterTagIds, urlTag]);
  }, [filterTagIds, pathname, searchParams]);

  // ─── New tiles notification ───
  const { lastSeen, readIds, dismissAll } = useTileNotificationStore();

  const { data: tilesData } = useQuery({
    queryKey: ['tiles-poll'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    refetchInterval: 30000,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const tags: Tag[] = tagsData?.data || [];
  const nonRootTags = tags.filter((t) => !t.is_root);

  const newCount = useMemo(() => {
    if (!tilesData?.data) return 0;
    return tilesData.data.filter(
      (t) => new Date(t.created_at) > new Date(lastSeen) && !readIds.includes(t.id)
    ).length;
  }, [tilesData, lastSeen, readIds]);

  // "Pulisci filtro" agisce solo sul filter store: il ?tag= URL viene gestito
  // dalla pagina (canvas/graph), non dalla sidebar, quindi `hasFilter` riflette
  // solo lo stato vero dello store, non l'union con URL.
  const hasFilter = filterTagIds.size > 0;

  // ─── Pin state (DB-backed) ───
  const pinnedIds = useMemo(() => new Set(tags.filter((t) => t.is_pinned).map((t) => t.id)), [tags]);
  const [viewMode, setViewMode] = useState<'all' | 'pin'>('all');

  const tagsQc = useQueryClient();
  const togglePin = useCallback(async (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    if (!tag) return;
    const next = !tag.is_pinned;
    tagsQc.setQueryData(['tags'], (old: any) => {
      if (!old?.data) return old;
      return { ...old, data: old.data.map((t: Tag) => t.id === tagId ? { ...t, is_pinned: next } : t) };
    });
    try {
      await tagsApi.update(tagId, { is_pinned: next });
    } finally {
      tagsQc.invalidateQueries({ queryKey: ['tags'] });
    }
  }, [tags, tagsQc]);

  // ─── Reorder tags within a group (persist in DB via settings API) ───
  const queryClient = useQueryClient();
  const TAG_ORDER_KEY = 'sidebar_tag_order';

  const { data: tagOrderData } = useQuery({
    queryKey: ['settings', TAG_ORDER_KEY],
    queryFn: async () => {
      const res = await settingsApi.get<Record<string, string[]>>(TAG_ORDER_KEY);
      return res.data ?? {};
    },
    staleTime: 5 * 60 * 1000,
  });
  const tagOrder: Record<string, string[]> = tagOrderData ?? {};

  const saveTagOrderMutation = useMutation({
    mutationFn: (order: Record<string, string[]>) => settingsApi.set(TAG_ORDER_KEY, order),
  });

  // Group tags by tag_type — use dynamic tagTypes order, fallback to fixed order
  const grouped = useMemo(() => {
    const typeOrder = tagTypes.length > 0
      ? tagTypes.map((tt) => tt.slug)
      : [...TAG_TYPE_ORDER];

    const allTypes = new Set(nonRootTags.map((t) => t.tag_type).filter(Boolean));
    allTypes.forEach((type) => {
      if (!typeOrder.includes(type)) typeOrder.push(type);
    });

    return typeOrder
      .map((type) => {
        let groupTags = nonRootTags.filter((t) => t.tag_type === type);
        // Apply custom order if stored
        const order = tagOrder[type];
        if (order) {
          groupTags.sort((a, b) => {
            const ai = order.indexOf(a.id);
            const bi = order.indexOf(b.id);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        }
        return {
          type,
          label: tagTypes.find((tt) => tt.slug === type)?.name?.toUpperCase() || TAG_TYPE_LABELS[type] || type.toUpperCase(),
          tags: groupTags,
        };
      })
      .filter((g) => g.tags.length > 0);
  }, [nonRootTags, tagTypes, tagOrder]);

  // ─── Group expand/collapse state ───
  const [groupState, setGroupState] = useState<Record<string, boolean>>(() => loadGroupState());

  const toggleGroup = useCallback((type: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [type]: !(prev[type] ?? true) };
      saveGroupState(next);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    grouped.forEach((g) => { next[g.type] = true; });
    setGroupState(next);
    saveGroupState(next);
  }, [grouped]);

  const collapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    grouped.forEach((g) => { next[g.type] = false; });
    setGroupState(next);
    saveGroupState(next);
  }, [grouped]);

  const allExpanded = grouped.length > 0 && grouped.every((g) => groupState[g.type] !== false);

  const handleReorder = useCallback((tagType: string, fromIdx: number, toIdx: number) => {
    const currentGroup = grouped.find((g) => g.type === tagType);
    if (!currentGroup) return;
    const ids = tagOrder[tagType] || currentGroup.tags.map((t) => t.id);
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const updated = { ...tagOrder, [tagType]: next };
    queryClient.setQueryData(['settings', TAG_ORDER_KEY], updated);
    saveTagOrderMutation.mutate(updated);
  }, [grouped, tagOrder, queryClient, saveTagOrderMutation]);

  // ─── Drag-and-drop to reorder groups (types) ───
  const GROUP_ORDER_KEY = 'sidebar_group_order';
  const { data: groupOrderData } = useQuery({
    queryKey: ['settings', GROUP_ORDER_KEY],
    queryFn: async () => {
      const res = await settingsApi.get<string[]>(GROUP_ORDER_KEY);
      return res.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const saveGroupOrderMutation = useMutation({
    mutationFn: (order: string[]) => settingsApi.set(GROUP_ORDER_KEY, order),
  });

  // Apply saved group order
  const sortedGrouped = useMemo(() => {
    if (!groupOrderData || groupOrderData.length === 0) return grouped;
    const order = groupOrderData;
    return [...grouped].sort((a, b) => {
      const ai = order.indexOf(a.type);
      const bi = order.indexOf(b.type);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [grouped, groupOrderData]);

  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);
  const [overGroupIdx, setOverGroupIdx] = useState<number | null>(null);

  const handleGroupReorder = useCallback((fromIdx: number, toIdx: number) => {
    const types = sortedGrouped.map((g) => g.type);
    const next = [...types];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    queryClient.setQueryData(['settings', GROUP_ORDER_KEY], next);
    saveGroupOrderMutation.mutate(next);
  }, [sortedGrouped, queryClient, saveGroupOrderMutation]);

  // ─── Resizable sidebar width — clamped to [192, 240], default 240, persisted in localStorage ───
  const SIDEBAR_MIN_W = 192;
  const SIDEBAR_MAX_W = 240;
  const SIDEBAR_DEFAULT_W = 240;
  const SIDEBAR_WIDTH_VERSION = '2';
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      // One-shot migration: if the version flag isn't current, force-reset to the new default.
      // This catches users who had an older saved value (e.g. 192) and brings them to 240.
      const v = localStorage.getItem('sidebar_width_v');
      if (v !== SIDEBAR_WIDTH_VERSION) {
        localStorage.setItem('sidebar_width', String(SIDEBAR_DEFAULT_W));
        localStorage.setItem('sidebar_width_v', SIDEBAR_WIDTH_VERSION);
        return SIDEBAR_DEFAULT_W;
      }
      const w = localStorage.getItem('sidebar_width');
      const parsed = w ? parseInt(w, 10) : SIDEBAR_DEFAULT_W;
      return Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, parsed));
    } catch { return SIDEBAR_DEFAULT_W; }
  });
  const resizing = useRef(false);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      lastW = Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, startW + ev.clientX - startX));
      setSidebarWidth(lastW);
    };
    const onUp = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('sidebar_width', String(lastW)); } catch { /* */ }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  return (
    <div
      className="flex h-full flex-col relative"
      style={{
        width: sidebarWidth,
        minWidth: SIDEBAR_MIN_W,
        maxWidth: SIDEBAR_MAX_W,
        background: theme.bg2,
        borderRight: `2px solid ${theme.border}`,
      }}
    >
      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500/30 transition-colors z-10"
        onMouseDown={onResizeStart}
      />
      {/* Wordmark + new-tiles notification */}
      <div className="flex h-12 items-center px-3 gap-2 shrink-0">
        {/* Gimmick mascot — 24×24 sprite next to the wordmark, brand logo. */}
        {(() => {
          const gimmick = MASCOTS.find((m) => m.id === 'gimmick');
          return gimmick ? <MascotSprite mascot={gimmick} cell={2} /> : null;
        })()}
        <span
          style={{
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 14,
            color: theme.ink,
            letterSpacing: '0.04em',
          }}
        >
          GIMMICK
        </span>
        {newCount > 0 && (
          <Link
            href="/tiles"
            onClick={dismissAll}
            className="flex items-center justify-center w-5 h-5 animate-pulse"
            style={{
              background: theme.accent,
              color: theme.onAccent,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              border: `2px solid ${theme.border}`,
            }}
          >
            {newCount}
          </Link>
        )}
      </div>

      {/* Tags header — All Tags / Pinned, pixel-style tabs */}
      <div
        className="h-12 flex items-center gap-1 px-2"
        style={{ borderTop: `2px solid ${theme.border}`, borderBottom: `2px solid ${theme.border}` }}
      >
        <button
          onClick={() => setViewMode('all')}
          className="flex-1 h-8 px-2.5 transition-colors flex items-center justify-center px-press"
          style={{
            background: viewMode === 'all' ? theme.accent : theme.surfaceVariant,
            color: viewMode === 'all' ? theme.onAccent : theme.ink2,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 8,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          All Tags
        </button>
        <button
          onClick={() => setViewMode('pin')}
          className="flex-1 h-8 px-2.5 transition-colors flex items-center justify-center gap-1 px-press"
          style={{
            background: viewMode === 'pin' ? '#F5A623' : theme.surfaceVariant,
            color: viewMode === 'pin' ? theme.onAccent : theme.ink2,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 8,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          <IconPinFilled size={10} />
          Pinned
          {pinnedIds.size > 0 && <span style={{ fontSize: 8, opacity: 0.7 }}>({pinnedIds.size})</span>}
        </button>
        {hasFilter && (
          <button
            onClick={clear}
            title="Pulisci filtro"
            className="shrink-0 h-8 px-2 transition-colors flex items-center gap-1 px-press"
            style={{
              background: theme.surfaceVariant,
              color: theme.accent,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 8,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <IconX className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      {/* Expand/Collapse all groups — own row, only in ALL view */}
      {viewMode === 'all' && (
        <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            style={{
              height: 24,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 9,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: theme.ink3,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            {allExpanded
              ? <><IconArrowsMinimize size={11} /> Collapse all</>
              : <><IconArrowsMaximize size={11} /> Expand all</>
            }
          </button>
        </div>
      )}

      {/* Grouped tag list (filtered by viewMode) */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 sidebar-scroll">
        {viewMode === 'pin' ? (
          (() => {
            const filteredGrouped = sortedGrouped
              .map((g) => ({ ...g, tags: g.tags.filter((t) => pinnedIds.has(t.id)) }))
              .filter((g) => g.tags.length > 0);
            if (filteredGrouped.length === 0) {
              return <p className="text-[10px] text-zinc-500 text-center py-4">Nessun tag pinnato</p>;
            }
            return filteredGrouped.map((group) => (
              <TagSidebarGroup
                key={group.type}
                tagType={group.type}
                label={group.label}
                tags={group.tags}
                selectedTagIds={selectedTagIds}
                onToggle={(tagId) => {
                  if (pathname === '/canvas') router.push(`/canvas?tag=${tagId}`);
                  else if (pathname === '/graph') router.push(`/graph?tag=${tagId}`);
                  else toggle(tagId);
                }}
                isOpen={true}
                onToggleGroup={() => {}}
                onReorder={handleReorder}
                onOpenCanvas={(tagId) => router.push(`/canvas?tag=${tagId}`)}
                color={getTypeColor(group.type)}
                emoji={getTypeEmoji(group.type)}
                pinnedIds={pinnedIds}
                onTogglePin={togglePin}
              />
            ));
          })()
        ) : (
        sortedGrouped
          .filter((g) => g.tags.length > 0)
          .map((group, idx) => (
          <div
            key={group.type}
            draggable
            onDragStart={(e) => {
              // Only allow group drag from header area — use a data attribute to distinguish
              setDragGroupIdx(idx);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/x-group', group.type);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('text/x-group')) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverGroupIdx(idx);
            }}
            onDragLeave={() => setOverGroupIdx((v) => v === idx ? null : v)}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes('text/x-group')) return;
              e.preventDefault();
              if (dragGroupIdx !== null && dragGroupIdx !== idx) {
                handleGroupReorder(dragGroupIdx, idx);
              }
              setDragGroupIdx(null);
              setOverGroupIdx(null);
            }}
            onDragEnd={() => { setDragGroupIdx(null); setOverGroupIdx(null); }}
            className={cn(
              dragGroupIdx === idx && 'opacity-40',
              overGroupIdx === idx && dragGroupIdx !== null && dragGroupIdx !== idx && 'border-t border-blue-500',
            )}
          >
            <TagSidebarGroup
              tagType={group.type}
              label={group.label}
              tags={group.tags}
              selectedTagIds={selectedTagIds}
              onToggle={(tagId) => {
                if (pathname === '/canvas') {
                  router.push(`/canvas?tag=${tagId}`);
                } else if (pathname === '/graph') {
                  router.push(`/graph?tag=${tagId}`);
                } else {
                  toggle(tagId);
                }
              }}
              isOpen={groupState[group.type] !== false}
              onToggleGroup={() => toggleGroup(group.type)}
              onReorder={handleReorder}
              onOpenCanvas={(tagId) => router.push(`/canvas?tag=${tagId}`)}
              color={getTypeColor(group.type)}
              emoji={getTypeEmoji(group.type)}
              pinnedIds={pinnedIds}
              onTogglePin={togglePin}
            />
          </div>
        )))}
      </div>

    </div>
  );
}
