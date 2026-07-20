'use client';

/**
 * Tiles — vista Obsidian (`TilesView` browse + select→Inspector + add +
 * infinite scroll; editing nel TileSidebar). La tabella arcade è stata rimossa
 * nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { TilesLive } from '@/components/views/tiles-live';

export default function TilesPage() {
  return (
    <ViewContainer hideToolbar>
      <TilesLive />
    </ViewContainer>
  );
}
