'use client';

import { useQuery } from '@tanstack/react-query';
import { statusesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { Status, StatusShape } from '@/types';

export function useStatuses() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const statuses: Status[] = data?.data || [];

  // Lookup a system status shape by name (canonical set: active, waiting_for,
  // paused, blocked, cancelled, done). Fallback to 'solid' if the user renamed
  // or deleted the row.
  const getSystemShape = (name: string): StatusShape => {
    const s = statuses.find((st) => st.category === 'system' && st.name === name);
    return s?.shape || 'solid';
  };

  // Shape applied to completed tiles (tile.is_completed = true).
  const doneShape = getSystemShape('done');

  // Statuses can still be linked to action types (custom rows). If a tile has
  // an action_type but no explicit status_id, match it against the linked status.
  const getActionTypeShape = (actionType: string): StatusShape => {
    const linked = statuses.find((s) => s.action_type === actionType);
    return linked?.shape || 'solid';
  };

  const customStatuses = statuses.filter((s) => s.category === 'custom');

  return {
    statuses,
    doneShape,
    getActionTypeShape,
    getSystemShape,
    customStatuses,
    isLoading,
  };
}
