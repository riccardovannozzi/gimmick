/**
 * Gimmick — Punto di aggancio dell'instrumentation di Next.js.
 *
 * `register()` viene chiamato dal framework una volta per runtime, prima del
 * codice dell'app: è il posto in cui inizializzare Sentry lato server. I due
 * import sono dinamici e condizionati perché le configurazioni Node ed Edge non
 * possono essere caricate insieme — l'edge non ha le API di Node.
 *
 * `onRequestError` è l'aggancio richiesto da Next.js 15 per gli errori dei
 * Server Component e dei Route Handler: senza, quelli non arrivano a Sentry
 * anche se l'SDK è inizializzato.
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
