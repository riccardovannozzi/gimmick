import { Request } from 'express';
import { User } from '@supabase/supabase-js';

// Extend Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

// Memo types
export type MemoType =
  | 'photo'
  | 'image'
  | 'audio_recording'
  | 'audio_file'
  | 'text'
  | 'file';

// Memo entity
export interface Memo {
  id: string;
  user_id: string;
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

// Create memo DTO
export interface CreateMemoDto {
  type: MemoType;
  content?: string;
  storage_path?: string;
  thumbnail_path?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// Update memo DTO
export interface UpdateMemoDto {
  content?: string;
  metadata?: Record<string, unknown>;
}

// API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
