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
  | 'video'
  | 'audio_recording'
  | 'text'
  | 'file';

// Tile entity
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

// Create tile DTO
export interface CreateTileDto {
  title?: string;
  description?: string;
}

// AI indexing status
export type AiStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Structured memo metadata (stored in JSONB)
export interface MemoMetadata {
  tags?: string[];
  summary?: string;
  ai_description?: string;
  transcript?: string;
  extracted_text?: string;
  [key: string]: unknown;
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
  metadata: MemoMetadata;
  ai_status: AiStatus;
  created_at: string;
  updated_at: string;
}

// Create memo DTO
export interface CreateMemoDto {
  type: MemoType;
  tile_id?: string;
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
