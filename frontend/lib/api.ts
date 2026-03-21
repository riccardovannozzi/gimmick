import type { Spark, Tile, Tag, TagGraph, TagNode, ApiResponse, PaginatedResponse, AuthTokens, User, ActionType, TagTypeEntity } from '@/types';

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

// API request helper
let isRefreshing = false;

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
      // Auto-refresh token on 401
      if (response.status === 401 && !_retry && refreshToken && !isRefreshing) {
        isRefreshing = true;
        const refreshResult = await authApi.refreshSession();
        isRefreshing = false;

        if (refreshResult.success) {
          return apiRequest<T>(endpoint, options, true);
        }
      }

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

// ============ Auth API ============
export const authApi = {
  async signUp(email: string, password: string) {
    return apiRequest<{ user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
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
  async list(options?: { page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());

    const query = params.toString();
    const endpoint = `/api/tiles${query ? `?${query}` : ''}`;

    return apiRequest<PaginatedResponse<Tile>>(endpoint) as unknown as Promise<PaginatedResponse<Tile>>;
  },

  async get(id: string) {
    return apiRequest<Tile & { sparks: Spark[] }>(`/api/tiles/${id}`);
  },

  async graph() {
    return apiRequest<{
      tiles: { id: string; title?: string; description?: string; created_at: string; action_type?: ActionType }[];
      sparks: { id: string; tile_id?: string; type: string; label: string; tags: string[]; summary?: string; created_at: string }[];
      tags: { id: string; name: string; created_at: string; tile_ids: string[] }[];
    }>('/api/tiles/graph');
  },

  async create(tile?: { title?: string; description?: string }) {
    return apiRequest<Tile>('/api/tiles', {
      method: 'POST',
      body: JSON.stringify(tile || {}),
    });
  },

  async update(id: string, updates: { title?: string; description?: string; action_type?: ActionType; is_event?: boolean; all_day?: boolean; start_at?: string | null; end_at?: string | null; is_completed?: boolean; is_cta?: boolean; sort_order?: number }) {
    return apiRequest<Tile>(`/api/tiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tiles/${id}`, { method: 'DELETE' });
  },
};

// ============ Chat API ============
export const chatApi = {
  async send(
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ) {
    return apiRequest<{ reply: string; foundSparkIds?: string[]; foundTileIds?: string[] }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  async sendVoice(
    audioBlob: Blob,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('history', JSON.stringify(history));

    loadTokens();
    const token = getAccessToken();
    const response = await fetch(`${API_URL}/api/chat/voice`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    return response.json() as Promise<ApiResponse<{ transcript: string; reply: string; foundSparkIds?: string[]; foundTileIds?: string[] }>>;
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
  async uploadFile(file: File, folder: string = 'files') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch(`${API_URL}/api/upload/file`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    return response.json() as Promise<ApiResponse<{
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

  async update(id: string, updates: { name?: string; aliases?: string[]; tag_type?: string }) {
    return apiRequest<Tag>(`/api/tags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/tags/${id}`, { method: 'DELETE' });
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
    description?: string;
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
    description?: string;
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
    description?: string;
    start_at?: string;
    end_at?: string;
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
