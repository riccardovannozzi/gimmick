import { create } from 'zustand';

interface TagFilterState {
  selectedTagIds: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
  selectOnly: (id: string) => void;
}

export const useTagFilterStore = create<TagFilterState>((set) => ({
  selectedTagIds: new Set(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedTagIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTagIds: next };
    }),
  clear: () => set({ selectedTagIds: new Set() }),
  selectOnly: (id) => set({ selectedTagIds: new Set([id]) }),
}));
