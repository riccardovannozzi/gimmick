'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconBell,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconLayoutGrid,
  IconTag,
  IconCalendar,
  IconShare,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

const TAB_GROUP_DATA = [
  { name: 'Sparks', href: '/sparks', icon: IconSparkles },
  { name: 'Tiles', href: '/tiles', icon: IconLayoutGrid },
  { name: 'Tags', href: '/tags', icon: IconTag },
];

const TAB_GROUP_VIEWS = [
  { name: 'Calendar', href: '/calendar', icon: IconCalendar },
  { name: 'Graph', href: '/graph', icon: IconShare },
];

function TabGroup({ items }: { items: typeof TAB_GROUP_DATA }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
      {items.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
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

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      {/* Left — Tab groups */}
      <div className="flex items-center gap-3">
        <TabGroup items={TAB_GROUP_DATA} />
        <TabGroup items={TAB_GROUP_VIEWS} />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {actions}
        {/* Search */}
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Cerca..."
            className="w-48 h-8 bg-zinc-900 border-zinc-800 pl-8 text-xs text-white placeholder:text-zinc-500"
          />
        </div>

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
