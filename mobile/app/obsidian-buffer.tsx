/**
 * Gimmick · Obsidian — Mobile Buffer route. At /obsidian-buffer.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, the triage stack is driven by
 * the live buffer store; otherwise the static QA mockup.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianBufferScreen, ObsidianBufferScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianBufferRoute() {
  const router = useRouter();
  const onBack = () => { if (router.canGoBack()) router.back(); };

  if (isObsidianShellEnabled()) {
    return <ObsidianBufferScreenLive onBack={onBack} onCapture={() => router.push('/obsidian-capture' as never)} />;
  }
  return <ObsidianBufferScreen onBack={onBack} />;
}
