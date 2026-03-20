import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest, TagTypeEntity } from '../types/index.js';

export const tagTypesRouter = Router();

tagTypesRouter.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1).max(30),
  emoji: z.string().min(1).max(50).default('IconTag'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  emoji: z.string().min(1).max(50).optional(),
  sort_order: z.number().int().optional(),
});

/**
 * GET /api/tag-types
 */
tagTypesRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tag_types')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data as TagTypeEntity[] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tag-types
 */
tagTypesRouter.post(
  '/',
  validate(createSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { name, emoji } = req.body;
      const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\u00C0-\u024F-]/g, '').replace(/-+/g, '-');

      // Get next sort_order
      const { data: existing } = await supabaseAdmin
        .from('tag_types')
        .select('sort_order')
        .eq('user_id', req.user!.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const { data, error } = await supabaseAdmin
        .from('tag_types')
        .insert({ user_id: req.user!.id, slug, name, emoji, sort_order: nextOrder, is_default: false })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data: data as TagTypeEntity });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/tag-types/:id
 */
tagTypesRouter.patch(
  '/:id',
  validate(updateSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };

      // If name is updated, also update slug
      if (updates.name) {
        updates.slug = updates.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\u00C0-\u024F-]/g, '').replace(/-+/g, '-');
      }

      const { data, error } = await supabaseAdmin
        .from('tag_types')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, error: 'Tag type not found' });
      }

      res.json({ success: true, data: data as TagTypeEntity });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/tag-types/:id
 */
tagTypesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const { data: tagType } = await supabaseAdmin
      .from('tag_types')
      .select('slug')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!tagType) {
      return res.status(404).json({ success: false, error: 'Tag type not found' });
    }

    // Reassign tags with this type to empty
    await supabaseAdmin
      .from('tags')
      .update({ tag_type: '' })
      .eq('user_id', userId)
      .eq('tag_type', tagType.slug);

    // Delete
    const { error } = await supabaseAdmin
      .from('tag_types')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Tag type deleted' });
  } catch (error) {
    next(error);
  }
});
