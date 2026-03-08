import type { Memo, Tile, Tag, ApiResponse, PaginatedResponse, AuthTokens, User } from '@/types';

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

// ============ Memos API ============
export const memosApi = {
  async list(options?: { page?: number; limit?: number; type?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.type) params.set('type', options.type);

    const query = params.toString();
    const endpoint = `/api/memos${query ? `?${query}` : ''}`;

    return apiRequest<PaginatedResponse<Memo>>(endpoint) as unknown as Promise<PaginatedResponse<Memo>>;
  },

  async stats() {
    return apiRequest<{ counts: Record<string, number>; total: number; totalSize: number; dateCounts: Record<string, number> }>('/api/memos/stats');
  },

  async get(id: string) {
    return apiRequest<Memo>(`/api/memos/${id}`);
  },

  async create(memo: Partial<Memo>) {
    return apiRequest<Memo>('/api/memos', {
      method: 'POST',
      body: JSON.stringify(memo),
    });
  },

  async update(id: string, updates: Partial<Memo>) {
    return apiRequest<Memo>(`/api/memos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    return apiRequest(`/api/memos/${id}`, { method: 'DELETE' });
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
    return apiRequest<Tile & { memos: Memo[] }>(`/api/tiles/${id}`);
  },

  async graph() {
    return apiRequest<{
      tiles: { id: string; title?: string; description?: string; created_at: string }[];
      memos: { id: string; tile_id?: string; type: string; label: string; tags: string[]; summary?: string; created_at: string }[];
      tags: { id: string; name: string; color?: string; created_at: string; tile_ids: string[] }[];
    }>('/api/tiles/graph');
  },

  async create(tile?: { title?: string; description?: string }) {
    return apiRequest<Tile>('/api/tiles', {
      method: 'POST',
      body: JSON.stringify(tile || {}),
    });
  },

  async update(id: string, updates: { title?: string; description?: string }) {
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
    return apiRequest<{ reply: string; foundMemoIds?: string[]; foundTileIds?: string[] }>('/api/chat', {
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

    return response.json() as Promise<ApiResponse<{ transcript: string; reply: string; foundMemoIds?: string[]; foundTileIds?: string[] }>>;
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

  async create(tag: { name: string; color?: string; aliases?: string[] }) {
    return apiRequest<Tag>('/api/tags', {
      method: 'POST',
      body: JSON.stringify(tag),
    });
  },

  async update(id: string, updates: { name?: string; color?: string; aliases?: string[] }) {
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
};
