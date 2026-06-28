/**
 * Gimmick · Obsidian — Sparks screen, wired to live data.
 *
 * Strangler pattern (mirrors the frontend *-live wrappers): fetches real
 * sparks via React Query + sparksApi, maps them through `sparkToVM`, and feeds
 * the presentational ObsidianSparksScreen. The static mockup
 * (ObsidianSparksScreen with no props) stays available for QA previews.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { sparksApi } from '@/lib/api';
import { sparkToVM } from '@/lib/obsidian-adapters';
import { ObsidianSparksScreen } from './SparksScreen';

export interface ObsidianSparksScreenLiveProps {
  onBack?: () => void;
  onHome?: () => void;
  onSearch?: () => void;
  onSettings?: () => void;
  onOpenSpark?: (id: string, tileId?: string) => void;
}

export function ObsidianSparksScreenLive(props: ObsidianSparksScreenLiveProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['sparks', { page: 1, limit: 100 }],
    queryFn: () => sparksApi.list({ page: 1, limit: 100 }),
  });

  const sparks = React.useMemo(
    () => (data?.data ?? []).map(sparkToVM),
    [data],
  );

  return <ObsidianSparksScreen sparks={sparks} loading={isLoading} {...props} />;
}
