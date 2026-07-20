'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tagTypesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import type { TagTypeEntity } from '@/types';

export function useTagTypes() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['tag-types'],
    queryFn: async () => {
      const res = await tagTypesApi.list();
      if (!res.success) throw new Error(res.error || 'Errore caricamento tag-type');
      return res;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  // Riferimento stabile + lookup O(1): `data?.data ?? []` creava un nuovo array
  // ad ogni render e i getter facevano .find() lineare (chiamati per ogni tag).
  const tagTypes = useMemo<TagTypeEntity[]>(() => data?.data ?? [], [data]);
  const bySlug = useMemo(() => new Map(tagTypes.map((t) => [t.slug, t])), [tagTypes]);

  const getEmoji = (slug: string): string => bySlug.get(slug)?.emoji ?? '';
  const getName = (slug: string): string => bySlug.get(slug)?.name ?? slug;
  const getColor = (slug: string): string | undefined => bySlug.get(slug)?.color ?? undefined;

  return { tagTypes, getEmoji, getName, getColor, isLoading };
}
