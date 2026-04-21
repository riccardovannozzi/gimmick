import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const typeIconsRouter = Router();
typeIconsRouter.use(authenticate);

/**
 * GET /api/type-icons
 * List user's type icons
 */
typeIconsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('type_icons')
      .select('id, name, icon, color, sort_order')
      .eq('user_id', req.user!.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { next(error); }
});

/**
 * POST /api/type-icons
 * Create a type icon
 */
typeIconsRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, icon, color } = req.body;
    const { data: existing } = await supabaseAdmin
      .from('type_icons')
      .select('sort_order')
      .eq('user_id', req.user!.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('type_icons')
      .insert({
        user_id: req.user!.id,
        name,
        icon,
        color: color || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

/**
 * PATCH /api/type-icons/:id
 * Update a type icon
 */
typeIconsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.icon !== undefined) updates.icon = req.body.icon;
    if (req.body.color !== undefined) updates.color = req.body.color || null;

    const { error } = await supabaseAdmin
      .from('type_icons')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * DELETE /api/type-icons/:id
 * Delete a type icon
 */
typeIconsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    // Also remove all tile assignments
    await supabaseAdmin
      .from('tile_type_icons')
      .delete()
      .eq('type_icon_id', id)
      .eq('user_id', req.user!.id);

    const { error } = await supabaseAdmin
      .from('type_icons')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * GET /api/type-icons/assignments
 * Get all tile → type icon assignments
 */
typeIconsRouter.get('/assignments', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tile_type_icons')
      .select('tile_id, type_icon_id')
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { next(error); }
});

/**
 * PUT /api/type-icons/assign
 * Assign/unassign a type icon to a tile
 */
typeIconsRouter.put('/assign', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tile_id, type_icon_id } = req.body;

    if (!type_icon_id) {
      await supabaseAdmin
        .from('tile_type_icons')
        .delete()
        .eq('tile_id', tile_id)
        .eq('user_id', req.user!.id);
    } else {
      await supabaseAdmin
        .from('tile_type_icons')
        .upsert({
          user_id: req.user!.id,
          tile_id,
          type_icon_id,
        }, { onConflict: 'user_id,tile_id' });
    }

    res.json({ success: true });
  } catch (error) { next(error); }
});
