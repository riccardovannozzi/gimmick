import { Request } from 'express';
import { User } from '@supabase/supabase-js';

// Extend Express Request with user
export interface AuthenticatedRequest extends Request {
  user?: User;
  accessToken?: string;
}

// Action type for GTD classification
export type ActionType = 'none' | 'anytime' | 'deadline' | 'event';

// Spark types (formerly MemoType)
export type SparkType =
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
  start_at?: string;
  end_at?: string;
  is_event?: boolean;
  all_day?: boolean;
  action_type: ActionType;
  action_type_ai?: ActionType;
  action_type_confidence?: number;
  action_type_reviewed: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  spark_count?: number;
  sparks?: Spark[];
}

// Create tile DTO
export interface CreateTileDto {
  title?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  is_event?: boolean;
}

// AI indexing status
export type AiStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Structured spark metadata (stored in JSONB)
export interface SparkMetadata {
  tags?: string[];
  summary?: string;
  ai_description?: string;
  transcript?: string;
  extracted_text?: string;
  pending_event?: {
    start_at: string;
    end_at?: string;
    confidence: number;
  };
  [key: string]: unknown;
}

// Spark entity (formerly Memo)
export interface Spark {
  id: string;
  user_id: string;
  tile_id?: string;
  type: SparkType;
  content?: string;
  storage_path?: string;
  thumbnail_path?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  metadata: SparkMetadata;
  ai_status: AiStatus;
  created_at: string;
  updated_at: string;
}

// Create spark DTO
export interface CreateSparkDto {
  type: SparkType;
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

// Update spark DTO
export interface UpdateSparkDto {
  content?: string;
  metadata?: Record<string, unknown>;
}

// Tag type entity (dynamic, user-managed)
export interface TagTypeEntity {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  emoji: string;
  color?: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

// Tag entity
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  slug?: string;
  tag_type: string;
  aliases?: string[];
  usage_count?: number;
  is_root?: boolean;
  created_at: string;
}

// Tag relation (weighted edge in the co-occurrence graph)
export interface TagRelation {
  id: string;
  user_id: string;
  tag_from: string;
  tag_to: string;
  weight: number;
  relation_type?: string;
  created_at: string;
  updated_at: string;
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
