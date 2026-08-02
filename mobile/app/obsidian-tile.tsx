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
    return (
      <ObsidianTileScreenLive
        tileId={id}
        onBack={onBack}
        // `?tile=` aggancia lo spark a QUESTO tile invece di crearne uno nuovo:
        // tutte e sei le rotte sotto app/capture/ leggono già quel parametro.
        onCapture={(key) => router.push(`/capture/${key}?tile=${id}` as never)}
      />
    );
  }
  return <ObsidianTileScreen onBack={onBack} />;
}
