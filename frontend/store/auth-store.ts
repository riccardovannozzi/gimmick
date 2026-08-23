import { create } from 'zustand';
import * as Sentry from '@sentry/nextjs';
import { authApi, setTokens, loadTokens, getAccessToken } from '@/lib/api';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string; code?: string }>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error?: string; requiresEmailVerification?: boolean }>;
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
        return { error: result.error || 'Login fallito', code: result.code };
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

      if (!result.success || !result.data) {
        set({ isLoading: false });
        return { error: result.error || 'Registrazione fallita' };
      }

      // Con email verification attiva (production), Supabase non ritorna una
      // session: l'utente deve cliccare il link nell'email. Il backend ci
      // segnala questo via `requiresEmailVerification`. Se invece la session
      // arriva subito (dev / auto-confirm), facciamo set diretto del user.
      if (result.data.requiresEmailVerification) {
        set({ isLoading: false });
        return { requiresEmailVerification: true };
      }

      set({ user: result.data.user, isLoading: false });
      return { requiresEmailVerification: false };
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

/**
 * CHI ha incontrato l'errore — l'id e nient'altro.
 *
 * È una SOTTOSCRIZIONE allo stato, non una chiamata nei quattro punti che
 * scrivono `user` (ripristino sessione, login, registrazione, logout): qualunque
 * strada porti a un cambio di utente passa di qua, comprese quelle che verranno
 * aggiunte dopo. Quattro chiamate sparse sarebbero quattro occasioni perché la
 * quinta se ne dimentichi.
 *
 * Senza questo, la regola «dell'utente resta solo l'id» in `lib/sentry-privacy`
 * non ha mai un id da tenere. Il confronto con l'ultimo valore evita di
 * riscrivere lo scope a ogni cambio di `isLoading`.
 */
let lastSentryUserId: string | null = null;
useAuthStore.subscribe((state) => {
  const id = state.user?.id ?? null;
  if (id === lastSentryUserId) return;
  lastSentryUserId = id;
  Sentry.setUser(id ? { id } : null);
});
