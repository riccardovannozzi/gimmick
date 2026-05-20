import type {
  Spark,
  SparkType,
  BufferItem,
  Tile,
  Tag,
  Subtask,
  Contact,
  ContactKind,
  FlowGraph,
  FlowNode,
  FlowNodeState,
  FlowHubItem,
  FlowHubFilter,
} from '@/types';
import Constants from 'expo-constants';

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

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaginatedResponse<T> {
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
let refreshSubscribers: Array<(token: string | null) => void> = [];
let onAuthFailedCallback: (() => void) | null = null;

/**
 * Register callback for when auth fails completely (refresh token invalid)
 */
export function setOnAuthFailed(cb: () => void) {
  onAuthFailedCallback = cb;
}

/**
 * Set authentication tokens
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

/**
 * Get current access token
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Try to refresh the access token
 */
async function tryRefreshToken(): Promise<string | null> {
  if (!refreshToken) {
    onAuthFailedCallback?.();
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data?.session) {
      setTokens(data.data.session);
      return accessToken;
    }

    // Refresh failed — force logout
    onAuthFailedCallback?.();
    return null;
  } catch {
    onAuthFailedCallback?.();
    return null;
  }
}

/**
 * Handle 401: queue concurrent requests, refresh once, retry all
 */
function handleTokenRefresh(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshSubscribers.push(resolve);
    });
  }

  isRefreshing = true;

  return tryRefreshToken().then((newToken) => {
    isRefreshing = false;
    refreshSubscribers.forEach((cb) => cb(newToken));
    refreshSubscribers = [];
    return newToken;
  });
}

/**
 * Make authenticated API request (with auto-refresh on 401)
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
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

    // On 401, try refreshing token and retry once
    if (response.status === 401 && !endpoint.includes('/auth/refresh')) {
      const newToken = await handleTokenRefresh();
      if (newToken) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          return { success: false, error: retryData.error || `HTTP ${retryResponse.status}` };
        }
        return retryData;
      }
      return { success: false, error: 'Session expired' };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
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

/**
 * Authenticated fetch with auto-refresh on 401 (for direct fetch calls)
 */
async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    const newToken = await handleTokenRefresh();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      return fetch(`${API_URL}${endpoint}`, { ...options, headers });
    }
  }

  return response;
}

// ============ Auth API ============

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
    const result = await apiRequest<{
      user: { id: string; email: string };
      session: AuthTokens;
    }>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

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

    const result = await apiRequest<{ session: AuthTokens }>(
      '/api/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (result.success && result.data?.session) {
      setTokens(result.data.session);
    }

    return result;
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
  async list(options?: { page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());

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

// ============ Flow API ============

export const flowApi = {
  async getByTile(tileId: string) {
    return apiRequest<FlowGraph>(`/api/tiles/${tileId}/flow`);
  },
  async createNode(
    tileId: string,
    body: {
      label?: string;
      state?: FlowNodeState;
      contact_id?: string | null;
      occurred_at?: string | null;
      scheduled_at?: string | null;
      notes?: string | null;
    },
  ) {
    // Server appends at the end (sort_order = max+1). Response shape keeps
    // the legacy { node, edge } for mid-rollout client compatibility.
    return apiRequest<{ node: FlowNode; edge: null }>(
      `/api/tiles/${tileId}/flow/nodes`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },
  async updateNode(
    id: string,
    updates: Partial<Pick<FlowNode, 'label' | 'state' | 'contact_id' | 'occurred_at' | 'scheduled_at' | 'notes' | 'sort_order'>>,
  ) {
    return apiRequest<FlowNode>(`/api/flow/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
  async deleteNode(id: string) {
    return apiRequest(`/api/flow/nodes/${id}`, { method: 'DELETE' });
  },
  /** Bulk reorder — send the full list with new sort_order values. */
  async reorderNodes(items: { id: string; sort_order: number }[]) {
    return apiRequest('/api/flow/nodes/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },
  /** Cross-tile inbox of pending flow nodes. Mounted at /api/flows. */
  async hub(filter: FlowHubFilter) {
    return apiRequest<FlowHubItem[]>(`/api/flows/hub?filter=${encodeURIComponent(filter)}`);
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
  async update(id: string, updates: { content?: string; is_done?: boolean; sort_order?: number }) {
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

export const chatApi = {
  async send(
    message: string,
    history: { role: string; content: string }[],
    model?: string
  ) {
    return apiRequest<{ reply: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, model }),
    });
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
): Promise<{ success: boolean; results: Spark[]; errors: string[]; tile?: Tile }> {
  const results: Spark[] = [];
  const errors: string[] = [];
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
    if (tileOptions.action_type === 'event' || tileOptions.action_type === 'deadline') {
      updates.is_event = tileOptions.action_type === 'event';
      updates.all_day = !!tileOptions.all_day;
      updates.start_at = tileOptions.start_at ?? null;
      updates.end_at = tileOptions.end_at ?? null;
    } else if (tileOptions.action_type === 'none' || tileOptions.action_type === 'anytime') {
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
  };
}
