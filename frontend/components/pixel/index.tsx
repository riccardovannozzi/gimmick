'use client';

/**
 * Gimmick — plumbing residuo del vecchio tema "Pixel Arcade".
 *
 * La UI arcade è stata rimossa: `usePixelTheme()` restituisce sempre il tema
 * mappato sui token Obsidian (`buildObsidianPixelTheme`). Questo modulo resta
 * solo perché (a) emette ancora le CSS var `--px-*` consumate dal chrome
 * globale (toast/tooltip/focus in `globals.css`) e (b) `usePixelSettings()`
 * fornisce `captureTreatment` alla TileSidebar. Da eliminare quando quel chrome
 * sarà ripuntato sui token `--ob-*`.
 */
import { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  PixelTheme, buildPixelTheme, BuildPixelThemeInput, themeCssVars,
} from '@/lib/pixel-theme';
import { useObsidianTheme } from '@/lib/theme/obsidian-provider';
import { buildObsidianPixelTheme } from '@/lib/theme/obsidian-pixel-theme';

// ─── Provider + hooks ──────────────────────────────────────────────────────

export type PixelSettings = BuildPixelThemeInput;

export const PIXEL_DEFAULTS: PixelSettings = {
  paletteId: 'cmyk',
  mode: 'light',
  shadowSize: 'm',
  backgroundId: 'none',
  bgColorId: 'paletteDefault',
  captureTreatment: 'tinted',
  scanlines: false,
};

interface CtxValue {
  theme: PixelTheme;
  settings: PixelSettings;
  setSetting: <K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => void;
  setAll: (s: PixelSettings) => void;
  reset: () => void;
}

const Ctx = createContext<CtxValue | null>(null);

/** Read settings from localStorage, falling back to defaults. Only the keys
 *  we know about are merged, so a stale key shape won't crash the provider. */
function readStoredSettings(storageKey: string | undefined): PixelSettings | null {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const merged: PixelSettings = { ...PIXEL_DEFAULTS };
    (Object.keys(PIXEL_DEFAULTS) as (keyof PixelSettings)[]).forEach((k) => {
      if (parsed[k] !== undefined) (merged as any)[k] = parsed[k];
    });
    return merged;
  } catch {
    return null;
  }
}

export function PixelThemeProvider({
  initial = PIXEL_DEFAULTS, onChange, storageKey, children,
}: {
  initial?: PixelSettings;
  onChange?: (s: PixelSettings) => void;
  /** When set, the provider hydrates from `localStorage[storageKey]` after
   *  mount and writes back on every change. The server can then sync on top
   *  via `onChange`. */
  storageKey?: string;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<PixelSettings>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Client-only hydration from localStorage — done in a useEffect so the
  // server-rendered HTML matches the first client paint, then the saved
  // settings take over on the next frame.
  useEffect(() => {
    const stored = readStoredSettings(storageKey);
    if (stored) setSettings(stored);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSetting = useCallback(<K extends keyof PixelSettings>(k: K, v: PixelSettings[K]) => {
    setSettings((s) => {
      const next = { ...s, [k]: v };
      if (storageKey && typeof window !== 'undefined') {
        try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* */ }
      }
      onChange?.(next);
      return next;
    });
  }, [onChange, storageKey]);

  const setAll = useCallback((next: PixelSettings) => {
    setSettings(next);
    if (storageKey && typeof window !== 'undefined') {
      try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* */ }
    }
    onChange?.(next);
  }, [onChange, storageKey]);

  const reset = useCallback(() => {
    setAll(PIXEL_DEFAULTS);
  }, [setAll]);

  const theme = useMemo(() => buildPixelTheme(settings), [settings]);
  // Sfondo/foreground del wrapper full-height seguono i token Obsidian, così al
  // reload (F5) il primo paint ha già il colore giusto (default mode 'dark').
  const { mode: obMode } = useObsidianTheme();
  const obWrap = useMemo(() => buildObsidianPixelTheme(obMode), [obMode]);
  const wrapBg = obWrap.bg1;
  const wrapInk = obWrap.ink;
  return (
    <Ctx.Provider value={{ theme, settings, setSetting, setAll, reset }}>
      <div
        // suppressHydrationWarning: the bg/colors flip post-hydration when
        // localStorage settings load. The change is purely visual.
        suppressHydrationWarning
        style={{
          ...themeCssVars(theme),
          backgroundColor: wrapBg, color: wrapInk,
          minHeight: '100vh',
          fontFamily: 'var(--font-pixel-body), ui-monospace, monospace',
        }}
      >
        {hydrated || !storageKey ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
      </div>
    </Ctx.Provider>
  );
}

export function usePixelTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePixelTheme must be inside <PixelThemeProvider>');
  // Migrazione Obsidian (Fase 8/9): dentro lo shell la palette pixel viene
  // sostituita da un PixelTheme mappato sui token Obsidian, così il layer D3
  // (Canvas/Graph) e le superfici arcade residue (TileSidebar, menu, modali)
  // rese dentro lo shell adottano i colori Obsidian senza riscrivere l'SVG.
  // Reattivo al mode light/dark via useObsidianTheme.
  const { mode } = useObsidianTheme();
  return useMemo(() => buildObsidianPixelTheme(mode), [mode]);
}
export function usePixelSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePixelSettings must be inside <PixelThemeProvider>');
  return { settings: c.settings, setSetting: c.setSetting, setAll: c.setAll, reset: c.reset };
}

