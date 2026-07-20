import type { QueryClient } from '@tanstack/react-query';

/**
 * Le stesse tile vivono sotto chiavi React Query diverse a seconda della vista:
 *   - `tiles`           → lista Tiles (infinite query)
 *   - `tiles-kanban`    → board Kanban
 *   - `tiles-calendar`  → colonne Chrono (Notes/Todo)
 *   - `calendar-events` → eventi schedulati nella griglia Chrono
 *
 * Nessuna di queste si invalidava a vicenda: creando/eliminando una tile in una
 * vista, le altre restavano stale fino allo scadere di `staleTime`. Questo
 * helper invalida l'intero gruppo in un colpo solo, così ogni mutazione che
 * cambia l'insieme delle tile (create/delete/schedule) propaga ovunque.
 */
const TILE_LIST_KEYS = ['tiles', 'tiles-kanban', 'tiles-calendar', 'calendar-events'] as const;

export function invalidateTileCaches(qc: QueryClient, extra: string[] = []): void {
  for (const key of [...TILE_LIST_KEYS, ...extra]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}
