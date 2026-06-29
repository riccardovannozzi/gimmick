/**
 * React-query hook for the cross-tile FlowHub.
 *
 *   const { items, isLoading } = useFlowHub('wait');
 *
 * Filters map 1:1 to the flow node's `state` decorator: each value surfaces
 * every node currently in that state (done / wait / undo / stop).
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type { FlowHubItem } from '@/types/flow';

export type FlowHubFilter = 'done' | 'wait' | 'undo' | 'stop';

export function useFlowHub(filter: FlowHubFilter) {
  const query = useQuery({
    queryKey: ['flow-hub', filter],
    queryFn: async (): Promise<FlowHubItem[]> => {
      const res = await flowApi.hub(filter);
      if (!res.success) throw new Error(res.error || 'Errore caricamento FlowHub');
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
