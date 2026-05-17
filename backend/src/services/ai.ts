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
## Ricerca

Per QUALSIASI richiesta che implichi cercare contenuti dell'utente, usa il tool \`find\`.

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
NON usare i tool deprecati search_sparks/search_tiles/semantic_search: usa SEMPRE find.`,
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
              items: { type: 'string', enum: ['none', 'anytime', 'deadline', 'event'] },
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
    description: 'Search tiles by keyword in title or description, optionally filtered by action_type or date range. Use this for any informational query — events, seminars, organizations, names, addresses, etc. Returns matching tiles with id, title, description.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Keyword(s) to match against title and description (case-insensitive substring match)',
        },
        action_type: {
          type: 'string',
          enum: ['none', 'anytime', 'deadline', 'event'],
          description: 'Filter by tile action_type',
        },
        date_from: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at >= this',
        },
        date_to: {
          type: 'string',
          description: 'ISO date — only tiles with start_at/end_at <= this',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20, max 50)',
        },
      },
      required: ['query'],
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
          enum: ['none', 'anytime', 'deadline', 'event'],
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
    query = query.or(`content.ilike.%${input.query}%,file_name.ilike.%${input.query}%`);
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

async function searchTiles(input: Record<string, unknown>, userId: string): Promise<string> {
  const query = (input.query as string)?.trim();
  if (!query) return JSON.stringify({ error: 'Query is required' });
  const limit = Math.min(Number(input.limit) || 20, 50);

  let q = supabaseAdmin
    .from('tiles')
    .select('id, title, description, action_type, start_at, end_at, created_at')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`);

  if (input.action_type) q = q.eq('action_type', input.action_type as string);
  if (input.date_from) {
    const from = normalizeDateFrom(input.date_from as string);
    q = q.or(`start_at.gte.${from},end_at.gte.${from}`);
  }
  if (input.date_to) {
    const to = normalizeDateTo(input.date_to as string);
    q = q.or(`start_at.lte.${to},end_at.lte.${to}`);
  }

  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limit);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ tiles: data || [], count: data?.length ?? 0, query });
}

async function countTiles(input: Record<string, unknown>, userId: string): Promise<string> {
  let q = supabaseAdmin.from('tiles').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (input.action_type) q = q.eq('action_type', input.action_type as string);
  if (input.date_from) {
    const from = normalizeDateFrom(input.date_from as string);
    q = q.or(`start_at.gte.${from},end_at.gte.${from}`);
  }
  if (input.date_to) {
    const to = normalizeDateTo(input.date_to as string);
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
  } catch (err) {
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

export interface ChatResult {
  reply: string;
  foundSparkIds: string[];
  foundTileIds: string[];
}

export async function chat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userId: string,
  model: string = 'claude-haiku-4-5-20251001'
): Promise<ChatResult> {
  const collectedSparkIds: Set<string> = new Set();
  const collectedTileIds: Set<string> = new Set();

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
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
  const reply = textBlock ? (textBlock as Anthropic.TextBlock).text : 'No response generated.';

  const mentionedSparkIds = Array.from(collectedSparkIds).filter((id) => reply.includes(id.substring(0, 8)));
  const mentionedTileIds = Array.from(collectedTileIds).filter((id) => reply.includes(id.substring(0, 8)));

  return {
    reply,
    foundSparkIds: mentionedSparkIds.length > 0 ? mentionedSparkIds : Array.from(collectedSparkIds),
    foundTileIds: mentionedTileIds.length > 0 ? mentionedTileIds : Array.from(collectedTileIds),
  };
}
