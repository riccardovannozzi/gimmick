'use client';

/**
 * Sparks — vista Obsidian (via SparksLive). La lista arcade è stata rimossa
 * nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { SparksLive } from '@/components/views/sparks-live';

export default function SparksPage() {
  return (
    <ViewContainer hideToolbar>
      <SparksLive />
    </ViewContainer>
  );
}
