'use client';

/**
 * Cockpit — due liste, una domanda: di chi è la palla.
 *
 * `hideToolbar` come il Kanban: la vista ha una barra propria, con
 * l'ordinamento e l'interruttore dei conclusi.
 */
import { ViewContainer } from '@/components/shell';
import { CockpitLive } from '@/components/views/cockpit-live';

export default function CockpitPage() {
  return (
    <ViewContainer hideToolbar>
      <CockpitLive />
    </ViewContainer>
  );
}
