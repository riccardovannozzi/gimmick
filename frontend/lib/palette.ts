import type { ActionType } from '@/types';

export interface PaletteColor {
  id: string;
  hex: string;
  name: string;
}

/**
 * Palette Gimmick basata sull'Airtable Blocks SDK.
 * 10 famiglie cromatiche (Blue, Cyan, Teal, Green, Yellow, Orange, Red, Pink, Purple, Gray)
 * × 4 stop di intensità (Light2, Light1, Bright, Dark1) = 40 colori.
 *
 * Fonte: https://airtable.com/developers/extensions/api/UI/utils/colors
 *
 * Ordinamento: riga per riga dal più chiaro al più scuro (Light2 → Light1 → Bright → Dark1).
 * All'interno di ogni riga: Blue → Cyan → Teal → Green → Yellow → Orange → Red → Pink → Purple → Gray.
 * L'ordine va mantenuto perché determina il layout 10×4 del ColorPicker.
 */
export const GIMMICK_PALETTE: PaletteColor[] = [
  // Riga 1 — Light2
  { id: 'blueLight2',   hex: '#CFDFFF', name: 'Blu chiaro' },
  { id: 'cyanLight2',   hex: '#D0F0FD', name: 'Ciano chiaro' },
  { id: 'tealLight2',   hex: '#C2F5E9', name: 'Verde acqua chiaro' },
  { id: 'greenLight2',  hex: '#D1F7C4', name: 'Verde chiaro' },
  { id: 'yellowLight2', hex: '#FFEAB6', name: 'Giallo chiaro' },
  { id: 'orangeLight2', hex: '#FEE2D5', name: 'Arancio chiaro' },
  { id: 'redLight2',    hex: '#FFDCE5', name: 'Rosso chiaro' },
  { id: 'pinkLight2',   hex: '#FFDAF6', name: 'Rosa chiaro' },
  { id: 'purpleLight2', hex: '#EDE2FE', name: 'Viola chiaro' },
  { id: 'grayLight2',   hex: '#EEEEEE', name: 'Grigio chiaro' },

  // Riga 2 — Light1
  { id: 'blueLight1',   hex: '#9CC7FF', name: 'Blu tenue' },
  { id: 'cyanLight1',   hex: '#77D1F3', name: 'Ciano tenue' },
  { id: 'tealLight1',   hex: '#72DDC3', name: 'Verde acqua tenue' },
  { id: 'greenLight1',  hex: '#93E088', name: 'Verde tenue' },
  { id: 'yellowLight1', hex: '#FFD66E', name: 'Giallo tenue' },
  { id: 'orangeLight1', hex: '#FFA981', name: 'Arancio tenue' },
  { id: 'redLight1',    hex: '#FF9EB7', name: 'Rosso tenue' },
  { id: 'pinkLight1',   hex: '#F99DE2', name: 'Rosa tenue' },
  { id: 'purpleLight1', hex: '#CDB0FF', name: 'Viola tenue' },
  { id: 'grayLight1',   hex: '#CCCCCC', name: 'Grigio tenue' },

  // Riga 3 — Bright
  { id: 'blueBright',   hex: '#2D7FF9', name: 'Blu' },
  { id: 'cyanBright',   hex: '#18BFFF', name: 'Ciano' },
  { id: 'tealBright',   hex: '#20D9D2', name: 'Verde acqua' },
  { id: 'greenBright',  hex: '#20C933', name: 'Verde' },
  { id: 'yellowBright', hex: '#FCB400', name: 'Giallo' },
  { id: 'orangeBright', hex: '#FF6F2C', name: 'Arancio' },
  { id: 'redBright',    hex: '#F82B60', name: 'Rosso' },
  { id: 'pinkBright',   hex: '#FF08C2', name: 'Rosa' },
  { id: 'purpleBright', hex: '#8B46FF', name: 'Viola' },
  { id: 'grayBright',   hex: '#666666', name: 'Grigio' },

  // Riga 4 — Dark1
  { id: 'blueDark1',    hex: '#2750AE', name: 'Blu scuro' },
  { id: 'cyanDark1',    hex: '#0B76B7', name: 'Ciano scuro' },
  { id: 'tealDark1',    hex: '#06A09B', name: 'Verde acqua scuro' },
  { id: 'greenDark1',   hex: '#338A17', name: 'Verde scuro' },
  { id: 'yellowDark1',  hex: '#B87503', name: 'Giallo scuro' },
  { id: 'orangeDark1',  hex: '#D74D26', name: 'Arancio scuro' },
  { id: 'redDark1',     hex: '#BA1E45', name: 'Rosso scuro' },
  { id: 'pinkDark1',    hex: '#B2158B', name: 'Rosa scuro' },
  { id: 'purpleDark1',  hex: '#6B1CB0', name: 'Viola scuro' },
  { id: 'grayDark1',    hex: '#444444', name: 'Grigio scuro' },
];

/**
 * Default colori per action_type.
 * - `none` (Notes): neutro strutturale fuori palette — non esposto nel picker.
 * - `allday`: blueBright (colore primario della palette).
 */
export const DEFAULT_ACTION_COLORS: Record<ActionType, string> = {
  none:     '#52525B', // Zinc-600 (Notes — neutro, non mostrato in UI)
  anytime:  '#666666', // grayBright (To Do)
  deadline: '#F82B60', // redBright (Deadline)
  event:    '#20C933', // greenBright (Timed)
  allday:   '#2D7FF9', // blueBright (All Day)
};

export function getColorName(hex: string): string {
  if (!hex) return '';
  const found = GIMMICK_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.name ?? hex;
}

// Returns an icon/text color readable on the given background:
// dark foreground on light backgrounds, light foreground on dark backgrounds.
// Uses WCAG relative luminance.
export function readableOn(bg: string, light = '#FFFFFF', dark = '#18181B'): string {
  if (!bg) return light;
  let hex = bg.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return light;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return light;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.5 ? dark : light;
}
