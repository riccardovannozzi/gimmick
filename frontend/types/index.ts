/**
 * Classificazione GTD del tile. Attenzione: questa unione mescola due piani.
 *
 *   MEMORIZZATI su `tiles.action_type`:  none · anytime · deadline · event · flow
 *   DERIVATO solo a tempo di render:     allday  (= event + all_day)
 *
 * `allday` non esiste nel database — è una chiave grafica che il frontend usa
 * per colori e icone; `tileVisualKey()` in `lib/tile-visual.ts` è il posto in cui
 * viene derivata. Sta qui dentro perché `Record<ActionType, string>` alimenta la
 * tavolozza, che di chiavi ne vuole sei.
 *
 * `flow` è il tile-processo: la sua sostanza sono i passi (`subtasks`), non una
 * data. Non è schedulabile — vive nella terza colonna di CHRONO, mai nella
 * griglia del calendario.
 */
export type ActionType = 'none' | 'anytime' | 'deadline' | 'event' | 'allday' | 'flow';

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
  start_at?: string;
  end_at?: string;
  is_event?: boolean;
  all_day?: boolean;
  action_type?: ActionType;
  action_type_ai?: ActionType;
  action_type_confidence?: number;
  action_type_reviewed?: boolean;
  is_completed?: boolean;
  is_cta?: boolean;
  status_id?: string;
  color?: string;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  spark_count?: number;
  sparks?: Spark[];
  tags?: { id: string; name: string; tag_type?: string; is_root?: boolean }[];
  // Compact checklist payload (sorted by sort_order) for rendering the checklist bar.
  subtasks?: { is_done: boolean }[];
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
  /** Domain-specific error code (e.g. 'EMAIL_NOT_CONFIRMED'). Set by some
   *  auth endpoints to let the UI branch on the cause. */
  code?: string;
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
  is_pinned?: boolean;
  is_archived?: boolean;
  pin_order?: number;
  created_at: string;
}

// Tag graph types
export interface TagNode {
  id: string;
  name: string;
  slug: string;
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

// Status shapes
export type StatusShape = 'cross' | 'target' | 'solid' | 'diagonal_ltr' | 'diagonal_rtl' | 'square' | 'bubble' | 'question' | 'exclamation' | 'arrows' | 'vertical' | 'hourglass' | 'pause_bars' | 'lock' | 'shade';

// Status entity
export interface Status {
  id: string;
  user_id: string;
  category: 'system' | 'custom';
  name: string;
  shape: StatusShape;
  action_type?: string;
  created_at: string;
}

// Tile subtask (checklist item)
/**
 * Voce di checklist di un tile — e, sui tile di tipo `flow`, un PASSO del
 * processo. È la stessa riga: cambia la resa, non lo schema.
 *
 * I tre campi in fondo servono ai passi e restano nulli su una checklist
 * ordinaria. `state` è una sovrastruttura su `is_done`, non un suo rimpiazzo:
 * copre i due casi che un booleano non sa dire.
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

// Kanban
export type KanbanFilterType = 'action_type' | 'tag' | 'completion' | 'status' | 'type_icon' | 'date_range';
export type KanbanSortBy = 'date_start' | 'date_end' | 'date_created' | 'date_updated' | null;
export type KanbanSortDir = 'asc' | 'desc';

export interface KanbanFilter {
  type: KanbanFilterType;
  // For date_range: "from|to" (ISO date strings, either side can be empty)
  value: string;
}

export interface KanbanColumn {
  id: string;
  user_id: string;
  title: string;
  sort_order: number;
  filters: KanbanFilter[];
  sort_by?: KanbanSortBy;
  sort_dir?: KanbanSortDir;
  width?: number;
  bg_color?: string | null;
  created_at: string;
  updated_at: string;
}

// Auth Tokens
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}
