/**
 * Gimmick · Obsidian — host for the (tabs) routes during the strangler migration.
 *
 * The four primary views (Tiles / Flows / Chrono / Settings) live inside a
 * single `ObsidianViewsScreenLive` with its own TopNav switcher, while
 * expo-router still models them as four separate tab routes. This host bridges
 * the two: it seeds the screen with the route's view and mirrors internal
 * switches back onto the router with `replace`, so the URL never drifts from
 * what's on screen and the back stack doesn't grow.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianViewsScreenLive } from './screens/ViewsScreenLive';
import type { MobileViewId } from './TopNav';

const ROUTE_FOR: Record<MobileViewId, string> = {
  tiles: '/history',
  flows: '/flows',
  chrono: '/chrono',
  settings: '/settings',
};

export function ObsidianViewsTabHost({ view }: { view: MobileViewId }) {
  const router = useRouter();

  return (
    <ObsidianViewsScreenLive
      initial={view}
      onActiveChange={(id) => {
        if (id !== view) router.replace(ROUTE_FOR[id] as never);
      }}
      onSignIn={() => router.push('/auth/login' as never)}
      onHome={() => router.replace('/' as never)}
      onOpenTile={(id) => router.push(`/obsidian-tile?id=${id}` as never)}
      onOpenFlow={(tileId) => router.push(`/obsidian-tile?id=${tileId}` as never)}
    />
  );
}
