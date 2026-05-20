/**
 * Flow system — shared types.
 *
 * Mirrors backend/src/types/flow.ts exactly. Keep the two files in sync: when
 * you change a field here, update the other one too. The repo doesn't share a
 * TS package, so duplication is the pragmatic choice.
 */

/** Lifecycle of the node. 'active' means no decorator — the default state
 *  saying "this node is in play". */
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
  /** Position in the tile's linear flow list (0 = first card). Replaced the
   *  previous DAG model in migration 030. */
  sort_order: number;
  /** Legacy DAG layout coords — kept on the type for read compatibility but
   *  no longer used by the UI. */
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated The DAG model was replaced by a linear list ordered by
 *  `FlowNode.sort_order`. The flow_edges table still exists for rollback
 *  safety but the API no longer reads or writes it. */
export interface FlowEdge {
  id: string;
  user_id: string;
  tile_id: string;
  parent_id: string;
  child_id: string;
  created_at: string;
}

/** Flow data for a tile — an ordered list of nodes. */
export interface FlowGraph {
  nodes: FlowNode[];
}

export interface FlowHubItem extends FlowNode {
  /** The tile the node belongs to, plus its primary (first non-root) tag. */
  tile: { id: string; title: string; tag: { name: string } | null };
  /** Includes `is_self` so the UI can derive ownership/shape without a second
   *  lookup against the contacts list. */
  contact: { id: string; name: string; color: string | null; is_self: boolean } | null;
  last_activity_at: string;
  is_leaf: boolean;
  is_open: boolean;
  days_since_activity: number;
}
