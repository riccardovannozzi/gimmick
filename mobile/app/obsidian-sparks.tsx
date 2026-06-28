/**
 * Gimmick · Obsidian — Mobile Sparks route. At /obsidian-sparks.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, renders the live screen wired
 * to real sparks (React Query + sparksApi); otherwise the static QA mockup.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianSparksScreen, ObsidianSparksScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianSparksRoute() {
  const router = useRouter();
  const onBack = () => { if (router.canGoBack()) router.back(); };

  if (isObsidianShellEnabled()) {
    return (
      <ObsidianSparksScreenLive
        onBack={onBack}
        onOpenSpark={(_id, tileId) => { if (tileId) router.push(`/obsidian-tile?id=${tileId}` as never); }}
      />
    );
  }
  return <ObsidianSparksScreen onBack={onBack} />;
}
