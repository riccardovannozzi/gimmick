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
  /** Stato nell'outbox: assente = in composizione (nel composer); 'queued' =
   *  committato da un invio, in coda per la sincronizzazione. */
  status?: 'queued' | 'uploading' | 'failed';
  /** Id del "batch" (= tile) a cui l'item appartiene una volta committato in
   *  coda. Raggruppa gli item di uno stesso invio così sincronizzano come un
   *  unico tile. Assente finché è in composizione. */
  batchId?: string;
}

/**
 * Action type for GTD classification
 */
// `flow` = tile-processo: la sua sostanza sono i PASSI (`subtasks`), non una
// data. Non è schedulabile — un flow non entra mai nel calendario.
export type ActionType = 'none' | 'anytime' | 'deadline' | 'event' | 'flow';

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
  /**
   * Checklist del tile in forma compatta, già ordinata per `sort_order`, come
   * la manda `GET /api/tiles`: della riga sopravvive il solo `is_done`, che è
   * quanto basta a disegnare lo stepper sulla card.
   *
   * ⚠️ Il campo `state` dei subtask (`blocked` / `cancelled`) NON viaggia in
   * questo payload — né qui né sul web. Finché non ci sarà, il segmento rosso
   * dello stepper non ha sorgente e i passi si leggono in due soli stati.
   */
  subtasks?: { is_done: boolean }[];
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

// ─── Contatti ────────────────────────────────────────────────────────────────
// Sopravvivono al ritiro di `flow_nodes`: un contatto è l'anagrafica di una
// persona, non un pezzo del vecchio grafo. Oggi lo usa il picker dei contatti;
// sul dato è anche il SOGGETTO di un passo (`tile_subtasks.contact_id`).

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
  /** True for the per-user "self" contact, seeded at signup. Pinned at the top
   *  of contact pickers. Exactly one per user (partial unique index). */
  is_self: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Voce di checklist di un tile — e, sui tile di tipo `flow`, un PASSO del
 * processo. È la stessa riga: cambia la resa, non lo schema.
 *
 * I tre campi in fondo (migration 037/038) servono ai passi e restano nulli su
 * una checklist ordinaria. `state` è una SOVRASTRUTTURA su `is_done`, non un
 * suo rimpiazzo: copre i due casi che un booleano non sa dire.
 *
 *   StepState = state ?? (is_done ? 'done' : 'pending')
 */
export interface Subtask {
  id: string;
  tile_id: string;
  content: string;
  is_done: boolean;
  sort_order: number;
  /** Chi ha la palla su questo passo. */
  contact_id?: string | null;
  /** Quando il passo è avvenuto. Storia, non programma: non va in calendario. */
  occurred_at?: string | null;
  /** `null` = voce ordinaria (lo stato lo dice `is_done`). */
  state?: 'blocked' | 'cancelled' | null;
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
