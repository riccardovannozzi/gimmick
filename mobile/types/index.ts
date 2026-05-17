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
 * Action type for GTD classification
 */
export type ActionType = 'none' | 'anytime' | 'deadline' | 'event';

/**
 * Tile - Group of related sparks
 */
export interface Tile {
  id: string;
  user_id: string;
  title?: string;
  start_at?: string;
  end_at?: string;
  is_event?: boolean;
  all_day?: boolean;
  action_type?: ActionType;
  action_type_ai?: ActionType;
  action_type_confidence?: number;
  action_type_reviewed?: boolean;
  status_id?: string | null;
  is_completed?: boolean;
  is_cta?: boolean;
  color?: string;
  created_at: string;
  updated_at: string;
  spark_count?: number;
  sparks?: Spark[];
  tags?: { id: string; name: string; tag_type?: string; is_root?: boolean }[];
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

// ─── Flow types (DAG of micro-actions inside a Tile) ────────────────────────
// Mirrors backend/src/types/flow.ts and frontend/types/flow.ts. Keep in sync.

export type FlowNodeState = 'active' | 'done' | 'wait' | 'undo' | 'stop';

export type ContactKind = 'person' | 'company' | 'professional' | 'institution' | 'other';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  kind: ContactKind;
  phone: string | null;
  email: string | null;
  notes: string | null;
  color: string | null;
  avatar_url: string | null;
  archived_at: string | null;
  /** True for the per-user "self" contact, seeded at signup. UI treats it as
   *  the default node assignment ("ball is on me") and pins it at the top of
   *  contact pickers. Exactly one per user (partial unique index). */
  is_self: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  user_id: string;
  tile_id: string;
  label: string;
  /** Lifecycle decorator. 'active' = no decorator drawn on the node body. */
  state: FlowNodeState;
  /** Drives node shape: square when null OR points to the user's self contact
   *  ("ball is on me"), circle otherwise ("ball is on someone else"). */
  contact_id: string | null;
  occurred_at: string | null;
  scheduled_at: string | null;
  notes: string | null;
  /** Manual position override (null = use auto-layout). */
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

export interface FlowEdge {
  id: string;
  user_id: string;
  tile_id: string;
  parent_id: string;
  child_id: string;
  created_at: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Cross-tile FlowHub row — each entry is a "ball in play" node enriched with
 * its parent tile + primary tag + contact, plus derived activity stats. Built
 * server-side by /api/flows/hub.
 */
export interface FlowHubItem extends FlowNode {
  tile: { id: string; title: string; tag: { name: string } | null };
  contact: { id: string; name: string; color: string | null; is_self: boolean } | null;
  last_activity_at: string;
  is_leaf: boolean;
  is_open: boolean;
  days_since_activity: number;
}

/** Filter keyword for the Hub query. Matches backend GET /api/flows/hub?filter=…
 *  Maps 1:1 to the flow node's `state` lifecycle decorator. */
export type FlowHubFilter = 'done' | 'wait' | 'undo' | 'stop';

/**
 * Subtask - Checklist item belonging to a tile (List view in sidebar).
 */
export interface Subtask {
  id: string;
  tile_id: string;
  content: string;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Tag type entity (dynamic, user-managed)
 */
export interface TagTypeEntity {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  emoji: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

/**
 * Tag - Label for organizing tiles
 */
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
