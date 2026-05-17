import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const kanbanRouter = Router();
kanbanRouter.use(authenticate);

const filterRuleSchema = z.object({
  type: z.enum(['action_type', 'tag', 'completion', 'status', 'type_icon', 'date_range']),
  value: z.string().min(1),
});

const sortBySchema = z.enum(['date_start', 'date_end', 'date_created', 'date_updated']).nullable();
const sortDirSchema = z.enum(['asc', 'desc']);

const createColumnSchema = z.object({
  title: z.string().min(1).default('Nuova colonna'),
  filters: z.array(filterRuleSchema).default([]),
  sort_order: z.number().int().optional(),
  sort_by: sortBySchema.optional(),
  sort_dir: sortDirSchema.optional(),
  width: z.number().int().min(1).max(10).optional(),
  bg_color: z.string().nullable().optional(),
});

const updateColumnSchema = z.object({
  title: z.string().min(1).optional(),
  filters: z.array(filterRuleSchema).optional(),
  sort_order: z.number().int().optional(),
  sort_by: sortBySchema.optional(),
  sort_dir: sortDirSchema.optional(),
  width: z.number().int().min(1).max(10).optional(),
  bg_color: z.string().nullable().optional(),
});

const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sort_order: z.number().int(),
  })),
});

/**
 * GET /api/kanban/columns
 * List user's kanban columns ordered by sort_order
 */
kanbanRouter.get('/columns', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('kanban_columns')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kanban/columns
 * Create a new kanban column
 */
kanbanRouter.post(
  '/columns',
  validate(createColumnSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { title, filters, sort_order, sort_by, sort_dir } = req.body;

      // Auto sort_order: append at end
      let order = sort_order;
      if (order === undefined) {
        const { data: existing } = await supabaseAdmin
          .from('kanban_columns')
          .select('sort_order')
          .eq('user_id', req.user!.id)
          .order('sort_order', { ascending: false })
          .limit(1);
        order = (existing?.[0]?.sort_order ?? -1) + 1;
      }

      const { data, error } = await supabaseAdmin
        .from('kanban_columns')
        .insert({
          user_id: req.user!.id,
          title,
          filters,
          sort_order: order,
          sort_by: sort_by ?? null,
          sort_dir: sort_dir ?? 'asc',
        })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/kanban/columns/:id
 * Update a kanban column
 */
kanbanRouter.patch(
  '/columns/:id',
  validate(updateColumnSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const updates: Record<string, unknown> = { ...req.body };
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('kanban_columns')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/kanban/columns/:id
 * Delete a kanban column
 */
kanbanRouter.delete('/columns/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('kanban_columns')
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
 * PUT /api/kanban/columns/reorder
 * Batch update sort_order for columns
 */
kanbanRouter.put(
  '/columns/reorder',
  validate(reorderSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { items } = req.body;

      for (const item of items) {
        await supabaseAdmin
          .from('kanban_columns')
          .update({ sort_order: item.sort_order, updated_at: new Date().toISOString() })
          .eq('id', item.id)
          .eq('user_id', req.user!.id);
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);
