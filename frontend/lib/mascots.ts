/**
 * Source of truth for the 10 official Gimmick mascots.
 * See `/MASCOT.md` for the design doc.
 *
 * Each mascot owns a 16×16 sprite encoded with a tiny 6-char legend:
 *   `.` transparent  ·  `1` primary  ·  `2` secondary  ·  `3` accent
 *   `4` ink (outline / eyes)  ·  `5` white
 *
 * Palette hints reference PixelTheme tokens as dotted paths so the sprite
 * recolors itself whenever the user switches palette. Use `resolveToken()`
 * + `mascotPalette()` to convert hints into the actual 5-color palette.
 */
import type { PixelTheme } from './pixel-theme';

export type MascotAnimation = 'pulse' | 'bob' | 'wobble' | 'none';

export type MascotSurface =
  | 'splash'
  | 'onboarding'
  | 'flow-hub'
  | 'tiles-archive'
  | 'chrono-reminder'
  | 'buffer-full'
  | 'ai-chat'
  | 'focus-mode'
  | 'good-morning'
  | 'photo-capture'
  | 'motion-transition';

export interface MascotStat {
  label: string;
  val: number;        // 1..10
  colorToken: string; // e.g. "theme.cap.video"
}

export interface Mascot {
  id: string;
  name: string;
  role: string;          // caps, e.g. "THE MASCOT"
  description: string;
  /** 16 strings of 16 chars each. See legend above. */
  sprite: string[];
  paletteHints: {
    primary: string;   // token path
    secondary: string; // token path
  };
  animation: MascotAnimation;
  stats: MascotStat[];
  context: {
    where: string;     // caps human label (e.g. "FLOW HUB")
    msg: string;       // sample dialog line
    surface: MascotSurface;
  };
}

export const MASCOTS: Mascot[] = [
  {
    id: 'gimmick',
    name: 'Gimmick',
    role: 'THE MASCOT',
    description: "Il beniamino ufficiale del brand. Piccolo robot dalle antenne sempre attive, dice 'bip' quando lo tocchi.",
    sprite: [
      '................',
      '.....1...1......',
      '.....11.11......',
      '......111.......',
      '...11111111.....',
      '..1111111111....',
      '..1144111441....',
      '..1144111441....',
      '..1111111111....',
      '..1144444411....',
      '..1111111111....',
      '...11111111.....',
      '....11..11......',
      '....11..11......',
      '....11..11......',
      '...111..111.....',
    ],
    paletteHints: { primary: 'theme.accent', secondary: 'theme.ink' },
    animation: 'pulse',
    stats: [
      { label: 'BRAND', val: 10, colorToken: 'theme.accent' },
      { label: 'SOUL', val: 10, colorToken: 'theme.cap.text' },
      { label: 'CHARM', val: 10, colorToken: 'theme.cap.gallery' },
    ],
    context: {
      where: 'SPLASH / EMPTY STATE',
      msg: 'BIP. Sono qui. Premi su di me ogni volta che hai un’idea da catturare.',
      surface: 'splash',
    },
  },
  {
    id: 'surfer',
    name: 'Surfer',
    role: 'THE RIDER',
    description: 'Cavalca i Flow di Gimmick. Ogni volta che un’azione passa da un nodo al successivo, lui ci scivola sopra. Sempre in equilibrio.',
    sprite: [
      '................',
      '..........33....',
      '.........3333...',
      '.........1441...',
      '.........11.1...',
      '........11111...',
      '1......1111111..',
      '.1....111111....',
      '..1..1111.......',
      '...11111........',
      '...11..11.......',
      '...11..11.......',
      '..11....11......',
      '.222222222222...',
      '..2255555522....',
      '3..22222222...3.',
    ],
    paletteHints: { primary: 'theme.cap.file', secondary: 'theme.cap.photo' },
    animation: 'bob',
    stats: [
      { label: 'SPEED', val: 9, colorToken: 'theme.cap.photo' },
      { label: 'ENERGY', val: 10, colorToken: 'theme.cap.voice' },
      { label: 'CALM', val: 3, colorToken: 'theme.cap.text' },
    ],
    context: {
      where: 'FLOW HUB',
      msg: 'Onda in arrivo: 3 nodi pronti per il salto. Sali a bordo, scivoliamo insieme.',
      surface: 'flow-hub',
    },
  },
  {
    id: 'tilo',
    name: 'Tilo',
    role: 'THE ARCHIVIST',
    description: 'Fantasmino-archivio. Custodisce idee, foto e note vecchie. Galleggia leggero come uno spirito.',
    sprite: [
      '................',
      '....11111111....',
      '...1111111111...',
      '..111111111111..',
      '.11111111111111.',
      '.11144111144111.',
      '.11154411115411.',
      '.11154411115411.',
      '.11144111144111.',
      '.11111111111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.111.1111.1111..',
      '.11...11...11...',
    ],
    paletteHints: { primary: 'theme.cap.photo', secondary: 'theme.cap.gallery' },
    animation: 'bob',
    stats: [
      { label: 'MEMORY', val: 10, colorToken: 'theme.cap.gallery' },
      { label: 'FOCUS', val: 8, colorToken: 'theme.cap.photo' },
      { label: 'SPEED', val: 4, colorToken: 'theme.cap.text' },
    ],
    context: {
      where: 'TILES ARCHIVE',
      msg: 'Ho ritrovato 3 spark sepolti. Vuoi rivederli?',
      surface: 'tiles-archive',
    },
  },
  {
    id: 'kron',
    name: 'Kron',
    role: 'THE TIMEKEEPER',
    description: 'Il guardiano del Chrono. Scandisce i giorni, ricorda le scadenze, segnala quando un evento si avvicina.',
    sprite: [
      '......1111......',
      '.....111111.....',
      '....11111111....',
      '...1144444411...',
      '..114111111411..',
      '..114144114411..',
      '..114155115411..',
      '..114111111411..',
      '..114111111411..',
      '..114144444411..',
      '...1144444411...',
      '....11111111....',
      '....11.11.11....',
      '....11.11.11....',
      '...22..22..22...',
      '...22..22..22...',
    ],
    paletteHints: { primary: 'theme.ink', secondary: 'theme.cap.file' },
    animation: 'none',
    stats: [
      { label: 'TIME', val: 10, colorToken: 'theme.cap.file' },
      { label: 'ORDER', val: 9, colorToken: 'theme.ink' },
      { label: 'SPEED', val: 5, colorToken: 'theme.cap.text' },
    ],
    context: {
      where: 'CHRONO REMINDER',
      msg: 'Tra 15 minuti: ‘Call Marco — Teleport flow’. Vuoi che apra la tile?',
      surface: 'chrono-reminder',
    },
  },
  {
    id: 'buffy',
    name: 'Buffy',
    role: 'THE CARRIER',
    description: 'Il portatore del buffer. Tiene tra le sue braccine tutto quello che cattura prima di archiviarlo. Sgranchisce i muscoli quando il buffer è pieno.',
    sprite: [
      '................',
      '.....111111.....',
      '....11111111....',
      '...1144114411...',
      '...1155115511...',
      '..111441144111..',
      '..111111111111..',
      '.22111111111122.',
      '.22111111111122.',
      '..111111111111..',
      '..111133331111..',
      '...1111111111...',
      '....11....11....',
      '....11....11....',
      '....22....22....',
      '................',
    ],
    paletteHints: { primary: 'theme.cap.text', secondary: 'theme.cap.file' },
    animation: 'pulse',
    stats: [
      { label: 'GRIP', val: 10, colorToken: 'theme.cap.text' },
      { label: 'STAMINA', val: 8, colorToken: 'theme.cap.file' },
      { label: 'CHARM', val: 7, colorToken: 'theme.cap.gallery' },
    ],
    context: {
      where: 'BUFFER FULL',
      msg: 'Ho in braccio 8 spark. Li archiviamo come tile o continuiamo?',
      surface: 'buffer-full',
    },
  },
  {
    id: 'bito',
    name: 'Bito',
    role: 'THE ASSISTANT',
    description: 'Il robot AI. Vive nella chat. Risponde a comandi vocali e testuali, propone azioni. Pacato, mai invadente.',
    sprite: [
      '.......22.......',
      '.......22.......',
      '......2222......',
      '.1111111111111..',
      '.1111111111111..',
      '.1144111111441..',
      '.1155114411551..',
      '.1155114411551..',
      '.1144111111441..',
      '.1111133331111..',
      '.1111144441111..',
      '.1111111111111..',
      '.1111111111111..',
      '.11.111111.111..',
      '.11.111111.111..',
      '.11.........11..',
    ],
    paletteHints: { primary: 'theme.cap.gallery', secondary: 'theme.cap.video' },
    animation: 'pulse',
    stats: [
      { label: 'BRAIN', val: 10, colorToken: 'theme.cap.gallery' },
      { label: 'PATIENCE', val: 9, colorToken: 'theme.cap.text' },
      { label: 'HUMOR', val: 6, colorToken: 'theme.cap.video' },
    ],
    context: {
      where: 'AI CHAT',
      msg: 'Ho letto la tua nota. Vuoi che la trasformi in 3 sub-task?',
      surface: 'ai-chat',
    },
  },
  {
    id: 'sloth',
    name: 'Sloth',
    role: 'THE CHILL',
    description: 'Compare nel focus mode. Ti ricorda di rallentare, di non riempire tutti i blocchi di Chrono. Se lo ignori, sbadiglia.',
    sprite: [
      '..2..........2..',
      '..222......222..',
      '..2222....2222..',
      '..1111111111111.',
      '..111111111111..',
      '.11441111114411.',
      '.11441111114411.',
      '.11331111113311.',
      '.11111441111111.',
      '.11111441111111.',
      '.11111111111111.',
      '.11111111111111.',
      '.11.11111111.11.',
      '.11.11111111.11.',
      '..11..1111..11..',
      '...11......11...',
    ],
    paletteHints: { primary: 'theme.cap.voice', secondary: 'theme.cap.text' },
    animation: 'wobble',
    stats: [
      { label: 'CHILL', val: 10, colorToken: 'theme.cap.text' },
      { label: 'WISDOM', val: 8, colorToken: 'theme.cap.gallery' },
      { label: 'SPEED', val: 2, colorToken: 'theme.cap.voice' },
    ],
    context: {
      where: 'FOCUS MODE',
      msg: 'Slow down. Tre tile bastano oggi. Vuoi spegnere le notifiche?',
      surface: 'focus-mode',
    },
  },
  {
    id: 'flocky',
    name: 'Flocky',
    role: 'THE EARLY BIRD',
    description: 'Il pollo mattutino. Annuncia l’inizio della giornata, propone una pianificazione veloce.',
    sprite: [
      '......22........',
      '.....22.22......',
      '....2.22........',
      '....111111......',
      '...11144111.....',
      '...111543333....',
      '...11154333.....',
      '...11144111.....',
      '...111111111....',
      '..1111111111....',
      '.11111111111....',
      '.11111111111....',
      '.22111111111....',
      '.22111111111....',
      '..111111111.....',
      '....33.33.......',
    ],
    paletteHints: { primary: 'theme.cap.file', secondary: 'theme.cap.voice' },
    animation: 'bob',
    stats: [
      { label: 'ENERGY', val: 9, colorToken: 'theme.cap.voice' },
      { label: 'CHARM', val: 8, colorToken: 'theme.cap.file' },
      { label: 'CALM', val: 2, colorToken: 'theme.cap.text' },
    ],
    context: {
      where: 'GOOD MORNING',
      msg: 'Buongiorno! Hai 3 eventi e 1 deadline oggi. Iniziamo dal caffè?',
      surface: 'good-morning',
    },
  },
  {
    id: 'snappy',
    name: 'Snappy',
    role: 'THE SNAPPER',
    description: 'La macchina fotografica del team. Vive nei capture buttons di tipo PHOTO. Quando scatti, fa “click” e archivia con riflessi.',
    sprite: [
      '................',
      '...........22...',
      '....1111.1111...',
      '..111111111111..',
      '.11111111111111.',
      '.11144444444111.',
      '.11144555544111.',
      '.11145544444111.',
      '.11144444444111.',
      '.11144444444111.',
      '.11111111111111.',
      '.11111.11111111.',
      '.11111111111111.',
      '..111111111111..',
      '................',
      '................',
    ],
    paletteHints: { primary: 'theme.cap.photo', secondary: 'theme.ink' },
    animation: 'none',
    stats: [
      { label: 'AIM', val: 10, colorToken: 'theme.cap.photo' },
      { label: 'SPEED', val: 9, colorToken: 'theme.cap.voice' },
      { label: 'CHARM', val: 6, colorToken: 'theme.cap.gallery' },
    ],
    context: {
      where: 'PHOTO CAPTURE',
      msg: 'Click! Pronto a inquadrare. Premi e tieni per video.',
      surface: 'photo-capture',
    },
  },
  {
    id: 'ballerina',
    name: 'Ballerina',
    role: 'THE DANCER',
    description: 'Quando un’azione si compie con grazia, è lei che la coreografa. Vive nelle transizioni, nei tween, in ogni piccolo movimento che rende l’app fluida.',
    sprite: [
      '.......22.......',
      '......2222......',
      '.......22.......',
      '......1111......',
      '......1441......',
      '.......11.......',
      '....11111111....',
      '...11.1111.11...',
      '..11..1144..11..',
      '11.....11.....11',
      '....22222222....',
      '...2222222222...',
      '..222222222222..',
      '.22..22..22..22.',
      '.......11.......',
      '.....11..11.....',
    ],
    paletteHints: { primary: 'theme.cap.gallery', secondary: 'theme.accent' },
    animation: 'bob',
    stats: [
      { label: 'GRACE', val: 10, colorToken: 'theme.accent' },
      { label: 'FLOW', val: 9, colorToken: 'theme.cap.gallery' },
      { label: 'SPEED', val: 7, colorToken: 'theme.cap.photo' },
    ],
    context: {
      where: 'MOTION TRANSITION',
      msg: 'Una pausa elegante? Solo un momento.',
      surface: 'motion-transition',
    },
  },
];

/**
 * Resolve a token path like `theme.cap.photo` into the actual color
 * string by walking the PixelTheme object. Falls back to `theme.ink` for
 * unknown paths so a typo never renders an invisible sprite.
 */
export function resolveToken(token: string, theme: PixelTheme): string {
  // Strip a leading "theme." since the caller IS theme; paths in MASCOT.md
  // use "theme.cap.file" / "theme.accent" / "theme.ink".
  const path = token.replace(/^theme\./, '').split('.');
  let cur: unknown = theme;
  for (const seg of path) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return theme.ink;
    }
  }
  return typeof cur === 'string' ? cur : theme.ink;
}

/**
 * Build the 5-slot palette used by the sprite legend (indexes 1..5).
 * Slot 0 is transparent (handled in the renderer).
 */
export function mascotPalette(mascot: Mascot, theme: PixelTheme): [string, string, string, string, string] {
  return [
    resolveToken(mascot.paletteHints.primary, theme),
    resolveToken(mascot.paletteHints.secondary, theme),
    theme.accent,
    theme.ink,
    '#FFFFFF',
  ];
}
