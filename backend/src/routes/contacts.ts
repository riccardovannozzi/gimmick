/**
 * Contacts API — la rubrica dell'app.
 *
 * NON è una rubrica di sole persone: `kind` vale person / company /
 * professional / institution / other, quindi un'organizzazione è un contatto
 * come un individuo. È il motivo per cui il canvas non ha un secondo archivio
 * per i suoi «soggetti» e le sue «organizzazioni»: li punta qui (migration 048).
 *
 *   GET    /api/contacts            list (?archived=true for archived)
 *   POST   /api/contacts            create
 *   PATCH  /api/contacts/:id        partial update
 *   DELETE /api/contacts/:id        hard delete (flow_nodes.contact_id → NULL)
 *   POST   /api/contacts/:id/archive  soft delete (sets archived_at)
 *
 *   GET    /api/contacts/memberships          tutte le appartenenze dell'utente
 *   PUT    /api/contacts/:id/organizations    sostituisce quelle di un contatto
 */
import { Router, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { assertContactOwned, assertContactsOwned } from '../utils/ownership.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ContactKind } from '../types/contact.js';

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

    // is_self is never accepted from the request — it's a server-managed flag
    // seeded at signup. Always create regular contacts here.
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
        is_self: false,
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

    // The self contact is the canonical "ball on me" anchor — deleting it
    // would orphan every flow node currently assigned to it.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('contacts')
      .select('id, is_self')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (existing?.is_self) {
      res.status(400).json({ success: false, error: 'The self contact cannot be deleted' });
      return;
    }

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

    // Same rule as DELETE: the self contact stays visible. Archiving it would
    // hide it from the picker and break the "ball on me" default.
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from('contacts')
      .select('id, is_self')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (existing?.is_self) {
      res.status(400).json({ success: false, error: 'The self contact cannot be archived' });
      return;
    }

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

/**
 * POST /api/contacts/:id/unarchive — riporta il contatto fra gli attivi.
 *
 * Mancava. Senza, `/archive` non era un archivio ma un'eliminazione con un
 * passaggio in più: la riga restava nel database e continuava a soddisfare i
 * `contact_id` dei passi, ma dall'interfaccia non c'era modo di rivederla.
 */
contactsRouter.post('/:id/unarchive', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ archived_at: null })
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


/**
 * GET /api/contacts/memberships
 *
 * TUTTE le appartenenze dell'utente in un colpo solo, non quelle di un contatto
 * per volta.
 *
 * È una scelta dettata da chi legge: la lavagna disegna venti soggetti insieme e
 * ognuno vuole sapere di che cosa fa parte. Un endpoint per contatto avrebbe
 * voluto dire venti richieste per aprire un canvas. Le coppie sono due UUID e
 * niente altro — anche una rubrica grande sta in pochi kilobyte — e chi le
 * riceve le indicizza come gli serve, nei due versi.
 *
 * ⚠️ Deve stare PRIMA di ogni rotta con `:id` che possa catturarla. Oggi non ce
 * ne sono in GET, ma la prima che arriva se la prenderebbe come un id.
 */
contactsRouter.get('/memberships', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_organizations')
      .select('member_id, org_id')
      .eq('user_id', req.user!.id);
    if (error) throw error;
    res.json({ success: true, data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/contacts/:id/organizations   body: { org_ids: string[] }
 *
 * SOSTITUISCE l'insieme delle organizzazioni di un contatto.
 *
 * PUT e non POST/DELETE per singola appartenenza perché è la forma che ha il
 * gesto vero: davanti c'è un elenco con delle spunte, e quello che l'utente
 * comunica non è «aggiungi questa» ma «le sue organizzazioni ora sono queste».
 * Idempotente: rimandare la stessa lista non cambia niente, e due schede aperte
 * sullo stesso soggetto non si sommano a vicenda.
 */
contactsRouter.put('/:id/organizations', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const raw = (req.body?.org_ids ?? []) as unknown;
    if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) {
      res.status(400).json({ success: false, error: 'org_ids must be an array of ids' });
      return;
    }
    // Un contatto non fa parte di sé stesso. Il CHECK sulla tabella lo rifiuta
    // comunque, ma tornerebbe un errore di database invece di una frase.
    const orgIds = [...new Set(raw as string[])].filter((v) => v && v !== id);

    // `req.params` è tipizzato `string | string[]`: il cast è lo stesso che usa
    // canvas.ts con `tagId`. Un id di rotta è sempre una stringa sola.
    await assertContactOwned(req.user!.id, id as string);
    await assertContactsOwned(req.user!.id, orgIds);

    // Sostituzione secca. Non è in transazione — PostgREST non ne espone una —
    // quindi fra le due c'è una finestra in cui il contatto non appartiene a
    // niente. È accettabile qui: la finestra è di millisecondi, riguarda un
    // singolo utente che sta guardando quella schermata, e se l'inserimento
    // fallisce il rimedio è rimettere le spunte — nessun dato di altri ne
    // dipende. Un `upsert` + `delete not in (...)` avrebbe evitato la finestra
    // ma non l'atomicità, e a costo di due query più complicate.
    const { error: delErr } = await supabaseAdmin
      .from('contact_organizations')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('member_id', id);
    if (delErr) throw delErr;

    if (orgIds.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from('contact_organizations')
        .insert(orgIds.map((org_id) => ({ user_id: req.user!.id, member_id: id, org_id })));
      if (insErr) throw insErr;
    }

    res.json({ success: true, data: orgIds.map((org_id) => ({ member_id: id, org_id })) });
  } catch (error) {
    next(error);
  }
});
