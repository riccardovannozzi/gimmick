/**
 * Gimmick · Obsidian — Mobile Tile detail route. At /obsidian-tile.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on AND an `?id=` param, renders
 * the live tile detail (React Query + tilesApi.get); otherwise the static QA
 * mockup.
 */
import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ObsidianTileScreen, ObsidianTileScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianTileRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const onBack = () => { if (router.canGoBack()) router.back(); };

  if (isObsidianShellEnabled() && id) {
    return <ObsidianTileScreenLive tileId={id} onBack={onBack} />;
  }
  return <ObsidianTileScreen onBack={onBack} />;
}
