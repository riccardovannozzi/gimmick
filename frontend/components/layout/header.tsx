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
  IconRoute,
} from '@tabler/icons-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePixelTheme } from '@/components/pixel';
import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';

const TAB_GROUP_DATA = [
  { name: 'Sparks', href: '/sparks', icon: IconSparkles },
  { name: 'Tiles', href: '/tiles', icon: IconLayoutGrid },
  { name: 'Tags', href: '/tags', icon: IconTag },
  { name: 'Flows', href: '/flows', icon: IconRoute },
] as const;

const TAB_GROUP_VIEWS = [
  { name: 'Chrono', href: '/calendar', icon: IconCalendar },
  { name: 'Canvas', href: '/canvas', icon: IconLayoutBoard },
  { name: 'Kanban', href: '/kanban', icon: IconColumns },
  { name: 'Panopticon', href: '/graph', icon: IconShare },
] as const;

/**
 * Pixel-styled tab pill. Active = filled with accent, inactive = bordered
 * surfaceVariant. Pure hard borders, no border-radius.
 */
function PixelTabLink({
  href,
  name,
  icon: Icon,
  active,
}: {
  href: string;
  name: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  active: boolean;
}) {
  const theme = usePixelTheme();
  return (
    <Link
      href={href}
      className="px-press"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 28,
        padding: '0 10px',
        background: active ? theme.accent : theme.surfaceVariant,
        color: active ? theme.onAccent : theme.ink2,
        border: `2px solid ${theme.border}`,
        fontFamily: 'var(--font-pixel-head)',
        fontSize: 9,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}` : 'none',
      }}
    >
      <Icon size={11} />
      {name}
    </Link>
  );
}

type TabItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

function PixelTabGroup({ items }: { items: readonly TabItem[] }) {
  const pathname = usePathname();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {items.map((item) => (
        <PixelTabLink
          key={item.href}
          href={item.href}
          name={item.name}
          icon={item.icon}
          active={pathname === item.href}
        />
      ))}
    </div>
  );
}

interface HeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Header({ actions }: HeaderProps) {
  const theme = usePixelTheme();
  const { user, signOut } = useAuthStore();
  const setChatOpen = useChatStore((s) => s.setOpen);

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : 'U';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 48,
        padding: '0 12px',
        background: theme.bg2,
        borderBottom: `2px solid ${theme.border}`,
        gap: 12,
      }}
    >
      {/* Primary nav */}
      <PixelTabGroup items={TAB_GROUP_DATA} />
      <div style={{ flex: 1 }} />
      {/* Center view tabs */}
      <PixelTabGroup items={TAB_GROUP_VIEWS} />
      <div style={{ flex: 1 }} />

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {actions}

        {/* Ask Gimmick — accent button, the only "primary" action in the header */}
        <button
          onClick={() => setChatOpen(true)}
          className="px-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            background: theme.accent,
            color: theme.onAccent,
            border: `2px solid ${theme.border}`,
            fontFamily: 'var(--font-pixel-head)',
            fontSize: 9,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
          }}
        >
          <IconRobot size={12} />
          ASK GIMMICK
        </button>

        {/* Settings */}
        <Link
          href="/settings"
          className="px-press"
          aria-label="Settings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: theme.surfaceVariant,
            color: theme.ink2,
            border: `2px solid ${theme.border}`,
          }}
        >
          <IconSettings size={14} />
        </Link>

        {/* Notifications */}
        <button
          aria-label="Notifications"
          className="px-press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: theme.surfaceVariant,
            color: theme.ink2,
            border: `2px solid ${theme.border}`,
            cursor: 'pointer',
          }}
        >
          <IconBell size={14} />
        </button>

        {/* Avatar with logout dropdown — keep shadcn DropdownMenu, just
            restyle the trigger so it matches the surrounding pixel chrome. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="px-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: theme.accent,
                color: theme.onAccent,
                border: `2px solid ${theme.border}`,
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={{
              minWidth: 200,
              background: theme.surface,
              border: `2px solid ${theme.border}`,
              borderRadius: 0,
              padding: 0,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            <DropdownMenuItem
              style={{
                color: theme.ink3,
                fontFamily: 'var(--font-pixel-body)',
                fontSize: 11,
                borderRadius: 0,
              }}
            >
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut()}
              style={{
                color: '#E24B4A',
                fontFamily: 'var(--font-pixel-head)',
                fontSize: 9,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
