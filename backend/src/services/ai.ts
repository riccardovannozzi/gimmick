import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './indexing.js';
import { find as findImpl, type FindParams } from './search/find.js';
import type { SparkType } from '../types/index.js';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Gimmick AI, a helpful assistant integrated into the Gimmick app — a personal capture tool. Users capture sparks of various types: photos, images, videos, audio recordings, text notes, and files. Sparks can be organized into Tiles (collections).

You have access to tools that let you query and manage the user's sparks and tiles. Use them to answer questions about their content, find specific sparks, provide statistics, or perform actions like deleting sparks.

Guidelines:
- Be concise and helpful
- When listing sparks, format them clearly with their ID
- IMPORTANT: When the user asks to delete a spark, you MUST execute the deletion immediately using the delete_spark tool. NEVER ask for confirmation. Search for the spark first if needed, then call delete_spark right away in the same turn. After deleting, tell the user what was deleted.
- Dates from the database are in UTC (ISO format). ALWAYS convert them to Europe/Rome timezone (CET/CEST, UTC+1 or UTC+2 in summer) before presenting to the user. For example, 2026-03-07T17:12:00Z in UTC = 18:12 in Italy (CET, UTC+1).
- Spark types: photo, image, video, audio_recording, text, file
- For text sparks, the content field contains the full text.
- For media sparks (photos, images, audio, video, files), the metadata field may contain AI-generated data from indexing: ai_summary (a summary of the content), ai_tags (relevant tags), ai_description (description of images), ai_transcription (transcription of audio/video). Use get_spark to access these fields and answer questions about the content.
- You cannot play or display media files directly, but you CAN read their AI-processed descriptions and transcriptions.
## Vocabolario: come l'utente chiama le cose

Un Tile ha un \`action_type\`, che è QUELLO CHE IL TILE È. L'utente non lo nomina
mai così: usa le parole di tutti i giorni, e tradurle sta a te.

| \`action_type\` | Cos'è | Come l'utente lo chiama |
|---|---|---|
| \`none\` | appunto senza tempo | appunti, note, promemoria, cose segnate |
| \`anytime\` | da fare, senza data | to-do, da fare, cose in sospeso, task |
| \`deadline\` | scade a una data | scadenze, termini, entro quando |
| \`event\` | appuntamento a un orario | appuntamenti, eventi, impegni, agenda, calendario |
| \`flow\` | processo a passi | pratiche, iter, procedure, processi |

Parole ombrello, che coprono più tipi insieme:

- **attività, cose da fare, impegni, roba da sbrigare, che ho da fare** →
  \`anytime\` + \`deadline\` + \`event\` (tutto ciò che richiede un'azione)
- **tutto, i miei tile, le mie cose** → nessun filtro di tipo

Gli Spark invece sono i CONTENUTI dentro un tile: foto, vocali, registrazioni,
video, testi, file, allegati.

⚠️ Una parola di CATEGORIA non si cerca nei contenuti. Se l'utente chiede "che
attività ho?", non cercare la stringa "attività": nessuno l'ha mai scritta in una
nota. Sta chiedendo un ELENCO PER TIPO — vedi la regola qui sotto su quale tool
usare.

## Ricerca

Per QUALSIASI richiesta che implichi cercare contenuti dell'utente, usa il tool \`find\`.

Ma prima decidi di che richiesta si tratta:

- **Parole** ("il preventivo dell'idraulico", "ho qualcosa sui viaggi") → \`find\`
- **Categoria e/o periodo** ("che attività ho domani", "le mie scadenze", "cosa
  ho in agenda") → \`search_tiles\` SENZA query, con \`action_type\` e le date
- **Le due insieme** ("appuntamenti col dentista a marzo") → \`find\` con
  \`filters.action_type\` e \`filters.date_from\`/\`date_to\`

Se la parola ombrello copre più tipi, passali TUTTI INSIEME nell'array
\`action_type\` in UNA chiamata sola: attività → \`["anytime","deadline","event"]\`.
Non fare una chiamata per tipo — te ne resterebbero tre liste ordinate
separatamente da fondere a mano, ed è lì che si sbaglia.

### «Il prossimo», «cosa mi aspetta», «in ordine cronologico»

UNA chiamata a \`search_tiles\`, con tutte e quattro queste cose:

1. \`date_from\` = adesso (Current date/time qui sotto). Senza, peschi anche il
   passato — ed è l'errore più facile da fare: la lista contiene sia il passato
   sia il futuro, e il primo elemento non è "il prossimo".
2. NESSUN \`date_to\`. ⚠️ "Il prossimo" NON HA un limite superiore: la prossima
   cosa in programma può essere domani come fra tre mesi. Restringere a "i
   prossimi giorni" o "questa settimana" è una TUA invenzione, e fa rispondere
   "non hai nulla in programma" a chi ha un appuntamento fra tre settimane. Metti
   un \`date_to\` solo se è l'utente a nominare un periodo.
3. \`order_by: 'scheduled'\`, \`order_dir: 'asc'\`. NON \`start_at\`: la data di una
   scadenza sta in \`end_at\`, e ordinando per \`start_at\` le scadenze finiscono
   tutte in fondo. \`scheduled\` prende da sé la colonna giusta per ogni tipo.
4. \`limit\` piccolo (1 se l'utente ne chiede uno solo).

Se la domanda dice "da fare" nel senso di non ancora fatto, aggiungi
\`is_completed: false\`.

Esempio completo. "Qual è la prossima attività che devo fare?" →
\`search_tiles({ action_type: ["anytime","deadline","event"], is_completed: false,
date_from: <adesso ISO>, order_by: "scheduled", order_dir: "asc", limit: 1 })\`
Una chiamata, nessun date_to, nessuna fusione a mano.

Se il risultato è vuoto, la risposta corretta è "non hai nulla in programma da
qui in avanti". NON ripiegare sul tile passato più vicino presentandolo come il
prossimo: una data già trascorsa non è mai la risposta a "qual è il prossimo".

Prima di dire che una data è "in programma", CONFRONTALA con la data odierna. Se
è passata, non è un impegno futuro — è uno storico, e va detto come tale.

### «Ieri», «oggi», «domani», «questa settimana»

Calcola l'intervallo dalla data odierna e passalo come \`date_from\`/\`date_to\`.
Non filtrare a mano dopo aver preso tutto: i filtri esistono per questo.

Regole:

1. \`find\` è la porta d'ingresso unica per la ricerca. Non usare get_tile, get_spark, get_tile_sparks per cercare — servono solo quando hai già l'ID. NON usare i tool deprecati search_sparks, search_tiles, semantic_search: usa SEMPRE find (fa già keyword + semantic + espansione sinonimi in parallelo, su sparks E tiles insieme).

2. Passa la query in modo naturale. Non riformulare la richiesta in keyword: il tool fa già query expansion (dizionario + LLM). Se l'utente chiede "ho dei corsi di aggiornamento programmati?", passa esattamente quella stringa.

3. Default scope = 'all'. Specifica 'tiles' o 'sparks' solo se l'utente ha esplicitamente distinto.

4. Risultati vuoti: prova UNA volta riformulando, poi fermati.
   - Se find torna vuoto, prova UNA seconda chiamata con riformulazione (es. da "ordine ingegneri" a "albo professionale ingegneri")
   - Se anche la seconda è vuota, comunica all'utente che non hai trovato nulla e chiedi se vuole provare altri termini
   - NON fare 5+ chiamate speculative in sequenza

5. Interpretazione dei risultati di find:
   - tiles: i risultati principali, ordinati per rilevanza (score)
   - orphan_sparks: sparks rilevanti il cui tile non è nei risultati — menziona come "ho trovato anche alcuni appunti correlati"
   - matching_sparks dentro un tile: estratti rilevanti da citare nella risposta
   - matched_via: se è solo ["semantic"] con score basso, abbassa la confidenza
   - expanded_queries: utile per spiegare all'utente come hai interpretato la richiesta

6. CRITICAL: NEVER reply che non hai accesso a informazioni senza prima aver chiamato find. L'informazione è quasi sempre presente nei tile/sparks dell'utente.

## Come presentare i risultati

Il client DISEGNA le tile come card: titolo, tipo, data, ora e stato sono GIÀ VISIBILI all'utente sotto la tua risposta. Non sei tu a doverli scrivere.

1. Chiudi la risposta con una riga finale \`[[tiles: <id>, <id>]]\` che elenca le tile da mostrare, in ordine di rilevanza. Quella riga viene RIMOSSA prima di arrivare all'utente: non è testo, è la tua scelta di cosa disegnare. Se non c'è nulla da mostrare, ometti la riga.

2. Elenca SOLO le tile che rispondono davvero alla domanda, non tutte quelle che \`find\` ha restituito.

3. Nel testo NON ripetere ciò che la card già dice: niente titolo, niente data, niente ora, niente stato di completamento. Scrivi solo ciò che la card non può dire — il contesto, cosa contiene, la risposta alla domanda posta.

4. Niente dettagli interni: mai citare UTC, id, o come il dato è memorizzato.

5. Tieniti breve: una o due frasi sopra le card. Se la card risponde da sola, una sola riga basta.

Esempio. Domanda: "che cosa ho da fare domani?"
Risposta SBAGLIATA: "Domani 9 agosto hai **Chiamare l'idraulico**: · Ora: 15:00 · Stato: non completato"
Risposta GIUSTA: "Sì, una cosa sola:
[[tiles: 3f2a1b8c-...]]"

- Respond in the same language the user writes in.
- Current date/time: {{CURRENT_DATE}}
- When comparing dates/times, use the ISO timestamp for precise calculations. Do NOT estimate relative times (like "un'ora fa") unless you can calculate them exactly from the ISO timestamps.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'find',
    description: `Cerca contenuti nel sistema dell'utente. È IL TOOL PRINCIPALE per qualsiasi ricerca.

Esegue automaticamente in parallelo:
- Ricerca per parole chiave (tollerante a typo, accenti, ordine parole)
- Ricerca semantica via embedding (trova concetti correlati anche con parole diverse)
- Espansione automatica della query con sinonimi italiani

Ritorna risultati raggruppati per Tile, con sparks rilevanti annidati.

USA SEMPRE QUESTO TOOL per richieste tipo:
- "cerca il tile X" / "trova lo spark Y"
- "ho qualcosa su X?"
- "ho programmato Z?" / "mi ricordi cosa avevo su W?"
- ricerche per concetto, sinonimo, parafrasi

NON usare get_tile/get_spark per cercare: quelli servono SOLO quando hai già l'ID.
NON usare i tool deprecati search_sparks/semantic_search: per cercare nei contenuti usa SEMPRE find.

ECCEZIONE — quando la richiesta NON è fatta di parole ma di CATEGORIA e/o PERIODO
("che attività ho domani", "le mie scadenze", "i miei appunti"), usa \`search_tiles\`
senza query, con i filtri. Qui find non serve: cerca nei contenuti, e "attività" nei
contenuti non è scritto da nessuna parte — è un tipo, non una parola.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: "La query in linguaggio naturale italiano. Passa la richiesta dell'utente in modo naturale, non riformularla in keyword.",
        },
        scope: {
          type: 'string',
          enum: ['tiles', 'sparks', 'all'],
          description: "Default 'all' (consigliato).",
        },
        filters: {
          type: 'object',
          properties: {
            action_type: {
              type: 'array',
              items: { type: 'string', enum: ['none', 'anytime', 'deadline', 'event', 'flow'] },
            },
            is_cta: { type: 'boolean', description: 'Filtra solo Tile call-to-action' },
            is_completed: { type: 'boolean' },
            tag_ids: { type: 'array', items: { type: 'string' } },
            date_from: { type: 'string', description: 'ISO 8601' },
            date_to: { type: 'string', description: 'ISO 8601' },
            spark_type: {
              type: 'array',
              items: { type: 'string', enum: ['photo', 'image', 'video', 'audio_recording', 'text', 'file'] },
            },
          },
        },
        limit: { type: 'number', description: 'Default 20' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_sparks',
    description: 'Search sparks by type, text content, or date range. Returns matching sparks with their metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['photo', 'image', 'video', 'audio_recording', 'text', 'file'],
          description: 'Filter by spark type',
        },
        query: {
          type: 'string',
          description: 'Search text in spark content (text sparks) or file_name',
        },
        date_from: {
          type: 'string',
          description: 'Filter sparks created after this ISO date (e.g. 2026-02-01)',
        },
        date_to: {
          type: 'string',
          description: 'Filter sparks created before this ISO date',
        },
        limit: {
          type: 'number',
          description: 'Max number of results (default 10, max 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'count_sparks',
    description: 'Count sparks, optionally filtered by type or date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['photo', 'image', 'video', 'audio_recording', 'text', 'file'],
          description: 'Filter by spark type',
        },
        date_from: {
          type: 'string',
          description: 'Count sparks created after this ISO date',
        },
        date_to: {
          type: 'string',
          description: 'Count sparks created before this ISO date',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_recent_sparks',
    description: 'List the most recent sparks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of sparks to return (default 5, max 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_spark',
    description: 'Get a specific spark by its ID, including full content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The spark UUID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_spark',
    description: 'Delete a specific spark by ID. Only use after user confirms deletion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The spark UUID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tiles',
    description: 'List all tiles (spark collections) for the user.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_tile_sparks',
    description: 'Get all sparks inside a specific tile.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tile_id: {
          type: 'string',
          description: 'The tile UUID',
        },
      },
      required: ['tile_id'],
    },
  },
  {
    name: 'search_tiles',
    description: `ELENCO DI TILE PER CRITERI. La query è FACOLTATIVA: ometterla dà tutti i tile che rispettano i filtri.

USA QUESTO — non \`find\` — quando la richiesta è fatta di CATEGORIA e/o PERIODO invece che di parole:
- "che attività ho domani?" → action_type event/deadline/anytime + date_from/date_to di domani
- "quali scadenze ho questa settimana?" → action_type deadline + intervallo
- "mostrami i miei appunti" → action_type none, nessuna query
- "cos'ho in agenda a settembre?" → action_type event + intervallo

\`find\` cerca nei CONTENUTI: se la parola chiave è un nome di categoria ("attività", "impegni", "appunti") non troverà nulla, perché quella parola nei contenuti non è scritta. Le date filtrano su start_at/end_at, cioè su quando la cosa è programmata.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'FACOLTATIVA. Parole da cercare in titolo e descrizione. OMETTILA per avere l\'elenco completo dei tile che rispettano i filtri.',
        },
        action_type: {
          type: 'array',
          items: { type: 'string', enum: ['none', 'anytime', 'deadline', 'event', 'flow'] },
          description: 'Uno o PIÙ tipi in una sola chiamata. Per "attività / cose da fare / impegni" passa ["anytime","deadline","event"] insieme: NON fare tre chiamate separate.',
        },
        is_completed: {
          type: 'boolean',
          description: 'false = solo ciò che resta da fare. Ometti per avere tutto.',
        },
        date_from: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at >= this',
        },
        date_to: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at <= this',
        },
        order_by: {
          type: 'string',
          enum: ['scheduled', 'start_at', 'end_at', 'completed_at', 'created_at', 'updated_at'],
          description: 'Per «il prossimo», «in ordine cronologico», «cosa mi aspetta» usa SEMPRE "scheduled": è la data che il tile mostra davvero (end_at per le scadenze, start_at per gli eventi), e ordina correttamente tipi diversi mescolati. "start_at" da solo sbaglia sulle scadenze. Per «cosa ho completato di recente» usa "completed_at". Default updated_at (ultima modifica), che NON è un ordine cronologico.',
        },
        order_dir: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Verso. Default: crescente su start_at/end_at, decrescente sulle altre.',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20, max 50)',
        },
      },
    },
  },
  {
    name: 'count_tiles',
    description: 'Count user tiles, optionally filtered by action_type or date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        action_type: {
          type: 'string',
          enum: ['none', 'anytime', 'deadline', 'event', 'flow'],
          description: 'Filter by action_type',
        },
        date_from: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at >= this',
        },
        date_to: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at <= this',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_recent_tiles',
    description: 'List the most recent tiles ordered by updated_at desc. Default 5, max 20.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'How many recent tiles to return (default 5, max 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_tile',
    description: 'Get full detail of a single tile by id (title, description, action_type, dates, status, plus all sparks inside it with their AI metadata).',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The tile UUID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'semantic_search',
    description: 'Search sparks by meaning using AI embeddings. Use this for conceptual queries like "notes about travel", "recordings mentioning the budget", etc. Returns sparks ranked by semantic similarity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 20)',
        },
      },
      required: ['query'],
    },
  },
];

// Date helpers
/**
 * Racchiude un valore fra virgolette per i filtri PostgREST.
 *
 * Dentro `or(...)` la virgola, le parentesi e il punto sono SINTASSI, non testo:
 * un valore che li contiene aggiunge condizioni proprie al gruppo. E questi
 * valori arrivano dal messaggio dell'utente, passando per il tool use di Claude
 * — `query`, `date_from`, `date_to` sono tutti stringhe che l'utente detta.
 *
 * Il rimedio previsto dal protocollo è la virgoletta doppia, con backslash e
 * virgolette a loro volta protette. I caratteri jolly di ILIKE (`%`, `_`)
 * restano attivi apposta: servono alla ricerca.
 *
 * Nota su cosa NON era in gioco: `.eq('user_id', …)` è sempre stato un
 * parametro separato, in AND con l'intero gruppo `or`, quindi da qui non si
 * arrivava ai dati di un altro utente. Bastava però spostare quell'`eq` dentro
 * l'`or` in un refactor futuro perché lo diventasse.
 */
function pgQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function normalizeDateFrom(d: string): string {
  return d.includes('T') ? d : `${d}T00:00:00`;
}
function normalizeDateTo(d: string): string {
  return d.includes('T') ? d : `${d}T23:59:59.999`;
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  console.log(`[AI Tool] ${toolName}`, JSON.stringify(toolInput));
  const result = await executeToolInner(toolName, toolInput, userId);
  console.log(`[AI Tool] ${toolName} result:`, result.substring(0, 200));
  return result;
}

async function executeToolInner(
  toolName: string,
  toolInput: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (toolName) {
    case 'find':
      return findTool(toolInput, userId);
    case 'search_sparks':
      return searchSparks(toolInput, userId);
    case 'count_sparks':
      return countSparks(toolInput, userId);
    case 'list_recent_sparks':
      return listRecentSparks(toolInput, userId);
    case 'get_spark':
      return getSpark(toolInput, userId);
    case 'delete_spark':
      return deleteSpark(toolInput, userId);
    case 'list_tiles':
      return listTiles(userId);
    case 'get_tile_sparks':
      return getTileSparks(toolInput, userId);
    case 'search_tiles':
      return searchTiles(toolInput, userId);
    case 'count_tiles':
      return countTiles(toolInput, userId);
    case 'list_recent_tiles':
      return listRecentTiles(toolInput, userId);
    case 'get_tile':
      return getTile(toolInput, userId);
    case 'semantic_search':
      return semanticSearch(toolInput, userId);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function searchSparks(input: Record<string, unknown>, userId: string): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 50);

  let query = supabaseAdmin
    .from('sparks')
    .select('id, type, content, file_name, file_size, duration, tile_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.type) query = query.eq('type', input.type as SparkType);
  if (input.query) {
    const like = pgQuote(`%${String(input.query)}%`);
    query = query.or(`content.ilike.${like},file_name.ilike.${like}`);
  }
  if (input.date_from) query = query.gte('created_at', normalizeDateFrom(input.date_from as string));
  if (input.date_to) query = query.lte('created_at', normalizeDateTo(input.date_to as string));

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ sparks: data, count: data?.length ?? 0 });
}

async function countSparks(input: Record<string, unknown>, userId: string): Promise<string> {
  let query = supabaseAdmin
    .from('sparks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (input.type) query = query.eq('type', input.type as SparkType);
  if (input.date_from) query = query.gte('created_at', normalizeDateFrom(input.date_from as string));
  if (input.date_to) query = query.lte('created_at', normalizeDateTo(input.date_to as string));

  const { count, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ count: count ?? 0 });
}

async function listRecentSparks(input: Record<string, unknown>, userId: string): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 20);

  const { data, error } = await supabaseAdmin
    .from('sparks')
    .select('id, type, content, file_name, file_size, duration, tile_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ sparks: data, count: data?.length ?? 0 });
}

async function getSpark(input: Record<string, unknown>, userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('sparks')
    .select('*')
    .eq('id', input.id as string)
    .eq('user_id', userId)
    .single();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ error: 'Spark not found' });
  return JSON.stringify(data);
}

async function deleteSpark(input: Record<string, unknown>, userId: string): Promise<string> {
  const { data: spark, error: fetchError } = await supabaseAdmin
    .from('sparks')
    .select('id, type, file_name, storage_path')
    .eq('id', input.id as string)
    .eq('user_id', userId)
    .single();

  if (fetchError || !spark) return JSON.stringify({ error: 'Spark not found or access denied' });

  if (spark.storage_path) {
    await supabaseAdmin.storage.from('sparks').remove([spark.storage_path]);
  }

  const { error } = await supabaseAdmin
    .from('sparks')
    .delete()
    .eq('id', input.id as string)
    .eq('user_id', userId);

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ deleted: true, spark_id: spark.id, file_name: spark.file_name });
}

async function listTiles(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tiles')
    .select('id, title, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });

  const tilesWithCounts = await Promise.all(
    (data || []).map(async (tile) => {
      const { count } = await supabaseAdmin
        .from('sparks')
        .select('*', { count: 'exact', head: true })
        .eq('tile_id', tile.id);
      return { ...tile, spark_count: count ?? 0 };
    })
  );

  return JSON.stringify({ tiles: tilesWithCounts, count: tilesWithCounts.length });
}

async function getTileSparks(input: Record<string, unknown>, userId: string): Promise<string> {
  const { data: tile, error: tileError } = await supabaseAdmin
    .from('tiles')
    .select('id, title')
    .eq('id', input.tile_id as string)
    .eq('user_id', userId)
    .single();

  if (tileError || !tile) return JSON.stringify({ error: 'Tile not found or access denied' });

  const { data, error } = await supabaseAdmin
    .from('sparks')
    .select('id, type, content, file_name, file_size, duration, created_at')
    .eq('tile_id', input.tile_id as string)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ tile: tile.title, sparks: data, count: data?.length ?? 0 });
}

/**
 * Riscrive un testo secondo un'istruzione (azioni AI dell'editor markdown).
 * Usata da POST /api/ai/rewrite. Ritorna SOLO il testo riscritto (Markdown),
 * conservando la lingua originale. Su testo vuoto/errore ritorna l'originale.
 */
export async function rewriteText(text: string, instruction: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system:
      "Sei un assistente di scrittura integrato in un editor di testo. " +
      "Riscrivi il testo dell'utente seguendo l'istruzione fornita. " +
      "Regole ferree: rispondi SOLO con il testo riscritto, senza preamboli, " +
      "virgolette di apertura/chiusura, commenti o spiegazioni; mantieni la " +
      "lingua originale del testo; conserva la formattazione Markdown dove sensato.",
    messages: [
      { role: 'user', content: `Istruzione: ${instruction}\n\nTesto:\n${text}` },
    ],
  });
  const out = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  return out || text;
}

async function expandQueryBilingual(query: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Translate this search query to both Italian and English. Return ONLY the two versions separated by " / ". No explanation.\n\nQuery: ${query}`,
        },
      ],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : query;
    return text || query;
  } catch {
    return query;
  }
}

/** Quante righe si leggono prima di ordinarle cronologicamente in memoria. */
const SCHEDULED_SCAN = 200;

async function searchTiles(input: Record<string, unknown>, userId: string): Promise<string> {
  const query = (input.query as string)?.trim();
  const limit = Math.min(Number(input.limit) || 20, 50);

  let q = supabaseAdmin
    .from('tiles')
    .select('id, title, description, action_type, start_at, end_at, all_day, is_completed, completed_at, created_at')
    .eq('user_id', userId);

  // Query FACOLTATIVA: senza, questo è un elenco per criteri e non una ricerca.
  // Era obbligatoria, e mancando un tool capace di elencare per tipo e periodo
  // una domanda come «che attività ho domani» non aveva strumento giusto da
  // chiamare — il modello cercava la parola "attività" nei contenuti e non
  // trovava nulla, perché non è una parola scritta da nessuna parte: è una
  // categoria.
  if (query) {
    q = q.or(`title.ilike.${pgQuote(`%${query}%`)},description.ilike.${pgQuote(`%${query}%`)}`);
  }

  // PIÙ TIPI IN UNA CHIAMATA. Era un valore solo, e siccome le parole ombrello
  // dell'utente ne coprono tre ("attività" = anytime + deadline + event), il
  // modello doveva fare tre chiamate e fondere a mente tre liste ordinate
  // separatamente. Non ci riusciva: sceglieva il primo elemento della lista
  // sbagliata e rispondeva con una data già passata.
  const rawTypes = input.action_type;
  const types = Array.isArray(rawTypes)
    ? (rawTypes as string[])
    : typeof rawTypes === 'string' && rawTypes
      ? [rawTypes]
      : [];
  if (types.length === 1) q = q.eq('action_type', types[0]);
  else if (types.length > 1) q = q.in('action_type', types);

  // "Da fare" nel senso di NON ancora fatto: senza questo filtro il modello non
  // aveva modo di escludere ciò che l'utente ha già chiuso.
  if (typeof input.is_completed === 'boolean') q = q.eq('is_completed', input.is_completed);

  if (input.date_from) {
    const from = pgQuote(normalizeDateFrom(input.date_from as string));
    q = q.or(`start_at.gte.${from},end_at.gte.${from}`);
  }
  if (input.date_to) {
    const to = pgQuote(normalizeDateTo(input.date_to as string));
    q = q.or(`start_at.lte.${to},end_at.lte.${to}`);
  }

  const ORDERABLE = new Set(['scheduled', 'start_at', 'end_at', 'completed_at', 'created_at', 'updated_at']);
  const orderBy = ORDERABLE.has(input.order_by as string)
    ? (input.order_by as string)
    : 'updated_at';
  const scheduled = orderBy === 'scheduled';
  // Su una data di PROGRAMMAZIONE il verso naturale è crescente ("il prossimo"),
  // su una data di MODIFICA è decrescente ("il più recente").
  const defaultAsc = scheduled || orderBy === 'start_at' || orderBy === 'end_at';
  const ascending =
    input.order_dir === 'asc' ? true : input.order_dir === 'desc' ? false : defaultAsc;

  if (scheduled) {
    // ⚠️ La data che conta CAMBIA COL TIPO: una scadenza la porta in `end_at`,
    // tutto il resto in `start_at` (stessa regola della card — vedi
    // `tileWhen` in mobile/lib/obsidian-adapters.ts). Nessuna singola colonna la
    // rappresenta, quindi ordinare per `start_at` spingeva in fondo proprio le
    // scadenze, che di quella colonna sono prive.
    //
    // Si prende un blocco e si ordina qui: i filtri hanno già ristretto, e
    // ordinare in SQL vorrebbe dire una vista o una funzione per una COALESCE.
    const { data, error } = await q.limit(SCHEDULED_SCAN);
    if (error) return JSON.stringify({ error: error.message });

    const whenOf = (t: { action_type?: string | null; start_at?: string | null; end_at?: string | null }) => {
      const iso = t.action_type === 'deadline' ? (t.end_at ?? t.start_at) : (t.start_at ?? t.end_at);
      const ts = iso ? new Date(iso).getTime() : NaN;
      return Number.isNaN(ts) ? null : ts;
    };

    const rows = (data ?? [])
      .map((t) => ({ t, w: whenOf(t) }))
      .sort((a, b) => {
        // Senza data sempre in fondo, in entrambi i versi: un tile non
        // programmato non è "il prossimo" né "l'ultimo".
        if (a.w === null && b.w === null) return 0;
        if (a.w === null) return 1;
        if (b.w === null) return -1;
        return ascending ? a.w - b.w : b.w - a.w;
      })
      .slice(0, limit)
      .map((x) => x.t);

    return JSON.stringify({ tiles: rows, count: rows.length, query, ordered_by: 'scheduled' });
  }

  const { data, error } = await q
    .order(orderBy, { ascending, nullsFirst: false })
    .limit(limit);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ tiles: data || [], count: data?.length ?? 0, query, ordered_by: orderBy });
}

async function countTiles(input: Record<string, unknown>, userId: string): Promise<string> {
  let q = supabaseAdmin.from('tiles').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (input.action_type) q = q.eq('action_type', input.action_type as string);
  if (input.date_from) {
    const from = pgQuote(normalizeDateFrom(input.date_from as string));
    q = q.or(`start_at.gte.${from},end_at.gte.${from}`);
  }
  if (input.date_to) {
    const to = pgQuote(normalizeDateTo(input.date_to as string));
    q = q.or(`start_at.lte.${to},end_at.lte.${to}`);
  }
  const { count, error } = await q;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ count: count ?? 0 });
}

async function listRecentTiles(input: Record<string, unknown>, userId: string): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 20);
  const { data, error } = await supabaseAdmin
    .from('tiles')
    .select('id, title, description, action_type, start_at, end_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ tiles: data || [], count: data?.length ?? 0 });
}

async function getTile(input: Record<string, unknown>, userId: string): Promise<string> {
  const id = input.id as string;
  if (!id) return JSON.stringify({ error: 'id is required' });
  const { data: tile, error: tileErr } = await supabaseAdmin
    .from('tiles')
    .select('id, title, description, action_type, all_day, is_event, start_at, end_at, status_id, created_at, updated_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (tileErr) return JSON.stringify({ error: tileErr.message });
  if (!tile) return JSON.stringify({ error: 'Tile not found' });

  const { data: sparks } = await supabaseAdmin
    .from('sparks')
    .select('id, type, content, file_name, mime_type, metadata, created_at')
    .eq('user_id', userId)
    .eq('tile_id', id)
    .order('created_at', { ascending: true });

  return JSON.stringify({ tile, sparks: sparks || [] });
}

async function findTool(input: Record<string, unknown>, userId: string): Promise<string> {
  const query = (input.query as string)?.trim();
  if (!query) return JSON.stringify({ error: 'Query is required' });

  const params: FindParams = {
    query,
    scope: (input.scope as FindParams['scope']) ?? 'all',
    filters: (input.filters as FindParams['filters']) ?? undefined,
    limit: typeof input.limit === 'number' ? input.limit : undefined,
  };

  try {
    const result = await findImpl(userId, params);
    console.log(
      `[find] q="${query}" expanded=${result.expanded_queries.length} tiles=${result.tiles.length} orphans=${result.orphan_sparks.length}`,
    );
    return JSON.stringify(result);
  } catch (err) {
    console.error('[findTool] failed:', err);
    return JSON.stringify({ error: 'Find failed', tiles: [], orphan_sparks: [], total_results: 0 });
  }
}

async function semanticSearch(input: Record<string, unknown>, userId: string): Promise<string> {
  const query = input.query as string;
  if (!query) return JSON.stringify({ error: 'Query is required' });

  const limit = Math.min(Number(input.limit) || 5, 20);

  try {
    const bilingualQuery = await expandQueryBilingual(query);
    console.log(`[AI Semantic] Original: "${query}" → Expanded: "${bilingualQuery}"`);
    const queryEmbedding = await generateEmbedding(bilingualQuery);

    const { data, error } = await supabaseAdmin.rpc('match_sparks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.2,
      match_count: limit,
      match_user_id: userId,
    });

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({ sparks: data || [], count: data?.length ?? 0, query });
  } catch {
    return JSON.stringify({ error: 'Semantic search failed' });
  }
}

function extractSparkIds(toolName: string, resultJson: string): string[] {
  try {
    const parsed = JSON.parse(resultJson);
    const ids: string[] = [];
    if (parsed.sparks && Array.isArray(parsed.sparks)) {
      ids.push(...parsed.sparks.map((s: { id: string }) => s.id).filter(Boolean));
    }
    if (parsed.id && (toolName === 'get_spark')) ids.push(parsed.id);
    // find tool result: { tiles: [{ matching_sparks: [...] }], orphan_sparks: [...] }
    if (parsed.tiles && Array.isArray(parsed.tiles)) {
      for (const t of parsed.tiles) {
        if (t.matching_sparks && Array.isArray(t.matching_sparks)) {
          ids.push(...t.matching_sparks.map((s: { id: string }) => s.id).filter(Boolean));
        }
      }
    }
    if (parsed.orphan_sparks && Array.isArray(parsed.orphan_sparks)) {
      ids.push(...parsed.orphan_sparks.map((s: { id: string }) => s.id).filter(Boolean));
    }
    return [...new Set(ids)];
  } catch {}
  return [];
}

function extractTileIds(toolName: string, resultJson: string): string[] {
  try {
    const parsed = JSON.parse(resultJson);
    const ids: string[] = [];
    if (parsed.tiles && Array.isArray(parsed.tiles)) {
      ids.push(...parsed.tiles.map((t: { id: string }) => t.id).filter(Boolean));
    }
    if (parsed.sparks && Array.isArray(parsed.sparks)) {
      for (const s of parsed.sparks) {
        if (s.tile_id) ids.push(s.tile_id);
      }
    }
    if (parsed.orphan_sparks && Array.isArray(parsed.orphan_sparks)) {
      for (const s of parsed.orphan_sparks) {
        if (s.tile_id) ids.push(s.tile_id);
      }
    }
    if (parsed.tile_id && typeof parsed.tile_id === 'string') {
      ids.push(parsed.tile_id);
    }
    if (toolName === 'get_tile' && parsed.tile && typeof parsed.tile.id === 'string') {
      ids.push(parsed.tile.id);
    }
    return [...new Set(ids)];
  } catch {}
  return [];
}

/**
 * Riga di tile che il client può DISEGNARE, non solo linkare.
 *
 * I tool restituiscono già queste colonne — `extractTileIds` le buttava via
 * tenendo il solo id, e il client si ritrovava con degli UUID da cui non poteva
 * ricavare una card senza rifare una query per ognuno. Sono i campi che tutti i
 * tool di ricerca hanno in comune; `end_at` e `all_day` li porta solo qualcuno,
 * quindi sono opzionali e la resa deve reggere la loro assenza.
 */
export interface ChatTileSummary {
  id: string;
  title: string | null;
  description: string | null;
  action_type: string | null;
  start_at: string | null;
  end_at?: string | null;
  all_day?: boolean | null;
  is_completed?: boolean | null;
  is_cta?: boolean | null;
}

export interface ChatResult {
  reply: string;
  foundSparkIds: string[];
  foundTileIds: string[];
  /**
   * Sottoinsieme di `foundTileIds` per cui abbiamo i dati da renderizzare. Non
   * coincide sempre: un tile pescato via `tile_id` di uno spark è noto solo per
   * id, e finirebbe in una card vuota. Meglio non disegnarlo che disegnarlo
   * senza titolo.
   */
  foundTiles: ChatTileSummary[];
}

/**
 * Riga con cui il modello dichiara QUALI tile vanno disegnate: `[[tiles: a, b]]`.
 *
 * Serve perché senza, l'unica alternativa è mostrare tutto ciò che la ricerca ha
 * toccato — e `find` restituisce fino a 20 tile per rilevanza, mentre la domanda
 * ne riguardava una. Il marcatore viene tolto dal testo prima di uscire: non è
 * contenuto, è la scelta di cosa disegnare.
 */
const TILE_MARKER = /\[\[tiles?:\s*([^\]]*)\]\]/i;

function extractTileSelection(reply: string): { reply: string; ids: string[] | null } {
  const m = reply.match(TILE_MARKER);
  if (!m) return { reply, ids: null };
  const ids = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { reply: reply.replace(TILE_MARKER, '').trimEnd(), ids };
}

/** Estrae le righe di tile là dove il tool le espone per intero. */
function extractTileRows(toolName: string, resultJson: string): ChatTileSummary[] {
  try {
    const parsed = JSON.parse(resultJson);
    const rows: ChatTileSummary[] = [];
    const take = (t: Record<string, unknown>) => {
      if (!t || typeof t.id !== 'string') return;
      rows.push({
        id: t.id,
        title: (t.title as string) ?? null,
        description: (t.description as string) ?? null,
        action_type: (t.action_type as string) ?? null,
        start_at: (t.start_at as string) ?? null,
        end_at: (t.end_at as string) ?? null,
        all_day: (t.all_day as boolean) ?? null,
        is_completed: (t.is_completed as boolean) ?? null,
        is_cta: (t.is_cta as boolean) ?? null,
      });
    };
    // `find`, `search_tiles`, `list_tiles`, `list_recent_tiles`, `count_tiles`
    if (Array.isArray(parsed.tiles)) parsed.tiles.forEach(take);
    // `get_tile` annida la riga sotto `tile`.
    if (toolName === 'get_tile' && parsed.tile) take(parsed.tile);
    return rows;
  } catch {
    return [];
  }
}

export async function chat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userId: string,
  model: string = 'claude-haiku-4-5-20251001',
  /**
   * Allegati del turno corrente (immagine, PDF o testo estratto), già convertiti
   * in blocchi da `utils/chat-attachment`. Vuoto → il turno è la sola stringa,
   * esattamente come prima.
   */
  attachments: Anthropic.ContentBlockParam[] = []
): Promise<ChatResult> {
  const collectedSparkIds: Set<string> = new Set();
  const collectedTileIds: Set<string> = new Set();
  const collectedTileRows: Map<string, ChatTileSummary> = new Map();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    // Gli allegati vanno PRIMA del testo: è l'ordine raccomandato dall'API, e
    // ha senso anche a leggerlo — la domanda arriva dopo ciò a cui si riferisce.
    attachments.length > 0
      ? { role: 'user' as const, content: [...attachments, { type: 'text' as const, text: message }] }
      : { role: 'user' as const, content: message },
  ];

  const now = new Date();
  const isoNow = now.toISOString();
  const readableNow = now.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'long', timeZone: 'Europe/Rome' });
  const systemPrompt = SYSTEM_PROMPT.replace(
    '{{CURRENT_DATE}}',
    `${readableNow} (ISO: ${isoNow})`
  );

  let response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages,
  });

  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    const toolUseBlocks = assistantContent.filter(
      (block) => block.type === 'tool_use'
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const tu = toolUse as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
        const result = await executeTool(tu.name, tu.input, userId);

        for (const id of extractSparkIds(tu.name, result)) {
          collectedSparkIds.add(id);
        }
        for (const id of extractTileIds(tu.name, result)) {
          collectedTileIds.add(id);
        }
        // Le righe intere, per chi la risposta la disegna invece di linkarla.
        // La prima vince: se più tool tornano lo stesso tile, la ricerca lo ha
        // già dato completo e un passaggio successivo non aggiunge nulla.
        for (const row of extractTileRows(tu.name, result)) {
          if (!collectedTileRows.has(row.id)) collectedTileRows.set(row.id, row);
        }
        if (tu.name === 'get_tile_sparks' && tu.input.tile_id) {
          collectedTileIds.add(tu.input.tile_id as string);
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: result,
        };
      })
    );

    messages.push({ role: 'assistant', content: assistantContent });
    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    });
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  const rawReply = textBlock ? (textBlock as Anthropic.TextBlock).text : 'No response generated.';

  // Il marcatore va tolto PRIMA di qualunque altra cosa: contiene degli id, e
  // lasciarlo dentro farebbe scattare il riconoscimento "id citato nel testo"
  // qui sotto su tutto ciò che elenca, oltre a finire sotto gli occhi
  // dell'utente.
  const { reply, ids: selectedTileIds } = extractTileSelection(rawReply);

  const mentionedSparkIds = Array.from(collectedSparkIds).filter((id) => reply.includes(id.substring(0, 8)));
  const mentionedTileIds = Array.from(collectedTileIds).filter((id) => reply.includes(id.substring(0, 8)));

  // Tolleranza sulla forma dell'id: il modello può troncarlo o citarlo intero.
  const knownTileIds = Array.from(collectedTileIds);
  const resolveTileId = (raw: string) =>
    knownTileIds.find((id) => id === raw || id.startsWith(raw));

  // Due insiemi DIVERSI, e la differenza conta.
  //
  // `touched` = tutto ciò che la ricerca ha sfiorato. È quello che il web usa per
  // i link, e resta com'era.
  const touchedTileIds = mentionedTileIds.length > 0 ? mentionedTileIds : Array.from(collectedTileIds);

  // `display` = solo ciò che il modello ha scelto di mostrare. NIENTE ripiego
  // sull'intero raccolto: quando il modello scrive «non ho trovato attività
  // programmate» e sotto compaiono tre card, il testo e lo schermo si
  // contraddicono. Se non sceglie, non si disegna — meglio nessuna card che
  // card che smentiscono la risposta.
  const displayTileIds = selectedTileIds?.length
    ? selectedTileIds.map(resolveTileId).filter((id): id is string => !!id)
    : mentionedTileIds;

  return {
    reply,
    foundSparkIds: mentionedSparkIds.length > 0 ? mentionedSparkIds : Array.from(collectedSparkIds),
    foundTileIds: touchedTileIds,
    // Nell'ordine in cui il modello le ha elencate — che per una domanda
    // cronologica è l'ordine giusto, e per una ricerca è quello di rilevanza.
    // Riordinarle qui butterebbe via entrambi.
    foundTiles: displayTileIds
      .map((id) => collectedTileRows.get(id))
      .filter((t): t is ChatTileSummary => !!t),
  };
}
