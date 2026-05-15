'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { statusesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { Status, StatusShape } from '@/types';

// Canonical display order for system statuses. Shown in this order in every
// picker (sidebar, settings modal, kanban filters, etc.).
const SYSTEM_ORDER = ['active', 'done', 'paused', 'blocked', 'cancelled'] as const;
const SYSTEM_INDEX: Record<string, number> = Object.fromEntries(SYSTEM_ORDER.map((n, i) => [n, i]));

export function useStatuses() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => statusesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  // Sort system statuses by the canonical order, then custom (in arrival order).
  const statuses: Status[] = useMemo(() => {
    const raw = (data?.data || []) as Status[];
    const systemIdx = (s: Status) => SYSTEM_INDEX[s.name] ?? Number.MAX_SAFE_INTEGER;
    return [...raw].sort((a, b) => {
      if (a.category === 'system' && b.category === 'system') return systemIdx(a) - systemIdx(b);
      if (a.category === 'system') return -1;
      if (b.category === 'system') return 1;
      return 0;
    });
  }, [data]);

  // Lookup a system status shape by name (canonical set: active, paused,
  // blocked, cancelled, done). Fallback to 'solid' if the user renamed
  // or deleted the row.
  const getSystemShape = (name: string): StatusShape => {
    const s = statuses.find((st) => st.category === 'system' && st.name === name);
    return s?.shape || 'solid';
  };

  // Shape applied to tiles whose status_id points to the system 'done' row.
  const doneShape = getSystemShape('done');

  // ID of the system 'done' status — canonical source of truth for "completed".
  // Returns undefined until the statuses query resolves; callers should handle that.
  const doneStatusId = statuses.find((s) => s.category === 'system' && s.name === 'done')?.id;

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
    doneStatusId,
    getActionTypeShape,
    getSystemShape,
    customStatuses,
    isLoading,
  };
}
