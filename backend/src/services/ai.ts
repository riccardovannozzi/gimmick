import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from './indexing.js';
import type { MemoType } from '../types/index.js';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Gimmick AI, a helpful assistant integrated into the Gimmick app — a personal memo capture tool. Users capture memos of various types: photos, images, videos, audio recordings, text notes, and files. Memos can be organized into Tiles (collections).

You have access to tools that let you query and manage the user's memos and tiles. Use them to answer questions about their content, find specific memos, provide statistics, or perform actions like deleting memos.

Guidelines:
- Be concise and helpful
- When listing memos, format them clearly with their ID
- IMPORTANT: When the user asks to delete a memo, you MUST execute the deletion immediately using the delete_memo tool. NEVER ask for confirmation. Search for the memo first if needed, then call delete_memo right away in the same turn. After deleting, tell the user what was deleted.
- Dates from the database are in UTC (ISO format). ALWAYS convert them to Europe/Rome timezone (CET/CEST, UTC+1 or UTC+2 in summer) before presenting to the user. For example, 2026-03-07T17:12:00Z in UTC = 18:12 in Italy (CET, UTC+1).
- Memo types: photo, image, video, audio_recording, text, file
- For text memos, the content field contains the full text.
- For media memos (photos, images, audio, video, files), the metadata field may contain AI-generated data from indexing: ai_summary (a summary of the content), ai_tags (relevant tags), ai_description (description of images), ai_transcription (transcription of audio/video). Use get_memo to access these fields and answer questions about the content.
- You cannot play or display media files directly, but you CAN read their AI-processed descriptions and transcriptions.
- Use semantic_search when the user asks conceptual questions like "find my notes about cooking" or "what did I say about the project?". It searches by meaning, not just keywords.
- Respond in the same language the user writes in.
- Current date/time: {{CURRENT_DATE}}
- When comparing dates/times, use the ISO timestamp for precise calculations. Do NOT estimate relative times (like "un'ora fa") unless you can calculate them exactly from the ISO timestamps.`;

const tools: Anthropic.Tool[] = [
  {
    name: 'search_memos',
    description: 'Search memos by type, text content, or date range. Returns matching memos with their metadata.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['photo', 'image', 'video', 'audio_recording', 'text', 'file'],
          description: 'Filter by memo type',
        },
        query: {
          type: 'string',
          description: 'Search text in memo content (text memos) or file_name',
        },
        date_from: {
          type: 'string',
          description: 'Filter memos created after this ISO date (e.g. 2026-02-01)',
        },
        date_to: {
          type: 'string',
          description: 'Filter memos created before this ISO date',
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
    name: 'count_memos',
    description: 'Count memos, optionally filtered by type or date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['photo', 'image', 'video', 'audio_recording', 'text', 'file'],
          description: 'Filter by memo type',
        },
        date_from: {
          type: 'string',
          description: 'Count memos created after this ISO date',
        },
        date_to: {
          type: 'string',
          description: 'Count memos created before this ISO date',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_recent_memos',
    description: 'List the most recent memos.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Number of memos to return (default 5, max 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_memo',
    description: 'Get a specific memo by its ID, including full content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The memo UUID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_memo',
    description: 'Delete a specific memo by ID. Only use after user confirms deletion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: {
          type: 'string',
          description: 'The memo UUID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_tiles',
    description: 'List all tiles (memo collections) for the user.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_tile_memos',
    description: 'Get all memos inside a specific tile.',
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
    name: 'semantic_search',
    description: 'Search memos by meaning using AI embeddings. Use this for conceptual queries like "notes about travel", "recordings mentioning the budget", etc. Returns memos ranked by semantic similarity.',
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

// Date helpers: when AI passes a date-only string like "2026-03-07",
// expand it to cover the full day range for proper filtering.
function normalizeDateFrom(d: string): string {
  // If it's a date-only string (no T), add start-of-day
  return d.includes('T') ? d : `${d}T00:00:00`;
}
function normalizeDateTo(d: string): string {
  // If it's a date-only string (no T), add end-of-day
  return d.includes('T') ? d : `${d}T23:59:59.999`;
}

// Tool execution functions
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
    case 'search_memos':
      return searchMemos(toolInput, userId);
    case 'count_memos':
      return countMemos(toolInput, userId);
    case 'list_recent_memos':
      return listRecentMemos(toolInput, userId);
    case 'get_memo':
      return getMemo(toolInput, userId);
    case 'delete_memo':
      return deleteMemo(toolInput, userId);
    case 'list_tiles':
      return listTiles(userId);
    case 'get_tile_memos':
      return getTileMemos(toolInput, userId);
    case 'semantic_search':
      return semanticSearch(toolInput, userId);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function searchMemos(input: Record<string, unknown>, userId: string): Promise<string> {
  const limit = Math.min(Number(input.limit) || 10, 50);

  let query = supabaseAdmin
    .from('memos')
    .select('id, type, content, file_name, file_size, duration, tile_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (input.type) query = query.eq('type', input.type as MemoType);
  if (input.query) {
    query = query.or(`content.ilike.%${input.query}%,file_name.ilike.%${input.query}%`);
  }
  if (input.date_from) query = query.gte('created_at', normalizeDateFrom(input.date_from as string));
  if (input.date_to) query = query.lte('created_at', normalizeDateTo(input.date_to as string));

  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ memos: data, count: data?.length ?? 0 });
}

async function countMemos(input: Record<string, unknown>, userId: string): Promise<string> {
  let query = supabaseAdmin
    .from('memos')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (input.type) query = query.eq('type', input.type as MemoType);
  if (input.date_from) query = query.gte('created_at', normalizeDateFrom(input.date_from as string));
  if (input.date_to) query = query.lte('created_at', normalizeDateTo(input.date_to as string));

  const { count, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ count: count ?? 0 });
}

async function listRecentMemos(input: Record<string, unknown>, userId: string): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 20);

  const { data, error } = await supabaseAdmin
    .from('memos')
    .select('id, type, content, file_name, file_size, duration, tile_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ memos: data, count: data?.length ?? 0 });
}

async function getMemo(input: Record<string, unknown>, userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('memos')
    .select('*')
    .eq('id', input.id as string)
    .eq('user_id', userId)
    .single();

  if (error) return JSON.stringify({ error: error.message });
  if (!data) return JSON.stringify({ error: 'Memo not found' });
  return JSON.stringify(data);
}

async function deleteMemo(input: Record<string, unknown>, userId: string): Promise<string> {
  // First verify the memo exists and belongs to user
  const { data: memo, error: fetchError } = await supabaseAdmin
    .from('memos')
    .select('id, type, file_name, storage_path')
    .eq('id', input.id as string)
    .eq('user_id', userId)
    .single();

  if (fetchError || !memo) return JSON.stringify({ error: 'Memo not found or access denied' });

  // Delete from storage if applicable
  if (memo.storage_path) {
    await supabaseAdmin.storage.from('memos').remove([memo.storage_path]);
  }

  // Delete from database
  const { error } = await supabaseAdmin
    .from('memos')
    .delete()
    .eq('id', input.id as string)
    .eq('user_id', userId);

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ deleted: true, memo_id: memo.id, file_name: memo.file_name });
}

async function listTiles(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tiles')
    .select('id, title, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });

  // Get memo counts per tile
  const tilesWithCounts = await Promise.all(
    (data || []).map(async (tile) => {
      const { count } = await supabaseAdmin
        .from('memos')
        .select('*', { count: 'exact', head: true })
        .eq('tile_id', tile.id);
      return { ...tile, memo_count: count ?? 0 };
    })
  );

  return JSON.stringify({ tiles: tilesWithCounts, count: tilesWithCounts.length });
}

async function getTileMemos(input: Record<string, unknown>, userId: string): Promise<string> {
  // Verify tile belongs to user
  const { data: tile, error: tileError } = await supabaseAdmin
    .from('tiles')
    .select('id, title')
    .eq('id', input.tile_id as string)
    .eq('user_id', userId)
    .single();

  if (tileError || !tile) return JSON.stringify({ error: 'Tile not found or access denied' });

  const { data, error } = await supabaseAdmin
    .from('memos')
    .select('id, type, content, file_name, file_size, duration, created_at')
    .eq('tile_id', input.tile_id as string)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ tile: tile.title, memos: data, count: data?.length ?? 0 });
}

/**
 * Expand a search query to bilingual (IT+EN) for better semantic matching.
 */
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

async function semanticSearch(input: Record<string, unknown>, userId: string): Promise<string> {
  const query = input.query as string;
  if (!query) return JSON.stringify({ error: 'Query is required' });

  const limit = Math.min(Number(input.limit) || 5, 20);

  try {
    // Expand query to bilingual (IT+EN) for better cross-language matching
    const bilingualQuery = await expandQueryBilingual(query);
    console.log(`[AI Semantic] Original: "${query}" → Expanded: "${bilingualQuery}"`);
    const queryEmbedding = await generateEmbedding(bilingualQuery);

    const { data, error } = await supabaseAdmin.rpc('match_memos', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: 0.2,
      match_count: limit,
      match_user_id: userId,
    });

    if (error) return JSON.stringify({ error: error.message });

    return JSON.stringify({ memos: data || [], count: data?.length ?? 0, query });
  } catch (err) {
    return JSON.stringify({ error: 'Semantic search failed' });
  }
}

// Extracts memo IDs from a tool result JSON string
function extractMemoIds(toolName: string, resultJson: string): string[] {
  try {
    const parsed = JSON.parse(resultJson);
    if (parsed.memos && Array.isArray(parsed.memos)) {
      return parsed.memos.map((m: { id: string }) => m.id).filter(Boolean);
    }
    if (parsed.id && (toolName === 'get_memo')) {
      return [parsed.id];
    }
  } catch {}
  return [];
}

// Extracts tile IDs from a tool result JSON string
function extractTileIds(toolName: string, resultJson: string): string[] {
  try {
    const parsed = JSON.parse(resultJson);
    const ids: string[] = [];
    // From list_tiles results
    if (parsed.tiles && Array.isArray(parsed.tiles)) {
      ids.push(...parsed.tiles.map((t: { id: string }) => t.id).filter(Boolean));
    }
    // From memo results that include tile_id
    if (parsed.memos && Array.isArray(parsed.memos)) {
      for (const m of parsed.memos) {
        if (m.tile_id) ids.push(m.tile_id);
      }
    }
    // From single memo (get_memo)
    if (parsed.tile_id && typeof parsed.tile_id === 'string') {
      ids.push(parsed.tile_id);
    }
    return [...new Set(ids)];
  } catch {}
  return [];
}

export interface ChatResult {
  reply: string;
  foundMemoIds: string[];
  foundTileIds: string[];
}

// Main chat function
export async function chat(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  userId: string,
  model: string = 'claude-haiku-4-5-20251001'
): Promise<ChatResult> {
  const collectedMemoIds: Set<string> = new Set();
  const collectedTileIds: Set<string> = new Set();

  // Build messages array from history
  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: message },
  ];

  // Inject current date into system prompt with explicit ISO + readable format
  const now = new Date();
  const isoNow = now.toISOString();
  const readableNow = now.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'long', timeZone: 'Europe/Rome' });
  const systemPrompt = SYSTEM_PROMPT.replace(
    '{{CURRENT_DATE}}',
    `${readableNow} (ISO: ${isoNow})`
  );

  // Initial request to Claude
  let response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages,
  });

  // Tool use loop
  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    const toolUseBlocks = assistantContent.filter(
      (block) => block.type === 'tool_use'
    );

    // Execute all tool calls and collect memo IDs
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const tu = toolUse as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
        const result = await executeTool(tu.name, tu.input, userId);

        // Collect memo and tile IDs from results
        for (const id of extractMemoIds(tu.name, result)) {
          collectedMemoIds.add(id);
        }
        for (const id of extractTileIds(tu.name, result)) {
          collectedTileIds.add(id);
        }
        // For get_tile_memos, collect tile_id from the input
        if (tu.name === 'get_tile_memos' && tu.input.tile_id) {
          collectedTileIds.add(tu.input.tile_id as string);
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: tu.id,
          content: result,
        };
      })
    );

    // Continue conversation with tool results
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

  // Extract text response
  const textBlock = response.content.find((block) => block.type === 'text');
  const reply = textBlock ? (textBlock as Anthropic.TextBlock).text : 'No response generated.';

  // Filter IDs to only those actually mentioned in the AI's reply
  const mentionedMemoIds = Array.from(collectedMemoIds).filter((id) => reply.includes(id.substring(0, 8)));
  const mentionedTileIds = Array.from(collectedTileIds).filter((id) => reply.includes(id.substring(0, 8)));

  return {
    reply,
    foundMemoIds: mentionedMemoIds.length > 0 ? mentionedMemoIds : Array.from(collectedMemoIds),
    foundTileIds: mentionedTileIds.length > 0 ? mentionedTileIds : Array.from(collectedTileIds),
  };
}
