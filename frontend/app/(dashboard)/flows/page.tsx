'use client';

/**
 * Flows — vista Obsidian (FlowHub board via FlowsLive). La versione arcade è
 * stata rimossa nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { FlowsLive } from '@/components/views/flows-live';

export default function FlowsPage() {
  return (
    <ViewContainer hideToolbar>
      <FlowsLive />
    </ViewContainer>
  );
}
