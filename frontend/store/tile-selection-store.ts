import { create } from 'zustand';

/**
 * Selezione globale del tile "attivo" per il dettaglio nell'Inspector dello
 * shell Obsidian. Introdotto in Fase 3 (Tiles): le viste segnalano quale tile
 * mostrare a destra senza montare un proprio pannello, evitando doppi inspector.
 * Riusabile da Calendar/Kanban/Flows nelle fasi successive.
 */
interface TileSelectionState {
  selectedTileId: string | null;
  select: (id: string) => void;
  clear: () => void;
}

export const useTileSelectionStore = create<TileSelectionState>((set) => ({
  selectedTileId: null,
  select: (id) => set({ selectedTileId: id }),
  clear: () => set({ selectedTileId: null }),
}));
