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

  // Si arriva sempre in `push` dall'header (AppHeader → onAsk), quindi c'è
  // qualcosa a cui tornare. Il fallback copre l'apertura diretta della rotta —
  // deep link o anteprima QA — dove lo stack è vuoto e `back()` non farebbe
  // nulla, lasciando il pulsante inerte.
  const goBack = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  // Stessa rotta di dettaglio usata dalla lista Tiles (ViewsTabHost): una tile
  // aperta dalla chat deve finire dove finirebbe aperta dall'elenco.
  const openTile = React.useCallback(
    (id: string) => router.push(`/obsidian-tile?id=${id}` as never),
    [router],
  );

  if (isObsidianShellEnabled()) {
    return <ObsidianAskScreenLive onBack={goBack} onOpenTile={openTile} />;
  }
  return <ObsidianAskScreen onBack={goBack} />;
}
