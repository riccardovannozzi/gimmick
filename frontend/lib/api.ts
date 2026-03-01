import type { Memo, Tile, ApiResponse, PaginatedResponse, AuthTokens, User } from '@/types';

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
