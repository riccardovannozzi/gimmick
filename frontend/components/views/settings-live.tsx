'use client';

/**
 * Gimmick · Obsidian — Settings view collegata ai dati reali (Fase 6).
 *
 * Collega la `SettingsView`:
 *   - Tema (Aspetto) → `useObsidianTheme` (light/dark persistiti via settingsApi,
 *     vedi Fase 0); "Sistema" risolve `prefers-color-scheme` una tantum
 *   - Account (email + Esci) → `useAuthStore`
 *
 * GAP (vedi MIGRATION_PLAN.md): i pannelli arcade (colori azioni, statuses,
 * type-icons, roster mascotte, palette tema arcade) e la danger-zone
 * elimina-account NON sono ancora portati; gli altri controlli del pannello
 * Aspetto (colore tile, aptico, conferma, lingua, export) restano UI locale.
 */
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SettingsView } from '@/components/views/settings';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { useAuthStore } from '@/store/auth-store';
import type { ObsidianMode } from '@/lib/theme/obsidian';

export function SettingsLive() {
  const router = useRouter();
  const { mode, setMode } = useObsidianTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const onThemeMode = useCallback(
    (v: string) => {
      if (v === 'light' || v === 'dark') {
        setMode(v as ObsidianMode);
      } else if (v === 'system') {
        const prefersDark =
          typeof window !== 'undefined' &&
          window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        setMode(prefersDark ? 'dark' : 'light');
      }
    },
    [setMode],
  );

  const onLogout = useCallback(async () => {
    await signOut();
    router.push('/login');
  }, [signOut, router]);

  return (
    <SettingsView
      themeMode={mode}
      onThemeMode={onThemeMode}
      account={{ email: user?.email, onLogout }}
    />
  );
}
