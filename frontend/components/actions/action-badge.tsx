'use client';

import { IconBolt, IconArrowUp, IconClock, IconCalendar } from '@tabler/icons-react';
import { useActionColors } from '@/store/action-colors-store';
import { usePixelTheme } from '@/components/pixel';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import { readableOn } from '@/lib/palette';

/** Action-type → icon. `none` (NOTES) renders nothing by design. */
const ACTION_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }> | null> = {
  none: null,
  anytime: IconArrowUp,
  deadline: IconBolt,
  event: IconClock,
  allday: IconCalendar,
};

interface ActionBadgeProps {
  /** Canonical action key: 'none' | 'anytime' | 'deadline' | 'event' | 'allday'. */
  actionKey: string;
  /** Outer square size in pixels. Defaults to 16 (tile footer scale). */
  size?: number;
  /** Override the background color; defaults to the user's action palette. */
  color?: string;
  /** When true and there is no icon for `actionKey` (e.g. NOTES), render an
   *  invisible same-size spacer so footer alignment is preserved. */
  keepSpace?: boolean;
}

/**
 * Pixel-style action badge — single source of truth shared by every tile
 * surface (Chrono columns, Calendar events, Kanban, Staging, Canvas) and the
 * Actions settings modal. The look (hard pixel square, 2 px theme border)
 * mirrors the preview in the settings modal so "personalizzare l'azione"
 * means seeing the exact same chip everywhere.
 */
export function ActionBadge({ actionKey, size = 16, color, keepSpace }: ActionBadgeProps) {
  const theme = usePixelTheme();
  const inShell = isObsidianShellEnabled();
  const actionColors = useActionColors();
  const Icon = ACTION_ICON[actionKey];
  if (!Icon) {
    return keepSpace ? <span style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }} /> : null;
  }
  const bg = color ?? ((actionColors as Record<string, string>)[actionKey] || theme.ink2);
  const iconSize = Math.max(8, Math.round(size * 0.625));
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        // Obsidian: hairline + raggio morbido proporzionale; arcade: quadratino 2px.
        border: inShell ? `1px solid ${theme.border}` : `2px solid ${theme.border}`,
        borderRadius: inShell ? Math.max(3, Math.round(size * 0.28)) : 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} color={readableOn(bg)} />
    </div>
  );
}
