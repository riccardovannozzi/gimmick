import { create } from 'zustand';
import { settingsApi } from '@/lib/api';

/**
 * Gimmick · Obsidian — Quali viste OPZIONALI sono accese.
 *
 * Non tutte le viste servono a tutti. Il PANOPTICON è la prima ad ammetterlo: è
 * un grafo dell'intero archivio, potente per chi ci ragiona sopra e una
 * linguetta in più per chiunque altro — e una linguetta che non apri mai non è
 * neutra, occupa la barra e allunga la fila da leggere ogni volta che cerchi
 * un'altra vista. Quindi nasce SPENTA e la si accende dalle impostazioni.
 *
 * ⚠️ Il default è `false`, e conta anche prima dell'idratazione: finché non
 * sappiamo la preferenza, la vista resta nascosta. Al contrario — default acceso
 * — la linguetta comparirebbe a ogni caricamento per poi sparire, che è il
 * difetto peggiore dei due: una cosa che appare e se ne va sembra un guasto.
 *
 * ─── Persistenza a due livelli ───────────────────────────────────────────────
 * Stesso schema del tema (`lib/theme/obsidian-provider.tsx`):
 *   · localStorage → immediato e locale, evita il lampo al reload;
 *   · settingsApi  → copia autoritativa sul server, così la scelta ti segue fra
 *     i dispositivi. Ed è giusto che li segua: «questa vista per me non esiste»
 *     è una decisione sull'app, non sul computer da cui la apri — al contrario
 *     della larghezza di un pannello o dei tag che stavi guardando, che restano
 *     in localStorage e basta.
 */
const LS_KEY = 'ob-view-prefs';
const SETTINGS_KEY = 'view_prefs_v1';

export interface ViewPrefs {
  /** Il Panopticon (grafo) compare fra le linguette. */
  panopticon: boolean;
}

const DEFAULTS: ViewPrefs = { panopticon: false };

function readLocal(): ViewPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<ViewPrefs>) : null;
    return { panopticon: typeof v?.panopticon === 'boolean' ? v.panopticon : DEFAULTS.panopticon };
  } catch {
    return DEFAULTS;
  }
}

function writeLocal(prefs: ViewPrefs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* storage non disponibile */ }
}

interface ViewPrefsState extends ViewPrefs {
  /** L'idratazione locale è avvenuta: prima di allora valgono i default. */
  hydrated: boolean;
  /** Legge il localStorage. Idempotente — si chiama in layout-effect dallo shell. */
  hydrate: () => void;
  /** Tira giù la copia del server. Una volta per sessione, dal layout. */
  hydrateFromServer: () => Promise<void>;
  setPanopticon: (on: boolean) => void;
}

export const useViewPrefs = create<ViewPrefsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({ ...readLocal(), hydrated: true });
  },

  hydrateFromServer: async () => {
    try {
      const res = await settingsApi.get<Partial<ViewPrefs> | null>(SETTINGS_KEY);
      const remote = res.success ? res.data : null;
      if (!remote || typeof remote.panopticon !== 'boolean') return;
      // Il server è autoritativo: allinea anche la copia locale, altrimenti al
      // reload successivo il localStorage vecchio tornerebbe a vincere per un
      // istante e la linguetta lampeggerebbe.
      const next: ViewPrefs = { panopticon: remote.panopticon };
      writeLocal(next);
      set({ ...next, hydrated: true });
    } catch {
      /* offline o impostazione mai salvata: restano i valori locali */
    }
  },

  setPanopticon: (on) => {
    const next: ViewPrefs = { panopticon: on };
    set({ ...next, hydrated: true });
    writeLocal(next);
    // Nessun debounce: è un interruttore, non un cursore — una scrittura per
    // click, e il click non si ripete sessanta volte al secondo.
    settingsApi.set(SETTINGS_KEY, next).catch(() => { /* best-effort */ });
  },
}));
