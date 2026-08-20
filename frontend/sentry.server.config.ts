/**
 * Gimmick — Sentry nel runtime Node di Next.js (SSR, Route Handler, Server
 * Action). Caricato da `instrumentation.ts` quando `NEXT_RUNTIME === 'nodejs'`.
 *
 * Il DSN è quello di `gimmick-web`: qui gli errori sono della dashboard che
 * rende le pagine, non dell'API Express — quella ha il suo progetto.
 */
import * as Sentry from '@sentry/nextjs';
import { sentryCommonOptions } from '@/lib/sentry-privacy';

Sentry.init(sentryCommonOptions);
