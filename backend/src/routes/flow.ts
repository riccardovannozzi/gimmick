/**
 * Flow API — linear list of micro-actions inside a Tile.
 *
 * After migration 030 the data model is a flat, ordered list (sort_order).
 * The old DAG (flow_edges) is no longer read by the API and the edge
 * endpoints are retired — callers should reorder via PUT /api/flow/nodes/
 * reorder.
 *
 * Three routers exported, each mounted at a different prefix in index.ts:
 *
 *   tileFlowRouter  → /api/tiles/:tileId/flow
 *     GET    /                read the tile's flow as { nodes }
 *     POST   /nodes           create a new node at the end of the list
 *
 *   flowRouter      → /api/flow
 *     PATCH  /nodes/:id       partial update (label / state / contact /
 *                             dates / notes / sort_order)
 *     DELETE /nodes/:id
 *     PUT    /nodes/reorder   bulk reorder (atomic sort_order rewrite)
 *     POST   /edges           410 Gone — retired with migration 030
 *     DELETE /edges/:id       410 Gone
 *
 *   flowsHubRouter  → /api/flows
 *     GET    /tiles           tile_ids that have at least one flow node
 *     GET    /hub             cross-tile inbox, filtered by state decorator
 */
import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { FlowNodeState } from '../types/flow.js';

const VALID_STATES: FlowNodeState[] = ['active', 'done', 'wait', 'undo', 'stop'];

// ─── tileFlowRouter ────────────────────────────────────────────────────────

export const tileFlowRouter = Router({ mergeParams: true });
tileFlowRouter.use(authenticate);

/** GET /api/tiles/:tileId/flow → { nodes } (ordered by sort_order ASC) */
tileFlowRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tileId } = req.params as { tileId: string };
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin
      .from('flow_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('tile_id', tileId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: {
        nodes: data ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tiles/:tileId/flow/nodes
 * Body: { label?, state?, contact_id?, occurred_at?, scheduled_at?, notes? }
 *
 * The new node is appended to the END of the list (sort_order = max+1). The
 * legacy `parent_node_id` field is accepted but ignored — preserved so the
 * mobile dev-client APK doesn't 400 while we roll out the new clients.
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
    };

    if (body.state && !VALID_STATES.includes(body.state as FlowNodeState)) {
      res.status(400).json({ success: false, error: `state must be one of ${VALID_STATES.join(', ')}` });
      return;
    }

    // Verify the tile belongs to this user (RLS would deny otherwise but a
    // 404 reads cleaner than a 403/RLS error).
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

    // New node is appended at the end. Computing max+1 is racy under
    // concurrent inserts but acceptable for the human-scale use case (and
    // the user can always drag to reorder anyway).
    const { data: tail } = await supabaseAdmin
      .from('flow_nodes')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('tile_id', tileId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortOrder = (tail?.sort_order ?? -1) + 1;

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
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (nodeErr || !node) throw nodeErr ?? new Error('Insert failed');

    // Legacy response shape — old clients destructure `{ node, edge }`.
    res.status(201).json({ success: true, data: { node, edge: null } });
  } catch (error) {
    next(error);
  }
});

// ─── flowRouter ────────────────────────────────────────────────────────────

export const flowRouter = Router();
flowRouter.use(authenticate);

/**
 * PUT /api/flow/nodes/reorder
 * Body: { items: [{ id: string; sort_order: number }, ...] }
 *
 * Rewrites sort_order for every supplied node. The client sends the WHOLE
 * tile's ordered list after a drag-and-drop, so we apply the changes in
 * one round-trip. RLS scopes to the caller; nodes that don't belong to the
 * user are silently skipped (the WHERE user_id clause does that for free).
 */
flowRouter.put('/nodes/reorder', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const body = req.body as { items?: { id: string; sort_order: number }[] };

    const items = Array.isArray(body.items) ? body.items : null;
    if (!items || items.length === 0) {
      res.status(400).json({ success: false, error: 'items[] is required' });
      return;
    }
    // Validate shape up-front so we fail before issuing N writes.
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || typeof it.sort_order !== 'number') {
        res.status(400).json({ success: false, error: 'each item needs {id, sort_order}' });
        return;
      }
    }

    // Run the updates in parallel. Supabase has no batch-update-with-
    // different-values; the alternative is a stored procedure which isn't
    // worth the operational cost for a list that's at most a few dozen rows.
    const results = await Promise.all(
      items.map((it) =>
        supabaseAdmin
          .from('flow_nodes')
          .update({ sort_order: it.sort_order })
          .eq('id', it.id)
          .eq('user_id', userId),
      ),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

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
    for (const k of ['label', 'state', 'contact_id', 'occurred_at', 'scheduled_at', 'notes', 'sort_order']) {
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

/** DELETE /api/flow/nodes/:id */
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

// ─── Edge endpoints — retired ──────────────────────────────────────────────
//
// Migration 030 linearised the data model. The flow_edges table is still
// in the DB for rollback safety, but the API no longer reads or writes it.
// Old clients hit these endpoints — respond with 410 Gone so they fail loudly.

flowRouter.post('/edges', (_req, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Flow edges retired — the model is now a linear list. Use PUT /api/flow/nodes/reorder.',
  });
});

flowRouter.delete('/edges/:id', (_req, res: Response) => {
  res.status(410).json({
    success: false,
    error: 'Flow edges retired — the model is now a linear list. Use PUT /api/flow/nodes/reorder.',
  });
});

// ─── flowsHubRouter ────────────────────────────────────────────────────────

export const flowsHubRouter = Router();
flowsHubRouter.use(authenticate);

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

/**
 * GET /api/flows/hub?filter=done|wait|undo|stop
 *
 * Uses the `flow_node_activity` view for last_activity / is_open / is_leaf,
 * joins tiles and contacts, returns FlowHubItem[].
 */
flowsHubRouter.get('/hub', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.id;
    const filter = (req.query.filter as string) || 'wait';

    // Load the activity view rows for this user — small enough to filter in
    // memory and avoids three nearly-identical SQL queries.
    const { data: activityRows, error: actErr } = await supabaseAdmin
      .from('flow_node_activity')
      .select('*')
      .eq('user_id', userId);
    if (actErr) throw actErr;

    const now = Date.now();

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

    // Hub is organised by status decorator: one card per flow node whose
    // `state` matches the requested filter. The four lifecycle decorators
    // (done/wait/undo/stop) are the four scenarios; nodes in the base
    // `active` state never appear here.
    const filtered = (activityRows as ActivityRow[] | null ?? []).filter((row) => {
      switch (filter) {
        case 'done':
        case 'wait':
        case 'undo':
        case 'stop':
          return row.state === filter;
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

    // For each tile, pick the first non-root tag.
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

    // Most recently touched first.
    items.sort((a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime());

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});
