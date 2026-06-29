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
    queryFn: async () => {
      const res = await statusesApi.list();
      if (!res.success) throw new Error(res.error || 'Errore caricamento stati');
      return res;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  // Sort the seeded system statuses by the canonical display order. Custom
  // statuses were removed in migration 029, so every row should be system.
  const statuses: Status[] = useMemo(() => {
    const raw = (data?.data || []) as Status[];
    const idx = (s: Status) => SYSTEM_INDEX[s.name] ?? Number.MAX_SAFE_INTEGER;
    return [...raw].sort((a, b) => idx(a) - idx(b));
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

  return {
    statuses,
    doneShape,
    doneStatusId,
    getActionTypeShape,
    getSystemShape,
    isLoading,
  };
}
