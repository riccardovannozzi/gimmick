import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Skip ESLint during `next build`. Linting still runs locally (`npm run
  // lint`) and in the editor — the production build just shouldn't fail on
  // style/strict-TS rules that don't affect runtime behavior.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

/**
 * Caricamento delle source map su Sentry.
 *
 * Senza, la build funziona lo stesso: gli errori arrivano, ma con lo stack
 * trace minificato — righe tipo `a.b is not a function` in `chunk-4f2a.js`, che
 * non dicono niente. Con `SENTRY_AUTH_TOKEN` mancante il plugin salta l'upload
 * e basta, quindi la build non si rompe mai per questo.
 *
 * ⚠️ `hideSourceMaps` non esiste più nell'SDK v10. Al suo posto c'è
 * `sourcemaps.deleteSourcemapsAfterUpload`, che ottiene la stessa cosa in modo
 * più diretto: le mappe vengono caricate su Sentry e poi CANCELLATE dalla
 * cartella di build, invece di restare servite pubblicamente accanto ai bundle.
 * È già il default, ma qui è scritto perché è una decisione sulla riservatezza
 * del codice, non un dettaglio da lasciare implicito.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // In locale il plugin tace: senza token non ha niente da fare, e stampare
  // avvisi a ogni build addestra a ignorarli. Su CI parla, così un upload
  // fallito si vede.
  silent: !process.env.CI,

  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Niente telemetria verso Sentry sul processo di build.
  telemetry: false,

  webpack: {
    treeshake: {
      // Toglie dal bundle il logger di debug dell'SDK: è peso che serve a chi
      // sviluppa l'SDK, non a chi usa Gimmick. (Sostituisce `disableLogger`,
      // deprecata in v10.)
      removeDebugLogging: true,
    },
  },
});
