import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const patternsRouter = Router();

patternsRouter.use(authenticate);

const shapeEnum = z.enum(['cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl', 'square', 'bubble', 'question', 'exclamation', 'arrows']);

const actionTypeEnum = z.enum(['none', 'anytime', 'deadline', 'event']).nullable().optional();

const createPatternSchema = z.object({
  name: z.string().min(1).max(50),
  shape: shapeEnum,
  action_type: actionTypeEnum,
});

const updatePatternSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  shape: shapeEnum.optional(),
  action_type: actionTypeEnum,
});

/**
 * GET /api/patterns
 * List all user patterns (system + custom)
 */
patternsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('patterns')
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
 * POST /api/patterns
 * Create a custom pattern
 */
patternsRouter.post(
  '/',
  validate(createPatternSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { name, shape, action_type } = req.body;

      const { data, error } = await supabaseAdmin
        .from('patterns')
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
 * PATCH /api/patterns/:id
 * Update a pattern (system: only shape; custom: name + shape)
 */
patternsRouter.patch(
  '/:id',
  validate(updatePatternSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      // Fetch existing pattern
      const { data: existing } = await supabaseAdmin
        .from('patterns')
        .select('category')
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .single();

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Pattern not found' });
      }

      // System patterns: only shape can be updated
      const updates: Record<string, string | null> = {};
      if (req.body.shape) updates.shape = req.body.shape;
      if (req.body.name && existing.category === 'custom') updates.name = req.body.name;
      if (req.body.action_type !== undefined && existing.category === 'custom') updates.action_type = req.body.action_type;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid updates' });
      }

      const { data, error } = await supabaseAdmin
        .from('patterns')
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
 * DELETE /api/patterns/:id
 * Delete a custom pattern (system patterns cannot be deleted)
 */
patternsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Check if system pattern
    const { data: existing } = await supabaseAdmin
      .from('patterns')
      .select('category')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Pattern not found' });
    }

    if (existing.category === 'system') {
      return res.status(403).json({ success: false, error: 'Cannot delete system patterns' });
    }

    const { error } = await supabaseAdmin
      .from('patterns')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.json({ success: true, message: 'Pattern deleted' });
  } catch (error) {
    next(error);
  }
});
