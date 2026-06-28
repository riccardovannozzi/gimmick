/**
 * Gimmick · Obsidian — PixelTheme adapter (Fase 8/9, restyle D3).
 *
 * Builds a `PixelTheme`-shaped object whose colors resolve to the Obsidian
 * design tokens for a given mode. The Canvas (D3) and Graph (D3) views — plus
 * the leftover arcade surfaces still rendered inside the Obsidian shell
 * (TileSidebar, context menus, modals) — read their colors via
 * `usePixelTheme()`. When the shell is enabled the hook returns THIS object
 * instead of the pixel palette, so the whole D3 layer flips to Obsidian colors
 * without rewriting the SVG interaction code.
 *
 * Values are RESOLVED HEX (not `var(--ob-*)`) so the existing alpha-concat
 * patterns (`${theme.accent}33`, `${theme.surface}EE`) and any `parseInt`-based
 * helpers keep working. Structural pixel quirks that aren't theme-driven
 * (hardcoded 2px borders, the pixel font) remain — only colors + hard shadows
 * are neutralized here. Hard shadows are killed via `shadowOffset: 0`
 * (→ cardShadow 'none', and every `${shadowOffset}px ...` becomes invisible).
 */
import type { PixelTheme } from '@/lib/pixel-theme';
import {
  OBSIDIAN_ACCENT,
  OBSIDIAN_NEUTRALS,
  OBSIDIAN_TYPE_SCALE,
  OBSIDIAN_TILE_TINT,
  OBSIDIAN_SHADOW,
  obsidianAlpha,
  type ObsidianMode,
} from '@/lib/theme/obsidian';

/** Build a PixelTheme backed by Obsidian tokens for the given mode. */
export function buildObsidianPixelTheme(mode: ObsidianMode): PixelTheme {
  const a = OBSIDIAN_ACCENT[mode];
  const n = OBSIDIAN_NEUTRALS[mode];
  const t = OBSIDIAN_TYPE_SCALE[mode];
  const tint = OBSIDIAN_TILE_TINT[mode];

  const cap = {
    photo: t.photo, video: t.video, gallery: t.gallery,
    text: t.text, voice: t.voice, file: t.file,
  };
  // Tile-tint backgrounds at the canonical low alpha for each type.
  const tintBg = {
    photo: obsidianAlpha(t.photo, tint.bgAlpha),
    video: obsidianAlpha(t.video, tint.bgAlpha),
    gallery: obsidianAlpha(t.gallery, tint.bgAlpha),
    text: obsidianAlpha(t.text, tint.bgAlpha),
    voice: obsidianAlpha(t.voice, tint.bgAlpha),
    file: obsidianAlpha(t.file, tint.bgAlpha),
  };

  return {
    // PalettePerMode
    bg1: n.canvas,
    bg2: n.surface,
    bg3: n.surface2,
    surface: n.surface,
    surfaceVariant: n.surface2,
    surfaceMuted: n.head,
    ink: n.text,
    ink2: n.muted,
    ink3: n.subtle,
    border: n.line2,
    borderStrong: n.faint,
    accent: a.accent,
    onAccent: a.ink,
    shadowColor: 'transparent',
    cap,
    tint: tintBg,
    // PixelTheme meta
    paletteId: 'cmyk',
    mode,
    paletteLabel: 'Obsidian',
    shadowOffset: 0,
    cardShadow: OBSIDIAN_SHADOW[mode],
    cardBorder: `1px solid ${n.line2}`,
    scanlines: false,
    backgroundId: 'none',
    bgColorId: 'paletteDefault',
    captureTreatment: 'tinted',
  };
}
