import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { assertTileOwned, assertContactOwned } from '../utils/ownership.js';

export const subtasksRouter = Router();
subtasksRouter.use(authenticate);

/**
 * GET /api/subtasks?tile_id=...
 * List subtasks for a tile, ordered by sort_order
 */
subtasksRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tileId = req.query.tile_id as string | undefined;
    if (!tileId) {
      res.status(400).json({ success: false, error: 'tile_id is required' });
      return;
    }
    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .select('id, tile_id, content, is_done, sort_order, contact_id, is_theirs, occurred_at, state, created_at, updated_at')
      .eq('user_id', req.user!.id)
      .eq('tile_id', tileId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { next(error); }
});

/**
 * GET /api/subtasks/flow
 *
 * TUTTI i passi dei tile `flow` dell'utente, in una richiesta sola.
 *
 * Serve al Cockpit, che deve rispondere a una domanda trasversale — «di chi è
 * la palla, su tutto quel che ho aperto» — e non può farlo con la lista dei
 * tile: quella porta una proiezione COMPATTA dei subtask (`is_done` e `state`,
 * vedi `routes/tiles.ts`), che basta a disegnare una barra e non basta a dire
 * chi aspetta chi. Servono `contact_id`, `is_theirs`, `sort_order` e le date.
 *
 * L'alternativa era una `GET /api/subtasks?tile_id=` per ogni flow: oggi
 * sarebbero ventotto richieste per aprire una pagina.
 *
 * ⚠️ Nessun id arriva dal client: i tile si ricavano dall'utente autenticato.
 * È anche ciò che rende la rotta banale da verificare — non c'è niente da
 * possedere che non sia già filtrato per `user_id`, due volte.
 */
subtasksRouter.get('/flow', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: flowTiles, error: tilesError } = await supabaseAdmin
      .from('tiles')
      .select('id')
      .eq('user_id', req.user!.id)
      .eq('action_type', 'flow');

    if (tilesError) throw tilesError;

    const ids = (flowTiles ?? []).map((t) => t.id as string);
    // `.in()` con un array vuoto è SQL valido ma inutile: si esce prima.
    if (ids.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .select('id, tile_id, content, is_done, sort_order, contact_id, is_theirs, occurred_at, state, created_at, updated_at')
      .eq('user_id', req.user!.id)
      .in('tile_id', ids)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) { next(error); }
});

/**
 * POST /api/subtasks
 * Create a new subtask. Adds at end of list (max sort_order + 1).
 */
subtasksRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tile_id, content, is_done } = req.body;
    if (!tile_id) {
      res.status(400).json({ success: false, error: 'tile_id is required' });
      return;
    }

    // Il tile_id arriva dal body. La query qui sotto filtra sì per user_id, ma
    // serve solo a calcolare il sort_order: su un tile altrui non trova nulla e
    // riparte da zero, non blocca l'inserimento. Il subtask finiva così nella
    // checklist del tile della vittima, falsandone il completamento.
    await assertTileOwned(req.user!.id, tile_id as string);

    const { data: existing } = await supabaseAdmin
      .from('tile_subtasks')
      .select('sort_order')
      .eq('user_id', req.user!.id)
      .eq('tile_id', tile_id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .insert({
        user_id: req.user!.id,
        tile_id,
        content: content || '',
        is_done: !!is_done,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

/**
 * PATCH /api/subtasks/:id
 * Update content, is_done, or sort_order
 */
subtasksRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const updates: Record<string, unknown> = {};
    if (req.body.content !== undefined) updates.content = req.body.content;
    if (req.body.is_done !== undefined) updates.is_done = !!req.body.is_done;
    if (req.body.sort_order !== undefined) updates.sort_order = req.body.sort_order;
    // Campi dei passi di un flow. `null` è un valore legittimo — significa
    // "togli il contatto / la data / lo stato eccezionale" — quindi il controllo
    // è su `undefined`, non sulla verità del valore.
    //
    // ⚠️ `contact_id` arriva DAL CLIENT e punta a un'altra tabella. Il filtro
    // `user_id` qui sotto protegge il subtask, non il contatto: senza questa
    // verifica si potrebbe agganciare a un proprio passo il contatto di un
    // altro utente, e la riga terrebbe un riferimento a dati non propri.
    if (req.body.contact_id !== undefined) {
      const contactId = (req.body.contact_id as string | null) || null;
      if (contactId) await assertContactOwned(req.user!.id, contactId);
      updates.contact_id = contactId;
    }
    // La palla del passo (migration 049). Marcatura di eccezione: FALSE è il
    // valore muto. Vince sul contatto in lettura — vedi `subtaskBall()`.
    if (req.body.is_theirs !== undefined) updates.is_theirs = !!req.body.is_theirs;
    if (req.body.occurred_at !== undefined) updates.occurred_at = req.body.occurred_at || null;
    if (req.body.state !== undefined) {
      const s = req.body.state;
      if (s !== null && s !== 'blocked' && s !== 'cancelled') {
        res.status(400).json({ success: false, error: "state must be null, 'blocked' or 'cancelled'" });
        return;
      }
      updates.state = s;
    }

    /**
     * ─── FATTO e FERMO non stanno insieme ────────────────────────────────────
     *
     * In lettura `state` vince su `is_done` (`StepState = state ?? (is_done ?
     * 'done' : 'pending')`), quindi un passo spuntato che si porta dietro
     * `blocked` resterebbe rosso per sempre sulla barra di avanzamento — e un
     * passo fermo contato fra i fatti falserebbe il «X di Y» del footer, che
     * conta `is_done`.
     *
     * La garanzia sta QUI e non nel pannello che oggi è l'unico a scrivere:
     * un'invariante affidata a chi chiama regge finché chi chiama è uno solo.
     *
     * Chi vince quando la richiesta si contraddice: lo STATO. È la
     * sovrastruttura, e dice la cosa più specifica delle due.
     */
    if (updates.state === 'blocked' || updates.state === 'cancelled') {
      updates.is_done = false;
    } else if (updates.is_done === true && req.body.state === undefined) {
      updates.state = null;
    }

    const { data, error } = await supabaseAdmin
      .from('tile_subtasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

/**
 * DELETE /api/subtasks/:id
 */
subtasksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('tile_subtasks')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) { next(error); }
});

/**
 * PUT /api/subtasks/reorder
 * Bulk update sort_order for an array of { id, sort_order }
 */
subtasksRouter.put('/reorder', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const items = req.body.items as Array<{ id: string; sort_order: number }> | undefined;
    if (!items || !Array.isArray(items)) {
      res.status(400).json({ success: false, error: 'items array is required' });
      return;
    }

    for (const it of items) {
      await supabaseAdmin
        .from('tile_subtasks')
        .update({ sort_order: it.sort_order })
        .eq('id', it.id)
        .eq('user_id', req.user!.id);
    }

    res.json({ success: true });
  } catch (error) { next(error); }
});