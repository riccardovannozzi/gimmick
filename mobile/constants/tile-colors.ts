/**
 * Gimmick — Colori della TILE, allineati al Canvas web.
 *
 * Mirror di `frontend/lib/palette.ts` (DEFAULT_ACTION_COLORS, readableOn) e di
 * `frontend/lib/status-meta.ts` (hex degli status di sistema). Sono gli stessi
 * valori con cui il canvas dipinge badge azione e colonna status, quindi un
 * tile letto sul telefono ha gli stessi colori di quello sulla board.
 *
 * I colori azione sono sovrascrivibili dall'utente (settings `action_colors`):
 * qui vivono solo i default, il valore effettivo arriva da settingsApi.
 */

/** Chiave d'azione della tile: 'allday' è virtuale (event + all_day). */
export type TileActionKey = 'none' | 'anytime' | 'deadline' | 'event' | 'allday' | 'flow';

export const DEFAULT_ACTION_COLORS: Record<TileActionKey, string> = {
  none: '#52525B',     // Notes — neutro
  anytime: '#666666',  // To-do
  deadline: '#F82B60', // Deadline
  event: '#20C933',    // Timed
  allday: '#2D7FF9',   // All day
  flow: '#8B46FF',     // Flow — processo a passi
};

/** Colore del bordo delle scadenze — identico al canvas. */
export const DEADLINE_BORDER = '#E24B4A';

/** Hex degli status di sistema (colonna a sinistra della tile). */
export const STATUS_HEX: Record<string, string> = {
  active: '#4F86EE',
  done: '#3FAE72',
  paused: '#C99220',
  blocked: '#E0544F',
  cancelled: '#5C5868',
};
export const STATUS_HEX_FALLBACK = '#5C5868';

/**
 * Colore leggibile sopra un fondo: scuro su chiaro, chiaro su scuro (luminanza
 * relativa WCAG). Mirror di `readableOn` del web.
 */
export function readableOn(bg: string, light = '#FFFFFF', dark = '#18181B'): string {
  if (!bg) return light;
  let hex = bg.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
  if (hex.length !== 6) return light;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return light;
  const lin = (v: number) => {
    const ch = v / 255;
    return ch <= 0.03928 ? ch / 12.92 : Math.pow((ch + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? dark : light;
}
