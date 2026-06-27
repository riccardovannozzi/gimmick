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
    canvas: '#f6f6f8',
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
export const OBSIDIAN_RADIUS = {
  panel: '12px',   // Card / pannelli — lower bound of 12–14px
  card: '14px',    // Card / pannelli — upper bound of 12–14px
  control: '10px', // input, bottoni, chip rettangolari — 8–10px
  chip: '8px',     // chip rettangolari — lower bound of 8–10px
  icon: '8px',     // icona in box — 6–10px
  pill: '999px',   // pill / chip / segmented — full
} as const;

// ─── Spacing scale (step of 4) ────────────────────────────────────────────────
export const OBSIDIAN_SPACING = [4, 6, 8, 10, 12, 14, 18, 22, 24, 32, 40, 56] as const;
export type ObsidianSpace = (typeof OBSIDIAN_SPACING)[number];

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
// Geist for UI, Geist Mono for dates/counts/technical labels/eyebrow.
// Font families are wired through CSS variables (see obsidian.css / layout.tsx):
//   --font-geist-sans, --font-geist-mono
export const OBSIDIAN_TYPOGRAPHY = {
  fontSans: 'var(--font-geist-sans), system-ui, sans-serif',
  fontMono: 'var(--font-geist-mono), ui-monospace, monospace',
  weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  /** Eyebrow / label: uppercase, mono, wide tracking, `subtle` color. */
  eyebrow: { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
  /** Screen titles. */
  title: { fontSize: '24px', fontWeight: 600, letterSpacing: '-0.015em' },
  /** Body copy. */
  body: { fontSize: '14px', lineHeight: 1.5 },
  /** Smallest readable size (cards). */
  minReadable: '12px',
} as const;

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
    // elevation
    '--ob-shadow-card': OBSIDIAN_SHADOW[mode],
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
