import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BufferItem } from '@/types';
import type { TileUploadOptions } from '@/lib/api';
import { generateId } from '@/utils/formatters';
import { copyToOutbox, deleteOutboxFile } from '@/lib/offlineMedia';

/**
 * Opzioni d'invio di un batch (= tile) committato in coda: tag + metadati con
 * cui verrà sincronizzato. Persistite col buffer, una per batch.
 */
export interface BufferPending {
  tagIds?: string[];
  options?: TileUploadOptions;
}

interface BufferState {
  items: BufferItem[];
  /** Metadati per ogni batch (= tile) in coda, indicizzati per batchId. Il
   *  numero di chiavi = tile ancora da sincronizzare (contatore header). */
  batches: Record<string, BufferPending>;
  isUploading: boolean;
  uploadProgress: number;

  // Actions
  addItem: (item: Omit<BufferItem, 'id' | 'createdAt'>) => string;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<BufferItem>) => void;
  /** Rimuove item per id (+ pulizia file) e pota i batch rimasti senza item. */
  removeItemsById: (ids: string[]) => void;
  /** Committa in coda tutti gli item in composizione come un nuovo batch (tile),
   *  registrandone le opzioni d'invio. */
  commitToQueue: (meta: BufferPending) => void;
  clearBuffer: () => void;
  setUploading: (isUploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}

export const useBufferStore = create<BufferState>()(
  persist(
    (set, get) => ({
      items: [],
      batches: {},
      isUploading: false,
      uploadProgress: 0,

      addItem: (item) => {
        const id = generateId('buf');
        const newItem: BufferItem = {
          ...item,
          id,
          createdAt: new Date(),
        };

        set((state) => ({
          items: [...state.items, newItem],
        }));

        // Durabilizza il media in background: copia il file in documentDirectory
        // e aggiorna l'URI dell'item. Fino a fine copia l'URI resta quello di
        // cache (comunque valido). Testo e URI vuoti non hanno file da copiare.
        if (item.type !== 'text' && item.uri) {
          copyToOutbox(item.uri).then((durable) => {
            if (durable !== item.uri) get().updateItem(id, { uri: durable });
          });
        }

        return id;
      },

      removeItem: (id) => {
        const target = get().items.find((item) => item.id === id);
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
        if (target) deleteOutboxFile(target.uri);
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },

      removeItemsById: (ids) => {
        const idSet = new Set(ids);
        const items = get().items;
        if (ids.length) items.forEach((i) => { if (idSet.has(i.id)) deleteOutboxFile(i.uri); });
        const remaining = ids.length ? items.filter((i) => !idSet.has(i.id)) : items;
        // Pota i batch che non hanno più item (anche quando ids è vuoto).
        const batches = { ...get().batches };
        let changed = false;
        for (const bid of Object.keys(batches)) {
          if (!remaining.some((i) => i.batchId === bid)) { delete batches[bid]; changed = true; }
        }
        if (ids.length || changed) set({ items: remaining, batches });
      },

      commitToQueue: (meta) => {
        const batchId = generateId('batch');
        set((state) => {
          if (!state.items.some((i) => i.status !== 'queued')) return state;
          return {
            items: state.items.map((it) =>
              it.status === 'queued' ? it : { ...it, status: 'queued', batchId }
            ),
            batches: { ...state.batches, [batchId]: meta },
          };
        });
      },

      clearBuffer: () => {
        get().items.forEach((item) => deleteOutboxFile(item.uri));
        set({ items: [], batches: {}, uploadProgress: 0 });
      },

      setUploading: (isUploading) => {
        set({ isUploading });
      },

      setUploadProgress: (progress) => {
        set({ uploadProgress: progress });
      },
    }),
    {
      name: 'gimmick-outbox',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Coda + metadati batch persistiti; i flag transitori ripartono puliti.
      partialize: (state) => ({ items: state.items, batches: state.batches }),
      onRehydrateStorage: () => (state) => {
        if (!state?.items) return;
        state.items = state.items.map((item) => ({
          ...item,
          // JSON riporta createdAt come stringa: lo riconvertiamo in Date.
          createdAt: new Date(item.createdAt),
          // Un invio interrotto dalla chiusura dell'app torna ritentabile.
          status: item.status === 'uploading' ? 'queued' : item.status,
        }));
      },
    }
  )
);

// Selectors
export const selectBufferCount = (state: BufferState) => state.items.length;
export const selectIsBufferEmpty = (state: BufferState) => state.items.length === 0;
