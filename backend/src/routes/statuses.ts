import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const statusesRouter = Router();

statusesRouter.use(authenticate);

const shapeEnum = z.enum(['cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl', 'square', 'bubble', 'question', 'exclamation', 'arrows', 'vertical', 'hourglass', 'pause_bars', 'lock', 'check_badge']);

const actionTypeEnum = z.enum(['none', 'anytime', 'deadline', 'event']).nullable().optional();

const createStatusSchema = z.object({
  name: z.string().min(1).max(50),
  shape: shapeEnum,
  action_type: actionTypeEnum,
});

const updateStatusSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  shape: shapeEnum.optional(),
  action_type: actionTypeEnum,
});

/**
 * GET /api/statuses
 * List all user statuses (system + custom)
 */
statusesRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('statuses')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('category', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/statuses
 * Create a custom status
 */
statusesRouter.post(
  '/',
  validate(createStatusSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { name, shape, action_type } = req.body;

      const { data, error } = await supabaseAdmin
        .from('statuses')
        .insert({ user_id: req.user!.id, category: 'custom', name, shape, action_type: action_type || null })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/statuses/:id
 * Update a status (system: only shape; custom: name + shape)
 */
statusesRouter.patch(
  '/:id',
  validate(updateStatusSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const { data: existing } = await supabaseAdmin
        .from('statuses')
        .select('category')
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .single();

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Status not found' });
      }

      const updates: Record<string, string | null> = {};
      if (req.body.shape) updates.shape = req.body.shape;
      if (req.body.name && existing.category === 'custom') updates.name = req.body.name;
      if (req.body.action_type !== undefined && existing.category === 'custom') updates.action_type = req.body.action_type;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid updates' });
      }

      const { data, error } = await supabaseAdmin
        .from('statuses')
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
 * DELETE /api/statuses/:id
 * Delete a custom status (system statuses cannot be deleted)
 */
statusesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('statuses')
      .select('category')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Status not found' });
    }

    if (existing.category === 'system') {
      return res.status(403).json({ success: false, error: 'Cannot delete system statuses' });
    }

    const { error } = await supabaseAdmin
      .from('statuses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.json({ success: true, message: 'Status deleted' });
  } catch (error) {
    next(error);
  }
});
