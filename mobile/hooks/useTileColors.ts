/**
 * Resolves a calendar event's visual color from its assigned type-icon —
 * matches the rendering convention used by the frontend calendar:
 *
 *   background = `${typeIcon.color}80`   // 50% alpha
 *   fallback   = '#1C1C1E'                // dark zinc (no icon assigned)
 *
 * Plus an action-aware border:
 *   deadline → dashed red
 *   anything else → subtle white at 8%
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { typeIconsApi, type TypeIconEntity } from '@/lib/api';
import type { Tile } from '@/types';

export interface TileColors {
  /** Background fill — type-icon color at 50% alpha or dark zinc fallback. */
  bg: string;
  /** Solid border color. Dashed deadline border is signalled separately. */
  border: string;
  /** True when the tile uses the deadline dashed-red border. */
  deadlineBorder: boolean;
  /** Foreground text/icon color (light gray for parity with the web). */
  fg: string;
}

const DARK_BG = '#1C1C1E';
const SUBTLE_BORDER = 'rgba(255,255,255,0.08)';
const DEADLINE_BORDER = '#ef4444';
const FG = '#D4D4D8'; // zinc-300

export function useTileColors() {
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
    const bg = baseColor ? `${baseColor}80` : DARK_BG;
    const isDeadline = tile.action_type === 'deadline';
    return {
      bg,
      border: isDeadline ? DEADLINE_BORDER : SUBTLE_BORDER,
      deadlineBorder: isDeadline,
      fg: FG,
    };
  };

  return { resolve, isLoading: iconsQuery.isLoading || assignmentsQuery.isLoading };
}
