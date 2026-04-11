import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const subtasksRouter = Router();
subtasksRouter.use(authenticate);

/**
 * GET /api/subtasks?tile_id=...
 * List subtasks for a tile, ordered by sort_order
 */
subtasksRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tileId = req.query.tile_id as string | undefined;
    if (!tileId) {
      res.status(400).json({ success: false, error: 'tile_id is required' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .select('id, tile_id, content, is_done, sort_order, created_at, updated_at')
      .eq('user_id', req.user!.id)
      .eq('tile_id', tileId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { next(error); }
});

/**
 * POST /api/subtasks
 * Create a new subtask. Adds at end of list (max sort_order + 1).
 */
subtasksRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tile_id, content, is_done } = req.body;
    if (!tile_id) {
      res.status(400).json({ success: false, error: 'tile_id is required' });
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from('tile_subtasks')
      .select('sort_order')
      .eq('user_id', req.user!.id)
      .eq('tile_id', tile_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .insert({
        user_id: req.user!.id,
        tile_id,
        content: content || '',
        is_done: !!is_done,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

/**
 * PATCH /api/subtasks/:id
 * Update content, is_done, or sort_order
 */
subtasksRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (req.body.content !== undefined) updates.content = req.body.content;
    if (req.body.is_done !== undefined) updates.is_done = !!req.body.is_done;
    if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;

    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

/**
 * DELETE /api/subtasks/:id
 */
subtasksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('tile_subtasks')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * PUT /api/subtasks/reorder
 * Bulk update sort_order for an array of { id, sort_order }
 */
subtasksRouter.put('/reorder', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const items = req.body.items as Array<{ id: string; sort_order: number }> | undefined;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ success: false, error: 'items array is required' });
      return;
    }

    for (const it of items) {
      await supabaseAdmin
        .from('tile_subtasks')
        .update({ sort_order: it.sort_order })
        .eq('id', it.id)
        .eq('user_id', req.user!.id);
    }

    res.json({ success: true });
  } catch (error) { next(error); }
});