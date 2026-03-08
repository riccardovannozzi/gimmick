import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Tag } from '../types/index.js';

export const tagsRouter = Router();

tagsRouter.use(authenticate);

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).optional(),
  aliases: z.array(z.string().max(50)).max(20).optional(),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(7).optional(),
  aliases: z.array(z.string().max(50)).max(20).optional(),
});

/**
 * GET /api/tags
 * List all user tags
 */
tagsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tags')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data as Tag[] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags
 * Create a new tag
 */
tagsRouter.post(
  '/',
  validate(createTagSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { name, color, aliases } = req.body;

      const { data, error } = await supabaseAdmin
        .from('tags')
        .insert({ name, color, aliases: aliases || [], user_id: req.user!.id })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        data: data as Tag,
        message: 'Tag created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/tags/:id
 * Update a tag
 */
tagsRouter.patch(
  '/:id',
  validate(updateTagSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('tags')
        .update(req.body)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) throw new NotFoundError('Tag not found');

      res.json({ success: true, data: data as Tag });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/tags/:id
 * Delete a tag
 */
tagsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/:id/tiles
 * Associate a tag with tiles
 */
tagsRouter.post('/:id/tiles', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: tagId } = req.params;
    const { tile_ids } = req.body as { tile_ids: string[] };

    if (!tile_ids || !Array.isArray(tile_ids)) {
      return res.status(400).json({ success: false, error: 'tile_ids array required' });
    }

    const rows = tile_ids.map((tile_id) => ({ tag_id: tagId, tile_id }));

    const { error } = await supabaseAdmin
      .from('tile_tags')
      .upsert(rows, { onConflict: 'tag_id,tile_id' });

    if (error) throw error;

    res.json({ success: true, message: 'Tiles tagged' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tags/:id/tiles/:tileId
 * Remove tag from a tile
 */
tagsRouter.delete('/:id/tiles/:tileId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: tagId, tileId } = req.params;

    const { error } = await supabaseAdmin
      .from('tile_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('tile_id', tileId);

    if (error) throw error;

    res.json({ success: true, message: 'Tag removed from tile' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tags/:id/tiles
 * Get tiles for a specific tag
 */
tagsRouter.get('/:id/tiles', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: tagId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tile_tags')
      .select('tile_id, tiles(*)')
      .eq('tag_id', tagId);

    if (error) throw error;

    const tiles = data?.map((row: any) => row.tiles).filter(Boolean) || [];
    res.json({ success: true, data: tiles });
  } catch (error) {
    next(error);
  }
});
