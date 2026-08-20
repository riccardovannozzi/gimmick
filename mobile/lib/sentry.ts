/**
 * Gimmick — Tracciamento errori (Sentry) dell'app mobile.
 *
 * ⚠️ QUESTO MODULO VA IMPORTATO PER PRIMO in `index.ts`, prima di
 * `expo-router/entry`, e si inizializza DA SOLO al caricamento (in fondo al
 * file). Gli `import` sono valutati prima di ogni istruzione, quindi l'unico
 * modo per stare davvero davanti al router — e quindi al render del componente
 * radice — è essere un import a effetto collaterale. Stessa impostazione del
 * backend.
 *
 * ─── Cosa NON esce da qui ────────────────────────────────────────────────────
 * Gimmick archivia pensieri: il testo degli Spark, i titoli dei Tile, le
 * domande fatte ad Ask Gimmick. Un errore non deve portarseli dietro.
 *
 * La regola che conta, imparata sul backend e verificata sul campo: cancellare
 * `query_string` NON BASTA, perché l'URL se la porta dentro e il server di
 * Sentry la ricostruisce riparsando l'URL. Va tagliata da lì — vedi
 * `stripQuery`. Sul mobile riguarda soprattutto i breadcrumb di rete: la
 * ricerca semantica passa da `GET /api/sparks/search?q=…`.
 */
import * as Sentry from '@sentry/react-native';

const REDACTED = '[redacted]';

/**
 * Forme di chiave/token da non far uscire mai. Il JWT copre sia la chiave
 * Supabase sia l'access token dell'utente, che vive in AsyncStorage e finisce
 * facilmente dentro il messaggio di un errore di rete.
 */
const KEY_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
];

/** Toglie query string e frammento, lascia il percorso: serve sapere DOVE è
 *  successo, non con quali parametri. */
function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function scrubSecrets(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

let started = false;

/** Vero quando Sentry è davvero attivo. Utile ai test e alla diagnostica. */
export function isSentryEnabled(): boolean {
  return started;
}

export function initSentry(): void {
  if (started) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  // In sviluppo non parte nulla: gli errori di chi sta scrivendo il codice non
  // devono finire nello stesso posto di quelli che capitano agli utenti.
  if (!dsn || __DEV__) return;

  started = true;

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'production',

    // Niente Performance Monitoring e niente Session Replay: su piano gratuito
    // consumano quota in fretta e in questa fase non servono. Lo zero è
    // esplicito apposta — dice "scelto", non "dimenticato".
    tracesSampleRate: 0,

    sendDefaultPii: false,

    beforeBreadcrumb(breadcrumb) {
      // I log di console se ne vanno interi: in sviluppo Gimmick stampa
      // contenuto vero, e un breadcrumb non si accorge della differenza.
      if (breadcrumb.category === 'console') return null;

      const data = breadcrumb.data;
      if (!data) return breadcrumb;

      // Delle chiamate di rete resta CHE sono avvenute e come sono finite, non
      // cosa portavano: via il corpo, via la query dall'URL.
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        delete data.body;
        delete data.request_body_size;
        delete data.response_body_size;
      }
      for (const key of ['url', 'from', 'to']) {
        if (typeof data[key] === 'string') data[key] = stripQuery(data[key]);
      }
      return breadcrumb;
    },

    beforeSend(event) {
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
            if (lower === 'authorization' || lower === 'cookie' || lower === 'apikey') {
              delete event.request.headers[name];
            }
          }
        }
      }

      // Seconda passata sui breadcrumb già raccolti: alcuni entrano nell'evento
      // per strade che non passano da `beforeBreadcrumb`.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.filter((b) => b.category !== 'console');
        for (const crumb of event.breadcrumbs) {
          if (crumb.data && typeof crumb.data.url === 'string') {
            crumb.data.url = stripQuery(crumb.data.url);
          }
        }
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
    },
  });
}

initSentry();
