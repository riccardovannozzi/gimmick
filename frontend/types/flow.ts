/**
 * Flow system — shared types.
 *
 * Mirrors backend/src/types/flow.ts exactly. Keep the two files in sync: when
 * you change a field here, update the other one too. The repo doesn't share a
 * TS package, so duplication is the pragmatic choice.
 */

export type FlowNodeState = 'mine' | 'theirs' | 'done' | 'blocked' | 'cancelled';

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
  created_at: string;
  updated_at: string;
}

export interface FlowNode {
  id: string;
  user_id: string;
  tile_id: string;
  label: string;
  state: FlowNodeState;
  contact_id: string | null;
  occurred_at: string | null;
  scheduled_at: string | null;
  notes: string | null;
  /** Manual position override (null = use auto-layout). */
  x: number | null;
  y: number | null;
  /** Per-tile focus marker — at most one node per tile may have this true.
   *  Uniqueness is enforced application-side. */
  is_focus: boolean;
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

export interface FlowHubItem extends FlowNode {
  tile: { id: string; title: string };
  contact: { id: string; name: string; color: string | null } | null;
  last_activity_at: string;
  is_leaf: boolean;
  is_open: boolean;
  days_since_activity: number;
}
