'use client';

/**
 * Settings — vista Obsidian (la gestione azioni/statuses/tipi/beniamini vive
 * ora nativamente in `SettingsView` → pannelli Personalizzazione + Beniamini).
 * I vecchi modali arcade sono stati rimossi nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { SettingsLive } from '@/components/views/settings-live';

export default function SettingsPage() {
  return (
    <ViewContainer hideToolbar>
      <SettingsLive />
    </ViewContainer>
  );
}
