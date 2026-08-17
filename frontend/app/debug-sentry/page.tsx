'use client';

/**
 * ⚠️ PAGINA TEMPORANEA — DA CANCELLARE DOPO LA VERIFICA DELLE SOURCE MAP.
 *
 * Secondo giro: la prima volta serviva a controllare che il filtro privacy
 * reggesse (e reggeva). Questa volta serve a controllare che con
 * `SENTRY_AUTH_TOKEN` impostato lo stack trace diventi leggibile — cioè che
 * l'evento citi QUESTO file invece di `ux`/`uE` a riga 1 colonna 105122.
 */
import { useEffect } from 'react';

export default function DebugSentryPage() {
  useEffect(() => {
    throw new Error('Sentry sourcemap check — pagina di verifica, va rimossa');
  }, []);

  return <p style={{ padding: 24, fontFamily: 'sans-serif' }}>Innesco dell&apos;errore di prova…</p>;
}
