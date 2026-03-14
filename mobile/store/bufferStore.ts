import { create } from 'zustand';
import type { BufferItem, SparkType } from '@/types';
import { generateId } from '@/utils/formatters';

interface BufferState {
  items: BufferItem[];
  isUploading: boolean;
  uploadProgress: number;

  // Actions
  addItem: (item: Omit<BufferItem, 'id' | 'createdAt'>) => string;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<BufferItem>) => void;
  clearBuffer: () => void;
  setUploading: (isUploading: boolean) => void;
  setUploadProgress: (progress: number) => void;
}

export const useBufferStore = create<BufferState>((set, get) => ({
  items: [],
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

    return id;
  },

  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },

  updateItem: (id, updates) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  clearBuffer: () => {
    set({ items: [], uploadProgress: 0 });
  },

  setUploading: (isUploading) => {
    set({ isUploading });
  },

  setUploadProgress: (progress) => {
    set({ uploadProgress: progress });
  },
}));

// Selectors
export const selectBufferCount = (state: BufferState) => state.items.length;
export const selectIsBufferEmpty = (state: BufferState) => state.items.length === 0;
