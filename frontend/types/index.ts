// Memo types
export type MemoType =
  | 'photo'
  | 'image'
  | 'video'
  | 'audio_recording'
  | 'audio_file'
  | 'text'
  | 'file';

// Tile entity (group of memos)
export interface Tile {
  id: string;
  user_id: string;
  title?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  memo_count?: number;
  memos?: Memo[];
}

// Memo entity
export interface Memo {
  id: string;
  user_id: string;
  tile_id?: string;
  type: MemoType;
  content?: string;
  storage_path?: string;
  thumbnail_path?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// User
export interface User {
  id: string;
  email: string;
  created_at?: string;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Paginated Response
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

// Auth Tokens
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
