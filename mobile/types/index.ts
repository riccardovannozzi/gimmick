import { User, Session } from '@supabase/supabase-js';

/**
 * Spark Types - Types of content that can be captured
 */
export type SparkType =
  | 'photo'           // Photo from camera
  | 'image'           // Image from gallery
  | 'video'           // Video from camera
  | 'audio_recording' // Audio recorded in app
  | 'text'            // Text note
  | 'file';           // Generic file

/**
 * Buffer Item - Item in the pre-send buffer
 */
export interface BufferItem {
  id: string;
  type: SparkType;
  uri: string;
  thumbnail?: string;
  duration?: number;      // For audio, in milliseconds
  preview?: string;       // For text, first N characters
  fileName?: string;
  mimeType?: string;
  size?: number;          // File size in bytes
  width?: number;         // Image/video width in pixels
  height?: number;        // Image/video height in pixels
  createdAt: Date;
}

/**
 * Tile - Group of related sparks
 */
export interface Tile {
  id: string;
  user_id: string;
  title?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  spark_count?: number;
  sparks?: Spark[];
}

/**
 * Spark - Saved spark in database
 */
export interface Spark {
  id: string;
  user_id: string;
  tile_id?: string;       // Reference to parent tile
  type: SparkType;
  content?: string;       // For text sparks
  storage_path?: string;  // Path in Supabase Storage
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

/**
 * Tag - Label for organizing tiles
 */
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

/**
 * Upload Result - Result of uploading a buffer item
 */
export interface UploadResult {
  success: boolean;
  bufferId: string;
  sparkId?: string;
  error?: string;
}

/**
 * Upload Progress - Progress of batch upload
 */
export interface UploadProgress {
  total: number;
  completed: number;
  current?: string;   // Current item being uploaded
  errors: string[];
}

/**
 * Auth State
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
}

/**
 * Capture Options
 */
export interface CaptureOption {
  type: 'photo' | 'text' | 'voice' | 'file' | 'gallery';
  label: string;
  icon: string;
  color: string;
  route: string;
}

/**
 * Toast Type
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Toast Message
 */
export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
