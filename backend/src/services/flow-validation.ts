/**
 * Flow edge validation helpers.
 *
 * The flow_edges DB constraints already prevent self-loops and duplicates,
 * but they cannot detect multi-hop cycles. This module fills that gap with a
 * DFS over the existing edges of a tile.
 */
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Throws `EdgeCycleError` if adding `parentId → childId` would create a cycle
 * inside `tileId`. Also enforces that both endpoints belong to the same tile.
 *
 * Algorithm: starting from `childId`, walk forward along existing edges. If
 * `parentId` is reached, adding the new edge would close a cycle.
 */
export async function assertEdgeAcyclic(
  userId: string,
  tileId: string,
  parentId: string,
  childId: string,
): Promise<void> {
  if (parentId === childId) {
    throw new EdgeCycleError('parent_id and child_id must differ');
  }

  // 1. Both endpoints must exist in the same tile and belong to this user.
  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from('flow_nodes')
    .select('id, tile_id, user_id')
    .in('id', [parentId, childId]);

  if (endpointsError) throw endpointsError;

  if (!endpoints || endpoints.length !== 2) {
    throw new EdgeCycleError('parent or child node not found');
  }
  for (const n of endpoints) {
    if (n.user_id !== userId) throw new EdgeCycleError('node does not belong to user');
    if (n.tile_id !== tileId) throw new EdgeCycleError('parent and child must belong to the same tile');
  }

  // 2. Load ALL edges of this tile and walk forward from childId.
  const { data: edges, error: edgesError } = await supabaseAdmin
    .from('flow_edges')
    .select('parent_id, child_id')
    .eq('user_id', userId)
    .eq('tile_id', tileId);

  if (edgesError) throw edgesError;

  const adjacency = new Map<string, string[]>();
  for (const e of edges ?? []) {
    const list = adjacency.get(e.parent_id) ?? [];
    list.push(e.child_id);
    adjacency.set(e.parent_id, list);
  }

  // DFS from childId; if we reach parentId, we have a cycle.
  const visited = new Set<string>();
  const stack: string[] = [childId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === parentId) {
      throw new EdgeCycleError('edge would create a cycle');
    }
    if (visited.has(current)) continue;
    visited.add(current);
    const next = adjacency.get(current);
    if (next) stack.push(...next);
  }
}

export class EdgeCycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeCycleError';
  }
}
