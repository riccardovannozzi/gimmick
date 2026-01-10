import { create } from 'zustand';
import { authApi, setTokens, loadTokens, getAccessToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      set({ isLoading: true });
      loadTokens();

      if (getAccessToken()) {
        const result = await authApi.getMe();
        if (result.success && result.data) {
          set({ user: result.data.user });
        } else {
          setTokens(null);
        }
      }

      set({ isInitialized: true, isLoading: false });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  signIn: async (email, password) => {
    try {
      set({ isLoading: true });

      const result = await authApi.signIn(email, password);

      if (!result.success || !result.data) {
        set({ isLoading: false });
        return { error: result.error || 'Login failed' };
      }

      set({ user: result.data.user, isLoading: false });
      return {};
    } catch (error) {
      set({ isLoading: false });
      return { error: 'Errore durante il login' };
    }
  },

  signUp: async (email, password) => {
    try {
      set({ isLoading: true });

      const result = await authApi.signUp(email, password);

      if (!result.success) {
        set({ isLoading: false });
        return { error: result.error || 'Registration failed' };
      }

      set({ isLoading: false });
      return {};
    } catch (error) {
      set({ isLoading: false });
      return { error: 'Errore durante la registrazione' };
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await authApi.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      set({ user: null, isLoading: false });
    }
  },
}));
