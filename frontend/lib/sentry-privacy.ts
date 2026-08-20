/**
 * Gimmick — Cosa NON deve uscire dal browser (e dal server Next) verso Sentry.
 *
 * Scritto una volta e condiviso dalle quattro inizializzazioni del pacchetto
 * (`instrumentation-client`, `sentry.server.config`, `sentry.edge.config`,
 * più il `register` di `instrumentation`): sono impostazioni di riservatezza,
 * e tre copie sono tre occasioni perché una resti indietro.
 *
 * Gimmick archivia pensieri — testo degli Spark, titoli dei Tile, domande fatte
 * ad Ask Gimmick. Un errore non deve portarseli dietro.
 *
 * ⚠️ La lezione del backend, verificata sul campo: cancellare
 * `event.request.query_string` NON BASTA. L'SDK manda l'URL completo di `?…` e
 * il server di Sentry lo riparsa, ricostruendo la query da sé. Va tagliata
 * dall'URL, che sul web è pure `location.href` — cioè quello che stai
 * guardando, filtri e ricerche compresi.
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

const REDACTED = '[redacted]';

/**
 * Forme di chiave/token da non far uscire mai. Il JWT copre sia le chiavi
 * Supabase sia l'access token dell'utente, che sul web vive in `localStorage` e
 * finisce facilmente dentro il messaggio di un errore di rete.
 */
const KEY_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
];

/** Toglie query string e frammento, lascia il percorso: serve sapere DOVE è
 *  successo, non con quali parametri. */
export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

export function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

/**
 * Ripulisce un breadcrumb prima che entri nell'evento.
 *
 * · I breadcrumb di `console` se ne vanno interi: in sviluppo i log di Gimmick
 *   stampano contenuto vero, e un breadcrumb non si accorge della differenza.
 * · Di `fetch` e `xhr` resta il fatto che una chiamata è avvenuta e com'è
 *   finita, non cosa portava: via il corpo, via la query dall'URL. È il
 *   percorso che dice quale endpoint ha fallito, e quello resta.
 * · Le navigazioni portano l'URL con i filtri applicati: stesso taglio.
 */
export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;

  const data = breadcrumb.data;
  if (!data) return breadcrumb;

  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    delete data.body;
    delete data.request_body_size;
    delete data.response_body_size;
  }
  for (const key of ['url', 'from', 'to'] as const) {
    if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
  }
  return breadcrumb;
}

/**
 * Ultima passata prima dell'invio. Ripete il lavoro di `sanitizeBreadcrumb` sui
 * breadcrumb già raccolti: alcuni entrano nell'evento per strade che non
 * passano da `beforeBreadcrumb` (per esempio quelli ricostruiti da un'altra
 * integrazione), e qui la rete si chiude comunque.
 */
export function sanitizeEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.cookies;
    if (typeof event.request.url === 'string') {
      event.request.url = stripQuery(event.request.url);
    }
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        const lower = name.toLowerCase();
        if (lower === 'authorization' || lower === 'cookie' || lower === 'apikey' || lower === 'referer') {
          delete event.request.headers[name];
        }
      }
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => sanitizeBreadcrumb(b))
      .filter((b): b is Breadcrumb => b !== null);
  }

  // Dell'utente resta l'identificativo e nient'altro: serve a sapere quante
  // persone ha toccato un guasto, non chi sono.
  event.user = event.user?.id ? { id: String(event.user.id) } : undefined;

  if (event.message) event.message = scrubSecrets(event.message);
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (typeof value === 'string') event.extra[key] = scrubSecrets(value);
    }
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubSecrets(exception.value);
  }

  return event;
}

/**
 * Opzioni comuni alle inizializzazioni. `enabled` è il vero interruttore: senza
 * DSN o fuori dalla produzione non parte nulla, così gli errori di chi scrive
 * il codice non finiscono nello stesso posto di quelli degli utenti.
 */
export const sentryCommonOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,

  // Niente Performance Monitoring, niente Session Replay: su piano gratuito
  // consumano quota in fretta e in questa fase non servono. Gli zeri sono
  // espliciti apposta — dicono "scelto", non "dimenticato".
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  sendDefaultPii: false,

  beforeBreadcrumb: sanitizeBreadcrumb,
  beforeSend: sanitizeEvent,
} as const;
