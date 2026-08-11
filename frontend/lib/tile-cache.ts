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
export const TILE_LIST_KEYS = ['tiles', 'tiles-kanban', 'tiles-calendar', 'calendar-events'] as const;

export function invalidateTileCaches(qc: QueryClient, extra: string[] = []): void {
  for (const key of [...TILE_LIST_KEYS, ...extra]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

/** Una riga di lista: qualunque cosa abbia un `id`, tile o evento che sia. */
type Row = { id?: string };
/** Le due forme in cui le liste stanno in cache: piatta e paginata (infinite). */
type ListCache = { data?: Row[]; pages?: { data?: Row[] }[] };
/** La cache di dettaglio: un solo tile sotto `data`. */
type DetailCache = { data?: Record<string, unknown> };

/**
 * Scrive una modifica di tile in TUTTE le cache che lo contengono — dettaglio e
 * liste — senza passare dalla rete.
 *
 * ─── Perché serve un helper e non tre patcher copiati ───────────────────────
 * Ogni pannello che modifica un tile deve aggiornare le viste che quel tile lo
 * stanno mostrando ALTROVE: la sidebar destra e la board Kanban sono sullo
 * schermo nello stesso momento, e leggono da due chiavi diverse. Finché ogni
 * pannello si scriveva il proprio elenco di chiavi a mano, l'elenco finiva per
 * essere incompleto — la sidebar patchava `tiles`, `tiles-calendar` e
 * `calendar-events` ma mai `tiles-kanban`, quindi cambiare status o titolo non
 * muoveva la card che avevi accanto.
 *
 * `extra` serve alle chiavi che NON sono liste di tile ma vanno comunque
 * ritoccate (le cache del canvas, per esempio): un tile modificato è lo stesso
 * tile ovunque sia disegnato.
 */
export function patchTileCaches(
  qc: QueryClient,
  tileIds: string | string[],
  updates: Record<string, unknown>,
  extra: string[] = [],
): void {
  const ids = new Set(Array.isArray(tileIds) ? tileIds : [tileIds]);
  for (const id of ids) {
    qc.setQueriesData({ queryKey: ['tile-detail', id] }, (old: DetailCache | undefined) => (
      old?.data ? { ...old, data: { ...old.data, ...updates } } : old
    ));
  }
  const patch = (r: Row) => (r && r.id && ids.has(r.id) ? { ...r, ...updates } : r);
  for (const key of [...TILE_LIST_KEYS, ...extra]) {
    qc.setQueriesData({ queryKey: [key] }, (old: ListCache | undefined) => {
      if (!old) return old;
      // Forma paginata (infinite query)
      if (old.pages) return { ...old, pages: old.pages.map((p) => ({ ...p, data: (p.data ?? []).map(patch) })) };
      // Forma piatta `{ data: Tile[] }`
      if (Array.isArray(old.data)) return { ...old, data: old.data.map(patch) };
      return old;
    });
  }
}
