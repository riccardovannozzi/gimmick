/**
 * React-query hook for the cross-tile FlowHub.
 *
 *   const { items, isLoading } = useFlowHub('mine');
 *   const { items, isLoading } = useFlowHub('stalled', 14); // 14-day threshold
 *
 * `refetchInterval` is tighter than useFlow's because the hub surfaces stalled
 * flows whose "days since" badge needs to stay current.
 */
'use client';
import { useQuery } from '@tanstack/react-query';
import { flowApi } from '@/lib/api';
import type { FlowHubItem } from '@/types/flow';

export type FlowHubFilter = 'mine' | 'theirs' | 'due_soon' | 'stalled' | 'blocked';

export function useFlowHub(filter: FlowHubFilter, days?: number) {
  const query = useQuery({
    queryKey: ['flow-hub', filter, days ?? null],
    queryFn: async (): Promise<FlowHubItem[]> => {
      const res = await flowApi.hub(filter, days);
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
