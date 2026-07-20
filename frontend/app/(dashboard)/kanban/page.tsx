'use client';

/**
 * Kanban — vista Obsidian (board via KanbanLive). La board arcade è stata
 * rimossa nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { KanbanLive } from '@/components/views/kanban-live';

export default function KanbanPage() {
  return (
    <ViewContainer hideToolbar>
      <KanbanLive />
    </ViewContainer>
  );
}
