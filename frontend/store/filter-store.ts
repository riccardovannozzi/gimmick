import { create } from 'zustand';

interface FilterState {
  memoIds: string[] | null;
  tileIds: string[] | null;
  setMemoFilter: (ids: string[]) => void;
  setTileFilter: (ids: string[]) => void;
  clearFilter: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  memoIds: null,
  tileIds: null,
  setMemoFilter: (ids) => set({ memoIds: ids, tileIds: null }),
  setTileFilter: (ids) => set({ tileIds: ids, memoIds: null }),
  clearFilter: () => set({ memoIds: null, tileIds: null }),
}));
