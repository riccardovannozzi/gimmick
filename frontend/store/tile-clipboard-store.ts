import { create } from 'zustand';

interface TileClipboardState {
  /** Id della tile copiata (clipboard interna), o null se vuota. */
  tileId: string | null;
  copy: (tileId: string) => void;
  clear: () => void;
}

/**
 * Clipboard interna per le tile: "Copia" (tasto destro) memorizza l'id qui,
 * "Incolla" lo legge per duplicare la tile. In-memory, condivisa tra le viste
 * (Chrono, e in futuro le altre) così una copia sopravvive al cambio vista.
 */
export const useTileClipboardStore = create<TileClipboardState>((set) => ({
  tileId: null,
  copy: (tileId) => set({ tileId }),
  clear: () => set({ tileId: null }),
}));
