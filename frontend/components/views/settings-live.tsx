'use client';

/**
 * Gimmick · Obsidian — Settings collegati ai dati reali (Fase 6).
 *
 * Il contenuto, non la cornice: da `settings-modal.tsx` in poi vive dentro una
 * modale, non più nel corpo di una pagina.
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
import { useViewPrefs } from '@/store/view-prefs-store';
import type { ObsidianMode } from '@/lib/theme/obsidian';

export interface SettingsLiveProps {
  /** Chiude la cornice che ospita i settings (la modale). */
  onClose?: () => void;
}

export function SettingsLive({ onClose }: SettingsLiveProps = {}) {
  const router = useRouter();
  const { mode, setMode } = useObsidianTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const panopticon = useViewPrefs((s) => s.panopticon);
  const setPanopticon = useViewPrefs((s) => s.setPanopticon);

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
    // Prima si chiude, poi si esce: la modale vive in uno store che sopravvive
    // al cambio di rotta, e lasciata aperta riaffiorerebbe sul login successivo.
    onClose?.();
    await signOut();
    router.push('/login');
  }, [signOut, router, onClose]);

  return (
    <SettingsView
      themeMode={mode}
      onThemeMode={onThemeMode}
      account={{ email: user?.email, onLogout }}
      views={{ panopticon, onPanopticon: setPanopticon }}
    />
  );
}
