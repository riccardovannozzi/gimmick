/**
 * Gimmick — Sentry nel runtime Edge di Next.js (middleware).
 *
 * Caricato da `instrumentation.ts` quando `NEXT_RUNTIME === 'edge'`. Oggi
 * Gimmick non ha middleware, quindi questo file non viene quasi mai eseguito:
 * esiste perché il giorno in cui ne comparirà uno, i suoi errori non finiscano
 * nel nulla senza che nessuno se ne accorga.
 */
import * as Sentry from '@sentry/nextjs';
import { sentryCommonOptions } from '@/lib/sentry-privacy';

Sentry.init(sentryCommonOptions);
