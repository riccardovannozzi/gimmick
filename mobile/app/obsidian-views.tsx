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
        // Home = la schermata di cattura VIVA, che sta in `(tabs)/index` — NON
        // `/obsidian-capture`, che è il mockup QA statico e porterebbe a una
        // home finta, senza buffer né invio.
        // `replace` e non `push`: la home è la radice della shell, e con push si
        // accumulerebbe una pila home→viste→home→viste in cui il tasto Indietro
        // ripercorre un giro che l'utente non ricorda di aver fatto.
        onHome={() => router.replace('/(tabs)' as never)}
        onAsk={() => router.push('/obsidian-ask' as never)}
      />
    );
  }
  return <ObsidianViewsScreen />;
}
