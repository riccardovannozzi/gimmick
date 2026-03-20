'use client';

import { useQuery } from '@tanstack/react-query';
import { tagTypesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export function useTagTypes() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['tag-types'],
    queryFn: () => tagTypesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const tagTypes = data?.data ?? [];

  const getEmoji = (slug: string): string => {
    return tagTypes.find((t) => t.slug === slug)?.emoji ?? '';
  };

  const getName = (slug: string): string => {
    return tagTypes.find((t) => t.slug === slug)?.name ?? slug;
  };

  return { tagTypes, getEmoji, getName, isLoading };
}
