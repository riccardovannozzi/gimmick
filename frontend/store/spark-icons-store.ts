import { create } from 'zustand';

/**
 * Gimmick · Obsidian — I pallini degli spark si vedono o no.
 *
 * ─── Perché una preferenza sola e non una per vista ──────────────────────────
 * Il `Done` verde è per vista, e ha senso: è un modo di leggere QUELLA board.
 * Questi pallini no — sono un canale del TILE, e il tile è lo stesso componente
 * in Chrono, Kanban, Canvas e Staging. Spegnerli nel Kanban e ritrovarli nel
 * Canvas sarebbe la stessa domanda con quattro risposte diverse.
 *
 * ─── Perché un attributo sulla radice e non un prop ──────────────────────────
 * L'alternativa era passare `showSparks` giù per quattro alberi di componenti
 * fino a ogni card. Costa di più e rende di meno: nel Canvas le card sono
 * stringhe prodotte da `renderToString` dentro D3, quindi un prop obbligherebbe
 * a ricostruire l'intero SVG a ogni click sull'interruttore. Un attributo sulla
 * radice e una regola CSS spengono tutto in un frame, senza un solo re-render —
 * la stessa tecnica del tema (`data-theme`) e del verde dei completati.
 *
 * Sta in localStorage e non sul server: è come guardi la board su QUESTO
 * schermo, come lo zoom del canvas o la vista del calendario.
 */
const LS_KEY = 'ob-spark-icons';
const ATTR = 'sparks';

/**
 * Nascono ACCESI. Sono un'informazione che sulla card prima non c'era, e una
 * funzione che debutta spenta è una funzione che nessuno scopre.
 */
const DEFAULT_ON = true;

/** Scrive (o toglie) `data-sparks="off"` sulla radice. */
function applyAttr(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) delete document.documentElement.dataset[ATTR];
  else document.documentElement.dataset[ATTR] = 'off';
}

interface SparkIconsState {
  /** I pallini sono visibili. */
  on: boolean;
  /** Legge il localStorage e allinea la radice. Idempotente. */
  hydrate: () => void;
  toggle: () => void;
}

export const useSparkIcons = create<SparkIconsState>((set, get) => ({
  on: DEFAULT_ON,

  hydrate: () => {
    let on = DEFAULT_ON;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw !== null) on = raw === '1';
    } catch { /* modalità privata: restano i pallini accesi */ }
    // L'attributo va riscritto anche quando il valore coincide col default: al
    // primo montaggio la radice non l'ha ancora, e da spento resterebbe pulita.
    applyAttr(on);
    if (on !== get().on) set({ on });
  },

  toggle: () => {
    const on = !get().on;
    set({ on });
    applyAttr(on);
    try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch { /* best-effort */ }
  },
}));
