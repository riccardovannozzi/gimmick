import { create } from 'zustand';

/**
 * Gimmick · Obsidian — Quali tag stai guardando.
 *
 * È la sorgente UNICA della selezione dei tag: ci scrivono la sidebar dei tag e
 * le linguette dei pinnati nella toolbar del Kanban, e da qui entrambe prendono
 * la propria evidenziazione. Due stati separati avrebbero potuto divergere —
 * board filtrata su un tag e sidebar accesa su un altro — ed è esattamente
 * quello che succedeva prima.
 *
 * ⚠️ Insieme VUOTO = nessun filtro, cioè tutti i tile. Non è la stessa cosa di
 * "nessun tile": è lo stato in cui la board non è ristretta a niente.
 *
 * Più tag insieme si selezionano con ctrl/cmd+click e la vista ne mostra
 * l'UNIONE. Non contraddice la regola "un tile, un tag": quella riguarda quanti
 * tag può avere un tile, non quanti se ne possono guardare insieme.
 *
 * ─── Perché è persistita ─────────────────────────────────────────────────────
 * Riaprendo l'app ritrovi la board che stavi guardando, non "tutti i tile". La
 * selezione è un posto in cui sei, non un filtro che riparte da zero a ogni
 * avvio. Sta in localStorage e non nelle impostazioni utente perché è una scelta
 * di questo dispositivo, come la larghezza dello staging o il verde dei
 * completati.
 */
const KEY = 'ob-tag-filter';

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: Set<string>) {
  try { localStorage.setItem(KEY, JSON.stringify([...ids])); } catch { /* storage non disponibile */ }
}

interface TagFilterState {
  selectedTagIds: Set<string>;
  /** Vero dopo il ripristino dalla sessione precedente. */
  hydrated: boolean;
  /** Aggiunge o toglie un tag dalla selezione (ctrl/cmd+click). */
  toggle: (id: string) => void;
  clear: () => void;
  /** Sostituisce la selezione con questo solo tag (click semplice). */
  selectOnly: (id: string) => void;
  /**
   * Ripristina la selezione dell'ultima sessione. Idempotente: la chiama lo
   * shell al montaggio.
   *
   * NON si legge localStorage al momento di creare lo store: il primo render
   * gira anche sul server, dove localStorage non esiste, e un valore diverso fra
   * server e client fa saltare l'idratazione. Si parte vuoti e si ripristina in
   * un layout-effect, prima del paint.
   */
  hydrate: () => void;
  /**
   * Toglie dalla selezione i tag che non esistono più.
   *
   * Serve proprio perché la selezione è persistita: cancellato un tag, il suo id
   * resterebbe in localStorage e la board continuerebbe a filtrare su qualcosa
   * che non c'è — vuota, e senza niente di acceso che spieghi perché.
   */
  prune: (known: Set<string>) => void;
}

export const useTagFilterStore = create<TagFilterState>((set, get) => ({
  selectedTagIds: new Set(),
  hydrated: false,
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedTagIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(next);
      return { selectedTagIds: next };
    }),
  clear: () => {
    write(new Set());
    set({ selectedTagIds: new Set() });
  },
  selectOnly: (id) => {
    const next = new Set([id]);
    write(next);
    set({ selectedTagIds: next });
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true, selectedTagIds: new Set(read()) });
  },
  prune: (known) => {
    const cur = get().selectedTagIds;
    const next = new Set([...cur].filter((id) => known.has(id)));
    // Solo se qualcosa è davvero caduto: un `set` a ogni giro rimetterebbe in
    // coda un render per nulla, e l'effect che lo chiama dipende da qui.
    if (next.size === cur.size) return;
    write(next);
    set({ selectedTagIds: next });
  },
}));
