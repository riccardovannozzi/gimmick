/**
 * Gimmick — Sentry nel browser.
 *
 * Convenzione di Next.js 15.3+: questo file sostituisce il vecchio
 * `sentry.client.config.ts` e viene caricato dal framework prima del codice
 * dell'app. Le impostazioni di riservatezza stanno in `lib/sentry-privacy`,
 * condivise con le inizializzazioni server ed edge.
 *
 * Session Replay non compare da nessuna parte perché in v10 non è
 * un'integrazione di default: per non averla basta non chiederla. I sample rate
 * a zero in `sentryCommonOptions` sono la seconda serratura, non la prima.
 */
import * as Sentry from '@sentry/nextjs';
import { sentryCommonOptions } from '@/lib/sentry-privacy';

Sentry.init(sentryCommonOptions);

/**
 * Aggancio richiesto dall'SDK per strumentare le navigazioni dell'App Router.
 *
 * Con `tracesSampleRate: 0` non produce nulla — non stiamo attivando il
 * Performance Monitoring. Esiste perché senza, l'SDK stampa un "ACTION
 * REQUIRED" a ogni build: un avviso permanente che non si può risolvere
 * insegna solo a non leggere gli avvisi.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
