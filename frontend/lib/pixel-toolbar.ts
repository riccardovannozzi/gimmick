import type { PixelTheme } from './pixel-theme';

/**
 * Style condiviso per tutti i bottoni delle toolbar (Canvas, Chrono, Kanban,
 * Panopticon, Sparks, Tiles, Tags, Flows).
 *
 * Coppia ink/surface della palette: in light mode ink è scuro e surface è
 * chiaro; in dark mode ink è BRILLANTE (giallo/rosa/bianco) e surface è
 * scuro. Per ottenere "fondo scuro + testo chiaro" coerente in entrambi i
 * mode dobbiamo SWAP-pare i due slot in base a `theme.mode` — usare sempre
 * `theme.ink` come bg darebbe in dark mode bianco-su-giallo (illeggibile).
 *
 *  - default: sfondo "slot scuro" + testo/bordo "slot chiaro" — popping
 *    inverso rispetto alla Header bar, ma sempre dark-on-light invertito.
 *  - active: sfondo `theme.accent` + testo/bordo `theme.onAccent` + ombra
 *    → il toggle "acceso" è il colore pop del brand.
 *
 * Border = colore del testo (self-coherent chip).
 */
export function pixelToolbarBtn(theme: PixelTheme, active: boolean): React.CSSProperties {
  const darkSlot = theme.mode === 'dark' ? theme.surface : theme.ink;
  const lightSlot = theme.mode === 'dark' ? theme.ink : theme.surface;
  const fg = active ? theme.onAccent : lightSlot;
  const shadowCol = theme.mode === 'dark' ? theme.shadowColor : theme.surface;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    background: active ? theme.accent : darkSlot,
    color: fg,
    border: `2px solid ${fg}`,
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 8,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: active ? `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${shadowCol}` : 'none',
  };
}

/**
 * Variante "segmented" per gruppi di bottoni dentro un container scuro
 * (es. WEEK/MONTH, NAVIGATE/EDIT TAG). Niente border individuale: il
 * container ha il bordo, qui gestiamo solo l'highlight active.
 */
export function pixelSegmentedBtn(theme: PixelTheme, active: boolean): React.CSSProperties {
  const lightSlot = theme.mode === 'dark' ? theme.ink : theme.surface;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px',
    height: 24,
    background: active ? theme.accent : 'transparent',
    color: active ? theme.onAccent : lightSlot,
    border: 'none',
    fontFamily: 'var(--font-pixel-head)',
    fontSize: 8,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  };
}

/**
 * Container per i bottoni `pixelSegmentedBtn`. Bg "slot scuro" + border
 * "slot chiaro" così matcha il look dei bottoni standalone.
 */
export function pixelSegmentedContainer(theme: PixelTheme): React.CSSProperties {
  const darkSlot = theme.mode === 'dark' ? theme.surface : theme.ink;
  const lightSlot = theme.mode === 'dark' ? theme.ink : theme.surface;
  return {
    display: 'flex',
    alignItems: 'center',
    background: darkSlot,
    border: `2px solid ${lightSlot}`,
    padding: 2,
  };
}
