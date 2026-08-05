/**
 * Gimmick · Obsidian — Mobile Ask route. At /obsidian-ask.
 *
 * Flag-aware: with EXPO_PUBLIC_OBSIDIAN_SHELL on, renders the live chat (chatApi
 * send loop); otherwise the static QA demo thread.
 */
import React from 'react';
import { ObsidianAskScreen, ObsidianAskScreenLive } from '@/components/obsidian';
import { isObsidianShellEnabled } from '@/lib/feature-flags';

// Niente `onBack`: la schermata non ha più una barra in cima dove metterlo. Si
// esce col tasto indietro di sistema o con lo swipe dal bordo, che la Stack di
// expo-router gestisce da sé.
export default function ObsidianAskRoute() {
  if (isObsidianShellEnabled()) {
    return <ObsidianAskScreenLive />;
  }
  return <ObsidianAskScreen />;
}
