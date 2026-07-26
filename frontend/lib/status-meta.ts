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
  /** Colore semantico come token Obsidian (per swatch/picker theme-aware). */
  color: string;
  /** Colore esadecimale (per fill/sfondo dove serve un hex, es. `readableOn`). */
  hex: string;
}

/** Presentazione dei 5 status di sistema (hex = valori semantici tema chiaro). */
export const STATUS_META: Record<string, StatusMeta> = {
  active: { label: 'Attivo', color: 'var(--ob-info)', hex: '#4F86EE' },
  done: { label: 'Completato', color: 'var(--ob-success)', hex: '#3FAE72' },
  paused: { label: 'In pausa', color: 'var(--ob-warning)', hex: '#C99220' },
  blocked: { label: 'Bloccato', color: 'var(--ob-error)', hex: '#E0544F' },
  cancelled: { label: 'Annullato', color: 'var(--ob-muted)', hex: '#5C5868' },
};

export const STATUS_FALLBACK: StatusMeta = { label: 'Status', color: 'var(--ob-muted)', hex: '#5C5868' };

/** Presentazione per nome di status; fallback per righe rinominate/custom. */
export function statusMeta(name: string | undefined | null): StatusMeta {
  if (!name) return STATUS_FALLBACK;
  return STATUS_META[name] ?? { label: name, color: STATUS_FALLBACK.color, hex: STATUS_FALLBACK.hex };
}

/**
 * Rappresentazione visiva dello status (colonna del tile + picker). Due
 * tipologie: un'ICONA colorata (es. done→pallino, pausa, bloccato→lucchetto)
 * oppure un TESTO (es. cancelled→"DELETE"). 'none' = nessuna rappresentazione
 * (status 'active', prevalente). È la SINGLE SOURCE OF TRUTH usata da canvas,
 * staging e status picker, così le tre viste restano allineate.
 */
export type StatusGlyph =
  | { kind: 'none' }
  | { kind: 'icon'; icon: string }   // nome componente Tabler (es. 'IconLock')
  | { kind: 'dot' }                  // pallino pieno del colore dello status
  | { kind: 'text'; text: string };  // etichetta breve (es. 'DELETE')

export const STATUS_GLYPH: Record<string, StatusGlyph> = {
  active: { kind: 'none' },
  done: { kind: 'dot' },
  paused: { kind: 'icon', icon: 'IconPlayerPause' },
  blocked: { kind: 'icon', icon: 'IconLock' },
  cancelled: { kind: 'text', text: 'DELETE' },
};

export function statusGlyph(name: string | undefined | null): StatusGlyph {
  if (!name) return { kind: 'none' };
  return STATUS_GLYPH[name] ?? { kind: 'none' };
}
