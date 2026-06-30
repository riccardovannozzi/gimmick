/**
 * Unified `find` tool for the Ask Gimmick agent.
 *
 * Replaces the previous fragmented search tools (search_sparks / search_tiles
 * / semantic_search). Performs in parallel, for the same query:
 *   1. Dictionary expansion (synonyms.ts)
 *   2. LLM expansion via Haiku (llm-expansion.ts)
 *   3. Trigram keyword search across the expanded queries on tiles AND sparks
 *   4. Cosine semantic search (pgvector) on tiles AND sparks using the
 *      embedding of the *original* query (variants are useful for keyword
 *      lexical search but tend to drift the embedding centroid).
 *
 * Results are merged, scored, and grouped by Tile (sparks belonging to a tile
 * surface as `matching_sparks` of that tile; orphan sparks — without tile or
 * whose tile didn't match — are returned separately).
 */
import { supabaseAdmin } from '../../config/supabase.js';
import { generateEmbedding } from '../indexing.js';
import { expandWithDictionary } from './synonyms.js';
import { expandWithLLM } from './llm-expansion.js';

// ─── Types ────────────────────────────────────────────────────────────────

type ActionType = 'none' | 'anytime' | 'deadline' | 'event';

export type FindParams = {
  query: string;
  scope?: 'tiles' | 'sparks' | 'all';
  filters?: {
    action_type?: ActionType[];
    is_cta?: boolean;
    is_completed?: boolean;
    tag_ids?: string[];
    date_from?: string;
    date_to?: string;
    spark_type?: string[];
  };
  limit?: number;
};

type MatchedSpark = {
  id: string;
  excerpt: string;
  score: number;
};

type FindTileResult = {
  id: string;
  title: string | null;
  description: string | null;
  action_type: string;
  is_completed: boolean;
  is_cta: boolean | null;
  start_at: string | null;
  score: number;
  matched_via: ('keyword' | 'semantic')[];
  matching_sparks: MatchedSpark[];
};

type FindSparkResult = {
  id: string;
  tile_id: string | null;
  excerpt: string;
  score: number;
  matched_via: ('keyword' | 'semantic')[];
};

export type FindResult = {
  tiles: FindTileResult[];
  orphan_sparks: FindSparkResult[];
  total_results: number;
  search_strategies_used: string[];
  expanded_queries: string[];
};

type RawTileHit = {
  id: string;
  title: string | null;
  description: string | null;
  action_type: string;
  is_completed: boolean;
  is_cta: boolean | null;
  start_at: string | null;
  score: number;
};

type RawSparkHit = {
  id: string;
  tile_id: string | null;
  content: string | null;
  score: number;
};

// ─── Constants (tunable) ──────────────────────────────────────────────────

const KEYWORD_THRESHOLD = 0.2;
const SEMANTIC_THRESHOLD = 0.55;
const DEFAULT_LIMIT = 20;

// ─── Main ─────────────────────────────────────────────────────────────────

export async function find(userId: string, params: FindParams): Promise<FindResult> {
  const scope = params.scope ?? 'all';
  const limit = params.limit ?? DEFAULT_LIMIT;
  const strategies: string[] = [];

  // 1. Query expansion in parallel
  const [dictExpansions, llmExpansions] = await Promise.all([
    Promise.resolve(expandWithDictionary(params.query)),
    expandWithLLM(params.query),
  ]);
  const expandedQueries = Array.from(new Set([...dictExpansions, ...llmExpansions]));
  strategies.push(`expanded_to_${expandedQueries.length}_queries`);

  // 2. Single embedding (only the original query — variants drift the centroid)
  const embeddingPromise = generateEmbedding(params.query);

  // 3. Fan-out
  const tilesKwTask =
    scope !== 'sparks'
      ? searchTilesKeyword(userId, expandedQueries, params.filters)
      : Promise.resolve([] as RawTileHit[]);

  const tilesSemTask =
    scope !== 'sparks'
      ? embeddingPromise.then((emb) => searchTilesSemantic(userId, emb, params.filters))
      : Promise.resolve([] as RawTileHit[]);

  const sparksKwTask =
    scope !== 'tiles'
      ? searchSparksKeyword(userId, expandedQueries, params.filters)
      : Promise.resolve([] as RawSparkHit[]);

  const sparksSemTask =
    scope !== 'tiles'
      ? embeddingPromise.then((emb) => searchSparksSemantic(userId, emb, params.filters))
      : Promise.resolve([] as RawSparkHit[]);

  const [tilesKw, tilesSem, sparksKw, sparksSem] = await Promise.all([
    tilesKwTask,
    tilesSemTask,
    sparksKwTask,
    sparksSemTask,
  ]);

  if (scope !== 'sparks') strategies.push('tiles_keyword', 'tiles_semantic');
  if (scope !== 'tiles') strategies.push('sparks_keyword', 'sparks_semantic');

  // 4. Merge & score
  const merged = mergeAndScore({ tilesKw, tilesSem, sparksKw, sparksSem }, limit);

  return {
    ...merged,
    search_strategies_used: strategies,
    expanded_queries: expandedQueries,
  };
}

// ─── RPC wrappers ─────────────────────────────────────────────────────────

async function searchTilesKeyword(
  userId: string,
  queries: string[],
  filters?: FindParams['filters'],
): Promise<RawTileHit[]> {
  const { data, error } = await supabaseAdmin.rpc('find_tiles_keyword', {
    p_user_id: userId,
    p_queries: queries.map((q) => q.toLowerCase()),
    p_threshold: KEYWORD_THRESHOLD,
    p_action_types: filters?.action_type ?? null,
    p_is_cta: filters?.is_cta ?? null,
    p_is_completed: filters?.is_completed ?? null,
    p_date_from: filters?.date_from ?? null,
    p_date_to: filters?.date_to ?? null,
    p_tag_ids: filters?.tag_ids ?? null,
  });
  if (error) {
    console.error('[searchTilesKeyword]', error);
    return [];
  }
  return (data ?? []) as RawTileHit[];
}

async function searchTilesSemantic(
  userId: string,
  embedding: number[],
  filters?: FindParams['filters'],
): Promise<RawTileHit[]> {
  const { data, error } = await supabaseAdmin.rpc('find_tiles_semantic', {
    p_user_id: userId,
    p_embedding: JSON.stringify(embedding),
    p_threshold: SEMANTIC_THRESHOLD,
    p_action_types: filters?.action_type ?? null,
    p_is_cta: filters?.is_cta ?? null,
    p_is_completed: filters?.is_completed ?? null,
    p_date_from: filters?.date_from ?? null,
    p_date_to: filters?.date_to ?? null,
    p_tag_ids: filters?.tag_ids ?? null,
  });
  if (error) {
    console.error('[searchTilesSemantic]', error);
    return [];
  }
  return (data ?? []) as RawTileHit[];
}

async function searchSparksKeyword(
  userId: string,
  queries: string[],
  filters?: FindParams['filters'],
): Promise<RawSparkHit[]> {
  const { data, error } = await supabaseAdmin.rpc('find_sparks_keyword', {
    p_user_id: userId,
    p_queries: queries.map((q) => q.toLowerCase()),
    p_threshold: KEYWORD_THRESHOLD,
    p_spark_types: filters?.spark_type ?? null,
  });
  if (error) {
    console.error('[searchSparksKeyword]', error);
    return [];
  }
  return (data ?? []) as RawSparkHit[];
}

async function searchSparksSemantic(
  userId: string,
  embedding: number[],
  filters?: FindParams['filters'],
): Promise<RawSparkHit[]> {
  const { data, error } = await supabaseAdmin.rpc('find_sparks_semantic', {
    p_user_id: userId,
    p_embedding: JSON.stringify(embedding),
    p_threshold: SEMANTIC_THRESHOLD,
    p_spark_types: filters?.spark_type ?? null,
  });
  if (error) {
    console.error('[searchSparksSemantic]', error);
    return [];
  }
  return (data ?? []) as RawSparkHit[];
}

// ─── Merge & scoring ──────────────────────────────────────────────────────

function mergeAndScore(
  raw: {
    tilesKw: RawTileHit[];
    tilesSem: RawTileHit[];
    sparksKw: RawSparkHit[];
    sparksSem: RawSparkHit[];
  },
  limit: number,
): {
  tiles: FindTileResult[];
  orphan_sparks: FindSparkResult[];
  total_results: number;
} {
  // 1. Merge tile hits keeping best score + tracked provenance.
  const tileMap = new Map<string, FindTileResult>();
  for (const hit of raw.tilesKw) upsertTile(tileMap, hit, 'keyword');
  for (const hit of raw.tilesSem) upsertTile(tileMap, hit, 'semantic');

  // 2. Dedup spark hits (same id may come from kw + sem), aggregate provenance.
  const sparkMap = new Map<string, { hit: RawSparkHit; via: ('keyword' | 'semantic')[] }>();
  for (const s of raw.sparksKw) {
    sparkMap.set(s.id, { hit: { ...s }, via: ['keyword'] });
  }
  for (const s of raw.sparksSem) {
    const existing = sparkMap.get(s.id);
    if (existing) {
      existing.hit.score = Math.max(existing.hit.score, s.score);
      if (!existing.via.includes('semantic')) existing.via.push('semantic');
    } else {
      sparkMap.set(s.id, { hit: { ...s }, via: ['semantic'] });
    }
  }

  // 3. Distribute sparks: attach to its tile if that tile is in results,
  //    otherwise return as orphan. Boost the tile's score when it carries
  //    relevant sparks (so a tile whose body matches strongly via internal
  //    sparks bubbles up even if the title is weak).
  const orphan_sparks: FindSparkResult[] = [];
  for (const { hit, via } of sparkMap.values()) {
    if (hit.tile_id && tileMap.has(hit.tile_id)) {
      const tile = tileMap.get(hit.tile_id)!;
      tile.matching_sparks.push({
        id: hit.id,
        excerpt: makeExcerpt(hit.content),
        score: hit.score,
      });
      tile.score = Math.max(tile.score, hit.score * 0.9);
    } else {
      orphan_sparks.push({
        id: hit.id,
        tile_id: hit.tile_id,
        excerpt: makeExcerpt(hit.content),
        score: hit.score,
        matched_via: via,
      });
    }
  }

  // 4. Sort + limit
  const tiles = Array.from(tileMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  for (const t of tiles) {
    t.matching_sparks.sort((a, b) => b.score - a.score);
    t.matching_sparks = t.matching_sparks.slice(0, 5);
  }

  const orphans = orphan_sparks
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(5, Math.floor(limit / 2)));

  return {
    tiles,
    orphan_sparks: orphans,
    total_results: tiles.length + orphans.length,
  };
}

function upsertTile(
  map: Map<string, FindTileResult>,
  hit: RawTileHit,
  via: 'keyword' | 'semantic',
): void {
  const existing = map.get(hit.id);
  if (existing) {
    existing.score = Math.max(existing.score, hit.score);
    if (!existing.matched_via.includes(via)) existing.matched_via.push(via);
  } else {
    map.set(hit.id, {
      id: hit.id,
      title: hit.title,
      description: hit.description,
      action_type: hit.action_type,
      is_completed: hit.is_completed,
      is_cta: hit.is_cta,
      start_at: hit.start_at,
      score: hit.score,
      matched_via: [via],
      matching_sparks: [],
    });
  }
}

function makeExcerpt(content: string | null, maxLen = 200): string {
  if (!content) return '';
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen).trimEnd() + '…';
}
