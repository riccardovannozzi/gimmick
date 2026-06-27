'use client';

/**
 * Gimmick · Obsidian — <Beniamino>.
 *
 * Renders one of the 10 mascots at a given size. The fixed identity color pair
 * is injected as `--m1` / `--m2` on the wrapper; the eye ink resolves to the
 * `--ob-mascot-ink` theme token (dark eyes in light theme, near-black in dark)
 * unless overridden via the `ink` prop.
 *
 * Reference (shapes + colors): design_handoff_obsidian/Mascot.dc.html.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { BENIAMINO_PAIRS, BENIAMINO_SVG, type BeniaminoName } from './sprites';

export interface BeniaminoProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  name: BeniaminoName;
  /** Square size in px. */
  size?: number;
  /** Override the eye-ink color (defaults to the `--ob-mascot-ink` token). */
  ink?: string;
  /** Accessible label. Defaults to the mascot name; pass '' to mark decorative. */
  title?: string;
}

export const Beniamino = React.forwardRef<HTMLSpanElement, BeniaminoProps>(function Beniamino(
  { name, size = 64, ink, title, className, style, ...rest },
  ref,
) {
  const pair = BENIAMINO_PAIRS[name] ?? BENIAMINO_PAIRS.gimmick;
  const svg = BENIAMINO_SVG[name] ?? BENIAMINO_SVG.gimmick;
  const label = title ?? name;

  const vars = {
    '--m1': pair[0],
    '--m2': pair[1],
    '--mascot-ink': ink ?? 'var(--ob-mascot-ink, #26212f)',
    width: size,
    height: size,
    ...style,
  } as React.CSSProperties;

  return (
    <span
      ref={ref}
      className={cn('ob-beniamino', className)}
      style={vars}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
      {...rest}
    />
  );
});
