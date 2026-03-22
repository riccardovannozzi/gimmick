'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  IconLogout,
  IconRobot,
  IconLayoutGrid,
  IconX,
} from '@tabler/icons-react';
import * as TablerIcons from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { useTagFilterStore } from '@/store/tag-filter-store';
import { useTagTypes } from '@/store/tag-types-store';
import { tilesApi, tagsApi } from '@/lib/api';
import type { Tag } from '@/types';

interface SidebarProps {
  onOpenChat?: () => void;
}

export function Sidebar({ onOpenChat }: SidebarProps) {
  const { user, signOut } = useAuthStore();
  const { selectedTagIds, toggle, clear } = useTagFilterStore();
  const { getEmoji, getColor } = useTagTypes();

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

  return (
    <div className="flex h-full w-48 flex-col bg-zinc-950 border-r border-zinc-800">
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
        {hasFilter && (
          <button onClick={clear} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5">
            <IconX className="h-2.5 w-2.5" /> Clear
          </button>
        )}
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {nonRootTags.map((tag) => {
          const isSelected = selectedTagIds.has(tag.id);
          const typeColor = getColor(tag.tag_type || 'topic');
          const emoji = getEmoji(tag.tag_type || 'topic');
          return (
            <button
              key={tag.id}
              onClick={() => toggle(tag.id)}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-xs transition-colors',
                isSelected
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300'
              )}
            >
              {emoji && emoji.startsWith('Icon') && (TablerIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[emoji] ? (
                (() => {
                  const IconComp = (TablerIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[emoji];
                  return <IconComp className="h-3.5 w-3.5 shrink-0" style={{ color: typeColor || '#64748B' }} />;
                })()
              ) : (
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: typeColor || '#64748B' }}
                />
              )}
              <span className="truncate flex-1">{tag.name}</span>
              {isSelected && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              )}
            </button>
          );
        })}
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
