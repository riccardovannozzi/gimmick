import { Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { supabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Authentication middleware
 * Validates JWT token from Authorization header
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Attach user and token to request
    req.user = user;
    req.accessToken = token;

    // CHI ha incontrato l'errore — l'id e nient'altro. Sta QUI perché è l'unico
    // passaggio obbligato di ogni richiesta autenticata, e perché in Express
    // ogni richiesta ha il suo isolation scope: l'id non si mischia fra utenti
    // serviti in parallelo.
    //
    // Senza questa riga, la regola «dell'utente resta solo l'id» scritta in
    // `observability/sentry.ts` non ha mai un id da tenere: di un guasto si sa
    // che è successo, non quante persone ha toccato. A Sentry spento (sviluppo,
    // DSN assente) è una chiamata a vuoto, non un ramo da saltare.
    Sentry.setUser({ id: user.id });

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}
