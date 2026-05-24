import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { supabaseAdmin, supabaseAuth, createUserClient } from '../config/supabase.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const authRouter = Router();

// ── Rate limiters dedicati ────────────────────────────────────────────────
// Globale 1000/15min vive in index.ts come fallback DDoS-light. Qui invece
// vincoliamo gli endpoint sensibili per evitare account spam, brute-force
// password e email-bombing via Supabase SMTP.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Troppi tentativi di registrazione. Riprova tra un\'ora.' },
});

const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
});

const passwordRecoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Troppi tentativi. Riprova tra un\'ora.' },
});

// ── Validation schemas ────────────────────────────────────────────────────
const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const confirmSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(['signup', 'recovery', 'email_change']),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  access_token: z.string().min(1),
  new_password: z.string().min(6),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

// ── seedNewUserDefaults: idempotente ─────────────────────────────────────
/**
 * Crea le righe di onboarding (root tag GIMMICK, 5 status di sistema,
 * contact "Io"=self) per il nuovo utente. Idempotente: re-eseguire NON
 * duplica righe, controlla sempre prima se esistono già.
 *
 * Bypassa RLS via supabaseAdmin (service role key).
 */
async function seedNewUserDefaults(userId: string): Promise<void> {
  // 1. Root tag GIMMICK
  const { data: existingRoot } = await supabaseAdmin
    .from('tags')
    .select('id')
    .eq('user_id', userId)
    .eq('is_root', true)
    .maybeSingle();
  if (!existingRoot) {
    await supabaseAdmin.from('tags').insert({
      user_id: userId,
      name: 'GIMMICK',
      is_root: true,
      slug: 'gimmick',
    });
  }

  // 2. 5 system statuses (canonical set)
  const { count: statusCount } = await supabaseAdmin
    .from('statuses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('category', 'system');
  if (!statusCount) {
    await supabaseAdmin.from('statuses').insert([
      { user_id: userId, category: 'system', name: 'active',    shape: 'solid' },
      { user_id: userId, category: 'system', name: 'paused',    shape: 'pause_bars' },
      { user_id: userId, category: 'system', name: 'blocked',   shape: 'lock' },
      { user_id: userId, category: 'system', name: 'cancelled', shape: 'cross' },
      { user_id: userId, category: 'system', name: 'done',      shape: 'shade' },
    ]);
  }

  // 3. Self contact "Io"
  const { data: existingSelf } = await supabaseAdmin
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('is_self', true)
    .maybeSingle();
  if (!existingSelf) {
    await supabaseAdmin.from('contacts').insert({
      user_id: userId,
      name: 'Io',
      kind: 'person',
      is_self: true,
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  return url || 'http://localhost:3000';
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup — registra nuovo utente
//
// Passa per `supabaseAuth.auth.signUp` (NON admin.createUser) così Supabase
// invia automaticamente l'email di conferma se l'auto-confirm è disattivato
// nel project. L'utente esiste in `auth.users` anche se non confermato:
// seediamo subito i suoi defaults perché siano già pronti al primo login.
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/signup', signupLimiter, validate(signUpSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const emailRedirectTo = `${getFrontendUrl()}/auth/callback`;

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    if (!data.user) {
      res.status(500).json({ success: false, error: 'Signup failed: no user returned' });
      return;
    }

    // Seed defaults — sicuro anche se l'utente non ha ancora confermato.
    await seedNewUserDefaults(data.user.id);

    // Supabase ritorna `session` solo se l'auto-confirm è attivo nel project
    // (tipicamente in dev). In produzione `session` è null finché l'utente
    // non clicca il link di verifica via email.
    const requiresEmailVerification = !data.session;

    res.status(201).json({
      success: true,
      data: {
        user: { id: data.user.id, email: data.user.email },
        session: data.session
          ? {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
            }
          : null,
        requiresEmailVerification,
      },
      message: requiresEmailVerification
        ? 'Controlla la tua email per confermare la registrazione'
        : 'Registrazione completata',
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/signin — login con email/password
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/signin', signinLimiter, validate(signInSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error) {
      // Distinguiamo "email non confermata" così il frontend può guidare l'utente.
      const code = error.message?.toLowerCase().includes('email not confirmed')
        ? 'EMAIL_NOT_CONFIRMED'
        : 'INVALID_CREDENTIALS';
      res.status(401).json({ success: false, error: error.message, code });
      return;
    }

    res.json({
      success: true,
      data: {
        user: { id: data.user.id, email: data.user.email },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/confirm — verifica token_hash di signup o recovery
//
// Il frontend riceve `?token_hash=...&type=signup|recovery` dal link
// nell'email di Supabase, lo manda qui, e noi chiamiamo `verifyOtp`. Il
// risultato OK ritorna una sessione valida che il frontend salva.
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/confirm', validate(confirmSchema), async (req, res, next) => {
  try {
    const { token_hash, type } = req.body;
    const { data, error } = await supabaseAuth.auth.verifyOtp({ token_hash, type });

    if (error || !data.session || !data.user) {
      res.status(400).json({ success: false, error: error?.message || 'Token non valido o scaduto' });
      return;
    }

    // Idempotency: se l'utente conferma signup, ri-seediamo i defaults nel
    // caso il primo seed non sia andato per qualche transient error.
    if (type === 'signup') {
      await seedNewUserDefaults(data.user.id).catch(() => { /* best-effort */ });
    }

    res.json({
      success: true,
      data: {
        user: { id: data.user.id, email: data.user.email },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
        type,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/resend-verification — rinvia email di conferma signup
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/resend-verification', passwordRecoveryLimiter, validate(resendSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const emailRedirectTo = `${getFrontendUrl()}/auth/callback`;

    // Ignoriamo errori per evitare email enumeration: la risposta è sempre 200.
    await supabaseAuth.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    }).catch(() => { /* silent */ });

    res.json({
      success: true,
      message: 'Se l\'email è registrata, riceverai un nuovo link di conferma',
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password — invia email per reset password
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/forgot-password', passwordRecoveryLimiter, validate(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const redirectTo = `${getFrontendUrl()}/auth/callback`;

    // Anche qui ignoriamo errori per evitare enumeration.
    await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo })
      .catch(() => { /* silent */ });

    res.json({
      success: true,
      message: 'Se l\'email è registrata, riceverai un link per reimpostare la password',
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password — aggiorna password con token recovery
//
// Il frontend chiama prima /confirm con type=recovery, ottiene una session,
// e qui ci manda `access_token` di quella session + nuova password.
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/reset-password', passwordRecoveryLimiter, validate(resetSchema), async (req, res, next) => {
  try {
    const { access_token, new_password } = req.body;
    const client = createUserClient(access_token);

    const { error } = await client.auth.updateUser({ password: new_password });
    if (error) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Password aggiornata correttamente' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh — refresh access token
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ success: false, error: 'Refresh token is required' });
      return;
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    res.json({
      success: true,
      data: {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// POST /api/auth/signout — logout
// ──────────────────────────────────────────────────────────────────────────
authRouter.post('/signout', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.accessToken!);
    res.json({ success: true, message: 'Signed out successfully' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// GET /api/auth/me — utente corrente
// ──────────────────────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        created_at: req.user!.created_at,
      },
    },
  });
});

// ──────────────────────────────────────────────────────────────────────────
// DELETE /api/auth/account — eliminazione permanente account
//
// Richiede la password come re-conferma anti-misclick. Se le tabelle utente
// hanno `ON DELETE CASCADE` verso `auth.users.id`, basta deleteUser e il DB
// fa il resto. Verificato pre-merge via SQL (vedi piano).
// ──────────────────────────────────────────────────────────────────────────
authRouter.delete('/account', authenticate, validate(deleteAccountSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { password } = req.body;
    const userId = req.user!.id;
    const email = req.user!.email;

    if (!email) {
      res.status(400).json({ success: false, error: 'Account corrente senza email' });
      return;
    }

    // Verifica password re-confermando il login.
    const { error: pwError } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (pwError) {
      res.status(401).json({ success: false, error: 'Password errata' });
      return;
    }

    // Cascade delete: confidiamo nel ON DELETE CASCADE delle FK. Se manca per
    // qualche tabella, il delete fallirebbe — verificare via SQL prima del merge.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, message: 'Account eliminato' });
  } catch (error) {
    next(error);
  }
});
