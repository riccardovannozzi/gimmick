/**
 * Gimmick · Obsidian — Buffer triage, wired to the live buffer store.
 *
 * Drives the card stack from the in-memory `bufferStore` (pre-send items).
 * Scarta removes the item from the buffer. Conferma is deferred to a simple
 * remove for now — full upload-to-spark (tile pick + AI indexing) is a larger
 * flow; the pre-upload items carry no AI suggestion, so that block is omitted
 * in live mode.
 */
import React from 'react';
import { useBufferStore } from '@/store/bufferStore';
import { bufferItemToVM } from '@/lib/obsidian-adapters';
import { ObsidianBufferScreen } from './BufferScreen';

export interface ObsidianBufferScreenLiveProps {
  onCapture?: () => void;
  onBack?: () => void;
}

export function ObsidianBufferScreenLive({ onCapture, onBack }: ObsidianBufferScreenLiveProps) {
  const storeItems = useBufferStore((s) => s.items);
  const removeItem = useBufferStore((s) => s.removeItem);

  const items = React.useMemo(() => storeItems.map(bufferItemToVM), [storeItems]);

  return (
    <ObsidianBufferScreen
      items={items}
      onDiscard={removeItem}
      onConfirm={removeItem}
      onCapture={onCapture}
      onBack={onBack}
    />
  );
}
