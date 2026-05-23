'use client';

import { usePixelTheme } from '@/components/pixel';
import { mascotPalette, type Mascot, type MascotAnimation } from '@/lib/mascots';

interface MascotSpriteProps {
  mascot: Mascot;
  /** Pixel size of each of the 16×16 cells. Total = 16 * cell. */
  cell?: number;
  /** Set to `false` to disable the per-mascot animation (settings toggle). */
  animated?: boolean;
}

const ANIMATION_STYLE: Record<MascotAnimation, string> = {
  pulse: 'mascot-pulse 0.8s steps(4, end) infinite',
  bob: 'mascot-bob 1.4s ease-in-out infinite',
  wobble: 'mascot-wobble 2s ease-in-out infinite',
  none: '',
};

/**
 * Renders the 16×16 sprite as a CSS grid of <div>s — one per cell.
 * 256 nodes per sprite, negligible at the sizes we use.
 *
 * Palette slots:
 *   1 = primary  ·  2 = secondary  ·  3 = accent
 *   4 = ink (outline / eyes)  ·  5 = white
 *   . = transparent (omitted background, the parent shines through)
 */
export function MascotSprite({ mascot, cell = 8, animated = true }: MascotSpriteProps) {
  const theme = usePixelTheme();
  const palette = mascotPalette(mascot, theme);
  const size = 16 * cell;
  const animation = animated ? ANIMATION_STYLE[mascot.animation] : '';

  const colorFor = (ch: string): string => {
    if (ch === '.') return 'transparent';
    const idx = parseInt(ch, 10);
    if (idx >= 1 && idx <= 5) return palette[idx - 1];
    return 'transparent';
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: `repeat(16, ${cell}px)`,
        gridTemplateRows: `repeat(16, ${cell}px)`,
        // Pixel-perfect rendering; default to crisp instead of smoothed.
        imageRendering: 'pixelated',
        animation,
      }}
    >
      {mascot.sprite.flatMap((row, y) =>
        Array.from(row, (ch, x) => (
          <div key={`${y}-${x}`} style={{ background: colorFor(ch) }} />
        )),
      )}
    </div>
  );
}
