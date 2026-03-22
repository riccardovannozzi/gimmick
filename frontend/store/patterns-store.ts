'use client';

import { useQuery } from '@tanstack/react-query';
import { patternsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { Pattern, PatternShape } from '@/types';

export function usePatterns() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['patterns'],
    queryFn: () => patternsApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const patterns: Pattern[] = data?.data || [];

  // System patterns by name
  const getSystemShape = (name: string): PatternShape => {
    const p = patterns.find((pat) => pat.category === 'system' && pat.name === name);
    return p?.shape || 'solid';
  };

  const doneShape = getSystemShape('Done');
  const ctaShape = getSystemShape('Call to action');
  const noneShape = getSystemShape('None');

  // Custom/system patterns linked to action_type
  const getActionTypeShape = (actionType: string): PatternShape => {
    // First check if there's a pattern linked to this action_type
    const linked = patterns.find((p) => p.action_type === actionType);
    if (linked) return linked.shape;
    // Fallback: system "None" shape for unlinked action types
    return noneShape;
  };

  const customPatterns = patterns.filter((p) => p.category === 'custom');

  return {
    patterns,
    doneShape,
    ctaShape,
    noneShape,
    getActionTypeShape,
    getSystemShape,
    customPatterns,
    isLoading,
  };
}
