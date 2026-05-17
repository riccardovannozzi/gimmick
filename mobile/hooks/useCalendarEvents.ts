/**
 * React-query hook for calendar events in a given date range.
 *
 *   const { events, refetch, isLoading, reschedule } = useCalendarEvents(start, end);
 *
 * `reschedule` is an optimistic-update mutation: the cached array is updated
 * before the network round-trip so the dragged block snaps to its new
 * position instantly. The cache reverts if the request fails.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarApi } from '@/lib/api';
import type { Tile } from '@/types';

export function useCalendarEvents(start: Date, end: Date) {
  const qc = useQueryClient();
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const key = ['calendar-events', startIso, endIso] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Tile[]> => {
      const res = await calendarApi.events(startIso, endIso);
      return (res.data as Tile[]) ?? [];
    },
    staleTime: 30_000,
  });

  const reschedule = useMutation({
    mutationFn: async ({ id, start_at, end_at }: { id: string; start_at: string; end_at?: string }) => {
      const res = await calendarApi.reschedule(id, start_at, end_at);
      return res.data as Tile;
    },
    onMutate: async ({ id, start_at, end_at }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Tile[]>(key);
      qc.setQueryData<Tile[]>(key, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, start_at, end_at: end_at ?? t.end_at } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['tiles'] });
    },
  });

  const unschedule = useMutation({
    mutationFn: async (id: string) => calendarApi.unschedule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['tiles'] });
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    reschedule,
    unschedule,
  };
}
