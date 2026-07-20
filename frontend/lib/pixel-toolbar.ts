import type { PixelTheme } from './pixel-theme';

/**
 * Style condivisi per i bottoni delle toolbar (Canvas, Graph, Tags).
 *
 * I colori arrivano dal PixelTheme mappato sui token Obsidian (vedi
 * `obsidian-pixel-theme.ts`): qui definiamo solo la struttura — Geist, hairline
 * 1px + raggio, niente uppercase né ombre dure.
 */
export function obsidianToolbarBtn(theme: PixelTheme, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 10,
    background: active ? theme.accent : theme.surfaceVariant,
    color: active ? theme.onAccent : theme.ink2,
    border: `1px solid ${active ? 'transparent' : theme.border}`,
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'none',
    cursor: 'pointer',
    boxShadow: 'none',
  };
}

/** Segmented button (dentro un container), es. WEEK/MONTH, NAVIGATE/EDIT TAG. */
export function obsidianSegmentedBtn(theme: PixelTheme, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    height: 26,
    borderRadius: 8,
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : theme.ink2,
    border: 'none',
    fontFamily: 'var(--ob-font-sans)',
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'none',
    cursor: 'pointer',
  };
}

/** Container per `obsidianSegmentedBtn` (surface-2 + hairline). */
export function obsidianSegmentedContainer(theme: PixelTheme): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    background: theme.surfaceVariant,
    border: `1px solid ${theme.border}`,
    borderRadius: 10,
    padding: 3,
  };
}
