import type { Spark, BufferItem, Tile, Tag } from '@/types';
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

  async create(tile?: { title?: string; description?: string }) {
    return apiRequest<Tile>('/api/tiles', {
      method: 'POST',
      body: JSON.stringify(tile || {}),
    });
  },

  async update(id: string, updates: { title?: string; description?: string; action_type?: string; is_event?: boolean; all_day?: boolean; start_at?: string | null; end_at?: string | null }) {
    return apiRequest<Tile>(`/api/tiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tiles/${id}`, { method: 'DELETE' });
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
export async function uploadBufferItems(
  items: BufferItem[],
  tagIds?: string[]
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

  return {
    success: errors.length === 0,
    results,
    errors,
    tile,
  };
}
