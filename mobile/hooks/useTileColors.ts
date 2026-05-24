/**
 * Resolves a calendar event's visual color from its assigned type-icon —
 * matches the Pixel calendar rendering of the web:
 *
 *   - If a type-icon is assigned → tinted bg (icon color at 30% alpha) with
 *     ink-readable foreground.
 *   - Otherwise → light surface bg + diagonal hatch pattern (the EventBlock
 *     reads `hatched: true` and overlays an SVG pattern).
 *
 * Plus a Pixel border:
 *   - deadline → dashed semantic.danger
 *   - default  → solid border (ink)
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { typeIconsApi, type TypeIconEntity } from '@/lib/api';
import { usePixelTheme } from '@/components/pixel';
import type { Tile } from '@/types';

// Pre-blend `overlay` over `base` with `alpha`. Restituisce un hex OPACO con la
// stessa tinta visiva di un overlay rgba(... , alpha): così le linee dell'ora
// non traspaiono attraverso il bg del tile.
function mixHex(base: string, overlay: string, alpha: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(base);
  const [r2, g2, b2] = parse(overlay);
  const r = Math.round(r1 * (1 - alpha) + r2 * alpha);
  const g = Math.round(g1 * (1 - alpha) + g2 * alpha);
  const b = Math.round(b1 * (1 - alpha) + b2 * alpha);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export interface TileColors {
  /** Background fill — type-icon color at 30% alpha, or theme.surface fallback. */
  bg: string;
  /** Solid border color. Dashed deadline border is signalled separately. */
  border: string;
  /** True when the tile uses the deadline dashed-danger border. */
  deadlineBorder: boolean;
  /** Foreground text/icon color. */
  fg: string;
  /** True when the tile has no type-icon → EventBlock renders an SVG
   *  hatching pattern on top of `bg` (mirror del diagonal_ltr web). */
  hatched: boolean;
  /** Color delle linee del pattern hatching (usato solo se `hatched`). */
  hatchColor: string;
}

export function useTileColors() {
  const theme = usePixelTheme();
  const iconsQuery = useQuery({
    queryKey: ['type-icons'],
    queryFn: () => typeIconsApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['type-icons', 'assignments'],
    queryFn: () => typeIconsApi.getAssignments(),
    staleTime: 5 * 60 * 1000,
  });

  const iconsById = useMemo(() => {
    const m = new Map<string, TypeIconEntity>();
    for (const ti of iconsQuery.data?.data ?? []) m.set(ti.id, ti);
    return m;
  }, [iconsQuery.data]);

  const assignmentByTile = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of assignmentsQuery.data?.data ?? []) {
      if (row.type_icon_id) m.set(row.tile_id, row.type_icon_id);
    }
    return m;
  }, [assignmentsQuery.data]);

  /** Resolve the colors for a tile. Always returns a value (uses fallback). */
  const resolve = (tile: Tile): TileColors => {
    const iconId = assignmentByTile.get(tile.id);
    const icon = iconId ? iconsById.get(iconId) : undefined;
    const baseColor = icon?.color;
    const isDeadline = tile.action_type === 'deadline';

    if (baseColor) {
      // Tile with type-icon: tinted bg (30% del colore mixato sopra bg1) —
      // opaco per evitare che le linee dell'ora si vedano in trasparenza.
      return {
        bg: mixHex(theme.bg1, baseColor, 0.3),
        border: isDeadline ? theme.semantic.danger : theme.border,
        deadlineBorder: isDeadline,
        fg: theme.ink,
        hatched: false,
        hatchColor: theme.ink,
      };
    }

    // Default: bg surface (cream/bianco) con hatching diagonale ink.
    return {
      bg: theme.surface,
      border: isDeadline ? theme.semantic.danger : theme.border,
      deadlineBorder: isDeadline,
      fg: theme.ink,
      hatched: true,
      hatchColor: theme.ink,
    };
  };

  return { resolve, isLoading: iconsQuery.isLoading || assignmentsQuery.isLoading };
}
