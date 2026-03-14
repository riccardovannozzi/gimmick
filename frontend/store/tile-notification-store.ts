import { create } from 'zustand';

const STORAGE_KEY = 'gimmick-tiles-last-seen';
const READ_IDS_KEY = 'gimmick-tiles-read-ids';

function getLastSeen(): string {
  if (typeof window === 'undefined') return new Date().toISOString();
  return localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString();
}

function getReadIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(READ_IDS_KEY) || '[]');
  } catch {
    return [];
  }
}

interface TileNotificationState {
  /** Timestamp of last visit to tiles page */
  lastSeen: string;
  /** IDs explicitly marked as read (for tiles newer than lastSeen) */
  readIds: string[];

  /** Check if a tile is unread based on its created_at */
  isUnread: (tileId: string, createdAt: string) => boolean;

  /** Mark a single tile as read */
  markRead: (tileId: string) => void;

  /** Mark all as read — updates lastSeen to now */
  dismissAll: () => void;
}

export const useTileNotificationStore = create<TileNotificationState>((set, get) => ({
  lastSeen: getLastSeen(),
  readIds: getReadIds(),

  isUnread: (tileId: string, createdAt: string) => {
    const { lastSeen, readIds } = get();
    if (new Date(createdAt) <= new Date(lastSeen)) return false;
    return !readIds.includes(tileId);
  },

  markRead: (tileId: string) => {
    const current = get().readIds;
    if (current.includes(tileId)) return;
    const updated = [...current, tileId];
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(updated));
    set({ readIds: updated });
  },

  dismissAll: () => {
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    localStorage.setItem(READ_IDS_KEY, '[]');
    set({ lastSeen: now, readIds: [] });
  },
}));
