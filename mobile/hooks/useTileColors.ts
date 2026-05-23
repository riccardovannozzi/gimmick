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
import { hexWithAlpha } from '@/constants/pixel-theme';
import type { Tile } from '@/types';

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
      // Tile with type-icon: tinted bg (30% alpha), ink readable on light.
      return {
        bg: hexWithAlpha(baseColor, 0.3),
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
