import { create } from 'zustand';
import type { ToastMessage, ToastType } from '@/types';
import { generateId } from '@/utils/formatters';
import { config } from '@/constants';

interface ToastState {
  toasts: ToastMessage[];

  // Actions
  showToast: (type: ToastType, message: string, duration?: number) => void;
  hideToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (type, message, duration = config.ui.toastDurationMs) => {
    const id = generateId('toast');
    const toast: ToastMessage = { id, type, message, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        get().hideToast(id);
      }, duration);
    }
  },

  hideToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Helper functions
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().showToast('success', message, duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().showToast('error', message, duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().showToast('info', message, duration),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().showToast('warning', message, duration),
};
