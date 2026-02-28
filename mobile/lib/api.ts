import type { Memo, BufferItem, Tile } from '@/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

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
 * Make authenticated API request
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

// ============ Memos API ============

export const memosApi = {
  async list(options?: { page?: number; limit?: number; type?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.type) params.set('type', options.type);

    const query = params.toString();
    const endpoint = `/api/memos${query ? `?${query}` : ''}`;

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.json() as Promise<PaginatedResponse<Memo>>;
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

  async createBatch(items: Partial<Memo>[], tileId?: string) {
    return apiRequest<Memo[]>('/api/memos/batch', {
      method: 'POST',
      body: JSON.stringify({ items, tile_id: tileId }),
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

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.json() as Promise<PaginatedResponse<Tile>>;
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

      const response = await fetch(`${API_URL}/api/upload/file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
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
  items: BufferItem[]
): Promise<{ success: boolean; results: Memo[]; errors: string[]; tile?: Tile }> {
  const results: Memo[] = [];
  const errors: string[] = [];
  let tile: Tile | undefined;

  // If multiple items, create a tile first to group them
  if (items.length > 1) {
    const tileResult = await tilesApi.create();
    if (tileResult.success && tileResult.data) {
      tile = tileResult.data;
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

      // Create memo with tile_id if we have a tile
      const memoResult = await memosApi.create({
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

      if (memoResult.success && memoResult.data) {
        results.push(memoResult.data);
      } else {
        errors.push(`Failed to create memo: ${memoResult.error}`);
      }
    } catch (error) {
      errors.push(
        `Error processing ${item.fileName || item.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  return {
    success: errors.length === 0,
    results,
    errors,
    tile,
  };
}
