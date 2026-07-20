'use client';

/**
 * Gimmick · Obsidian — Theme provider (Fase 0 della migrazione).
 *
 * Gestisce la modalità light/dark del design system Obsidian e la rende
 * disponibile via context. Convive con `PixelThemeProvider` (token `--px-*`):
 * questo provider tocca solo i token `--ob-*` impostando l'attributo
 * `data-theme` sul root del documento (vedi app/obsidian.css).
 *
 * Persistenza a due livelli (stesso pattern di PixelSettingsServerSync):
 *   - localStorage → immediato, locale, evita il flash al reload
 *   - settingsApi  → copia autoritativa lato server, sincronizza tra device
 *     (pull una volta al login, push con debounce 600ms al cambio)
 */
import * as React from 'react';
import { useAuthStore } from '@/store/auth-store';
import { settingsApi } from '@/lib/api';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
import type { ObsidianMode } from '@/lib/theme/obsidian';

const STORAGE_KEY = 'obsidian_theme';
const SETTINGS_KEY = 'obsidian_theme_v1';
const DEFAULT_MODE: ObsidianMode = 'dark';

interface ObsidianThemeContextValue {
  mode: ObsidianMode;
  setMode: (mode: ObsidianMode) => void;
  toggle: () => void;
}

const ObsidianThemeContext = React.createContext<ObsidianThemeContextValue | null>(null);

function readInitialMode(): ObsidianMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* localStorage non disponibile */
  }
  return DEFAULT_MODE;
}

export function ObsidianThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ObsidianMode>(DEFAULT_MODE);
  const user = useAuthStore((s) => s.user);
  const pulledOnce = React.useRef(false);
  const lastPushed = React.useRef<string>('');
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idratazione dal localStorage dopo il mount (evita mismatch SSR/CSR).
  React.useEffect(() => {
    setModeState(readInitialMode());
  }, []);

  // Applica `data-theme` al root + persiste in localStorage ad ogni cambio.
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', mode);
      // Marker globale per gli override scoped (es. scrollbar Obsidian che
      // devono battere lo stile pixel globale in globals.css). Solo con shell ON.
      if (isObsidianShellEnabled()) {
        document.documentElement.setAttribute('data-ob', 'on');
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* best-effort */
    }
  }, [mode]);

  // Pull dal server una sola volta al login.
  React.useEffect(() => {
    if (!user || pulledOnce.current) return;
    pulledOnce.current = true;
    settingsApi
      .get<{ mode?: ObsidianMode } | ObsidianMode>(SETTINGS_KEY)
      .then((res) => {
        if (!res.success || !res.data) return;
        const incoming =
          typeof res.data === 'string' ? res.data : res.data.mode;
        if (incoming === 'light' || incoming === 'dark') {
          lastPushed.current = incoming;
          setModeState(incoming);
        }
      })
      .catch(() => {
        /* l'utente potrebbe non avere ancora impostazioni */
      });
  }, [user]);

  // Push sul server al cambio (debounced).
  React.useEffect(() => {
    if (!user) return;
    if (mode === lastPushed.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      settingsApi
        .set(SETTINGS_KEY, { mode })
        .then(() => {
          lastPushed.current = mode;
        })
        .catch(() => {
          /* best-effort */
        });
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [user, mode]);

  const value = React.useMemo<ObsidianThemeContextValue>(
    () => ({
      mode,
      setMode: setModeState,
      toggle: () => setModeState((m) => (m === 'dark' ? 'light' : 'dark')),
    }),
    [mode],
  );

  return (
    <ObsidianThemeContext.Provider value={value}>
      {children}
    </ObsidianThemeContext.Provider>
  );
}

/** Accesso alla modalità tema Obsidian. Sicuro anche fuori dal provider. */
export function useObsidianTheme(): ObsidianThemeContextValue {
  const ctx = React.useContext(ObsidianThemeContext);
  if (!ctx) {
    // Fallback inerte: consente l'uso isolato (es. preview) senza provider.
    return { mode: DEFAULT_MODE, setMode: () => {}, toggle: () => {} };
  }
  return ctx;
}
