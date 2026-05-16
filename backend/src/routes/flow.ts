/**
 * Flow API — DAG of micro-actions inside a Tile.
 *
 * Three routers exported, each mounted at a different prefix in index.ts:
 *
 *   tileFlowRouter  → /api/tiles/:tileId/flow
 *     GET    /                read the whole DAG of a tile
 *     POST   /nodes           create a node (optional parent_node_id → edge too)
 *
 *   flowRouter      → /api/flow
 *     PATCH  /nodes/:id       partial update
 *     DELETE /nodes/:id       cascade removes adjacent edges
 *     POST   /edges           validates same-tile + assertEdgeAcyclic
 *     DELETE /edges/:id
 *
 *   flowsHubRouter  → /api/flows
 *     GET    /hub             cross-tile inbox view, filtered
 */
import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { assertEdgeAcyclic, EdgeCycleError } from '../services/flow-validation.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { FlowNodeState } from '../types/flow.js';

const VALID_STATES: FlowNodeState[] = ['active', 'done', 'wait', 'undo', 'stop'];

// ─── tileFlowRouter ────────────────────────────────────────────────────────

export const tileFlowRouter = Router({ mergeParams: true });
tileFlowRouter.use(authenticate);

/** GET /api/tiles/:tileId/flow → { nodes, edges } */
tileFlowRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tileId } = req.params as { tileId: string };
    const userId = req.user!.id;

    const [nodesRes, edgesRes] = await Promise.all([
      supabaseAdmin
        .from('flow_nodes')
        .select('*')
        .eq('user_id', userId)
        .eq('tile_id', tileId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('flow_edges')
        .select('*')
        .eq('user_id', userId)
        .eq('tile_id', tileId)
        .order('created_at', { ascending: true }),
    ]);

    if (nodesRes.error) throw nodesRes.error;
    if (edgesRes.error) throw edgesRes.error;

    res.json({
      success: true,
      data: {
        nodes: nodesRes.data ?? [],
        edges: edgesRes.data ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tiles/:tileId/flow/nodes
 * Body: { label?, state?, contact_id?, occurred_at?, scheduled_at?, notes?, parent_node_id? }
 * If parent_node_id is set, also creates the edge inside the same transaction.
 */
tileFlowRouter.post('/nodes', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tileId } = req.params as { tileId: string };
    const userId = req.user!.id;
    const body = req.body as {
      label?: string;
      state?: string;
      contact_id?: string | null;
      occurred_at?: string | null;
      scheduled_at?: string | null;
      notes?: string | null;
      parent_node_id?: string;
      x?: number | null;
      y?: number | null;
    };

    if (body.state && !VALID_STATES.includes(body.state as FlowNodeState)) {
      res.status(400).json({ success: false, error: `state must be one of ${VALID_STATES.join(', ')}` });
      return;
    }

    // 1. Verify the tile belongs to this user (RLS gives us that for free at
    //    insert time, but a 404 message is friendlier than a 403/RLS deny).
    const { data: tile, error: tileErr } = await supabaseAdmin
      .from('tiles')
      .select('id')
      .eq('id', tileId)
      .eq('user_id', userId)
      .maybeSingle();
    if (tileErr) throw tileErr;
    if (!tile) {
      res.status(404).json({ success: false, error: 'Tile not found' });
      return;
    }

    // 2. If parent_node_id is set, verify it belongs to the same tile.
    if (body.parent_node_id) {
      const { data: parent, error: parentErr } = await supabaseAdmin
        .from('flow_nodes')
        .select('id, tile_id')
        .eq('id', body.parent_node_id)
        .eq('user_id', userId)
        .maybeSingle();
      if (parentErr) throw parentErr;
      if (!parent || parent.tile_id !== tileId) {
        res.status(400).json({ success: false, error: 'parent_node_id is not in this tile' });
        return;
      }
    }

    // 3. Insert the node.
    const { data: node, error: nodeErr } = await supabaseAdmin
      .from('flow_nodes')
      .insert({
        user_id: userId,
        tile_id: tileId,
        label: body.label ?? '',
        state: body.state ?? 'active',
        contact_id: body.contact_id ?? null,
        occurred_at: body.occurred_at ?? null,
        scheduled_at: body.scheduled_at ?? null,
        notes: body.notes ?? null,
        x: body.x ?? null,
        y: body.y ?? null,
      })
      .select()
      .single();

    if (nodeErr || !node) throw nodeErr ?? new Error('Insert failed');

    // 4. If parent_node_id was given, insert the edge too. (Newly created node
    //    can't form a cycle with anything, so no DFS needed.)
    let edge = null;
    if (body.parent_node_id) {
      const { data: edgeRow, error: edgeErr } = await supabaseAdmin
        .from('flow_edges')
        .insert({
          user_id: userId,
          tile_id: tileId,
          parent_id: body.parent_node_id,
          child_id: node.id,
        })
        .select()
        .single();
      if (edgeErr) {
        // Rollback the orphan node — keeps the data consistent without a real txn.
        await supabaseAdmin.from('flow_nodes').delete().eq('id', node.id);
        throw edgeErr;
      }
      edge = edgeRow;
    }

    res.status(201).json({ success: true, data: { node, edge } });
  } catch (error) {
    next(error);
  }
});

// ─── flowRouter ────────────────────────────────────────────────────────────

export const flowRouter = Router();
flowRouter.use(authenticate);

/** PATCH /api/flow/nodes/:id */
flowRouter.patch('/nodes/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const body = req.body as Record<string, unknown>;

    if (body.state !== undefined && !VALID_STATES.includes(body.state as FlowNodeState)) {
      res.status(400).json({ success: false, error: `state must be one of ${VALID_STATES.join(', ')}` });
      return;
    }

    const updates: Record<string, unknown> = {};
    for (const k of ['label', 'state', 'contact_id', 'occurred_at', 'scheduled_at', 'notes', 'x', 'y']) {
      if (k in body) updates[k] = body[k];
    }

    const { data, error } = await supabaseAdmin
      .from('flow_nodes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Node not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/flow/nodes/:id (adjacent edges cascade) */
flowRouter.delete('/nodes/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { error } = await supabaseAdmin
      .from('flow_nodes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/flow/edges  body: { parent_id, child_id }
 * Looks up tile_id of the parent, then validates and inserts.
 */
flowRouter.post('/edges', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { parent_id, child_id } = req.body as { parent_id?: string; child_id?: string };

    if (!parent_id || !child_id) {
      res.status(400).json({ success: false, error: 'parent_id and child_id are required' });
      return;
    }

    // Look up the parent's tile_id (we need it for the edge row and for the
    // acyclic check).
    const { data: parent, error: parentErr } = await supabaseAdmin
      .from('flow_nodes')
      .select('id, tile_id, user_id')
      .eq('id', parent_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (parentErr) throw parentErr;
    if (!parent) {
      res.status(404).json({ success: false, error: 'parent node not found' });
      return;
    }

    try {
      await assertEdgeAcyclic(userId, parent.tile_id, parent_id, child_id);
    } catch (e) {
      if (e instanceof EdgeCycleError) {
        res.status(400).json({ success: false, error: e.message });
        return;
      }
      throw e;
    }

    const { data, error } = await supabaseAdmin
      .from('flow_edges')
      .insert({
        user_id: userId,
        tile_id: parent.tile_id,
        parent_id,
        child_id,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique violation → edge already exists; surface as 409.
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({ success: false, error: 'edge already exists' });
        return;
      }
      throw error;
    }
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/flow/edges/:id */
flowRouter.delete('/edges/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { error } = await supabaseAdmin
      .from('flow_edges')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── flowsHubRouter ────────────────────────────────────────────────────────

export const flowsHubRouter = Router();
flowsHubRouter.use(authenticate);

/**
 * GET /api/flows/hub?filter=mine|theirs|due_soon|stalled|blocked
 *
 * Uses the `flow_node_activity` view for last_activity / is_open / is_leaf,
 * joins tiles and contacts, returns FlowHubItem[].
 */
/**
 * GET /api/flows/tiles
 * Returns the set of tile_ids that have at least one flow_node, so the UI
 * can render a "FLOW" badge on those tiles without per-tile lookups.
 */
flowsHubRouter.get('/tiles', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const { data, error } = await supabaseAdmin
      .from('flow_nodes')
      .select('tile_id')
      .eq('user_id', userId);
    if (error) throw error;
    const ids = Array.from(new Set((data ?? []).map((r: { tile_id: string }) => r.tile_id)));
    res.json({ success: true, data: { tile_ids: ids } });
  } catch (error) {
    next(error);
  }
});

flowsHubRouter.get('/hub', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const filter = (req.query.filter as string) || 'mine';

    // Load the activity view rows for this user — small enough to filter in
    // memory and avoids three nearly-identical SQL queries.
    const { data: activityRows, error: actErr } = await supabaseAdmin
      .from('flow_node_activity')
      .select('*')
      .eq('user_id', userId);
    if (actErr) throw actErr;

    const now = Date.now();
    const dueSoonWindowMs = 48 * 60 * 60 * 1000;

    type ActivityRow = {
      id: string;
      user_id: string;
      tile_id: string;
      state: FlowNodeState;
      contact_id: string | null;
      /** Joined from contacts.is_self via the flow_node_activity view. */
      is_self_contact: boolean;
      occurred_at: string | null;
      scheduled_at: string | null;
      updated_at: string;
      last_activity_at: string;
      is_open: boolean;
      is_leaf: boolean;
    };

    const filtered = (activityRows as ActivityRow[] | null ?? []).filter((row) => {
      switch (filter) {
        case 'mine':
          // Every OPEN node (active/wait) whose contact is the user's self
          // row, or has no contact (null = default-self semantics). One row
          // per matching node — a flow with two open self-contact nodes
          // produces two cards.
          return row.is_open && (row.is_self_contact || row.contact_id === null);
        case 'theirs':
          // Every open node owned by a non-self contact. Same one-card-per-
          // node semantic as `mine`.
          return row.is_open && row.contact_id !== null && !row.is_self_contact;
        case 'due_soon': {
          if (!row.scheduled_at) return false;
          const t = new Date(row.scheduled_at).getTime();
          return t >= now && t <= now + dueSoonWindowMs;
        }
        case 'stalled':
          // "Fermi" — every node currently in the WAIT state. Renamed from
          // the old time-based stalled detection: the user marks a node as
          // wait explicitly, so we just surface them.
          return row.state === 'wait';
        case 'blocked':
          // "Bloccati" — every node in the STOP state.
          return row.state === 'stop';
        default:
          return false;
      }
    });

    if (filtered.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    // Hydrate with full node data + tile + contact.
    const nodeIds = filtered.map((r) => r.id);
    const tileIds = Array.from(new Set(filtered.map((r) => r.tile_id)));
    const contactIds = Array.from(
      new Set(filtered.map((r) => r.contact_id).filter((x): x is string => !!x)),
    );

    const [nodesRes, tilesRes, contactsRes] = await Promise.all([
      supabaseAdmin
        .from('flow_nodes')
        .select('*')
        .in('id', nodeIds),
      supabaseAdmin
        .from('tiles')
        .select('id, title, tile_tags(tags(id, name, is_root))')
        .in('id', tileIds),
      contactIds.length
        ? supabaseAdmin
            .from('contacts')
            .select('id, name, color, is_self')
            .in('id', contactIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (nodesRes.error) throw nodesRes.error;
    if (tilesRes.error) throw tilesRes.error;
    if (contactsRes.error) throw contactsRes.error;

    // For each tile, pick the first non-root tag (so the FlowHub card can
    // show "TAG / TILE TITLE" without exposing the implicit GIMMICK root).
    // Supabase types the nested join as `tags: TagRow[]` even when it's a
    // many-to-one relation — flatten with a flatMap and ignore root tags.
    type TileWithTags = {
      id: string;
      title: string;
      tile_tags?: { tags: { id: string; name: string; is_root: boolean }[] | { id: string; name: string; is_root: boolean } | null }[];
    };
    const tileMap = new Map<string, { id: string; title: string; tag: { name: string } | null }>(
      (tilesRes.data as unknown as TileWithTags[] | null ?? []).map((t) => {
        const allTags = (t.tile_tags ?? []).flatMap((tt) => {
          if (!tt.tags) return [];
          return Array.isArray(tt.tags) ? tt.tags : [tt.tags];
        });
        const tag = allTags.find((x) => !x.is_root) ?? null;
        return [t.id, { id: t.id, title: t.title, tag: tag ? { name: tag.name } : null }];
      }),
    );
    const contactMap = new Map((contactsRes.data ?? []).map((c) => [c.id, c]));
    const activityMap = new Map(filtered.map((r) => [r.id, r]));

    const items = (nodesRes.data ?? []).map((n) => {
      const activity = activityMap.get(n.id)!;
      const tile = tileMap.get(n.tile_id);
      const contact = n.contact_id ? contactMap.get(n.contact_id) : null;
      return {
        ...n,
        tile: tile ?? { id: n.tile_id, title: '', tag: null },
        contact: contact
          ? { id: contact.id, name: contact.name, color: contact.color, is_self: contact.is_self }
          : null,
        last_activity_at: activity.last_activity_at,
        is_leaf: activity.is_leaf,
        is_open: activity.is_open,
        days_since_activity: Math.max(
          0,
          Math.floor((now - new Date(activity.last_activity_at).getTime()) / (24 * 60 * 60 * 1000)),
        ),
      };
    });

    // Sort: oldest activity first for stalled, soonest scheduled first for due_soon,
    // newest activity first otherwise (most recently touched are usually most relevant).
    items.sort((a, b) => {
      if (filter === 'due_soon') {
        return new Date(a.scheduled_at ?? '').getTime() - new Date(b.scheduled_at ?? '').getTime();
      }
      if (filter === 'stalled') {
        return new Date(a.last_activity_at).getTime() - new Date(b.last_activity_at).getTime();
      }
      return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
    });

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});
