'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  IconLogout,
  IconRobot,
  IconX,
  IconChevronDown,
  IconFolder,
  IconUser,
  IconTag,
  IconMapPin,
  IconBookmark,
  IconArrowsMaximize,
  IconArrowsMinimize,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
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
}: {
  tagType: string;
  label?: string;
  tags: Tag[];
  selectedTagIds: Set<string>;
  onToggle: (id: string) => void;
  isOpen: boolean;
  onToggleGroup: () => void;
  onReorder: (tagType: string, fromIndex: number, toIndex: number) => void;
}) {
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

  const Icon = TAG_TYPE_ICONS[tagType] || IconTag;
  const label = labelProp || TAG_TYPE_LABELS[tagType] || tagType.toUpperCase();

  return (
    <div className="mb-0.5">
      {/* Group header */}
      <button
        onClick={onToggleGroup}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:bg-zinc-900 rounded transition-colors duration-150"
      >
        <span className="flex items-center gap-1.5">
          <Icon size={13} />
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
              className={cn(
                'cursor-grab',
                overIdx === idx && dragIdx !== null && dragIdx !== idx && 'border-t border-blue-500',
              )}
            >
              <button
                onClick={() => onToggle(tag.id)}
                className={cn(
                  'w-full text-left px-3 py-1 pl-7 text-xs rounded transition-colors duration-150',
                  isSelected
                    ? 'text-white font-medium bg-zinc-800'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300',
                  dragIdx === idx && 'opacity-40',
                )}
              >
                {tag.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Sidebar ───
interface SidebarProps {
  onOpenChat?: () => void;
}

export function Sidebar({ onOpenChat }: SidebarProps) {
  const { user, signOut } = useAuthStore();
  const { selectedTagIds, toggle, clear } = useTagFilterStore();
  const { tagTypes, getEmoji } = useTagTypes();

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

  const hasFilter = selectedTagIds.size > 0;

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

  return (
    <div className="flex h-full w-48 flex-col border-r border-zinc-800" style={{ backgroundColor: 'rgba(24, 24, 27, 0.5)' }}>
      {/* Logo + notification */}
      <div className="flex h-12 items-center px-3 gap-2 shrink-0">
        <span className="text-lg font-bold text-white">Gimmick</span>
        {newCount > 0 && (
          <Link
            href="/tiles"
            onClick={dismissAll}
            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse"
          >
            {newCount}
          </Link>
        )}
      </div>

      <Separator className="bg-zinc-800" />

      {/* Tags header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Tags</span>
        <div className="flex items-center gap-1">
          {hasFilter && (
            <button onClick={clear} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
              <IconX className="h-2.5 w-2.5" /> Clear
            </button>
          )}
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className="p-0.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={allExpanded ? 'Collapse all' : 'Expand all'}
          >
            {allExpanded
              ? <IconArrowsMinimize className="h-3 w-3" />
              : <IconArrowsMaximize className="h-3 w-3" />
            }
          </button>
        </div>
      </div>

      {/* Grouped tag list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sortedGrouped.map((group, idx) => (
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
              onToggle={toggle}
              isOpen={groupState[group.type] !== false}
              onToggleGroup={() => toggleGroup(group.type)}
              onReorder={handleReorder}
            />
          </div>
        ))}
      </div>

      {/* Ask Gimmick */}
      <div className="px-2 pb-2">
        <Button
          onClick={onOpenChat}
          variant="ghost"
          className="w-full h-8 justify-start gap-2 text-xs text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 border border-blue-500/20 rounded-lg"
        >
          <IconRobot className="h-4 w-4" />
          Ask Gimmick
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* User + Logout */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-semibold shrink-0" title={user?.email}>
          {user?.email?.substring(0, 2).toUpperCase() || 'U'}
        </div>
        <span className="text-[11px] text-zinc-500 truncate flex-1">{user?.email}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-500 hover:text-white hover:bg-zinc-800 shrink-0"
          onClick={() => signOut()}
          title="Logout"
        >
          <IconLogout className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
