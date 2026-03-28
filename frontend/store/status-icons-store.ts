import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StatusIcon {
  id: string;
  name: string;
  icon: string; // Tabler icon name, e.g. "IconFlame"
}

interface StatusIconsState {
  icons: StatusIcon[];
  tileIcons: Record<string, string>; // tileId -> iconId
  addIcon: (icon: StatusIcon) => void;
  updateIcon: (id: string, updates: Partial<Omit<StatusIcon, 'id'>>) => void;
  removeIcon: (id: string) => void;
  assignIcon: (tileId: string, iconId: string | null) => void;
  getIconForTile: (tileId: string) => StatusIcon | null;
}

export const useStatusIcons = create<StatusIconsState>()(
  persist(
    (set, get) => ({
      icons: [],
      tileIcons: {},
      addIcon: (icon) => set((s) => ({ icons: [...s.icons, icon] })),
      updateIcon: (id, updates) =>
        set((s) => ({
          icons: s.icons.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      removeIcon: (id) =>
        set((s) => ({
          icons: s.icons.filter((i) => i.id !== id),
          tileIcons: Object.fromEntries(
            Object.entries(s.tileIcons).filter(([, v]) => v !== id)
          ),
        })),
      assignIcon: (tileId, iconId) =>
        set((s) => {
          const next = { ...s.tileIcons };
          if (iconId) next[tileId] = iconId;
          else delete next[tileId];
          return { tileIcons: next };
        }),
      getIconForTile: (tileId) => {
        const state = get();
        const iconId = state.tileIcons[tileId];
        if (!iconId) return null;
        return state.icons.find((i) => i.id === iconId) || null;
      },
    }),
    { name: 'gimmick-status-icons' }
  )
);
