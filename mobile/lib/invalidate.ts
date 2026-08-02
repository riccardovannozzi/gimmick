/**
 * Gimmick — Invalidazioni della cache dopo una cattura.
 *
 * Esiste perché le chiavi di React Query in questa app sono TRE per la stessa
 * cosa, e chi salva uno spark non può saperlo:
 *
 *   ['tiles', …]            lista Tiles (Obsidian e history)
 *   ['tile', id]            dettaglio LEGACY (app/tile/[id].tsx)
 *   ['tile-detail', id]     dettaglio OBSIDIAN (TileScreenLive)
 *
 * Le sei rotte di cattura invalidavano solo la seconda: il dettaglio vecchio si
 * aggiornava, la lista no. E siccome il QueryClient ha `staleTime` di 5 minuti,
 * "no" non voleva dire "al prossimo giro" ma "fra cinque minuti" — il tile
 * appena salvato semplicemente non c'era.
 *
 * Raccoglierle qui non risolve la divergenza delle chiavi, ma fa sì che si
 * sistemi in un posto solo il giorno in cui la si affronta.
 */
import type { QueryClient } from '@tanstack/react-query';

/**
 * Da chiamare dopo aver creato o modificato spark su un tile.
 * `tileId` assente = è nato un tile nuovo: si aggiorna solo la lista.
 */
export function invalidateTileData(qc: QueryClient, tileId?: string | null): void {
  qc.invalidateQueries({ queryKey: ['tiles'] });
  // Un tile con data compare anche nel calendario: senza, resta indietro fino
  // al riavvio.
  qc.invalidateQueries({ queryKey: ['calendar-events'] });
  if (!tileId) return;
  qc.invalidateQueries({ queryKey: ['tile', tileId] });
  qc.invalidateQueries({ queryKey: ['tile-detail', tileId] });
}
