'use client';

/**
 * Calendar/Chrono — vista Obsidian (griglia settimanale via ChronoLive). La
 * versione arcade (FullCalendar) è stata rimossa nel cleanup della migrazione.
 */
import { ViewContainer } from '@/components/shell';
import { ChronoLive } from '@/components/views/chrono-live';

export default function CalendarPage() {
  return (
    <ViewContainer hideToolbar>
      <ChronoLive />
    </ViewContainer>
  );
}
