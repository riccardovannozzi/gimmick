import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const statusesRouter = Router();

statusesRouter.use(authenticate);

const shapeEnum = z.enum(['cross', 'target', 'solid', 'diagonal_ltr', 'diagonal_rtl', 'square', 'bubble', 'question', 'exclamation', 'arrows', 'vertical', 'hourglass', 'pause_bars', 'lock', 'shade']);

const updateStatusSchema = z.object({
  shape: shapeEnum.optional(),
});

/**
 * GET /api/statuses
 * Lists the user's status rows. Only system statuses exist after migration
 * 029; the `category` column is preserved so callers can still locate the
 * canonical 'done' row by `(category, name)`.
 */
statusesRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('statuses')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/statuses/:id
 * Updates the visual shape of a status. Name and action_type are server-
 * managed (system rows are seeded at signup with stable names) and cannot
 * be changed via the API. Custom statuses were removed in migration 029.
 */
statusesRouter.patch(
  '/:id',
  validate(updateStatusSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      if (!req.body.shape) {
        return res.status(400).json({ success: false, error: 'shape is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('statuses')
        .update({ shape: req.body.shape })
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({ success: false, error: 'Status not found' });
      }

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);
