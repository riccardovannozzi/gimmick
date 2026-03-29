'use client';

import { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { DEFAULT_ACTION_COLORS } from '@/lib/palette';
import { useAuthStore } from '@/store/auth-store';
import type { ActionType } from '@/types';

export type ActionColors = Record<ActionType, string>;

const SETTINGS_KEY = 'action_colors';

export function useActionColorsQuery() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['settings', SETTINGS_KEY],
    queryFn: async () => {
      const res = await settingsApi.get<ActionColors>(SETTINGS_KEY);
      return { ...DEFAULT_ACTION_COLORS, ...(res.data || {}) };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: async (colors: ActionColors) => {
      await settingsApi.set(SETTINGS_KEY, colors);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', SETTINGS_KEY] });
    },
  });

  const actionColors: ActionColors = data ?? DEFAULT_ACTION_COLORS;

  const updateActionColor = (type: ActionType, hex: string) => {
    const next = { ...actionColors, [type]: hex };
    queryClient.setQueryData(['settings', SETTINGS_KEY], next);
    mutation.mutate(next);
  };

  return { actionColors, updateActionColor, isLoading };
}

// Context for global access without prop drilling
export const ActionColorsContext = createContext<ActionColors>(DEFAULT_ACTION_COLORS);

export function useActionColors(): ActionColors {
  return useContext(ActionColorsContext);
}
