import { create } from 'zustand';
import { statusIconsApi } from '@/lib/api';

export interface StatusIcon {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

interface StatusIconsState {
  icons: StatusIcon[];
  tileIcons: Record<string, string>; // tileId -> iconId
  loaded: boolean;
  loading: boolean;
  // Actions
  fetchAll: () => Promise<void>;
  addIcon: (data: { name: string; icon: string; color?: string }) => Promise<void>;
  updateIcon: (id: string, updates: Partial<Omit<StatusIcon, 'id'>>) => Promise<void>;
  removeIcon: (id: string) => Promise<void>;
  assignIcon: (tileId: string, iconId: string | null) => void;
  getIconForTile: (tileId: string) => StatusIcon | null;
}

export const useStatusIcons = create<StatusIconsState>()((set, get) => ({
  icons: [],
  tileIcons: {},
  loaded: false,
  loading: false,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [iconsRes, assignRes] = await Promise.all([
        statusIconsApi.list(),
        statusIconsApi.getAssignments(),
      ]);
      const icons: StatusIcon[] = (iconsRes.data || []).map((si) => ({
        id: si.id,
        name: si.name,
        icon: si.icon,
        color: si.color || undefined,
      }));
      const tileIcons: Record<string, string> = {};
      (assignRes.data || []).forEach((a) => { tileIcons[a.tile_id] = a.status_icon_id; });
      set({ icons, tileIcons, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addIcon: async (data) => {
    try {
      const res = await statusIconsApi.create(data);
      if (res?.data) {
        const d = res.data as any;
        set((s) => ({ icons: [...s.icons, { id: d.id, name: d.name, icon: d.icon, color: d.color || undefined }] }));
      }
    } catch { /* ignore */ }
  },

  updateIcon: async (id, updates) => {
    set((s) => ({ icons: s.icons.map((i) => (i.id === id ? { ...i, ...updates } : i)) }));
    try {
      await statusIconsApi.update(id, updates as { name?: string; icon?: string; color?: string });
    } catch { /* ignore */ }
  },

  removeIcon: async (id) => {
    set((s) => ({
      icons: s.icons.filter((i) => i.id !== id),
      tileIcons: Object.fromEntries(Object.entries(s.tileIcons).filter(([, v]) => v !== id)),
    }));
    try {
      await statusIconsApi.delete(id);
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
    statusIconsApi.assign(tileId, iconId).catch(() => {});
  },

  getIconForTile: (tileId) => {
    const state = get();
    const iconId = state.tileIcons[tileId];
    if (!iconId) return null;
    return state.icons.find((i) => i.id === iconId) || null;
  },
}));
