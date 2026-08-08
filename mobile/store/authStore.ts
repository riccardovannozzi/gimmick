import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, setTokens, setOnAuthFailed, setOnTokensRefreshed } from '@/lib/api';

interface User {
  id: string;
  email: string;
  created_at?: string;
}

/** Rinnova un po' prima della scadenza: un token che muore fra 5 secondi è
 *  già inutile, e farlo scoprire alla prima richiesta costa un 401 di troppo. */
const EXPIRY_MARGIN_S = 60;

/** Logout in corso — vedi la guardia di rientranza in `signOut`. */
let signOutInFlight: Promise<void> | null = null;

/**
 * Attende la fine dell'idratazione da AsyncStorage, con un tetto di sicurezza:
 * se `persist` non notificasse mai, l'avvio non deve restare appeso — il velo
 * opaco del root layout resterebbe sopra tutto e servirebbe killare l'app.
 */
function waitForHydration(timeoutMs = 3000): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    let unsub: (() => void) | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub?.();
      resolve();
    };

    const timer = setTimeout(finish, timeoutMs);
    unsub = useAuthStore.persist.onFinishHydration(finish);
    // L'idratazione può essere finita fra il check e la sottoscrizione: in quel
    // caso il listener non scatterebbe mai e resteremmo fermi fino al timeout.
    if (useAuthStore.persist.hasHydrated()) finish();
  });
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

          // `persist` idrata da AsyncStorage in modo ASINCRONO, mentre questa
          // parte dal primo `useEffect` del root layout. Senza attendere, la
          // corsa la vinceva spesso l'effect: `get()` leggeva uno store ancora
          // vuoto, il rinnovo del token scaduto non partiva affatto e l'app
          // entrava con una sessione già morta.
          await waitForHydration();

          const state = get();

          // If we have tokens, set them in the API client
          if (state.accessToken && state.refreshToken) {
            setTokens({
              access_token: state.accessToken,
              refresh_token: state.refreshToken,
              expires_at: state.expiresAt || 0,
            });

            // Token scaduto → prova a rinnovarlo, ma NON sloggare se fallisce.
            // Offline il refresh fallisce SEMPRE: azzerare la sessione qui
            // chiuderebbe l'utente fuori dall'app (niente nemmeno cattura
            // offline). La sessione locale resta valida per lavorare offline; il
            // token si rinnova al ritorno online (401 → refresh in apiRequest) e
            // un refresh token davvero non valido farà logout al primo 401 online
            // via onAuthFailed → signOut.
            const now = Math.floor(Date.now() / 1000);
            if (!state.expiresAt || state.expiresAt - EXPIRY_MARGIN_S < now) {
              await get().refreshSession();
            }
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
        } finally {
          // Sempre, anche su eccezione: `isInitialized` è ciò che toglie il velo
          // opaco del root layout. Se restasse `false` l'app mostrerebbe uno
          // schermo cieco che intercetta pure i tocchi.
          set({ isInitialized: true, isLoading: false });
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

      // NB: `isLoading` NON viene toccato qui. È lo stato che la schermata di
      // login usa per disabilitare i campi: siccome il logout automatico
      // (onAuthFailed) precede di un istante la navigazione al login, la
      // schermata si apriva con email e password in sola lettura e il bottone
      // spento, finché la chiamata di rete non tornava. Al logout non c'è
      // nessuna form da bloccare.
      signOut: async () => {
        // Guardia di rientranza: a sessione morta le richieste in volo prendono
        // 401 tutte insieme e ognuna innescherebbe il suo logout.
        if (signOutInFlight) return signOutInFlight;

        signOutInFlight = (async () => {
          try {
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
            });
            signOutInFlight = null;
          }
        })();

        return signOutInFlight;
      },

      // I token nuovi NON vengono scritti qui: ci pensa `setOnTokensRefreshed`
      // in fondo a questo file, che è l'unico punto attraverso cui passano
      // TUTTI i rinnovi — sia questo esplicito sia quelli innescati dai 401.
      // Prima c'erano due strade e solo questa persisteva: bastava che il
      // rinnovo avvenisse per un 401 perché il token buono restasse in RAM.
      refreshSession: async () => {
        try {
          const { ok, authFailed } = await authApi.refreshSession();
          // Se il server ha rifiutato il refresh token, il client ha già
          // invocato `onAuthFailed` → `signOut`: la sessione è morta davvero e
          // l'app va al login subito, invece di entrare con un token scaduto e
          // scoprirlo alla prima richiesta (era il limbo in cui comparivano le
          // scritte «Session expired»).
          if (!ok && !authFailed) {
            // Solo irraggiungibile: teniamo la sessione locale per l'offline.
            console.warn('Refresh non riuscito: backend irraggiungibile');
          }
          return ok;
        } catch (error) {
          console.error('Error refreshing session:', error);
          return false;
        }
      },
    }),
    {
      name: 'gimmick-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync tokens to API module as soon as AsyncStorage rehydrates
        if (state?.accessToken && state?.refreshToken) {
          setTokens({
            access_token: state.accessToken,
            refresh_token: state.refreshToken,
            expires_at: state.expiresAt || 0,
          });
        }
      },
    }
  )
);

// ── Ponte api.ts ⇄ store ─────────────────────────────────────────────────────
//
// Registrati UNA VOLTA, a livello di modulo. Prima vivevano dentro
// `initialize()` e `onRehydrateStorage`, entrambi condizionati alla presenza di
// token GIÀ persistiti: dopo un login su installazione pulita non scattava
// nessuno dei due, `onAuthFailed` restava `null` e a sessione morta l'app non
// tornava mai al login — mostrava «Session expired» su ogni schermata finché
// non la si chiudeva a mano.

setOnAuthFailed(() => {
  void useAuthStore.getState().signOut();
});

// Il rinnovo che avviene sul giro dei 401 aggiornava SOLO le variabili di
// modulo di api.ts. Qui lo riportiamo nello store, che lo persiste: senza
// questo, al riavvio si ripescava da AsyncStorage il refresh token che Supabase
// aveva già ruotato — invalido — e la sessione moriva a ogni riapertura.
setOnTokensRefreshed((tokens) => {
  useAuthStore.setState({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at ?? null,
  });
});

// Selectors
export const selectIsAuthenticated = (state: AuthState) => !!state.accessToken;
export const selectUserId = (state: AuthState) => state.user?.id;
