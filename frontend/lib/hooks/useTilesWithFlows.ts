/**
 * React-query hook: returns the Set of tile_ids that own at least one Flow
 * node, so the UI can quickly check `hasFlow.has(tile.id)` while rendering
 * tiles in Canvas/Kanban/Calendar/etc.
 *
 * The query is invalidated by useFlow's mutations via the shared
 * ['flow-hub'] key — when a node/edge is created/deleted, the badge state
 * for the affected tile refreshes automatically.
 */
'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';

export function useTilesWithFlows() {
  const query = useQuery({
    queryKey: ['flow-hub', 'tiles'],
    queryFn: async () => {
      const res = await flowApi.tilesWithFlows();
      return res.data?.tile_ids ?? [];
    },
    staleTime: 30_000,
  });

  const set = useMemo(() => new Set(query.data ?? []), [query.data]);
  return set;
}
