/**
 * Gimmick · Obsidian — Mobile Ask route. At /obsidian-ask.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, renders the live chat (chatApi
 * send loop); otherwise the static QA demo thread.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianAskScreen, ObsidianAskScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

export default function ObsidianAskRoute() {
  const router = useRouter();
  const onBack = () => { if (router.canGoBack()) router.back(); };

  if (isObsidianShellEnabled()) {
    return <ObsidianAskScreenLive onBack={onBack} />;
  }
  return <ObsidianAskScreen onBack={onBack} />;
}
