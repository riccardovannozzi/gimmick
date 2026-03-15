// Action type for GTD classification
export type ActionType = 'none' | 'anytime' | 'deadline' | 'event';

// Spark types
export type SparkType =
  | 'photo'
  | 'image'
  | 'video'
  | 'audio_recording'
  | 'text'
  | 'file';

// Tile entity (group of sparks)
export interface Tile {
  id: string;
  user_id: string;
  title?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  is_event?: boolean;
  all_day?: boolean;
  action_type?: ActionType;
  action_type_ai?: ActionType;
  action_type_confidence?: number;
  action_type_reviewed?: boolean;
  created_at: string;
  updated_at: string;
  spark_count?: number;
  sparks?: Spark[];
  tags?: { id: string; name: string; color?: string }[];
}

// Spark entity
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
  metadata: Record<string, unknown>;
  ai_status?: 'pending' | 'processing' | 'completed' | 'failed';
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

// Tag entity
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  slug?: string;
  color?: string;
  aliases?: string[];
  usage_count?: number;
  is_root?: boolean;
  created_at: string;
}

// Tag graph types
export interface TagNode {
  id: string;
  name: string;
  slug: string;
  color?: string;
  usage_count: number;
  is_root?: boolean;
}

export interface TagEdge {
  id: string;
  tag_from: string;
  tag_to: string;
  weight: number;
  relation_type?: string;
}

export interface TagGraph {
  nodes: TagNode[];
  edges: TagEdge[];
}

// Auth Tokens
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
