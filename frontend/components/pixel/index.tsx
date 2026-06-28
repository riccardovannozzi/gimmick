'use client';

/**
 * Gimmick · Pixel Arcade — Atoms for the Next.js frontend.
 *
 * Drop into frontend/components/pixel/index.tsx.
 *
 * Tailwind isn't required but encouraged for layout. The atoms below use
 * inline styles for theme-driven values (so a single token change in
 * `pixel-theme.ts` propagates everywhere) and Tailwind for spacing.
 */
import { createContext, useContext, useMemo, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  PixelTheme, buildPixelTheme, BuildPixelThemeInput,
  PaletteId, PaletteMode, ShadowSize, BgColorId, BackgroundId, CaptureTreatment,
  backgroundCSS, themeCssVars,
} from '@/lib/pixel-theme';
import { isObsidianShellEnabled } from '@/lib/feature-flags';
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
  return (
    <Ctx.Provider value={{ theme, settings, setSetting, setAll, reset }}>
      <div
        // suppressHydrationWarning: the bg/colors flip post-hydration when
        // localStorage settings load. The change is purely visual.
        suppressHydrationWarning
        className={theme.scanlines ? 'px-scanlines' : undefined}
        style={{
          ...themeCssVars(theme),
          backgroundColor: theme.bg1, color: theme.ink,
          minHeight: '100vh',
          fontFamily: 'var(--font-pixel-body), ui-monospace, monospace',
          ...backgroundCSS(theme.backgroundId, theme),
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
  const obsidian = useMemo(() => buildObsidianPixelTheme(mode), [mode]);
  if (isObsidianShellEnabled()) return obsidian;
  return c.theme;
}
export function usePixelSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePixelSettings must be inside <PixelThemeProvider>');
  return { settings: c.settings, setSetting: c.setSetting, setAll: c.setAll, reset: c.reset };
}

// ─── Atoms ──────────────────────────────────────────────────────────────────

type DivProps = React.HTMLAttributes<HTMLDivElement>;
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PixelCard({ children, style, className, ...rest }: DivProps) {
  const theme = usePixelTheme();
  return (
    <div
      {...rest}
      className={className}
      style={{
        background: theme.surface,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        padding: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PixelButton({
  children, big, full, leading,
  bg, color, className, style, ...rest
}: ButtonProps & {
  big?: boolean; full?: boolean;
  leading?: ReactNode;
  bg?: string; color?: string;
}) {
  const theme = usePixelTheme();
  return (
    <button
      {...rest}
      className={`px-press ${className ?? ''}`}
      style={{
        appearance: 'none', cursor: 'pointer',
        background: bg || theme.surfaceVariant,
        color: color || theme.ink,
        border: theme.cardBorder,
        boxShadow: theme.cardShadow,
        padding: big ? '16px' : '10px 14px',
        width: full ? '100%' : undefined,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: 'var(--font-pixel-head)',
        fontSize: big ? 12 : 10, letterSpacing: '0.04em',
        ...style,
      }}
    >
      {leading}
      {children}
    </button>
  );
}

export function PixelBadge({
  children, bg, color, style,
}: { children: ReactNode; bg?: string; color?: string; style?: React.CSSProperties }) {
  const theme = usePixelTheme();
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '3px 6px',
        background: bg || theme.ink,
        color: color || theme.bg1,
        border: `2px solid ${theme.border}`,
        fontFamily: 'var(--font-pixel-head)',
        fontSize: 8, letterSpacing: '0.06em',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function PixelToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const theme = usePixelTheme();
  return (
    <button
      type="button"
      className="px-press"
      onClick={() => onChange(!on)}
      style={{
        appearance: 'none', cursor: 'pointer',
        width: 48, height: 24, padding: 2,
        background: on ? theme.accent : theme.surfaceVariant,
        border: `2px solid ${theme.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{
        display: 'block', width: 16, height: 16,
        background: on ? theme.bg1 : theme.ink3,
        border: `2px solid ${theme.border}`,
      }} />
    </button>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, small,
}: {
  options: { id: T; label: string }[];
  value: T; onChange: (v: T) => void; small?: boolean;
}) {
  const theme = usePixelTheme();
  return (
    <div style={{
      display: 'flex', padding: 2,
      background: theme.bg1, border: `2px solid ${theme.border}`,
    }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id} type="button" className="px-press"
            onClick={() => onChange(o.id)}
            style={{
              appearance: 'none', cursor: 'pointer', flex: 1,
              padding: small ? '5px 4px' : '6px 8px',
              background: active ? theme.accent : 'transparent',
              color: active ? theme.onAccent : theme.ink2,
              border: 'none',
              fontFamily: 'var(--font-pixel-head)',
              fontSize: small ? 7 : 8, letterSpacing: '0.06em',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChipGrid<T extends string>({
  options, value, onChange, swatched,
}: {
  options: { id: T; label: string; sw?: string }[];
  value: T; onChange: (v: T) => void; swatched?: boolean;
}) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id} type="button" className="px-press"
            onClick={() => onChange(o.id)}
            style={{
              appearance: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 7px',
              background: active ? theme.accent : theme.bg1,
              color: active ? theme.onAccent : theme.ink2,
              border: `2px solid ${theme.border}`,
              boxShadow: active ? theme.cardShadow : 'none',
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 7, letterSpacing: '0.04em',
            }}
          >
            {swatched && o.sw && (
              <span style={{
                display: 'inline-block', width: 9, height: 9,
                background: o.sw,
                border: `1.5px solid ${active ? theme.onAccent : theme.border}`,
              }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PixelWordmark({ size = 18 }: { size?: number }) {
  const theme = usePixelTheme();
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <PixelSparkSprite color={theme.accent} size={size + 2} />
      <span style={{
        fontFamily: 'var(--font-pixel-head)',
        fontSize: size, color: theme.ink, letterSpacing: '0.06em',
      }}>GIMMICK</span>
    </div>
  );
}

export function PixelSparkSprite({ color, size = 16 }: { color: string; size?: number }) {
  const cell = Math.max(2, Math.floor(size / 8));
  const pattern = [
    '...11...','..1111..','.111111.','11111111',
    '11111111','.111111.','..1111..','...11...',
  ];
  return (
    <span style={{ display: 'inline-grid', gridTemplateColumns: `repeat(8, ${cell}px)`, width: cell*8, height: cell*8 }}>
      {pattern.flatMap((row, y) => row.split('').map((c, x) => (
        <span key={`${x}-${y}`} style={{
          width: cell, height: cell, display: 'block',
          background: c === '1' ? color : 'transparent',
        }} />
      )))}
    </span>
  );
}
