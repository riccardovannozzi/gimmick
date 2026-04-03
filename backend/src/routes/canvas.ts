import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const canvasRouter = Router();
canvasRouter.use(authenticate);

/**
 * GET /api/canvas/layout/:tagId
 * Get saved positions for a tag's canvas
 */
canvasRouter.get('/layout/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('canvas_layouts')
      .select('tile_id, x, y')
      .eq('user_id', req.user!.id)
      .eq('tag_id', tagId);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/canvas/layout/:tagId
 * Save/update positions for a tag's canvas (batch upsert)
 */
canvasRouter.put('/layout/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { positions } = req.body; // [{ tile_id, x, y }]

    if (!Array.isArray(positions)) {
      res.status(400).json({ success: false, error: 'positions must be an array' });
      return;
    }

    const rows = positions.map((p: { tile_id: string; x: number; y: number }) => ({
      user_id: req.user!.id,
      tag_id: tagId,
      tile_id: p.tile_id,
      x: p.x,
      y: p.y,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('canvas_layouts')
      .upsert(rows, { onConflict: 'user_id,tag_id,tile_id' });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/canvas/edges/:tagId
 * Get saved edges for a tag's canvas
 */
canvasRouter.get('/edges/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('canvas_edges')
      .select('id, source_id, target_id, source_port, target_port')
      .eq('user_id', req.user!.id)
      .eq('tag_id', tagId);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/canvas/edges/:tagId
 * Create an edge
 */
canvasRouter.post('/edges/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { source_id, target_id, source_port, target_port } = req.body;

    const { data, error } = await supabaseAdmin
      .from('canvas_edges')
      .upsert({
        user_id: req.user!.id,
        tag_id: tagId,
        source_id,
        target_id,
        source_port: source_port || null,
        target_port: target_port || null,
      }, { onConflict: 'user_id,tag_id,source_id,target_id' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/canvas/edges/:id
 * Delete an edge
 */
canvasRouter.delete('/edges/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('canvas_edges')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/canvas/groups/:tagId
 */
canvasRouter.get('/groups/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('canvas_groups')
      .select('id, label, node_ids')
      .eq('user_id', req.user!.id)
      .eq('tag_id', tagId);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/canvas/groups/:tagId
 */
canvasRouter.put('/groups/:tagId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tagId } = req.params;
    const { groups } = req.body;

    if (!Array.isArray(groups)) {
      res.status(400).json({ success: false, error: 'groups must be an array' });
      return;
    }

    await supabaseAdmin
      .from('canvas_groups')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('tag_id', tagId);

    if (groups.length > 0) {
      const rows = groups.map((g: { id: string; label: string; node_ids: string[] }) => ({
        id: g.id,
        user_id: req.user!.id,
        tag_id: tagId,
        label: g.label || '',
        node_ids: g.node_ids,
      }));
      const { error } = await supabaseAdmin.from('canvas_groups').insert(rows);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});