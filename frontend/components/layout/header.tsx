'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconBell,
  IconRobot,
  IconSettings,
  IconSparkles,
  IconLayoutGrid,
  IconTag,
  IconCalendar,
  IconShare,
  IconLayoutBoard,
  IconColumns,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { cn } from '@/lib/utils';

const TAB_GROUP_DATA = [
  { name: 'Sparks', href: '/sparks', icon: IconSparkles },
  { name: 'Tiles', href: '/tiles', icon: IconLayoutGrid },
  { name: 'Tags', href: '/tags', icon: IconTag },
];

const TAB_GROUP_VIEWS = [
  { name: 'Chrono', href: '/calendar', icon: IconCalendar },
  { name: 'Canvas', href: '/canvas', icon: IconLayoutBoard },
  { name: 'Kanban', href: '/kanban', icon: IconColumns },
  { name: 'Panopticon', href: '/graph', icon: IconShare },
];

function TabGroup({ items }: { items: typeof TAB_GROUP_DATA }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'h-8 flex items-center gap-1.5 px-3 rounded text-xs leading-none font-medium transition-colors',
              isActive
                ? 'bg-blue-600/20 text-blue-400'
                : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
}

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Header({ actions }: HeaderProps) {
  const { user, signOut } = useAuthStore();
  const setChatOpen = useChatStore((s) => s.setOpen);

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="flex h-12 items-center border-b border-zinc-800 bg-zinc-950 px-4">
      {/* Left — primary nav */}
      <TabGroup items={TAB_GROUP_DATA} />
      <div className="flex-1" />
      {/* Center — view tabs */}
      <TabGroup items={TAB_GROUP_VIEWS} />
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {/* Ask Gimmick */}
        <Button
          onClick={() => setChatOpen(true)}
          variant="ghost"
          className="h-8 px-3 gap-1.5 text-xs text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 border border-blue-500/20 rounded-lg"
        >
          <IconRobot className="h-4 w-4" />
          Ask Gimmick
        </Button>

        {/* Settings */}
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
            <IconSettings className="h-4 w-4" />
          </Button>
        </Link>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
          <IconBell className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-7 w-7 rounded-full">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
            <DropdownMenuItem className="text-zinc-400">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-400 cursor-pointer"
              onClick={() => signOut()}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
