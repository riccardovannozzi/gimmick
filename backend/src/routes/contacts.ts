/**
 * Contacts API — standalone entity used today by Flow nodes.
 *
 *   GET    /api/contacts            list (?archived=true for archived)
 *   POST   /api/contacts            create
 *   PATCH  /api/contacts/:id        partial update
 *   DELETE /api/contacts/:id        hard delete (flow_nodes.contact_id → NULL)
 *   POST   /api/contacts/:id/archive  soft delete (sets archived_at)
 */
import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ContactKind } from '../types/flow.js';

export const contactsRouter = Router();
contactsRouter.use(authenticate);

const VALID_KINDS: ContactKind[] = ['person', 'company', 'professional', 'institution', 'other'];

contactsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const wantsArchived = req.query.archived === 'true';
    const query = supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('name', { ascending: true });

    if (wantsArchived) {
      query.not('archived_at', 'is', null);
    } else {
      query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

contactsRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, kind, phone, email, notes, color, avatar_url } = req.body as {
      name?: string;
      kind?: string;
      phone?: string;
      email?: string;
      notes?: string;
      color?: string;
      avatar_url?: string;
    };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    if (kind && !VALID_KINDS.includes(kind as ContactKind)) {
      res.status(400).json({ success: false, error: `kind must be one of ${VALID_KINDS.join(', ')}` });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        user_id: req.user!.id,
        name: name.trim(),
        kind: kind ?? 'person',
        phone: phone ?? null,
        email: email ?? null,
        notes: notes ?? null,
        color: color ?? null,
        avatar_url: avatar_url ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

contactsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { name, kind, phone, email, notes, color, avatar_url } = req.body as Record<string, string | null | undefined>;

    if (kind !== undefined && kind !== null && !VALID_KINDS.includes(kind as ContactKind)) {
      res.status(400).json({ success: false, error: `kind must be one of ${VALID_KINDS.join(', ')}` });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, error: 'name cannot be empty' });
        return;
      }
      updates.name = name.trim();
    }
    if (kind !== undefined) updates.kind = kind;
    if (phone !== undefined) updates.phone = phone;
    if (email !== undefined) updates.email = email;
    if (notes !== undefined) updates.notes = notes;
    if (color !== undefined) updates.color = color;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

contactsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

contactsRouter.post('/:id/archive', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
