'use client';

import { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api';
import { DEFAULT_ACTION_COLORS } from '@/lib/palette';
import { useAuthStore } from '@/store/auth-store';
import type { ActionType } from '@/types';

export type ActionColors = Record<ActionType, string>;
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'thick' | 'none';
export type ActionBorders = Record<ActionType, BorderStyle>;

const SETTINGS_KEY = 'action_colors';
const BORDERS_KEY = 'action_borders';

export const DEFAULT_ACTION_BORDERS: ActionBorders = {
  none: 'solid',
  anytime: 'solid',
  deadline: 'solid',
  event: 'solid',
  allday: 'solid',
};

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

  // Border styles
  const { data: borderData } = useQuery({
    queryKey: ['settings', BORDERS_KEY],
    queryFn: async () => {
      const res = await settingsApi.get<ActionBorders>(BORDERS_KEY);
      return { ...DEFAULT_ACTION_BORDERS, ...(res.data || {}) };
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const borderMutation = useMutation({
    mutationFn: async (borders: ActionBorders) => {
      await settingsApi.set(BORDERS_KEY, borders);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', BORDERS_KEY] });
    },
  });

  const actionBorders: ActionBorders = borderData ?? DEFAULT_ACTION_BORDERS;

  const updateActionBorder = (type: ActionType, style: BorderStyle) => {
    const next = { ...actionBorders, [type]: style };
    queryClient.setQueryData(['settings', BORDERS_KEY], next);
    borderMutation.mutate(next);
  };

  return { actionColors, updateActionColor, actionBorders, updateActionBorder, isLoading };
}

// Context for global access without prop drilling
export const ActionColorsContext = createContext<ActionColors>(DEFAULT_ACTION_COLORS);
export const ActionBordersContext = createContext<ActionBorders>(DEFAULT_ACTION_BORDERS);

export function useActionColors(): ActionColors {
  return useContext(ActionColorsContext);
}

export function useActionBorders(): ActionBorders {
  return useContext(ActionBordersContext);
}
