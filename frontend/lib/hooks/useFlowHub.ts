/**
 * React-query hook for the cross-tile FlowHub.
 *
 *   const { items, isLoading } = useFlowHub('mine');
 *
 * Filters: `mine` / `theirs` (open nodes by contact ownership), `due_soon`
 * (scheduled within 48h), `stalled` (state=wait), `blocked` (state=stop).
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type { FlowHubItem } from '@/types/flow';

export type FlowHubFilter = 'mine' | 'theirs' | 'due_soon' | 'stalled' | 'blocked';

export function useFlowHub(filter: FlowHubFilter) {
  const query = useQuery({
    queryKey: ['flow-hub', filter],
    queryFn: async (): Promise<FlowHubItem[]> => {
      const res = await flowApi.hub(filter);
      return (res.data as FlowHubItem[]) ?? [];
    },
    refetchInterval: 30_000,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
