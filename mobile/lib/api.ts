import type {
  Spark,
  SparkType,
  BufferItem,
  ActionType,
  Tile,
  Tag,
  Subtask,
  Contact,
  ContactKind,
} from '@/types';
import Constants from 'expo-constants';
import { useConnectivityStore } from '@/store/connectivityStore';

const PRODUCTION_API_URL = 'https://gimmick-backend-production.up.railway.app';

function getApiUrl(): string {
  // Override manuale da .env (ha sempre priorità)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (__DEV__) {
    // In sviluppo: usa l'IP locale di Expo automaticamente
    const debuggerHost = Constants.expoConfig?.hostUri;
    const host = debuggerHost?.split(':')[0];
    if (host) {
      return `http://${host}:5000`;
    }
    return 'http://localhost:5000';
  }

  // In produzione: usa Railway
  return PRODUCTION_API_URL;
}

const API_URL = getApiUrl();

/** Base URL risolto del backend — usato dal ping di raggiungibilità (/health). */
export function apiBaseUrl(): string {
  return API_URL;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  /** Codice applicativo del backend (es. `EMAIL_NOT_CONFIRMED`) quando c'è. */
  code?: string;
}

/** Esportata: l'aggiornamento ottimistico deve riscrivere la cache di `tilesApi.list`
 *  e per farlo deve conoscerne la forma. */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

// Token refresh state
let isRefreshing = false;
let refreshSubscribers: ((result: RefreshResult) => void)[] = [];
let onAuthFailedCallback: (() => void) | null = null;
let onTokensRefreshedCallback: ((tokens: AuthTokens) => void) | null = null;

/**
 * Timeout di rete. React Native NON ne applica uno di default su Android
 * (OkHttp è configurato con read/write timeout a 0 = infinito): senza questo
 * una fetch appesa non si risolve MAI. Sul giro di refresh era fatale — vedi
 * `handleTokenRefresh`.
 */
const REQUEST_TIMEOUT_MS = 20_000;
/** Il refresh è nel cammino critico dell'avvio: deve fallire in fretta. */
const REFRESH_TIMEOUT_MS = 15_000;
/** Gli upload viaggiano su `authenticatedFetch` e possono durare parecchio. */
const UPLOAD_TIMEOUT_MS = 120_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.message === 'Aborted');
}

/**
 * Register callback for when auth fails completely (refresh token invalid)
 */
export function setOnAuthFailed(cb: () => void) {
  onAuthFailedCallback = cb;
}

/**
 * Avvisa che il server ha emesso una NUOVA coppia di token.
 *
 * Senza questo aggancio il rinnovo restava confinato alle variabili di modulo
 * qui sotto: lo store (e quindi AsyncStorage) conservava la coppia originale.
 * Siccome Supabase RUOTA il refresh token a ogni rinnovo, al riavvio l'app
 * ripescava da disco un refresh token già consumato → «Session expired» e
 * logout forzato a ogni sessione durata più di un'ora.
 */
export function setOnTokensRefreshed(cb: (tokens: AuthTokens) => void) {
  onTokensRefreshedCallback = cb;
}

/**
 * Set authentication tokens
 *
 * Scrive SOLO le variabili di modulo: è la direzione store → client, usata da
 * chi i token li ha già persistiti per conto suo. Per i token che arrivano dal
 * server usa `applyTokens`, che notifica anche lo store.
 */
export function setTokens(tokens: AuthTokens | null) {
  if (tokens) {
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
  } else {
    accessToken = null;
    refreshToken = null;
  }
}

/** Token freschi dal server: aggiorna il client E lo store che li persiste. */
function applyTokens(tokens: AuthTokens) {
  setTokens(tokens);
  onTokensRefreshedCallback?.(tokens);
}

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

interface RefreshResult {
  token: string | null;
  /**
   * `true` solo se il server ha RIFIUTATO il refresh token: la sessione è
   * davvero morta. Un errore di rete o un 5xx lasciano `false` — prima
   * qualunque fallimento sloggava, quindi bastava un tunnel per farsi buttare
   * fuori dall'app (e perdere la cattura offline).
   */
  authFailed: boolean;
}

/**
 * Try to refresh the access token
 */
async function tryRefreshToken(): Promise<RefreshResult> {
  if (!refreshToken) return { token: null, authFailed: true };

  try {
    const response = await fetchWithTimeout(
      `${API_URL}/api/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      REFRESH_TIMEOUT_MS
    );

    // Backend in difficoltà, non sessione scaduta: non toccare i token.
    if (response.status >= 500) return { token: null, authFailed: false };

    const data = await response.json().catch(() => null);

    if (response.ok && data?.success && data?.data?.session) {
      applyTokens(data.data.session);
      return { token: accessToken, authFailed: false };
    }

    // 400/401 da /auth/refresh: il refresh token non è più valido.
    return { token: null, authFailed: true };
  } catch {
    // Rete assente o timeout: la sessione non è scaduta, è irraggiungibile.
    return { token: null, authFailed: false };
  }
}

/**
 * Handle 401: queue concurrent requests, refresh once, retry all
 */
async function handleTokenRefresh(): Promise<RefreshResult> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push(resolve);
    });
  }

  isRefreshing = true;
  let result: RefreshResult = { token: null, authFailed: false };
  try {
    result = await tryRefreshToken();
  } finally {
    // `finally`, non la coda di una `.then`: se `tryRefreshToken` lanciasse,
    // `isRefreshing` resterebbe `true` per sempre e OGNI 401 successivo si
    // accoderebbe in `refreshSubscribers` senza risolversi mai — l'app si
    // piantava e serviva chiuderla.
    isRefreshing = false;
    const waiting = refreshSubscribers;
    refreshSubscribers = [];
    waiting.forEach((cb) => cb(result));
  }

  // Fuori dalla sezione critica: il logout che ne consegue farà altre
  // richieste, e le deve trovare con `isRefreshing` già a `false`.
  if (result.authFailed) notifyAuthFailed();

  return result;
}

/** Sessione morta: butta i token e avvisa lo store una volta sola. */
function notifyAuthFailed() {
  setTokens(null);
  onAuthFailedCallback?.();
}

/**
 * Make authenticated API request (with auto-refresh on 401)
 */
interface RequestOpts {
  /**
   * Salta il giro di refresh sul 401. Serve al logout: il suo token è già
   * morto per definizione, e lasciarlo passare di qui lo farebbe rimbalzare in
   * `notifyAuthFailed` → `signOut` → logout → 401 → ricorsione.
   */
  skipAuthRefresh?: boolean;
  timeoutMs?: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  opts: RequestOpts = {}
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;

  try {
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, { ...options, headers }, timeoutMs);

    // Il server ha risposto (a qualunque status) → siamo online.
    useConnectivityStore.getState().setOnline(true);

    // On 401, try refreshing token and retry once
    if (
      response.status === 401 &&
      !opts.skipAuthRefresh &&
      !endpoint.includes('/auth/refresh')
    ) {
      const refreshed = await handleTokenRefresh();
      if (refreshed.token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${refreshed.token}`;
        const retryResponse = await fetchWithTimeout(
          `${API_URL}${endpoint}`,
          { ...options, headers },
          timeoutMs
        );
        const retryData = await retryResponse.json().catch(() => null);
        if (!retryResponse.ok) {
          return { success: false, error: retryData?.error || `HTTP ${retryResponse.status}` };
        }
        return retryData;
      }
      // «Session expired» SOLO se il server ha rifiutato il refresh token.
      // Un timeout o un backend giù non sono una sessione scaduta, e dirlo
      // all'utente lo mandava a rifare un login di cui non aveva bisogno.
      return refreshed.authFailed
        ? { success: false, error: 'Session expired' }
        : { success: false, error: 'Backend non raggiungibile' };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        code: data.code,
      };
    }

    return data;
  } catch (error) {
    // Fetch ha lanciato → rete assente/irraggiungibile: segnala offline.
    useConnectivityStore.getState().setOnline(false);
    if (isAbort(error)) {
      return { success: false, error: 'Timeout di rete' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Authenticated fetch with auto-refresh on 401 (for direct fetch calls)
 */
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = UPLOAD_TIMEOUT_MS
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetchWithTimeout(`${API_URL}${endpoint}`, { ...options, headers }, timeoutMs);

  if (response.status === 401) {
    const refreshed = await handleTokenRefresh();
    if (refreshed.token) {
      headers['Authorization'] = `Bearer ${refreshed.token}`;
      return fetchWithTimeout(`${API_URL}${endpoint}`, { ...options, headers }, timeoutMs);
    }
  }

  return response;
}

// ============ Auth API ============

/**
 * Traduce l'esito di un signin fallito. Il backend distingue i due casi con
 * `code` ([backend] routes/auth.ts): affidarsi al testo di Supabase
 * significherebbe dipendere da una stringa inglese che loro possono cambiare.
 */
function signInErrorMessage(result: ApiResponse<unknown>): string {
  if (result.code === 'EMAIL_NOT_CONFIRMED') {
    return 'Email non ancora confermata: controlla la posta.';
  }
  if (result.code === 'INVALID_CREDENTIALS') {
    return 'Email o password non corretti.';
  }
  return result.error || 'Accesso non riuscito';
}

export const authApi = {
  async signUp(email: string, password: string) {
    return apiRequest<{ user: { id: string; email: string } }>(
      '/api/auth/signup',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
  },

  async signIn(email: string, password: string) {
    // `skipAuthRefresh` è obbligatorio qui: il signin risponde 401 quando le
    // credenziali sono sbagliate: è una RISPOSTA, non una sessione scaduta.
    // Senza, il 401 finiva nel giro di refresh, che non ha nulla da rinnovare
    // (siamo sloggati) e sostituiva il messaggio vero con «Session expired» —
    // così ogni password sbagliata sembrava un problema di sessione.
    const result = await apiRequest<{
      user: { id: string; email: string };
      session: AuthTokens;
    }>(
      '/api/auth/signin',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      { skipAuthRefresh: true }
    );

    if (result.success && result.data?.session) {
      setTokens(result.data.session);
      return result;
    }

    // Supabase parla inglese, la schermata di login è in italiano.
    return { ...result, error: signInErrorMessage(result) };
  },

  async signOut() {
    // Senza token non c'è niente da invalidare lato server, e chiamare
    // comunque prenderebbe un 401 inutile. `skipAuthRefresh` chiude il cerchio:
    // il 401 di un logout non deve innescare un refresh né un altro logout.
    const result = accessToken
      ? await apiRequest('/api/auth/signout', { method: 'POST' }, { skipAuthRefresh: true })
      : { success: true };
    setTokens(null);
    return result;
  },

  /**
   * Rinnovo esplicito (avvio app). Passa dallo STESSO single-flight del giro
   * dei 401 invece di duplicarlo: condivide la coda, i token e soprattutto la
   * semantica di `authFailed` — «il server ha rifiutato il refresh token»
   * contro «non sono riuscito a raggiungerlo». Nel primo caso `notifyAuthFailed`
   * porta dritti al login; nel secondo la sessione locale resta in piedi, che è
   * quel che serve per lavorare offline.
   */
  async refreshSession(): Promise<{ ok: boolean; authFailed: boolean }> {
    const result = await handleTokenRefresh();
    return { ok: !!result.token, authFailed: result.authFailed };
  },

  /** Invia il link di reset. Il backend risponde sempre 200 (anti-enumeration). */
  async forgotPassword(email: string) {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async getMe() {
    return apiRequest<{ user: { id: string; email: string; created_at: string } }>(
      '/api/auth/me'
    );
  },
};

// ============ Sparks API ============

export const sparksApi = {
  async list(options?: { page?: number; limit?: number; type?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.type) params.set('type', options.type);

    const query = params.toString();
    const endpoint = `/api/sparks${query ? `?${query}` : ''}`;

    const response = await authenticatedFetch(endpoint);

    return response.json() as Promise<PaginatedResponse<Spark>>;
  },

  async get(id: string) {
    return apiRequest<Spark>(`/api/sparks/${id}`);
  },

  /**
   * Ricerca semantica sugli spark (embedding, non parole chiave): l'endpoint
   * genera l'embedding della query e chiama `match_sparks`. Le righe portano il
   * `tile_id`, così i risultati si possono riportare sui tile.
   */
  async search(q: string, limit = 30) {
    const params = new URLSearchParams({ q, limit: String(limit) });
    return apiRequest<(Spark & { similarity?: number })[]>(`/api/sparks/search?${params.toString()}`);
  },

  async create(spark: Partial<Spark>) {
    return apiRequest<Spark>('/api/sparks', {
      method: 'POST',
      body: JSON.stringify(spark),
    });
  },

  async createBatch(items: Partial<Spark>[], tileId?: string) {
    return apiRequest<Spark[]>('/api/sparks/batch', {
      method: 'POST',
      body: JSON.stringify({ items, tile_id: tileId }),
    });
  },

  async update(id: string, updates: Partial<Spark>) {
    return apiRequest<Spark>(`/api/sparks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/sparks/${id}`, { method: 'DELETE' });
  },
};

// ============ Tiles API ============

export const tilesApi = {
  /**
   * `action_type` filtra lato server. Senza filtro il tetto di 100 è spartito
   * fra TUTTI i tipi in ordine di creazione: con la grande maggioranza dei tile
   * che sono eventi, una lista di soli flow risulterebbe quasi vuota pur
   * avendone. Col filtro il tetto vale per tipo. Stessa scelta del web
   * (frontend/components/views/chrono-live.tsx).
   */
  async list(options?: { page?: number; limit?: number; action_type?: ActionType }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.action_type) params.set('action_type', options.action_type);

    const query = params.toString();
    const endpoint = `/api/tiles${query ? `?${query}` : ''}`;

    const response = await authenticatedFetch(endpoint);

    return response.json() as Promise<PaginatedResponse<Tile>>;
  },

  async get(id: string) {
    return apiRequest<Tile & { sparks: Spark[] }>(`/api/tiles/${id}`);
  },

  async create(tile?: { title?: string }) {
    return apiRequest<Tile>('/api/tiles', {
      method: 'POST',
      body: JSON.stringify(tile || {}),
    });
  },

  async update(id: string, updates: { title?: string; action_type?: string; is_event?: boolean; all_day?: boolean; start_at?: string | null; end_at?: string | null; status_id?: string | null }) {
    return apiRequest<Tile>(`/api/tiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tiles/${id}`, { method: 'DELETE' });
  },
};

// ============ Statuses API ============

export interface StatusEntity {
  id: string;
  name: string;
  shape: string;
  action_type?: string | null;
  category?: string;
}

export const statusesApi = {
  async list() {
    return apiRequest<StatusEntity[]>('/api/statuses');
  },
};

// ============ Type icons API ============

export interface TypeIconEntity {
  id: string;
  name: string;
  icon: string;
  color?: string;
  sort_order: number;
}

export const typeIconsApi = {
  async list() {
    return apiRequest<TypeIconEntity[]>('/api/type-icons');
  },

  async getAssignments() {
    return apiRequest<{ tile_id: string; type_icon_id: string }[]>('/api/type-icons/assignments');
  },

  async assign(tile_id: string, type_icon_id: string | null) {
    return apiRequest('/api/type-icons/assign', {
      method: 'PUT',
      body: JSON.stringify({ tile_id, type_icon_id }),
    });
  },
};

// ============ Tags API ============

export const tagsApi = {
  async list() {
    return apiRequest<Tag[]>('/api/tags');
  },

  async tagTiles(tagId: string, tileIds: string[]) {
    return apiRequest(`/api/tags/${tagId}/tiles`, {
      method: 'POST',
      body: JSON.stringify({ tile_ids: tileIds }),
    });
  },

  async untagTile(tagId: string, tileId: string) {
    return apiRequest(`/api/tags/${tagId}/tiles/${tileId}`, { method: 'DELETE' });
  },
};

// ============ Tag Types API ============

export interface TagTypeEntity {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  color?: string | null;
  sort_order: number;
  is_default: boolean;
}

export const tagTypesApi = {
  async list() {
    return apiRequest<TagTypeEntity[]>('/api/tag-types');
  },
};

// ============ Calendar API ============

export const calendarApi = {
  /** Tiles with start_at falling inside [start, end). Optional tag filter. */
  async events(start: string, end: string, tagId?: string) {
    const params = new URLSearchParams({ start, end });
    if (tagId) params.set('tag_id', tagId);
    return apiRequest<Tile[]>(`/api/calendar/events?${params}`);
  },
  async createEvent(data: { title?: string; start_at?: string; end_at?: string }) {
    return apiRequest<Tile>('/api/calendar/create-event', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async schedule(data: {
    tile_id: string;
    start_at?: string;
    end_at?: string;
    title?: string;
    auto_detect?: boolean;
  }) {
    return apiRequest<Tile>('/api/calendar/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async reschedule(id: string, start_at: string, end_at?: string) {
    return apiRequest<Tile>(`/api/calendar/events/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ start_at, end_at }),
    });
  },
  async updateEvent(
    id: string,
    updates: {
      title?: string;
      start_at?: string;
      end_at?: string;
      action_type?: string;
      all_day?: boolean;
    },
  ) {
    return apiRequest<Tile>(`/api/calendar/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async unschedule(id: string) {
    return apiRequest(`/api/calendar/events/${id}/unschedule`, {
      method: 'DELETE',
    });
  },
};

// ============ Contacts API ============

export const contactsApi = {
  async list(opts?: { archived?: boolean }) {
    const q = opts?.archived ? '?archived=true' : '';
    return apiRequest<Contact[]>(`/api/contacts${q}`);
  },
  async create(body: {
    name: string;
    kind?: ContactKind;
    phone?: string;
    email?: string;
    notes?: string;
    color?: string;
    avatar_url?: string;
  }) {
    return apiRequest<Contact>('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  async update(id: string, updates: Partial<Pick<Contact, 'name' | 'kind' | 'phone' | 'email' | 'notes' | 'color' | 'avatar_url'>>) {
    return apiRequest<Contact>(`/api/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async remove(id: string) {
    return apiRequest(`/api/contacts/${id}`, { method: 'DELETE' });
  },
  async archive(id: string) {
    return apiRequest<Contact>(`/api/contacts/${id}/archive`, { method: 'POST' });
  },
};

// ============ Subtasks API ============
//
// I PASSI DI UN FLOW PASSANO DA QUI. Un flow non ha più un'API sua: è un tile
// con `action_type = 'flow'`, e i suoi passi sono le voci di questa checklist —
// la stessa che ogni tile ha già. `flowApi` (`/api/tiles/:id/flow`,
// `/api/flow/nodes/*`, `/api/flows/hub`) è stato eliminato perché il backend
// non espone più quelle rotte: chiamarle tornava 404.

export const subtasksApi = {
  async list(tileId: string) {
    return apiRequest<Subtask[]>(`/api/subtasks?tile_id=${encodeURIComponent(tileId)}`);
  },
  async create(data: { tile_id: string; content?: string; is_done?: boolean }) {
    return apiRequest<Subtask>('/api/subtasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /**
   * `contact_id` / `occurred_at` / `state` sono i campi dei passi di un flow
   * (migration 037/038). `null` è un valore legittimo — significa "togli il
   * contatto / la data / lo stato eccezionale" — quindi il tipo li ammette
   * esplicitamente invece di limitarsi a renderli opzionali.
   */
  async update(
    id: string,
    updates: {
      content?: string;
      is_done?: boolean;
      sort_order?: number;
      contact_id?: string | null;
      occurred_at?: string | null;
      state?: 'blocked' | 'cancelled' | null;
    },
  ) {
    return apiRequest<Subtask>(`/api/subtasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async delete(id: string) {
    return apiRequest(`/api/subtasks/${id}`, { method: 'DELETE' });
  },
  async reorder(items: { id: string; sort_order: number }[]) {
    return apiRequest('/api/subtasks/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },
};

// ============ Chat API ============

/**
 * Tile che la chat ha trovato, con abbastanza dati per DISEGNARLA.
 *
 * Il backend le mandava già come soli id (`foundTileIds`, che il web usa per i
 * link) e il mobile le ignorava del tutto. Con le righe intere la risposta può
 * essere un elenco di card vere invece di un elenco puntato dentro il testo.
 * `end_at`/`all_day` non li porta ogni tool: la card deve reggere senza.
 */
export interface ChatTile {
  id: string;
  title: string | null;
  description: string | null;
  action_type: string | null;
  start_at: string | null;
  end_at?: string | null;
  all_day?: boolean | null;
  is_completed?: boolean | null;
  is_cta?: boolean | null;
}

export interface ChatReply {
  reply: string;
  foundTileIds?: string[];
  foundSparkIds?: string[];
  foundTiles?: ChatTile[];
}

export const chatApi = {
  async send(
    message: string,
    history: { role: string; content: string }[],
    model?: string
  ) {
    return apiRequest<ChatReply>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, model }),
    });
  },

  /**
   * Messaggio con un allegato: il file viaggia NELLA STESSA richiesta e Claude
   * lo legge insieme alla domanda. Multipart come `voiceSend` — `/api/chat`
   * accetta solo JSON, quindi l'allegato ha una rotta propria.
   *
   * `type` è quello che l'API si aspetta per riconoscere il formato: il backend
   * ci decide se mandarlo come immagine, come PDF o come testo estratto.
   */
  async sendWithFile(
    message: string,
    file: { uri: string; name: string; type: string },
    history: { role: string; content: string }[],
    model?: string
  ): Promise<{ success: boolean; data?: ChatReply; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
      formData.append('message', message);
      formData.append('history', JSON.stringify(history));
      if (model) formData.append('model', model);

      const response = await authenticatedFetch('/api/chat/attach', {
        method: 'POST',
        body: formData,
      });

      return response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invio allegato non riuscito',
      };
    }
  },

  async voiceSend(
    audioUri: string,
    history: { role: string; content: string }[],
    model?: string
  ): Promise<{ success: boolean; data?: { transcript: string; reply: string }; error?: string }> {
    try {
      const fileName = audioUri.split('/').pop() || 'audio.m4a';

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        name: fileName,
        type: 'audio/mp4',
      } as unknown as Blob);
      formData.append('history', JSON.stringify(history));
      if (model) formData.append('model', model);

      const response = await authenticatedFetch('/api/chat/voice', {
        method: 'POST',
        body: formData,
      });

      return response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Voice chat failed',
      };
    }
  },
};

// ============ Upload API ============

export const uploadApi = {
  async uploadFile(
    uri: string,
    folder: string = 'files'
  ): Promise<ApiResponse<{
    path: string;
    url: string;
    file_name: string;
    mime_type: string;
    file_size: number;
  }>> {
    try {
      const formData = new FormData();

      // Get file info from URI
      const fileName = uri.split('/').pop() || 'file';
      const fileType = getFileType(fileName);

      formData.append('file', {
        uri,
        name: fileName,
        type: fileType,
      } as unknown as Blob);
      formData.append('folder', folder);

      const response = await authenticatedFetch('/api/upload/file', {
        method: 'POST',
        body: formData,
      });

      return response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  },

  async deleteFile(path: string) {
    return apiRequest('/api/upload/file', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    });
  },

  async getSignedUrl(path: string) {
    return apiRequest<{ url: string; expires_in: number }>(
      `/api/upload/signed-url?path=${encodeURIComponent(path)}`
    );
  },

  /** Firma più file in una richiesta sola. Vedi `getSignedUrls` in lib/storage. */
  async getSignedUrls(paths: string[]) {
    return apiRequest<{ urls: Record<string, string>; expires_in: number }>(
      '/api/upload/signed-urls',
      { method: 'POST', body: JSON.stringify({ paths }) },
    );
  },
};

// ============ Settings API ============
export const settingsApi = {
  async get<T = unknown>(key: string): Promise<ApiResponse<T>> {
    return apiRequest<T>(`/api/settings/${key}`);
  },

  async set(key: string, value: unknown): Promise<ApiResponse> {
    return apiRequest(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },
};

/**
 * Helper to get MIME type from filename
 */
function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    // Videos
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Upload buffer items to backend
 * When multiple items are uploaded together, they are grouped into a Tile
 */
/**
 * Create a spark directly against a specific tile, handling the storage
 * upload for non-text types. Used by the capture screens when they receive a
 * `?tile=<id>` query param: instead of dropping the item in the buffer (which
 * later spawns a NEW tile on upload), the spark is attached to the originating
 * tile immediately.
 *
 * Returns the same ApiResponse shape as sparksApi.create.
 */
export async function createSparkForTile(args: {
  type: SparkType;
  tileId: string;
  uri?: string;
  content?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  duration?: number;
}): Promise<ApiResponse<Spark>> {
  let storagePath: string | undefined;
  if (args.type !== 'text' && args.uri) {
    const folder = args.type === 'photo' || args.type === 'image'
      ? 'images'
      : args.type === 'video'
      ? 'videos'
      : args.type.includes('audio')
      ? 'audio'
      : 'files';
    const upload = await uploadApi.uploadFile(args.uri, folder);
    if (!upload.success) {
      return { success: false, error: upload.error || 'Upload failed' };
    }
    storagePath = upload.data?.path;
  }
  return sparksApi.create({
    type: args.type,
    tile_id: args.tileId,
    content: args.content,
    storage_path: storagePath,
    file_name: args.fileName,
    mime_type: args.mimeType,
    file_size: args.size,
    duration: args.duration,
  });
}

export interface TileUploadOptions {
  action_type?: string;
  all_day?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  tag_id?: string | null;
  type_icon_id?: string | null;
  status_id?: string | null;
}

export async function uploadBufferItems(
  items: BufferItem[],
  tagIds?: string[],
  tileOptions?: TileUploadOptions,
): Promise<{ success: boolean; results: Spark[]; errors: string[]; tile?: Tile; uploadedIds: string[] }> {
  const results: Spark[] = [];
  const errors: string[] = [];
  // Id (buffer) degli item effettivamente caricati: l'outbox li rimuove dalla
  // coda in modo selettivo, così un invio parziale non ri-carica i già inviati.
  const uploadedIds: string[] = [];
  let tile: Tile | undefined;

  // If multiple items, create a tile first to group them
  if (items.length > 1) {
    const tileResult = await tilesApi.create();
    if (tileResult.success && tileResult.data) {
      tile = tileResult.data;
      // Tag the tile with selected tags
      if (tagIds && tagIds.length > 0) {
        for (const tagId of tagIds) {
          await tagsApi.tagTiles(tagId, [tile.id]).catch(() => {});
        }
      }
    } else {
      // Continue without tile if creation fails
      console.warn('Failed to create tile:', tileResult.error);
    }
  }

  for (const item of items) {
    try {
      let storagePath: string | undefined;
      let thumbnailPath: string | undefined;

      // Upload file if not text
      if (item.type !== 'text' && item.uri) {
        const folder = item.type === 'photo' || item.type === 'image'
          ? 'images'
          : item.type === 'video'
          ? 'videos'
          : item.type.includes('audio')
          ? 'audio'
          : 'files';

        const uploadResult = await uploadApi.uploadFile(item.uri, folder);

        if (!uploadResult.success) {
          errors.push(`Failed to upload ${item.fileName || item.id}: ${uploadResult.error}`);
          continue;
        }

        storagePath = uploadResult.data?.path;
      }

      // Create spark with tile_id if we have a tile
      const sparkResult = await sparksApi.create({
        type: item.type,
        tile_id: tile?.id,
        content: item.preview,
        storage_path: storagePath,
        thumbnail_path: thumbnailPath,
        file_name: item.fileName,
        mime_type: item.mimeType,
        file_size: item.size,
        duration: item.duration,
      });

      if (sparkResult.success && sparkResult.data) {
        results.push(sparkResult.data);
        uploadedIds.push(item.id);
      } else {
        errors.push(`Failed to create spark: ${sparkResult.error}`);
      }
    } catch (error) {
      errors.push(
        `Error processing ${item.fileName || item.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // For single item uploads, tag the auto-created tile
  if (!tile && tagIds && tagIds.length > 0 && results.length > 0 && results[0].tile_id) {
    for (const tagId of tagIds) {
      await tagsApi.tagTiles(tagId, [results[0].tile_id]).catch(() => {});
    }
  }

  // Apply tile-level metadata set via the "Set options" accordion. Works for
  // both branches (explicit tile created for multi-item uploads, and the
  // auto-created tile attached to a single spark).
  const targetTileId = tile?.id ?? (results.length > 0 ? results[0].tile_id : undefined);
  if (targetTileId && tileOptions) {
    const updates: Parameters<typeof tilesApi.update>[1] = {};
    if (tileOptions.action_type) updates.action_type = tileOptions.action_type;
    // I due rami sono "con tempo" e "tutto il resto", e l'ELSE è quello senza
    // condizione: prima erano due elenchi di tipi, e un tipo nuovo — `flow` —
    // sarebbe caduto fuori da entrambi, lasciando date ed `is_event` a quello
    // che erano invece di azzerarli. Scritto così, un settimo tipo eredita da
    // sé il comportamento giusto: senza tempo finché qualcuno non lo aggiunge
    // qui sopra di proposito.
    if (tileOptions.action_type === 'event' || tileOptions.action_type === 'deadline') {
      updates.is_event = tileOptions.action_type === 'event';
      updates.all_day = !!tileOptions.all_day;
      updates.start_at = tileOptions.start_at ?? null;
      updates.end_at = tileOptions.end_at ?? null;
    } else if (tileOptions.action_type) {
      updates.is_event = false;
      updates.all_day = false;
      updates.start_at = null;
      updates.end_at = null;
    }
    if (tileOptions.status_id !== undefined) updates.status_id = tileOptions.status_id;
    if (Object.keys(updates).length > 0) {
      await tilesApi.update(targetTileId, updates).catch((err) => {
        console.warn('Failed to apply tile options:', err);
      });
    }
    if (tileOptions.type_icon_id !== undefined) {
      await typeIconsApi.assign(targetTileId, tileOptions.type_icon_id).catch((err) => {
        console.warn('Failed to assign type icon:', err);
      });
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    tile,
    uploadedIds,
  };
}
