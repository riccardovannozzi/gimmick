export interface PaletteColor {
  id: string;
  hex: string;
  name: string;
}

/**
 * Palette Gimmick basata sull'Airtable Blocks SDK.
 * 10 famiglie × 4 stop (Light2 → Light1 → Bright → Dark1) = 40 colori.
 * Mirror di frontend/lib/palette.ts — mantenere le due in sync.
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

export const DEFAULT_ACTION_COLORS: Record<string, string> = {
  none:     '#52525B', // Zinc-600 (neutro, non mostrato in UI)
  anytime:  '#666666', // grayBright (To Do)
  deadline: '#F82B60', // redBright (Deadline)
  event:    '#20C933', // greenBright (Timed)
  allday:   '#2D7FF9', // blueBright (All Day)
};

export function getColorName(hex: string): string {
  const found = GIMMICK_PALETTE.find((c) => c.hex.toLowerCase() === hex.toLowerCase());
  return found?.name ?? hex;
}
