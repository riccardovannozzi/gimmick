import { create } from 'zustand';
import { typeIconsApi } from '@/lib/api';

export interface TypeIcon {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

interface TypeIconsState {
  icons: TypeIcon[];
  tileIcons: Record<string, string>; // tileId -> iconId
  loaded: boolean;
  loading: boolean;
  // Actions
  fetchAll: () => Promise<void>;
  addIcon: (data: { name: string; icon: string; color?: string }) => Promise<void>;
  updateIcon: (id: string, updates: Partial<Omit<TypeIcon, 'id'>>) => Promise<void>;
  removeIcon: (id: string) => Promise<void>;
  assignIcon: (tileId: string, iconId: string | null) => void;
  getIconForTile: (tileId: string) => TypeIcon | null;
}

export const useTypeIcons = create<TypeIconsState>()((set, get) => ({
  icons: [],
  tileIcons: {},
  loaded: false,
  loading: false,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [iconsRes, assignRes] = await Promise.all([
        typeIconsApi.list(),
        typeIconsApi.getAssignments(),
      ]);
      const icons: TypeIcon[] = (iconsRes.data || []).map((si) => ({
        id: si.id,
        name: si.name,
        icon: si.icon,
        color: si.color || undefined,
      }));
      const tileIcons: Record<string, string> = {};
      (assignRes.data || []).forEach((a) => { tileIcons[a.tile_id] = a.type_icon_id; });
      set({ icons, tileIcons, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addIcon: async (data) => {
    try {
      const res = await typeIconsApi.create(data);
      if (res?.data) {
        const d = res.data as any;
        set((s) => ({ icons: [...s.icons, { id: d.id, name: d.name, icon: d.icon, color: d.color || undefined }] }));
      }
    } catch { /* ignore */ }
  },

  updateIcon: async (id, updates) => {
    set((s) => ({ icons: s.icons.map((i) => (i.id === id ? { ...i, ...updates } : i)) }));
    try {
      await typeIconsApi.update(id, updates as { name?: string; icon?: string; color?: string });
    } catch { /* ignore */ }
  },

  removeIcon: async (id) => {
    set((s) => ({
      icons: s.icons.filter((i) => i.id !== id),
      tileIcons: Object.fromEntries(Object.entries(s.tileIcons).filter(([, v]) => v !== id)),
    }));
    try {
      await typeIconsApi.delete(id);
    } catch { /* ignore */ }
  },

  assignIcon: (tileId, iconId) => {
    set((s) => {
      const next = { ...s.tileIcons };
      if (iconId) next[tileId] = iconId;
      else delete next[tileId];
      return { tileIcons: next };
    });
    // Fire and forget
    typeIconsApi.assign(tileId, iconId).catch(() => {});
  },

  getIconForTile: (tileId) => {
    const state = get();
    const iconId = state.tileIcons[tileId];
    if (!iconId) return null;
    return state.icons.find((i) => i.id === iconId) || null;
  },
}));
