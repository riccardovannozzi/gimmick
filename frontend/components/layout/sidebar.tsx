'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  LayoutGrid,
  PlusCircle,
  Settings,
  BarChart3,
  Share2,
  LogOut,
  Bot,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';

const navigation = [
  { name: 'Analytics', href: '/', icon: BarChart3 },
  { name: 'Memos', href: '/memos', icon: FileText },
  { name: 'Tiles', href: '/tiles', icon: LayoutGrid },
  { name: 'Tags', href: '/tags', icon: Tag },
  { name: 'Cattura', href: '/capture', icon: PlusCircle },
  { name: 'Graph', href: '/graph', icon: Share2 },
  { name: 'Impostazioni', href: '/settings', icon: Settings },
];

interface SidebarProps {
  onOpenChat?: () => void;
}

export function Sidebar({ onOpenChat }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuthStore();

  return (
    <div className="flex h-full w-64 flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <span className="text-xl font-bold text-white">Gimmick</span>
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
          <Bot className="h-5 w-5" />
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
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
