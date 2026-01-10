import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, setTokens } from '@/lib/api';

interface User {
  id: string;
  email: string;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isLoading: true,
      isInitialized: false,

      initialize: async () => {
        try {
          set({ isLoading: true });

          const state = get();

          // If we have tokens, set them in the API client
          if (state.accessToken && state.refreshToken) {
            setTokens({
              access_token: state.accessToken,
              refresh_token: state.refreshToken,
              expires_at: state.expiresAt || 0,
            });

            // Check if token is expired
            const now = Math.floor(Date.now() / 1000);
            if (state.expiresAt && state.expiresAt < now) {
              // Try to refresh
              const refreshed = await get().refreshSession();
              if (!refreshed) {
                // Refresh failed, clear auth
                set({
                  user: null,
                  accessToken: null,
                  refreshToken: null,
                  expiresAt: null,
                });
              }
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

          const { user, session } = result.data;

          set({
            user,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
            isLoading: false,
          });

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

          // After signup, user needs to sign in
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
          setTokens(null);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
          });
        }
      },

      refreshSession: async () => {
        try {
          const result = await authApi.refreshSession();

          if (!result.success || !result.data) {
            return false;
          }

          const { session } = result.data;

          set({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
          });

          return true;
        } catch (error) {
          console.error('Error refreshing session:', error);
          return false;
        }
      },
    }),
    {
      name: 'moca-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
    }
  )
);

// Selectors
export const selectIsAuthenticated = (state: AuthState) => !!state.accessToken;
export const selectUserId = (state: AuthState) => state.user?.id;
