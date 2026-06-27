/**
 * Gimmick · Obsidian — Mobile Tile detail route (QA preview). At /obsidian-tile.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { ObsidianTileScreen } from '@/components/obsidian';

export default function ObsidianTileRoute() {
  const router = useRouter();
  return <ObsidianTileScreen onBack={() => { if (router.canGoBack()) router.back(); }} />;
}
