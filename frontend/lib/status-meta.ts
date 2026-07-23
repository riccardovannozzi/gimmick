/**
 * Metadati di presentazione per gli status di sistema del tile.
 *
 * Gli status vivono nella tabella `statuses` (5 righe di sistema seedate al
 * signup) e sono distinti nel modello dati dalla loro `shape` (StatusShape).
 * Qui aggiungiamo il layer di presentazione — etichetta italiana e colore
 * semantico — condiviso da TileSidebar, tabella Tiles e card Kanban/Chrono.
 *
 * I colori usano i token Obsidian (`--ob-*`), quindi sono theme-aware quando
 * applicati come stile inline in qualsiasi punto dell'app a tema Obsidian.
 */

export interface StatusMeta {
  label: string;
  color: string;
}

/** Presentazione dei 5 status di sistema. */
export const STATUS_META: Record<string, StatusMeta> = {
  active: { label: 'Attivo', color: 'var(--ob-info)' },
  done: { label: 'Completato', color: 'var(--ob-success)' },
  paused: { label: 'In pausa', color: 'var(--ob-warning)' },
  blocked: { label: 'Bloccato', color: 'var(--ob-error)' },
  cancelled: { label: 'Annullato', color: 'var(--ob-muted)' },
};

export const STATUS_FALLBACK: StatusMeta = { label: 'Status', color: 'var(--ob-muted)' };

/** Presentazione per nome di status; fallback per righe rinominate/custom. */
export function statusMeta(name: string | undefined | null): StatusMeta {
  if (!name) return STATUS_FALLBACK;
  return STATUS_META[name] ?? { label: name, color: STATUS_FALLBACK.color };
}
