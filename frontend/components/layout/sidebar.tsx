'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  IconFileText,
  IconLayoutGrid,
  IconCirclePlus,
  IconSettings,
  IconChartBar,
  IconShare,
  IconCalendar,
  IconLogout,
  IconRobot,
  IconTag,
  IconTimeline,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';
import { useTileNotificationStore } from '@/store/tile-notification-store';
import { tilesApi } from '@/lib/api';

const navigation = [
  { name: 'Analytics', href: '/', icon: IconChartBar },
  { name: 'Sparks', href: '/sparks', icon: IconFileText },
  { name: 'Tiles', href: '/tiles', icon: IconLayoutGrid },
  { name: 'Timeline', href: '/tileview', icon: IconTimeline },
  { name: 'Tags', href: '/tags', icon: IconTag },
  { name: 'Cattura', href: '/capture', icon: IconCirclePlus },
  { name: 'Calendario', href: '/calendar', icon: IconCalendar },
  { name: 'Graph', href: '/graph', icon: IconShare },
  { name: 'Impostazioni', href: '/settings', icon: IconSettings },
];

interface SidebarProps {
  onOpenChat?: () => void;
}

export function Sidebar({ onOpenChat }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuthStore();

  // ─── New tiles notification ───
  const { lastSeen, readIds, dismissAll } = useTileNotificationStore();

  const { data: tilesData } = useQuery({
    queryKey: ['tiles-poll'],
    queryFn: () => tilesApi.list({ limit: 100 }),
    refetchInterval: 30000,
  });

  const tileTotal = tilesData?.pagination?.total ?? null;
  const newCount = useMemo(() => {
    if (!tilesData?.data) return 0;
    return tilesData.data.filter(
      (t) => new Date(t.created_at) > new Date(lastSeen) && !readIds.includes(t.id)
    ).length;
  }, [tilesData, lastSeen, readIds]);

  return (
    <div className="flex h-full w-64 flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Logo + notification */}
      <div className="flex h-16 items-center px-6 gap-3">
        <span className="text-xl font-bold text-white">Gimmick</span>
        {newCount > 0 && (
          <Link
            href="/tiles"
            onClick={dismissAll}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-400 text-sm font-semibold animate-pulse hover:bg-red-500/30 transition-colors"
          >
            <IconLayoutGrid className="h-4 w-4" />
            {newCount}
          </Link>
        )}
      </div>

      <Separator className="bg-zinc-800" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Ask Gimmick button */}
      <div className="px-3 pb-3">
        <Button
          onClick={onOpenChat}
          className="w-full justify-start gap-3 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 border border-blue-500/20"
        >
          <IconRobot className="h-5 w-5" />
          Ask Gimmick
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* User section */}
      <div className="p-4">
        {user && (
          <div className="mb-3">
            <p className="text-sm text-zinc-400 truncate">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-800"
          onClick={() => signOut()}
        >
          <IconLogout className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
