import type { PixelTheme } from './pixel-theme';
import { OB_WEIGHT, OB_TEXT } from '@/lib/theme/ob-typography';

/**
 * Style condivisi per i bottoni delle toolbar (Canvas, Graph, Tags).
 *
 * I colori arrivano dal PixelTheme mappato sui token Obsidian (vedi
 * `obsidian-pixel-theme.ts`): qui definiamo solo la struttura — Geist, hairline
 * 1px + raggio, niente uppercase né ombre dure.
 *
 * Scala verticale dello shell: 56 navbar · 48 barre della fascia sotto la
 * navbar (toolbar canvas, header sidebar, tabbar inspector) · 40 sotto-barre
 * annidate. I CONTROLLI dentro le barre stanno tutti a 30: toolbar, segmented e
 * tab dell'inspector (`.ob-insp-tab`). Cambiare qui significa cambiare la
 * fascia intera, quindi tenerli allineati.
 */
export function obsidianToolbarBtn(theme: PixelTheme, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 'var(--ob-radius-sm)',
    background: active ? theme.accent : theme.surfaceVariant,
    color: active ? theme.onAccent : theme.ink2,
    border: 'none',
    fontFamily: 'var(--ob-font-sans)',
    fontSize: OB_TEXT.control,
    fontWeight: OB_WEIGHT.emphasis,
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
    height: 30,
    borderRadius: 'var(--ob-radius-sm)',
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : theme.ink2,
    border: 'none',
    fontFamily: 'var(--ob-font-sans)',
    fontSize: OB_TEXT.control,
    fontWeight: OB_WEIGHT.emphasis,
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
    borderRadius: 'var(--ob-radius-sm)',
    padding: 3,
  };
}
