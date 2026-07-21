/**
 * Gimmick · Pixel Arcade — Design tokens for the Next.js frontend.
 *
 * Drop into frontend/lib/pixel-theme.ts. Mirror of mobile/constants/pixel-theme.ts
 * with the same data — keep them in sync.
 */

// ─── Capture types ──────────────────────────────────────────────────────────
export type CaptureKey = 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';

export const CAPTURE_LABELS: Record<CaptureKey, string> = {
  photo: 'PHOTO', video: 'VIDEO', gallery: 'IMAGE',
  text: 'TEXT', voice: 'REC', file: 'FILE',
};

// ─── Palette ────────────────────────────────────────────────────────────────
export type PaletteMode = 'light' | 'dark';

export interface PalettePerMode {
  bg1: string; bg2: string; bg3: string;
  surface: string; surfaceVariant: string; surfaceMuted: string;
  ink: string; ink2: string; ink3: string;
  border: string; borderStrong: string;
  accent: string; onAccent: string;
  shadowColor: string;
  cap: Record<CaptureKey, string>;
  tint: Record<CaptureKey, string>;
}

export interface PaletteDef {
  label: string;
  light: PalettePerMode;
  dark: PalettePerMode;
}

export const PIXEL_PALETTES = {
  cmyk: {
    label: 'CMYK · Navy & Hot Pink',
    light: {
      bg1: '#FFE8C8', bg2: '#FFF6E6', bg3: '#FFD78A',
      surface: '#FFF6E6', surfaceVariant: '#FFE0A0', surfaceMuted: '#FFCC66',
      ink: '#0A1837', ink2: '#2A3A6B', ink3: '#5A6A9B',
      border: '#0A1837', borderStrong: '#0A1837',
      accent: '#FF2E93', onAccent: '#FFF6E6', shadowColor: '#0A1837',
      cap:  { photo:'#00C8FF', video:'#FF2E93', gallery:'#B043FF', text:'#1FB81F', voice:'#FF3D3D', file:'#FFB400' },
      tint: { photo:'#CCEFFF', video:'#FFD0E5', gallery:'#E8CCFF', text:'#CDF0CD', voice:'#FFD0D0', file:'#FFE5A8' },
    },
    dark: {
      bg1: '#100A2E', bg2: '#1A1247', bg3: '#2D1F6E',
      surface: '#1A1247', surfaceVariant: '#2D1F6E', surfaceMuted: '#3A2A8C',
      ink: '#FFE34D', ink2: '#5BE0FF', ink3: '#B79DFF',
      border: '#FFE34D', borderStrong: '#FFE34D',
      accent: '#FF2E93', onAccent: '#100A2E', shadowColor: '#FF2E93',
      cap:  { photo:'#5BE0FF', video:'#FF2E93', gallery:'#B043FF', text:'#5DFB55', voice:'#FF5252', file:'#FFE34D' },
      tint: { photo:'#0F2E47', video:'#3D0E29', gallery:'#2A0F47', text:'#0F3D14', voice:'#3D1212', file:'#3D2E0F' },
    },
  },
  synthwave: {
    label: 'Synthwave · Neon Sunset',
    light: {
      bg1: '#FFE3DC', bg2: '#FFF1ED', bg3: '#FFC1B5',
      surface: '#FFF1ED', surfaceVariant: '#FFD1C5', surfaceMuted: '#FFB2A0',
      ink: '#3D0F47', ink2: '#7A1F8C', ink3: '#B040C2',
      border: '#3D0F47', borderStrong: '#3D0F47',
      accent: '#FF2E93', onAccent: '#FFF1ED', shadowColor: '#3D0F47',
      cap:  { photo:'#00AAD4', video:'#FF2E93', gallery:'#9C2FFF', text:'#1FB820', voice:'#FF4400', file:'#FF8800' },
      tint: { photo:'#BFE5F0', video:'#FFCFE0', gallery:'#E2C5FF', text:'#CFF0CF', voice:'#FFCFB8', file:'#FFD9B8' },
    },
    dark: {
      bg1: '#08051F', bg2: '#16093A', bg3: '#26115C',
      surface: '#16093A', surfaceVariant: '#26115C', surfaceMuted: '#3A1A82',
      ink: '#FF6BD9', ink2: '#5BE0FF', ink3: '#B79DFF',
      border: '#FF6BD9', borderStrong: '#FF6BD9',
      accent: '#FFE34D', onAccent: '#08051F', shadowColor: '#5BE0FF',
      cap:  { photo:'#5BE0FF', video:'#FF2E93', gallery:'#B043FF', text:'#5DFB55', voice:'#FF6B6B', file:'#FFE34D' },
      tint: { photo:'#0F2E5C', video:'#3D0E47', gallery:'#2D0F5C', text:'#0F3D2E', voice:'#3D1F1F', file:'#3D2F0F' },
    },
  },
  arcade: {
    label: 'Arcade · Black & Pure CMYK',
    light: {
      bg1: '#FFF6E6', bg2: '#FFFFFF', bg3: '#FFE5A8',
      surface: '#FFFFFF', surfaceVariant: '#FFE5A8', surfaceMuted: '#FFD073',
      ink: '#000000', ink2: '#1A1A1A', ink3: '#525252',
      border: '#000000', borderStrong: '#000000',
      accent: '#FF0033', onAccent: '#FFFFFF', shadowColor: '#000000',
      cap:  { photo:'#0066FF', video:'#FF0033', gallery:'#9933FF', text:'#00B33C', voice:'#FF0033', file:'#FFCC00' },
      tint: { photo:'#CCDDFF', video:'#FFCCD5', gallery:'#E5CCFF', text:'#CCFFE0', voice:'#FFCCCC', file:'#FFF0CC' },
    },
    dark: {
      bg1: '#000000', bg2: '#0E0E0E', bg3: '#1A1A1A',
      surface: '#0E0E0E', surfaceVariant: '#1A1A1A', surfaceMuted: '#262626',
      ink: '#FFFFFF', ink2: '#FFCC00', ink3: '#999999',
      border: '#FFFFFF', borderStrong: '#FFFFFF',
      accent: '#FF0033', onAccent: '#FFFFFF', shadowColor: '#FF0033',
      cap:  { photo:'#00AAFF', video:'#FF0044', gallery:'#B355FF', text:'#33DD55', voice:'#FF3333', file:'#FFCC00' },
      tint: { photo:'#001E3D', video:'#3D0011', gallery:'#26113D', text:'#0E3315', voice:'#3D1111', file:'#3D2E00' },
    },
  },
  gameboy: {
    label: 'Game Boy Color · Pastel',
    light: {
      bg1: '#FFF0F8', bg2: '#FFFFFF', bg3: '#FFD0E8',
      surface: '#FFFFFF', surfaceVariant: '#FFD0E8', surfaceMuted: '#FFB3D9',
      ink: '#5C2E5C', ink2: '#8A4FA0', ink3: '#B380BF',
      border: '#5C2E5C', borderStrong: '#5C2E5C',
      accent: '#FF6BB5', onAccent: '#FFFFFF', shadowColor: '#5C2E5C',
      cap:  { photo:'#5BBFD4', video:'#FF6BB5', gallery:'#A975D9', text:'#7AC97A', voice:'#FF7A7A', file:'#F0C04A' },
      tint: { photo:'#D5F0F5', video:'#FFD9EC', gallery:'#EAD5F5', text:'#DBF0DB', voice:'#FFE0E0', file:'#FBEFD0' },
    },
    dark: {
      bg1: '#1A0F1F', bg2: '#2A1A33', bg3: '#3D2647',
      surface: '#2A1A33', surfaceVariant: '#3D2647', surfaceMuted: '#523A5C',
      ink: '#FFB8E0', ink2: '#B59FE6', ink3: '#8770A8',
      border: '#FFB8E0', borderStrong: '#FFB8E0',
      accent: '#FF6BB5', onAccent: '#1A0F1F', shadowColor: '#FF6BB5',
      cap:  { photo:'#7AD0E0', video:'#FF6BB5', gallery:'#C58CE6', text:'#8AD98A', voice:'#FF8A8A', file:'#FFD56B' },
      tint: { photo:'#0F2A33', video:'#3D1A2F', gallery:'#2D1A47', text:'#1A3A1A', voice:'#3D1F1F', file:'#3D2E0F' },
    },
  },
} as const satisfies Record<string, PaletteDef>;

export type PaletteId = keyof typeof PIXEL_PALETTES;

// ─── Shadow sizes ───────────────────────────────────────────────────────────
export type ShadowSize = 'none' | 's' | 'm' | 'l';
export const PIXEL_SHADOW_OFFSETS: Record<ShadowSize, number> = {
  none: 0, s: 2, m: 4, l: 6,
};

// ─── BG color presets ───────────────────────────────────────────────────────
export interface BgColorDef {
  label: string;
  light: string | null;
  dark: string | null;
}

export const PIXEL_BG_COLORS = {
  paletteDefault: { label: 'Default · palette', light: null, dark: null },
  cream:      { label: 'Cream',       light: '#FFF6E6', dark: null },
  parchment:  { label: 'Parchment',   light: '#F4ECD8', dark: null },
  bone:       { label: 'Bone',        light: '#F0EBE0', dark: null },
  white:      { label: 'Pure white',  light: '#FFFFFF', dark: null },
  silver:     { label: 'Silver',      light: '#E8E8EB', dark: null },
  sky:        { label: 'Sky blue',    light: '#D6ECFE', dark: null },
  mint:       { label: 'Mint',        light: '#D8F5E6', dark: null },
  lavender:   { label: 'Lavender',    light: '#EDE2FE', dark: null },
  peach:      { label: 'Peach',       light: '#FEE2D5', dark: null },
  blush:      { label: 'Blush',       light: '#FFDCE5', dark: null },
  yellowPop:  { label: 'Yellow pop',  light: '#FFE34D', dark: null },
  limePop:    { label: 'Lime pop',    light: '#D5FB55', dark: null },
  cyanPop:    { label: 'Cyan pop',    light: '#A8E8FF', dark: null },
  hotPinkPop: { label: 'Hot pink pop',light: '#FFB8DC', dark: null },
  ink:        { label: 'Pure black',  light: null, dark: '#000000' },
  midnight:   { label: 'Midnight',    light: null, dark: '#0A0820' },
  abyss:      { label: 'Abyss',       light: null, dark: '#080F1A' },
  plum:       { label: 'Plum',        light: null, dark: '#1A0B26' },
  forest:     { label: 'Forest',      light: null, dark: '#08210F' },
  burgundy:   { label: 'Burgundy',    light: null, dark: '#1F0A14' },
  navy:       { label: 'Navy',        light: null, dark: '#0A1130' },
  charcoal:   { label: 'Charcoal',    light: null, dark: '#161616' },
  matrix:     { label: 'Matrix dark', light: null, dark: '#001408' },
  phantom:    { label: 'Phantom violet', light: null, dark: '#150A38' },
} as const satisfies Record<string, BgColorDef>;

export type BgColorId = keyof typeof PIXEL_BG_COLORS;

export function bgColorsForMode(mode: PaletteMode): BgColorId[] {
  const ids: BgColorId[] = ['paletteDefault'];
  (Object.entries(PIXEL_BG_COLORS) as [BgColorId, BgColorDef][]).forEach(([id, p]) => {
    if (id === 'paletteDefault') return;
    if (mode === 'light' && p.light) ids.push(id);
    if (mode === 'dark' && p.dark) ids.push(id);
  });
  return ids;
}

// ─── Background patterns ────────────────────────────────────────────────────
export const PIXEL_BACKGROUND_LABELS = {
  none:      'None · flat',
  scanlines: 'CRT Scanlines',
  dots:      'Dot Matrix',
  grid:      'Pixel Grid',
  checker:   'Checker · 8px',
  diagonal:  'Diagonal Hatch',
  dither:    'Dither · Bayer',
  stars:     'Starfield',
  sunset:    'Synthwave Sunset',
  landscape: 'Pixel Landscape',
  arcade:    'Arcade Marquee',
  noise:     'Pixel Noise',
} as const;
export type BackgroundId = keyof typeof PIXEL_BACKGROUND_LABELS;

// ─── Capture treatment ──────────────────────────────────────────────────────
export type CaptureTreatment = 'tinted' | 'dot' | 'outline' | 'mono';

/**
 * Resolved visual style for a single capture-type button (photo/video/voice/...).
 * 4 treatments:
 *   - tinted:   pastel bg + saturated 2px border + saturated icon (default)
 *   - dot:      surface bg + 2px border (palette ink) + saturated icon
 *               + a small saturated dot in the corner — minimalist
 *   - outline:  transparent bg + 2px saturated border + saturated icon
 *   - mono:     surface bg + 2px border (palette ink) + ink-2 icon — monochrome
 */
export interface CaptureStyle {
  background: string;
  border: string;
  iconColor: string;
  /** When set, render a small 4×4 swatch in the top-right corner of the button. */
  dot?: string;
}

export function resolveCaptureStyle(
  treatment: CaptureTreatment,
  cap: string,
  tint: string,
  surface: string,
  border: string,
  ink2: string,
): CaptureStyle {
  switch (treatment) {
    case 'tinted':
      return { background: tint, border: cap, iconColor: cap };
    case 'dot':
      return { background: surface, border, iconColor: cap, dot: cap };
    case 'outline':
      return { background: 'transparent', border: cap, iconColor: cap };
    case 'mono':
      return { background: surface, border, iconColor: ink2 };
    default:
      return { background: tint, border: cap, iconColor: cap };
  }
}

// ─── Theme builder ──────────────────────────────────────────────────────────
export interface PixelTheme extends PalettePerMode {
  paletteId: PaletteId;
  mode: PaletteMode;
  paletteLabel: string;
  shadowOffset: number;
  cardShadow: string;
  cardBorder: string;
  scanlines: boolean;
  backgroundId: BackgroundId;
  bgColorId: BgColorId;
  captureTreatment: CaptureTreatment;
}

export interface BuildPixelThemeInput {
  paletteId: PaletteId;
  mode: PaletteMode;
  shadowSize: ShadowSize;
  backgroundId?: BackgroundId;
  bgColorId?: BgColorId;
  captureTreatment?: CaptureTreatment;
  scanlines?: boolean;
}

export function buildPixelTheme({
  paletteId, mode, shadowSize,
  backgroundId = 'none', bgColorId = 'paletteDefault',
  captureTreatment = 'tinted', scanlines = false,
}: BuildPixelThemeInput): PixelTheme {
  const pal = PIXEL_PALETTES[paletteId];
  const p = pal[mode];
  const shadowOffset = PIXEL_SHADOW_OFFSETS[shadowSize];

  // Widen `bg1` to plain string — TS would otherwise narrow it to the
  // palette's literal hex tuple, refusing the override from PIXEL_BG_COLORS.
  let bg1: string = p.bg1;
  const bgColor = PIXEL_BG_COLORS[bgColorId];
  if (bgColor) {
    const override = mode === 'light' ? bgColor.light : bgColor.dark;
    if (override) bg1 = override;
  }

  return {
    paletteId, mode, paletteLabel: pal.label,
    ...p, bg1,
    shadowOffset,
    cardShadow: shadowOffset > 0 ? `${shadowOffset}px ${shadowOffset}px 0 ${p.shadowColor}` : 'none',
    cardBorder: `2px solid ${p.border}`,
    scanlines, backgroundId, bgColorId, captureTreatment,
  };
}

/** Map theme tokens onto CSS variables so Tailwind utilities can read them.
 *  Apply on the root element of the layout. */
export function themeCssVars(theme: PixelTheme): React.CSSProperties {
  return {
    '--px-bg1': theme.bg1, '--px-bg2': theme.bg2, '--px-bg3': theme.bg3,
    '--px-surface': theme.surface, '--px-surface-variant': theme.surfaceVariant,
    '--px-ink': theme.ink, '--px-ink-2': theme.ink2, '--px-ink-3': theme.ink3,
    '--px-border': theme.border,
    '--px-accent': theme.accent, '--px-on-accent': theme.onAccent,
    '--px-shadow': theme.cardShadow,
    '--px-card-border': theme.cardBorder,
  } as React.CSSProperties;
}
