/**
 * Gimmick · Obsidian — Mobile views route. At /obsidian-views.
 *
 * The primary mobile screens (Tiles / Flows / Chrono / Settings) behind the
 * TopNav switcher. Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, the Tiles
 * tab is wired to live data; otherwise the static QA mockup.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianViewsScreen, ObsidianViewsScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianViewsRoute() {
  const router = useRouter();

  if (isObsidianShellEnabled()) {
    return (
      <ObsidianViewsScreenLive
        onOpenTile={(id) => router.push(`/obsidian-tile?id=${id}` as never)}
        onOpenFlow={(tileId) => router.push(`/obsidian-tile?id=${tileId}` as never)}
      />
    );
  }
  return <ObsidianViewsScreen />;
}
