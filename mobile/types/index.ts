import { User, Session } from '@supabase/supabase-js';

/**
 * Memo Types - Types of content that can be captured
 */
export type MemoType =
  | 'photo'           // Photo from camera
  | 'image'           // Image from gallery
  | 'audio_recording' // Audio recorded in app
  | 'audio_file'      // Audio file picked
  | 'text'            // Text note
  | 'file';           // Generic file

/**
 * Buffer Item - Item in the pre-send buffer
 */
export interface BufferItem {
  id: string;
  type: MemoType;
  uri: string;
  thumbnail?: string;
  duration?: number;      // For audio, in milliseconds
  preview?: string;       // For text, first N characters
  fileName?: string;
  mimeType?: string;
  size?: number;          // File size in bytes
  createdAt: Date;
}

/**
 * Memo - Saved memo in database
 */
export interface Memo {
  id: string;
  user_id: string;
  type: MemoType;
  content?: string;       // For text memos
  storage_path?: string;  // Path in Supabase Storage
  thumbnail_path?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  duration?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Upload Result - Result of uploading a buffer item
 */
export interface UploadResult {
  success: boolean;
  bufferId: string;
  memoId?: string;
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
