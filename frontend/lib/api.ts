import type { Spark, Tile, Tag, TagGraph, TagNode, ApiResponse, PaginatedResponse, AuthTokens, User, ActionType, TagTypeEntity, Status, Subtask, KanbanColumn, KanbanLane, KanbanFilter, KanbanSortBy, KanbanSortDir } from '@/types';
import type { Contact, ContactKind } from '@/types/contact';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// Token management
export function setTokens(tokens: AuthTokens | null) {
  if (tokens) {
    accessToken = tokens.access_token;
    refreshToken = tokens.refresh_token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      localStorage.setItem('expires_at', tokens.expires_at.toString());
    }
  } else {
    accessToken = null;
    refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('expires_at');
    }
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('access_token');
    refreshToken = localStorage.getItem('refresh_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

// API request helper.
//
// Refresh single-flight: quando l'access token è scaduto e la dashboard monta
// sparando molte query insieme (tags, tiles-calendar, tile-detail, statuses,
// tag-types…), ricevono TUTTE un 401 in contemporanea. Con un semplice flag
// booleano solo la prima richiesta rinfrescava il token e riprovava, mentre le
// altre vedevano "refresh in corso" e fallivano subito con 401 senza riprovare
// → l'Inspector (tile-detail) spesso perdeva la corsa e restava vuoto finché
// non si ricaricava la pagina. Ora le richieste concorrenti CONDIVIDONO lo
// stesso refresh e, al termine, riprovano tutte.
let refreshPromise: Promise<boolean> | null = null;

function refreshTokenOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refreshSession()
      .then((r) => r.success)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  _retry = false
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Auto-refresh token on 401. Escludiamo l'endpoint di refresh stesso per
      // evitare ricorsione (un 401 sul refresh significa refresh token scaduto).
      const isRefreshCall = endpoint === '/api/auth/refresh';
      if (response.status === 401 && !_retry && refreshToken && !isRefreshCall) {
        const ok = await refreshTokenOnce();
        if (ok) {
          return apiRequest<T>(endpoint, options, true);
        }
      }

      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
        code: data.code,
      };
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============ Auth API ============
export const authApi = {
  /**
   * Signup. In production Supabase email-verification è attiva e la response
   * arriva senza session: `requiresEmailVerification: true`. L'UI deve
   * mandare l'utente a /auth/verify-email. In dev (auto-confirm) torna
   * direttamente con session valida.
   */
  async signUp(email: string, password: string) {
    const result = await apiRequest<{
      user: User;
      session: AuthTokens | null;
      requiresEmailVerification: boolean;
    }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Se Supabase ha auto-confirm e arriva subito una session, salviamo i token.
    if (result.success && result.data?.session) {
      setTokens(result.data.session);
    }
    return result;
  },

  async signIn(email: string, password: string) {
    const result = await apiRequest<{ user: User; session: AuthTokens }>(
      '/api/auth/signin',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );

    if (result.success && result.data?.session) {
      setTokens(result.data.session);
    }

    return result;
  },

  async signOut() {
    const result = await apiRequest('/api/auth/signout', { method: 'POST' });
    setTokens(null);
    return result;
  },

  async refreshSession() {
    if (!refreshToken) {
      return { success: false, error: 'No refresh token' };
    }

    const result = await apiRequest<{ session: AuthTokens }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (result.success && result.data?.session) {
      setTokens(result.data.session);
    }

    return result;
  },

  async getMe() {
    return apiRequest<{ user: User }>('/api/auth/me');
  },

  // ── Nuovi metodi per email-verify / password-reset / account-delete ─────

  /** Conferma un token_hash ricevuto dal link nell'email (signup o recovery).
   *  Su success il backend ritorna una session valida che salviamo subito. */
  async confirmSignup(token_hash: string, type: 'signup' | 'recovery' | 'email_change') {
    const result = await apiRequest<{
      user: User;
      session: AuthTokens;
      type: typeof type;
    }>('/api/auth/confirm', {
      method: 'POST',
      body: JSON.stringify({ token_hash, type }),
    });
    if (result.success && result.data?.session) {
      setTokens(result.data.session);
    }
    return result;
  },

  /** Rinvia l'email di verifica signup. Sempre 200 (no enumeration). */
  async resendVerification(email: string) {
    return apiRequest('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** Invia email per reset password. Sempre 200 (no enumeration). */
  async forgotPassword(email: string) {
    return apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** Aggiorna la password usando l'access_token recuperato via /confirm
   *  con type=recovery (il flow è confirm → resetPassword). */
  async resetPassword(access_token: string, new_password: string) {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ access_token, new_password }),
    });
  },

  /** Elimina l'account corrente (richiede password come re-conferma).
   *  Su success svuota anche i token locali. */
  async deleteAccount(password: string) {
    const result = await apiRequest('/api/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
    if (result.success) setTokens(null);
    return result;
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

    return apiRequest<PaginatedResponse<Spark>>(endpoint) as unknown as Promise<PaginatedResponse<Spark>>;
  },

  async stats() {
    return apiRequest<{ counts: Record<string, number>; total: number; totalSize: number; dateCounts: Record<string, number> }>('/api/sparks/stats');
  },

  async get(id: string) {
    return apiRequest<Spark>(`/api/sparks/${id}`);
  },

  async create(spark: Partial<Spark>) {
    return apiRequest<Spark>('/api/sparks', {
      method: 'POST',
      body: JSON.stringify(spark),
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
  /** `action_type` filtra lato server: il tetto di 100 vale allora PER TIPO
   *  invece che spartito fra tutti. Con 393 eventi su 585 tile è la differenza
   *  fra una colonna piena e una colonna vuota. */
  async list(options?: { page?: number; limit?: number; action_type?: ActionType }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.action_type) params.set('action_type', options.action_type);

    const query = params.toString();
    const endpoint = `/api/tiles${query ? `?${query}` : ''}`;

    return apiRequest<PaginatedResponse<Tile>>(endpoint) as unknown as Promise<PaginatedResponse<Tile>>;
  },

  async get(id: string) {
    return apiRequest<Tile & { sparks: Spark[] }>(`/api/tiles/${id}`);
  },

  async graph() {
    return apiRequest<{
      tiles: { id: string; title?: string; created_at: string; action_type?: ActionType }[];
      sparks: { id: string; tile_id?: string; type: string; label: string; tags: string[]; summary?: string; created_at: string }[];
      tags: { id: string; name: string; created_at: string; tile_ids: string[] }[];
    }>('/api/tiles/graph');
  },

  async create(tile?: { title?: string }) {
    return apiRequest<Tile>('/api/tiles', {
      method: 'POST',
      body: JSON.stringify(tile || {}),
    });
  },

  async update(id: string, updates: { title?: string; action_type?: ActionType; is_event?: boolean; all_day?: boolean; start_at?: string | null; end_at?: string | null; is_completed?: boolean; is_cta?: boolean; is_focused?: boolean; status_id?: string | null; sort_order?: number }) {
    return apiRequest<Tile>(`/api/tiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tiles/${id}`, { method: 'DELETE' });
  },
};

// ============ Subtasks API ============
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
  async update(id: string, updates: { content?: string; is_done?: boolean; sort_order?: number; contact_id?: string | null; occurred_at?: string | null; state?: 'blocked' | 'cancelled' | null }) {
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

// ============ AI API ============
export const aiApi = {
  /** Riscrive un testo (o porzione) secondo un'istruzione. Ritorna il testo riscritto (Markdown). */
  async rewrite(text: string, instruction: string) {
    return apiRequest<{ result: string }>('/api/ai/rewrite', {
      method: 'POST',
      body: JSON.stringify({ text, instruction }),
    });
  },
};

// ============ Chat API ============

/**
 * Tile trovata dalla chat, con abbastanza colonne per DISEGNARLA.
 *
 * Il backend le manda già così (`ChatTileSummary` in services/ai.ts); il web
 * usava i soli `foundTileIds`, quindi una risposta poteva solo offrire un
 * filtro cumulativo — "Tile (4)" — e non mostrare QUALI. `end_at`/`all_day` non
 * li porta ogni tool: la card deve reggere senza.
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
  foundSparkIds?: string[];
  foundTileIds?: string[];
  /**
   * Sottoinsieme di `foundTileIds` per cui il backend ha i dati. Non coincide
   * sempre: un tile pescato dal `tile_id` di uno spark è noto solo per id.
   */
  foundTiles?: ChatTile[];
}

type ChatHistory = { role: 'user' | 'assistant'; content: string }[];

/**
 * POST multipart autenticata verso la chat. Le rotte `/attach` e `/voice` non
 * possono passare da `apiRequest`, che forza `Content-Type: application/json`:
 * su multipart serve che sia il browser a scrivere l'header, boundary incluso.
 * In cambio perdiamo il retry-su-401, quindi almeno l'errore va reso nella
 * stessa forma di `ApiResponse` — il backend risponde 400 con un motivo
 * leggibile (formato non supportato, file troppo grande) e il pannello lo mostra
 * così com'è.
 */
async function chatMultipart<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  loadTokens();
  const token = getAccessToken();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    // Un 413 del proxy o un 500 non gestito possono tornare HTML: senza questo
    // guscio il `json()` esploderebbe e l'utente vedrebbe "errore di rete".
    const data = await response.json().catch(() => null);
    if (!data) {
      return { success: false, error: `Errore del server (${response.status})` } as ApiResponse<T>;
    }
    return data as ApiResponse<T>;
  } catch {
    return { success: false, error: 'Errore di connessione.' } as ApiResponse<T>;
  }
}

export const chatApi = {
  async send(message: string, history: ChatHistory = []) {
    return apiRequest<ChatReply>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  /**
   * Messaggio con un allegato (immagine, PDF, Word, testo). Il file viaggia
   * NELLA STESSA richiesta della domanda: Claude lo legge insieme, e non resta
   * salvato da nessuna parte — è allegato alla conversazione, non catturato
   * come spark.
   */
  async sendWithFile(message: string, file: File, history: ChatHistory = []) {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('message', message);
    formData.append('history', JSON.stringify(history));
    return chatMultipart<ChatReply>('/api/chat/attach', formData);
  },

  async sendVoice(audioBlob: Blob, history: ChatHistory = []) {
    const formData = new FormData();
    // L'estensione deve rispecchiare il formato reale: Whisper sceglie il
    // decoder dal nome del file, e MediaRecorder produce webm su Chrome/Firefox
    // ma mp4 su Safari.
    const ext = audioBlob.type.includes('mp4') || audioBlob.type.includes('mpeg') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `audio.${ext}`);
    formData.append('history', JSON.stringify(history));
    return chatMultipart<ChatReply & { transcript: string }>('/api/chat/voice', formData);
  },

  async speak(text: string): Promise<HTMLAudioElement | null> {
    loadTokens();
    const token = getAccessToken();
    const response = await fetch(`${API_URL}/api/chat/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    return audio;
  },
};

// ============ Upload API ============
export const uploadApi = {
  async uploadFile(file: File, folder: string = 'files', bucket: 'sparks' | 'canvas-assets' = 'sparks') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('bucket', bucket);

    const response = await fetch(`${API_URL}/api/upload/file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    return response.json() as Promise<ApiResponse<{
      bucket: string;
      path: string;
      url: string;
      file_name: string;
      mime_type: string;
      file_size: number;
    }>>;
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
};

// ============ Tags API ============
export const tagsApi = {
  async list() {
    return apiRequest<Tag[]>('/api/tags');
  },

  async create(tag: { name: string; aliases?: string[]; tag_type?: string }) {
    return apiRequest<Tag>('/api/tags', {
      method: 'POST',
      body: JSON.stringify(tag),
    });
  },

  async update(id: string, updates: { name?: string; aliases?: string[]; tag_type?: string; is_pinned?: boolean; is_archived?: boolean }) {
    return apiRequest<Tag>(`/api/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tags/${id}`, { method: 'DELETE' });
  },

  async reorderPinned(ids: string[]) {
    return apiRequest('/api/tags/reorder-pinned', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
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

  async getTiles(tagId: string) {
    return apiRequest<Tile[]>(`/api/tags/${tagId}/tiles`);
  },

  async graph() {
    return apiRequest<TagGraph>('/api/tags/graph');
  },

  async getRelated(tagId: string, limit = 10) {
    return apiRequest<(TagNode & { weight: number })[]>(`/api/tags/${tagId}/related?limit=${limit}`);
  },

  async updateRelation(tagFrom: string, tagTo: string, weight: number, relationType?: string) {
    return apiRequest('/api/tags/relations', {
      method: 'PATCH',
      body: JSON.stringify({ tag_from: tagFrom, tag_to: tagTo, weight, relation_type: relationType }),
    });
  },

  async deleteRelation(tagFrom: string, tagTo: string) {
    return apiRequest('/api/tags/relations', {
      method: 'DELETE',
      body: JSON.stringify({ tag_from: tagFrom, tag_to: tagTo }),
    });
  },
};

// ============ Calendar API ============
export const calendarApi = {
  async events(start: string, end: string, tagId?: string) {
    const params = new URLSearchParams({ start, end });
    if (tagId) params.set('tag_id', tagId);
    return apiRequest<Tile[]>(`/api/calendar/events?${params}`);
  },

  async createEvent(data: {
    title?: string;
    start_at?: string;
    end_at?: string;
  }) {
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

  async updateEvent(id: string, updates: {
    title?: string;
    start_at?: string;
    end_at?: string;
    action_type?: string;
    all_day?: boolean;
  }) {
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

  async aiFilter(query: string, start?: string, end?: string) {
    return apiRequest<Tile[]>('/api/calendar/ai-filter', {
      method: 'POST',
      body: JSON.stringify({ query, start, end }),
    });
  },
};

// ============ Tag Types API ============
export const tagTypesApi = {
  async list() {
    return apiRequest<TagTypeEntity[]>('/api/tag-types');
  },

  async create(data: { name: string; emoji?: string; color?: string }) {
    return apiRequest<TagTypeEntity>('/api/tag-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, updates: { name?: string; emoji?: string; color?: string | null; sort_order?: number }) {
    return apiRequest<TagTypeEntity>(`/api/tag-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tag-types/${id}`, { method: 'DELETE' });
  },
};

// ============ Statuses API ============
// Custom statuses were removed in migration 029. Only the seeded system rows
// exist; the API surface is reduced to listing and updating the visual shape.
export const statusesApi = {
  async list() {
    return apiRequest<Status[]>('/api/statuses');
  },

  async update(id: string, updates: { shape: string }) {
    return apiRequest<Status>(`/api/statuses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

// ============ Settings API ============
export const settingsApi = {
  async get<T = unknown>(key: string) {
    return apiRequest<T>(`/api/settings/${key}`);
  },

  async set(key: string, value: unknown) {
    return apiRequest(`/api/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  },
};

// ============ Canvas API ============
export const canvasApi = {
  async getLayout(tagId: string) {
    return apiRequest<{ tile_id: string; x: number; y: number }[]>(`/api/canvas/layout/${tagId}`);
  },

  async saveLayout(tagId: string, positions: { tile_id: string; x: number; y: number }[]) {
    return apiRequest(`/api/canvas/layout/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify({ positions }),
    });
  },

  /** Remove a single tile's position entry — the tile goes back to the
   *  canvas-page staging panel. Used by drag canvas→staging and the
   *  "Rimuovi dal canvas" context-menu action. */
  async removeFromLayout(tagId: string, tileId: string) {
    return apiRequest(`/api/canvas/layout/${tagId}/${tileId}`, { method: 'DELETE' });
  },

  async getEdges(tagId: string) {
    return apiRequest<{ id: string; source_id: string; target_id: string; source_port?: string; target_port?: string; color?: string | null; line_style?: string | null; line_width?: number | null; label?: string | null }[]>(`/api/canvas/edges/${tagId}`);
  },

  async addEdge(tagId: string, source_id: string, target_id: string, source_port?: string, target_port?: string) {
    return apiRequest(`/api/canvas/edges/${tagId}`, {
      method: 'POST',
      body: JSON.stringify({ source_id, target_id, source_port, target_port }),
    });
  },

  async updateEdge(id: string, updates: { color?: string | null; line_style?: string | null; line_width?: number | null; label?: string | null }) {
    return apiRequest(`/api/canvas/edges/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteEdge(id: string) {
    return apiRequest(`/api/canvas/edges/${id}`, { method: 'DELETE' });
  },

  async getGroups(tagId: string) {
    return apiRequest<{ id: string; label: string; node_ids: string[] }[]>(`/api/canvas/groups/${tagId}`);
  },

  async saveGroups(tagId: string, groups: { id: string; label: string; node_ids: string[] }[]) {
    return apiRequest(`/api/canvas/groups/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify({ groups }),
    });
  },

  // ─── Polymorphic boxes (text, image, ...) ───
  // Content shape per type:
  //   text  → { html: string }
  //   image → { src: string, alt?: string }
  async getBoxes(tagId: string) {
    return apiRequest<{ id: string; type: 'text' | 'image'; content: Record<string, unknown>; x: number; y: number; w: number; h: number }[]>(`/api/canvas/boxes/${tagId}`);
  },

  async addBox(tagId: string, data: { type: 'text' | 'image' | 'marker' | 'subject' | 'organization'; content: Record<string, unknown>; x: number; y: number; w?: number; h?: number; contact_id?: string | null }) {
    return apiRequest<{ id: string; type: 'text' | 'image' | 'marker' | 'subject'; content: Record<string, unknown>; x: number; y: number; w: number; h: number }>(`/api/canvas/boxes/${tagId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBox(id: string, updates: { type?: 'text' | 'image' | 'marker' | 'subject' | 'organization'; content?: Record<string, unknown>; x?: number; y?: number; w?: number; h?: number; contact_id?: string | null }) {
    return apiRequest(`/api/canvas/boxes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteBox(id: string) {
    return apiRequest(`/api/canvas/boxes/${id}`, { method: 'DELETE' });
  },
};

// ============ Type Icons API ============
export const typeIconsApi = {
  async list() {
    return apiRequest<{ id: string; name: string; icon: string; color?: string; sort_order: number }[]>('/api/type-icons');
  },

  async create(data: { name: string; icon: string; color?: string }) {
    return apiRequest<{ id: string; name: string; icon: string; color?: string }>('/api/type-icons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, updates: { name?: string; icon?: string; color?: string }) {
    return apiRequest(`/api/type-icons/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/type-icons/${id}`, { method: 'DELETE' });
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

// ============ Kanban API ============
export const kanbanApi = {
  async listColumns() {
    return apiRequest<KanbanColumn[]>('/api/kanban/columns');
  },

  async createColumn(data: { title: string; filters?: KanbanFilter[]; sort_order?: number; sort_by?: KanbanSortBy; sort_dir?: KanbanSortDir; width?: number; bg_color?: string | null }) {
    return apiRequest<KanbanColumn>('/api/kanban/columns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateColumn(id: string, updates: { title?: string; filters?: KanbanFilter[]; sort_order?: number; sort_by?: KanbanSortBy; sort_dir?: KanbanSortDir; width?: number; bg_color?: string | null }) {
    return apiRequest<KanbanColumn>(`/api/kanban/columns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteColumn(id: string) {
    return apiRequest(`/api/kanban/columns/${id}`, { method: 'DELETE' });
  },

  async reorderColumns(items: { id: string; sort_order: number }[]) {
    return apiRequest('/api/kanban/columns/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },

  // ── Corsie orizzontali — gemelle delle colonne sul secondo asse ──
  async listLanes() {
    return apiRequest<KanbanLane[]>('/api/kanban/lanes');
  },

  async createLane(data: { title: string; filters?: KanbanFilter[]; sort_order?: number }) {
    return apiRequest<KanbanLane>('/api/kanban/lanes', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateLane(id: string, updates: { title?: string; filters?: KanbanFilter[]; sort_order?: number }) {
    return apiRequest<KanbanLane>(`/api/kanban/lanes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  },

  async deleteLane(id: string) {
    return apiRequest(`/api/kanban/lanes/${id}`, { method: 'DELETE' });
  },

  async reorderLanes(items: { id: string; sort_order: number }[]) {
    return apiRequest('/api/kanban/lanes/reorder', { method: 'PUT', body: JSON.stringify({ items }) });
  },
};

// ============ Contacts API ============

export const contactsApi = {
  async list(opts?: { archived?: boolean }) {
    const q = opts?.archived ? '?archived=true' : '';
    return apiRequest<Contact[]>(`/api/contacts${q}`);
  },
  async create(body: { name: string; kind?: ContactKind; phone?: string; email?: string; notes?: string; color?: string; avatar_url?: string }) {
    return apiRequest<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(body) });
  },
  async update(id: string, updates: Partial<Pick<Contact, 'name' | 'kind' | 'phone' | 'email' | 'notes' | 'color' | 'avatar_url'>>) {
    return apiRequest<Contact>(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
  },
  async remove(id: string) {
    return apiRequest(`/api/contacts/${id}`, { method: 'DELETE' });
  },
  async archive(id: string) {
    return apiRequest<Contact>(`/api/contacts/${id}/archive`, { method: 'POST' });
  },
  /**
   * TUTTE le appartenenze dell'utente in una richiesta sola.
   *
   * Non «le organizzazioni di questo contatto»: la lavagna disegna venti
   * soggetti insieme e ognuno vuole sapere di che cosa fa parte — un endpoint
   * per contatto sarebbe stato venti richieste per aprire un canvas. Sono coppie
   * di due UUID: anche una rubrica grande sta in pochi kilobyte.
   */
  async memberships() {
    return apiRequest<{ member_id: string; org_id: string }[]>('/api/contacts/memberships');
  },
  /**
   * SOSTITUISCE le organizzazioni di un contatto — non ne aggiunge una.
   *
   * È la forma del gesto: davanti c'è un elenco con delle spunte, e quello che
   * l'utente comunica è «le sue organizzazioni ora sono queste». Idempotente,
   * quindi due schede aperte sullo stesso soggetto non si sommano a vicenda.
   */
  async setOrganizations(id: string, orgIds: string[]) {
    return apiRequest<{ member_id: string; org_id: string }[]>(`/api/contacts/${id}/organizations`, {
      method: 'PUT',
      body: JSON.stringify({ org_ids: orgIds }),
    });
  },
  async unarchive(id: string) {
    return apiRequest<Contact>(`/api/contacts/${id}/unarchive`, { method: 'POST' });
  },
};
