/**
 * Gimmick — Tracciamento errori (Sentry) del backend.
 *
 * ⚠️ QUESTO MODULO VA IMPORTATO PER PRIMO in `index.ts`, prima di express e di
 * qualunque rotta, e si inizializza DA SOLO al caricamento (in fondo al file).
 *
 * Il motivo è che gli `import` vengono valutati prima di ogni istruzione del
 * modulo che li dichiara: una `initSentry()` scritta come prima riga di
 * `index.ts` girerebbe comunque DOPO che i diciannove router e i loro servizi
 * sono già stati caricati, e l'auto-instrumentation di `@sentry/node` v10
 * arriverebbe a giochi fatti. L'unico modo per essere davvero primi è essere un
 * import a effetto collaterale. `initSentry()` resta esportata, ma è protetta
 * contro la doppia inizializzazione.
 *
 * Per la stessa ragione qui si chiama `dotenv.config()`: quello di `index.ts`
 * gira dopo gli import, quindi senza questo `SENTRY_DSN` sarebbe ancora
 * `undefined`. È lo stesso motivo per cui lo fa già `config/supabase.ts`.
 *
 * ─── Cosa NON esce da qui ────────────────────────────────────────────────────
 * Gimmick archivia pensieri: il testo degli Spark, i titoli dei Tile, le
 * domande fatte ad Ask Gimmick. Un errore non deve portarseli dietro. Perciò:
 *   · niente corpo della richiesta e niente query string (la ricerca semantica
 *     passa da `?q=`, e quella query È il pensiero dell'utente);
 *   · niente header di autenticazione;
 *   · niente breadcrumb da `console`, perché alcuni log stampano contenuto in
 *     chiaro — la query espansa in `services/ai.ts`, il titolo generato dal
 *     parlato in `services/indexing.ts`;
 *   · dell'utente resta il solo `id`: mai email, mai nome.
 */
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

const REDACTED = '[redacted]';

/**
 * Forme note delle chiavi Supabase: il JWT classico (anon/service) e il formato
 * `sb_*` introdotto dopo. Servono da rete di sicurezza per le chiavi che non
 * conosciamo — quelle configurate qui vengono tolte per valore, che è più
 * affidabile di qualunque euristica.
 */
const KEY_PATTERNS: readonly RegExp[] = [
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/g,
];

/** Header che non devono mai lasciare il processo. */
const STRIPPED_HEADERS = ['authorization', 'cookie', 'set-cookie', 'apikey', 'x-api-key'];

/**
 * Toglie query string e frammento da un URL, lasciando il percorso.
 *
 * ⚠️ Non è ridondante rispetto a `delete event.request.query_string`, è LA cosa
 * che conta: l'SDK manda l'URL completo di `?…`, e il server di Sentry lo
 * riparsa ricostruendo `query_string` da sé. Cancellare solo il campo non serve
 * a nulla — la query rientra dalla porta dell'URL. Verificato sul campo: un
 * `?q=frase-di-prova-riservata` è arrivato integro nonostante il `delete`.
 *
 * Il percorso resta perché senza non si sa più quale endpoint è esploso.
 */
function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

let started = false;

/** Vero quando Sentry è davvero attivo: lo usa `index.ts` per montare l'handler. */
export function isSentryEnabled(): boolean {
  return started;
}

export function initSentry(): void {
  if (started) return;

  const dsn = process.env.SENTRY_DSN;
  // In sviluppo non parte nulla: gli errori di chi sta scrivendo il codice non
  // devono finire nello stesso posto di quelli che capitano agli utenti.
  if (!dsn || process.env.NODE_ENV !== 'production') return;

  // Letti una volta sola, alla partenza: `beforeSend` gira su ogni evento.
  const literalSecrets = [process.env.SUPABASE_ANON_KEY, process.env.SUPABASE_SERVICE_KEY]
    .filter((v): v is string => typeof v === 'string' && v.length > 12);

  const scrub = (text: string): string => {
    let out = text;
    for (const secret of literalSecrets) out = out.split(secret).join(REDACTED);
    for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
    return out;
  };

  started = true;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,

    // Performance monitoring spento: su piano gratuito consuma quota in fretta
    // e in questa fase non serve. `0` è esplicito apposta — dice "scelto", non
    // "dimenticato".
    tracesSampleRate: 0,

    // Già il default in v10; lo lasciamo scritto perché è una decisione, non un
    // caso. (In v11 sarà sostituito da `dataCollection`.)
    sendDefaultPii: false,

    // I breadcrumb da console porterebbero dentro il contenuto degli Spark:
    // si toglie l'integrazione alla radice, invece di ripulire dopo.
    integrations: (defaults) => defaults.filter((i) => i.name !== 'Console'),

    beforeSend(event) {
      if (event.request) {
        // Il corpo: è qui che vivono `message` e `history` della chat, il
        // `content` degli Spark, il testo passato a /api/ai/rewrite.
        delete event.request.data;
        // La query string: `GET /api/sparks/search?q=…`, cioè la ricerca
        // semantica. Va tolta da ENTRAMBI i posti in cui vive — vedi
        // `stripQuery`: il solo `delete` qui sotto non basta.
        delete event.request.query_string;
        if (typeof event.request.url === 'string') {
          event.request.url = stripQuery(event.request.url);
        }
        delete event.request.cookies;

        if (event.request.headers) {
          for (const name of Object.keys(event.request.headers)) {
            if (STRIPPED_HEADERS.includes(name.toLowerCase())) {
              delete event.request.headers[name];
            }
          }
        }
      }

      // Stessa perdita, porta diversa: i breadcrumb delle chiamate in USCITA
      // portano l'URL completo, e PostgREST mette i filtri nella query string
      // (`?content=ilike.*…`), quindi lì passerebbe il testo cercato.
      for (const crumb of event.breadcrumbs ?? []) {
        if (crumb.data && typeof crumb.data.url === 'string') {
          crumb.data.url = stripQuery(crumb.data.url);
        }
      }

      // Dell'utente teniamo l'identificativo e nient'altro: serve a capire
      // quante persone ha toccato un guasto, non chi sono.
      event.user = event.user?.id ? { id: String(event.user.id) } : undefined;

      if (event.message) event.message = scrub(event.message);
      if (event.extra) {
        for (const [key, value] of Object.entries(event.extra)) {
          if (typeof value === 'string') event.extra[key] = scrub(value);
        }
      }
      // Nei messaggi d'eccezione una chiave finisce più facilmente che altrove:
      // sono loro a citare le risposte dei servizi esterni.
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrub(exception.value);
      }

      return event;
    },
  });
}

initSentry();
