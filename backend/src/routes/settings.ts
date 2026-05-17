import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

/**
 * GET /api/settings/:key
 * Get a user setting by key
 */
settingsRouter.get('/:key', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { key } = req.params;

    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('value')
      .eq('user_id', req.user!.id)
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found

    res.json({ success: true, data: data?.value ?? null });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings/:key
 * Upsert a user setting
 */
settingsRouter.put('/:key', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'value is required' });
    }

    const { error } = await supabaseAdmin
      .from('user_settings')
      .upsert(
        { user_id: req.user!.id, key, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );

    if (error) throw error;

    res.json({ success: true, message: 'Setting saved' });
  } catch (error) {
    next(error);
  }
});
