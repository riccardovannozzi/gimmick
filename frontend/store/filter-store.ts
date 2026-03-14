import { create } from 'zustand';

interface FilterState {
  sparkIds: string[] | null;
  tileIds: string[] | null;
  setSparkFilter: (ids: string[]) => void;
  setTileFilter: (ids: string[]) => void;
  clearFilter: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  sparkIds: null,
  tileIds: null,
  setSparkFilter: (ids) => set({ sparkIds: ids, tileIds: null }),
  setTileFilter: (ids) => set({ tileIds: ids, sparkIds: null }),
  clearFilter: () => set({ sparkIds: null, tileIds: null }),
}));
