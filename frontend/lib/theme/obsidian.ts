/**
 * Gimmick · Obsidian — Design tokens for the Next.js frontend.
 *
 * Single source of truth (TypeScript) for the Obsidian design system.
 * Values are transcribed EXACTLY from design_handoff_obsidian/TOKENS.md
 * (hifi, hex verified). The same values are mirrored as CSS variables in
 * `app/obsidian.css` under `[data-theme="light|dark"]` — keep the two in sync.
 *
 * Principles (see design_handoff_obsidian/README.md):
 *   - One accent: Phantom Violet. No second direction.
 *   - Light + Dark are both first-class.
 *   - Type scale (photo/video/voice/text/file/gallery) is canonical and
 *     identical on desktop and mobile.
 *   - High density, low decoration: 1px hairlines, no hard shadows, soft radii.
 *
 * This module does NOT touch existing components. It is introduced alongside
 * `pixel-theme.ts` as part of the strangler migration.
 */

// ─── Theme mode ───────────────────────────────────────────────────────────────
export type ObsidianMode = 'light' | 'dark';

// ─── Capture / content types (canonical type scale) ───────────────────────────
export type ObsidianType = 'photo' | 'video' | 'voice' | 'text' | 'file' | 'gallery';

// ─── Accent — Phantom Violet (the only accent) ────────────────────────────────
export const OBSIDIAN_ACCENT = {
  light: { accent: '#7C5CCB', ink: '#ffffff', soft: '#efeafb' },
  dark:  { accent: '#AB9FF2', ink: '#1b0d2e', soft: '#2e2747' },
} as const;

// ─── Neutrals ─────────────────────────────────────────────────────────────────
export interface ObsidianNeutrals {
  canvas: string;
  surface: string;
  surface2: string;
  head: string;
  field: string;
  text: string;
  muted: string;
  subtle: string;
  faint: string;
  line: string;
  line2: string;
}

export const OBSIDIAN_NEUTRALS: Record<ObsidianMode, ObsidianNeutrals> = {
  light: {
    // ⚠️ MIRROR di app/obsidian.css — vanno cambiati INSIEME. Quello che passa di
    // qui non sono le CSS var: è il PixelTheme, cioè i colori risolti in hex che
    // usano il canvas D3, lo staging e la sidebar del tile. Cambiando solo il
    // CSS, l'app si divide in due — le viste in classi si aggiornano e quelle in
    // stili inline restano indietro, che è esattamente com'era il canvas quando
    // tutto il resto era già passato al bianco.
    canvas: '#ffffff',
    surface: '#ffffff',
    surface2: '#f1f0f4',
    head: '#fbfbfc',
    field: '#ffffff',
    text: '#1b1923',
    muted: '#5c5868',
    subtle: '#9a96a4',
    faint: '#c4c1cd',
    line: 'rgba(24,20,38,0.08)',
    line2: 'rgba(24,20,38,0.13)',
  },
  dark: {
    canvas: '#161616',
    surface: '#1e1e1e',
    surface2: '#262626',
    head: '#1b1b1b',
    field: '#1e1e1e',
    text: '#dcdcdc',
    muted: '#9a9a9a',
    subtle: '#6e6e6e',
    faint: '#4a4a4a',
    line: 'rgba(255,255,255,0.08)',
    line2: 'rgba(255,255,255,0.13)',
  },
};

// ─── Type scale (CANONICAL — same role, same hex, desktop + mobile) ────────────
export const OBSIDIAN_TYPE_SCALE: Record<ObsidianMode, Record<ObsidianType, string>> = {
  light: {
    photo:   '#4F86EE',
    video:   '#E0588C',
    voice:   '#E0544F',
    text:    '#3FAE72',
    file:    '#C99220',
    gallery: '#8C7BE0',
  },
  dark: {
    photo:   '#7AA7F5',
    video:   '#F08DB4',
    voice:   '#F38682',
    text:    '#74D6A2',
    file:    '#E7C25E',
    gallery: '#B0A2EE',
  },
};

// ─── Semantic colors (derived from the type scale) ────────────────────────────
export interface ObsidianSemantic {
  /** success / timed (green ← text) */
  success: string;
  /** error / deadline (red ← voice) */
  error: string;
  /** info / all-day (blue ← photo) */
  info: string;
  /** warning / amber (← file) */
  warning: string;
}

export const OBSIDIAN_SEMANTIC: Record<ObsidianMode, ObsidianSemantic> = {
  light: {
    success: OBSIDIAN_TYPE_SCALE.light.text,
    error:   OBSIDIAN_TYPE_SCALE.light.voice,
    info:    OBSIDIAN_TYPE_SCALE.light.photo,
    warning: OBSIDIAN_TYPE_SCALE.light.file,
  },
  dark: {
    success: OBSIDIAN_TYPE_SCALE.dark.text,
    error:   OBSIDIAN_TYPE_SCALE.dark.voice,
    info:    OBSIDIAN_TYPE_SCALE.dark.photo,
    warning: OBSIDIAN_TYPE_SCALE.dark.file,
  },
};

// ─── Radii ────────────────────────────────────────────────────────────────────
/**
 * Due soli valori — mirror di `--ob-radius-*` (app/obsidian.css).
 *
 * · sm → controlli: chip, badge, tag pill, pulsanti piccoli, input, select.
 * · md → contenitori: card (Tile, Spark), pannelli, popover, modali.
 *
 * `pill` non è un raggio consolidabile ma una forma (come `50%`), quindi resta.
 * `panel`/`card`/`icon` sono i residui della scala precedente: non erano raggi
 * letterali, quindi la consolidazione non li ha toccati.
 */
export const OBSIDIAN_RADIUS = {
  sm: '4px',
  md: '6px',
  pill: '999px',
  // residui della scala precedente
  panel: '12px',
  card: '14px',
  icon: '8px',
} as const;

// ─── Spacing scale (step of 4) ────────────────────────────────────────────────
export const OBSIDIAN_SPACING = [4, 6, 8, 10, 12, 14, 18, 22, 24, 32, 40, 56] as const;
export type ObsidianSpace = (typeof OBSIDIAN_SPACING)[number];

// ─── Azione distruttiva ───────────────────────────────────────────────────────
/**
 * Rosso di "elimina" — mirror di `--ob-danger` (app/obsidian.css).
 *
 * DISTINTO da `OBSIDIAN_SEMANTIC[mode].error`, che segnala uno stato e cambia
 * col tema (#E0544F chiaro / #F38682 scuro). Questo è il colore di un COMANDO e
 * resta identico nei due temi: era già così quando viveva scritto a mano in 27
 * punti, senza coincidere con nessuno dei due valori di `error`.
 */
export const OBSIDIAN_DANGER = '#E24B4A';

// ─── Vertical rhythm ──────────────────────────────────────────────────────────
/**
 * Altezza della PRIMA barra di una vista (px) — toolbar/header di Ask, Flows,
 * Sparks, Canvas, Chrono, Kanban, Panopticon, Tiles.
 *
 * Scala verticale dello shell: 56 navbar · 44 prima barra · 40 barre annidate.
 * Emesso come `--ob-toolbar-height`; è il gradino di mezzo e NON riguarda la
 * navbar né le barre di secondo livello.
 *
 * ⚠️ MIRROR di `--ob-toolbar-height` in app/obsidian.css — vanno cambiati
 * INSIEME, o le viste in stili inline restano su un'altra altezza e la fascia
 * salta passando da una all'altra, che è esattamente il guaio che questo numero
 * era nato per chiudere.
 */
export const OBSIDIAN_TOOLBAR_HEIGHT = 44;

// ─── Elevation ────────────────────────────────────────────────────────────────
// No hard shadows. Separation relies on surface vs surface2 + hairlines.
// Light may carry a single faint card shadow; dark carries none.
export const OBSIDIAN_SHADOW: Record<ObsidianMode, string> = {
  light: '0 1px 3px rgba(24,20,38,0.05)',
  dark: 'none',
};

// ─── Tile color (global setting: Tint vs Solid) ───────────────────────────────
// Tint mode renders the type color at low opacity for the background plus a
// stronger alpha for the border. Solid mode keeps the card on `surface` with
// the accent confined to a single detail (chip/icon).
export const OBSIDIAN_TILE_TINT = {
  light: { bgAlpha: 0.09, borderAlpha: 0.25 }, // ≈ 0x17 bg, 0x40 border
  dark:  { bgAlpha: 0.15, borderAlpha: 0.30 }, // ≈ 0x26 bg, 0x4d border
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
// Qui viveva `OBSIDIAN_TYPOGRAPHY`. Rimosso: non era importato da nessun file e
// dichiarava una scala che il codice non ha mai avuto. Nasceva dagli INTERVALLI
// di design_handoff_obsidian/TOKENS.md (eyebrow 10–11px, titoli 20–30px, corpo
// 13–15px) congelati in valori singoli — 10.5px, 24px, 14px — che non compaiono
// in nessun punto dell'interfaccia. Una costante del genere non documenta: mente,
// e chi la legge crede di aver trovato la regola.
//
// La tipografia vive in due posti veri:
//   · le famiglie → `--ob-font-sans` / `--ob-font-mono` (app/obsidian.css,
//     alimentati da next/font in app/layout.tsx);
//   · le scale → TOKENS.md come intento di design, e il CSS/gli stili inline
//     come stato di fatto.
// Se un giorno serve una scala tipografica in TypeScript, va DEDOTTA dal codice
// e mantenuta con lui, non trascritta da un intervallo.

// ─── CSS variable map ─────────────────────────────────────────────────────────
/**
 * Resolve the full set of `--ob-*` CSS variables for a given mode. Intended for
 * programmatic theming (e.g. inline `style` on a scoped container). The static
 * `[data-theme]` blocks in `app/obsidian.css` emit the same variables globally.
 */
export function obsidianCssVars(mode: ObsidianMode): Record<string, string> {
  const a = OBSIDIAN_ACCENT[mode];
  const n = OBSIDIAN_NEUTRALS[mode];
  const t = OBSIDIAN_TYPE_SCALE[mode];
  const s = OBSIDIAN_SEMANTIC[mode];
  return {
    // accent
    '--ob-accent': a.accent,
    '--ob-accent-ink': a.ink,
    '--ob-accent-soft': a.soft,
    // neutrals
    '--ob-canvas': n.canvas,
    '--ob-surface': n.surface,
    '--ob-surface-2': n.surface2,
    '--ob-head': n.head,
    '--ob-field': n.field,
    '--ob-text': n.text,
    '--ob-muted': n.muted,
    '--ob-subtle': n.subtle,
    '--ob-faint': n.faint,
    '--ob-line': n.line,
    '--ob-line-2': n.line2,
    // type scale
    '--ob-type-photo': t.photo,
    '--ob-type-video': t.video,
    '--ob-type-voice': t.voice,
    '--ob-type-text': t.text,
    '--ob-type-file': t.file,
    '--ob-type-gallery': t.gallery,
    // semantic
    '--ob-success': s.success,
    '--ob-error': s.error,
    '--ob-info': s.info,
    '--ob-warning': s.warning,
    // azione distruttiva — uguale nei due temi, non è uno stato
    '--ob-danger': OBSIDIAN_DANGER,
    // elevation
    '--ob-shadow-card': OBSIDIAN_SHADOW[mode],
    // ritmo verticale (indipendente dal tema, ma emesso qui per completezza:
    // chi tematizza un contenitore in modo programmatico ottiene il set intero)
    '--ob-toolbar-height': `${OBSIDIAN_TOOLBAR_HEIGHT}px`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Color for a content type in a given mode. */
export function obsidianTypeColor(type: ObsidianType, mode: ObsidianMode): string {
  return OBSIDIAN_TYPE_SCALE[mode][type];
}

/** Convert a `#rrggbb` hex to `rgba()` with the given alpha. */
export function obsidianAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolve background + border for a tinted tile of a given type. */
export function obsidianTileTint(type: ObsidianType, mode: ObsidianMode): { background: string; border: string } {
  const color = obsidianTypeColor(type, mode);
  const { bgAlpha, borderAlpha } = OBSIDIAN_TILE_TINT[mode];
  return {
    background: obsidianAlpha(color, bgAlpha),
    border: obsidianAlpha(color, borderAlpha),
  };
}
