/**
 * Gimmick · Obsidian — Design tokens for the Expo / React Native app.
 *
 * RN has no CSS variables, so the Obsidian tokens live as plain JS objects
 * (one per mode). Values are transcribed from design_handoff_obsidian/TOKENS.md
 * (and the mobile DC `tok()` for the device-specific surfaces: bezel,
 * statusInk, sidebar, field). Mirror of the web `lib/theme/obsidian.ts` /
 * `app/obsidian.css`.
 *
 * Introduced alongside the existing Phantom theme (constants/colors.ts) as part
 * of the strangler migration — nothing is replaced.
 *
 * Note: RN accepts 8-digit `#RRGGBBAA` hex, so the DC's `color + '2e'` tinting
 * pattern works directly (see `withAlpha`).
 */

export interface ObsidianCaptureScale {
  photo: string;
  video: string;
  voice: string;
  text: string;
  file: string;
  gallery: string;
}

export interface ObsidianColors {
  // device frame / chrome
  bezel: string;
  statusInk: string;
  // surfaces
  canvas: string;
  surface: string;
  surface2: string;
  head: string;
  sidebar: string;
  field: string;
  /**
   * Fondo standard di una tile quando non è impostato nient'altro. NON è
   * `surface`: sul web è un token a sé (`--ob-tile-bg`), un gradino più chiaro,
   * perché la tile deve staccare dal pannello che la contiene e non
   * confondersi con esso. Qui si tiene lo stesso valore del web, o le due
   * piattaforme divergono al primo confronto affiancato.
   */
  tileBg: string;
  // text
  text: string;
  muted: string;
  subtle: string;
  faint: string;
  // hairlines
  line: string;
  line2: string;
  // accent — Phantom Violet
  accent: string;
  accentInk: string;
  accentSoft: string;
  // canonical type scale
  cap: ObsidianCaptureScale;
  // semantic (derived from the type scale)
  success: string;
  error: string;
  info: string;
  warning: string;
  // calendar / status helpers
  timed: string;
  allday: string;
  deadline: string;
  anytime: string;
  notes: string;
  amber: string;
  todayBg: string;
  gridLine: string;
  /** true when this is the dark palette. */
  dark: boolean;
}

export const obsidianLight: ObsidianColors = {
  bezel: '#d9d7dd',
  statusInk: '#1b1923',
  canvas: '#f6f6f8',
  surface: '#ffffff',
  surface2: '#f1f0f4',
  head: '#fbfbfc',
  sidebar: '#ffffff',
  field: '#ffffff',
  tileBg: '#ffffff',
  text: '#1b1923',
  muted: '#5c5868',
  subtle: '#9a96a4',
  faint: '#c4c1cd',
  line: 'rgba(24,20,38,0.08)',
  line2: 'rgba(24,20,38,0.13)',
  accent: '#7C5CCB',
  accentInk: '#ffffff',
  accentSoft: '#efeafb',
  cap: { photo: '#4F86EE', video: '#E0588C', voice: '#E0544F', text: '#3FAE72', file: '#C99220', gallery: '#8C7BE0' },
  success: '#3FAE72',
  error: '#E0544F',
  info: '#4F86EE',
  warning: '#C99220',
  timed: '#3FAE72',
  allday: '#4F86EE',
  deadline: '#E0544F',
  anytime: '#7e8694',
  notes: '#8a8694',
  amber: '#C99220',
  todayBg: 'rgba(124,92,203,0.05)',
  gridLine: 'rgba(24,20,38,0.06)',
  dark: false,
};

export const obsidianDark: ObsidianColors = {
  bezel: '#0c0c0d',
  statusInk: '#dcdcdc',
  canvas: '#161616',
  surface: '#1e1e1e',
  surface2: '#262626',
  head: '#1c1c1c',
  sidebar: '#1b1b1b',
  field: '#1d1d1d',
  tileBg: '#2f3134',
  text: '#dcdcdc',
  muted: '#9a9a9a',
  subtle: '#6e6e6e',
  faint: '#565656',
  line: 'rgba(255,255,255,0.08)',
  line2: 'rgba(255,255,255,0.13)',
  accent: '#AB9FF2',
  accentInk: '#1b0d2e',
  accentSoft: '#2e2747',
  cap: { photo: '#7AA7F5', video: '#F08DB4', voice: '#F38682', text: '#74D6A2', file: '#E7C25E', gallery: '#B0A2EE' },
  success: '#74D6A2',
  error: '#F38682',
  info: '#7AA7F5',
  warning: '#E7C25E',
  timed: '#74D6A2',
  allday: '#7AA7F5',
  deadline: '#F08D89',
  anytime: '#9aa0ad',
  notes: '#8b8b94',
  amber: '#E7C25E',
  todayBg: 'rgba(171,159,242,0.07)',
  gridLine: 'rgba(255,255,255,0.05)',
  dark: true,
};

/**
 * Rosso di "elimina" (dp-independent) — mirror di `--ob-danger`
 * (web: app/obsidian.css, lib/theme/obsidian.ts).
 *
 * DISTINTO da `error` dei due temi, che segnala uno stato e cambia col tema:
 * questo è il colore di un COMANDO e resta identico in chiaro e scuro.
 * Da usare in `SwipeToDelete` e nella variante `danger` di `ui/Button`, che oggi
 * lo ripetono a mano.
 */
export const OB_DANGER = '#E24B4A';

/**
 * Altezza della PRIMA barra di una schermata (dp) — mirror di
 * `--ob-toolbar-height` (web: app/obsidian.css, lib/theme/obsidian.ts).
 *
 * Scala verticale: 56 navbar · 48 prima barra · 40 barre annidate. È il gradino
 * di mezzo e NON riguarda la navbar né le barre di secondo livello. Da non
 * confondere con `OB_BTN_H` (52), che è il bersaglio di tocco dei pulsanti.
 */
export const OB_TOOLBAR_H = 48;

/**
 * Raggi (dp) — mirror di `--ob-radius-*` (web: app/obsidian.css,
 * lib/theme/obsidian.ts). Due soli valori:
 *
 * · sm → controlli: chip, badge, tag pill, pulsanti piccoli, input, select.
 * · md → contenitori: card (Tile, Spark), pannelli, popover, modali.
 *
 * `pill` non è un raggio consolidabile ma una forma (come il 50% del web),
 * quindi resta. `panel`/`card`/`icon` sono i residui della scala precedente:
 * sul web non erano raggi letterali, quindi la consolidazione non li ha toccati
 * e qui restano allineati.
 */
export const obsidianRadius = {
  sm: 4,
  md: 6,
  pill: 999,
  // residui della scala precedente
  panel: 12,
  card: 14,
  icon: 8,
} as const;

/**
 * Altezza standard dei pulsanti con etichetta (dp).
 *
 * 48 è il bersaglio di tocco minimo di Material e delle linee guida di
 * accessibilità Android. Va applicata come `minHeight` e non come `height`,
 * così un'etichetta che va a capo o una dimensione di testo aumentata dalle
 * impostazioni di sistema fanno crescere il pulsante invece di essere tagliate.
 *
 * NON si applica a: pulsanti solo-icona compatti dentro barre ad altezza fissa,
 * chip in liste orizzontali e celle di calendario — lì la strada corretta è
 * `hitSlop`, che allarga l'area toccabile senza toccare il layout.
 */
export const OB_BTN_H = 52;

/**
 * Pulsanti delle schermate di cattura: fondo nero pieno, glifo bianco, nessun
 * bordo. La gerarchia la fanno forma e dimensione, non il colore:
 *   · secondari (chiudi, flash, flip, annulla, modifica) → quadrato con angoli
 *     arrotondati, lato `OB_CAP_BTN`;
 *   · primari (scatta, registra, conferma) → cerchio, lato `OB_CAP_BTN_LG`.
 * Le pill di stato che accompagnano i controlli usano lo stesso fondo.
 */
export const OB_CAP_BTN_BG = '#000000';
export const OB_CAP_BTN_GLYPH = '#FFFFFF';
/** Lato dei pulsanti secondari (quadrati) e raggio dei loro angoli. */
export const OB_CAP_BTN = 52;
export const OB_CAP_BTN_R = 16;
/** Diametro dei pulsanti primari (tondi). */
export const OB_CAP_BTN_LG = 84;

/** Append an 8-bit alpha (00–ff) to a 6-digit hex. */
export function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? hex + alpha : hex;
}
