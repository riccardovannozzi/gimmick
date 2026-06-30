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

// AI indexing status
type AiStatus = 'pending' | 'processing' | 'completed' | 'failed';

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

