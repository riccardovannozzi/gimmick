/**
 * Gimmick · Obsidian — Tile detail, wired to live data.
 *
 * Fetches the tile (with its sparks) via React Query + tilesApi.get and feeds
 * the presentational ObsidianTileScreen. Read-only display is wired (title,
 * schedule chip, tag, sparks count, voice/text spark cards); inline editing +
 * Save are deferred (the edit controls remain decorative for now).
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tilesApi } from '@/lib/api';
import { ObsidianTileScreen } from './TileScreen';

export interface ObsidianTileScreenLiveProps {
  tileId: string;
  onBack?: () => void;
}

export function ObsidianTileScreenLive({ tileId, onBack }: ObsidianTileScreenLiveProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['tile-detail', tileId],
    queryFn: () => tilesApi.get(tileId),
    enabled: !!tileId,
  });

  return <ObsidianTileScreen tile={data?.data} loading={isLoading} onBack={onBack} />;
}
