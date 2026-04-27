# Implementazione del tool `find` unificato per Ask Gimmick (v3)

## Contesto

Il sistema attuale ha 13 tool di ricerca (`search_sparks`, `search_tiles`, `semantic_search`, ecc.) con forte sovrapposizione concettuale. L'agente AI fatica a scegliere il tool giusto e si arrende dopo un singolo fallimento, perdendo risultati anche ovvi.

**Esempio reale fallito:**
- Query: "cerca il tile ordine ingegneri"
- Tile esistente: `Seminario "Relax ed Efficienza" Ordine Ingegneri`
- Risultato: nessun match (l'agente ha provato solo `search_tiles` con ILIKE)

## Obiettivo

Creare un **tool unico `find()`** che esegue automaticamente fan-out su keyword + semantic search, gestisce sinonimi italiani, e ritorna risultati raggruppati per Tile.

I tool specifici (`get_tile`, `get_spark`, `delete_spark`, `count_*`, `list_recent_*`, `get_tile_sparks`) restano invariati. I tool di ricerca vecchi (`search_sparks`, `search_tiles`, `semantic_search`) vengono **deprecati** ma lasciati attivi per 2 settimane di transizione.

---

## Schema reale (riferimento)

### `tiles`
- `id` uuid, `user_id` uuid (nullable), `title` text (nullable), `description` text (nullable)
- `created_at`, `updated_at` timestamptz, `start_at`, `end_at` timestamptz (nullable)
- `action_type` varchar NOT NULL (valori: `none` | `anytime` | `deadline` | `event`)
- `action_type_ai` varchar, `action_type_confidence` float8, `action_type_reviewed` bool
- `is_event` bool, `all_day` bool, `is_completed` bool NOT NULL
- `is_cta` bool (ortogonale ad action_type), `sort_order` int4, `status_id` uuid
- ⚠️ **manca `embedding`** — verrà aggiunto in Step 1

### `sparks`
- `id`, `user_id`, `tile_id` (nullable!) uuid
- `type` text NOT NULL, `content` text (nullable)
- `storage_path`, `file_name`, `mime_type` text, `file_size` int4, `duration` int4
- `metadata` jsonb, `created_at`, `updated_at` timestamptz
- `ai_status` text — unico valore osservato in DB: `'completed'`
- `embedding` vector

### `tags`
- `id`, `user_id`, `name`, `slug`, `tag_type`, `aliases` text[]
- `usage_count`, `is_root`, `is_pinned`, `is_archived`, `pin_order`

### `tile_tags` (M:N)
- `tag_id`, `tile_id`

⚠️ Non esiste `spark_tags`: i tag vivono solo sui tile.

---

## Step 1 — Migration: estensioni, embedding sui tiles, indici

Crea una nuova migration in `supabase/migrations/` con timestamp corrente.

```sql
-- ============================================================================
-- 1.1 Estensioni Postgres
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Funzione immutable per usare unaccent negli indici
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text AS $$
  SELECT unaccent('unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- ============================================================================
-- 1.2 Aggiunta colonna embedding ai tiles
-- ============================================================================
ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz;

-- Indice IVFFlat per ricerca cosine (lists=100 va bene fino a 100k record)
CREATE INDEX IF NOT EXISTS idx_tiles_embedding
  ON tiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 1.3 Indici GIN trigram (keyword search tollerante)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tiles_title_trgm
  ON tiles USING gin (immutable_unaccent(lower(coalesce(title, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tiles_description_trgm
  ON tiles USING gin (immutable_unaccent(lower(coalesce(description, ''))) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sparks_content_trgm
  ON sparks USING gin (immutable_unaccent(lower(coalesce(content, ''))) gin_trgm_ops);

-- ============================================================================
-- 1.4 Indici di supporto per filtri
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tiles_user_action
  ON tiles (user_id, action_type, is_completed);

CREATE INDEX IF NOT EXISTS idx_sparks_user_tile_aistatus
  ON sparks (user_id, tile_id, ai_status);
```

---

## Step 2 — Script di backfill embedding tiles

Crea `src/scripts/backfill-tiles-embeddings.ts`:

```typescript
/**
 * Backfill: genera embedding per tutti i tiles esistenti.
 * Concatena title + description e chiama il provider di embeddings.
 *
 * Uso: npx tsx src/scripts/backfill-tiles-embeddings.ts
 *
 * Idempotente: salta i tiles che hanno già embedding (a meno di --force).
 */
import { supabaseAdmin } from "@/lib/supabase-admin"; // adatta al tuo client service-role
import { generateEmbedding } from "@/lib/embeddings"; // adatta al tuo helper

const FORCE = process.argv.includes("--force");
const BATCH_SIZE = 50;

async function main() {
  console.log(`[backfill] Starting${FORCE ? " (FORCE mode)" : ""}`);

  let processed = 0;
  let lastId: string | null = null;

  while (true) {
    let query = supabaseAdmin
      .from("tiles")
      .select("id, title, description, embedding")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt("id", lastId);
    if (!FORCE) query = query.is("embedding", null);

    const { data: tiles, error } = await query;
    if (error) throw error;
    if (!tiles || tiles.length === 0) break;

    for (const tile of tiles) {
      const text = [tile.title, tile.description].filter(Boolean).join(" — ").trim();
      if (!text) {
        console.log(`[backfill] skip ${tile.id} (no text)`);
        lastId = tile.id;
        continue;
      }

      try {
        const embedding = await generateEmbedding(text);
        const { error: updateError } = await supabaseAdmin
          .from("tiles")
          .update({
            embedding,
            embedding_updated_at: new Date().toISOString(),
          })
          .eq("id", tile.id);

        if (updateError) {
          console.error(`[backfill] update failed ${tile.id}:`, updateError);
        } else {
          processed++;
          if (processed % 10 === 0) console.log(`[backfill] processed ${processed}`);
        }
      } catch (err) {
        console.error(`[backfill] embed failed ${tile.id}:`, err);
      }

      lastId = tile.id;
    }
  }

  console.log(`[backfill] Done. Processed ${processed} tiles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Aggiungi anche un hook** che genera/aggiorna l'embedding del tile quando viene creato o modificato (`title` o `description`). Probabilmente esiste già un pattern analogo per gli sparks — replica lì.

---

## Step 3 — Dizionario sinonimi domain-specific

Crea `src/lib/search/synonyms.ts`:

```typescript
/**
 * Dizionario di sinonimi italiani specifici per il dominio Gimmick.
 * Usato come primo step di query expansion prima dell'LLM.
 *
 * Mantenere ordinato per categoria. Aggiungere nuove voci osservando
 * le query degli utenti che falliscono nei log.
 */
export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // GTD / produttività
  "appunto": ["nota", "memo", "promemoria"],
  "nota": ["appunto", "memo", "promemoria"],
  "da fare": ["task", "todo", "attività", "azione"],
  "task": ["da fare", "todo", "attività"],
  "scadenza": ["deadline", "termine"],
  "deadline": ["scadenza", "termine"],
  "evento": ["appuntamento", "impegno", "meeting", "riunione"],
  "appuntamento": ["evento", "impegno", "meeting"],
  "impegno": ["evento", "appuntamento"],
  "meeting": ["riunione", "incontro", "evento"],
  "riunione": ["meeting", "incontro"],
  "call": ["chiamata", "videocall", "videochiamata"],

  // Formazione / professionale
  "corso": ["formazione", "lezione", "seminario", "workshop", "training"],
  "corso di aggiornamento": ["seminario", "workshop", "formazione professionale"],
  "seminario": ["corso", "workshop", "lezione", "convegno"],
  "workshop": ["seminario", "corso pratico", "laboratorio"],
  "aggiornamento": ["formazione", "corso", "refresh"],

  // Edilizia / professione
  "sopralluogo": ["ispezione", "visita in cantiere", "verifica sul posto"],
  "ispezione": ["sopralluogo", "verifica", "controllo"],
  "cantiere": ["lavori", "sito di costruzione"],
  "ordine": ["albo", "associazione professionale"],
  "ordine degli ingegneri": ["albo ingegneri", "ordine ingegneri"],
  "ingegneri": ["albo", "ordine"],

  // Gimmick interno
  "tile": ["scheda", "card", "elemento"],
  "spark": ["frammento", "contenuto", "appunto rapido"],
  "tag": ["etichetta", "categoria", "contesto"],
};

/**
 * Espande una query usando il dizionario locale.
 * Match case-insensitive, sia su query intera che su singole parole.
 */
export function expandWithDictionary(query: string): string[] {
  const normalized = query.toLowerCase().trim();
  const expansions = new Set<string>([query]);

  // Match esatto sulla query intera
  if (DOMAIN_SYNONYMS[normalized]) {
    DOMAIN_SYNONYMS[normalized].forEach((s) => expansions.add(s));
  }

  // Match su singole parole/bigrammi
  const tokens = normalized.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (DOMAIN_SYNONYMS[tokens[i]]) {
      DOMAIN_SYNONYMS[tokens[i]].forEach((s) => expansions.add(s));
    }
    if (i < tokens.length - 1) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (DOMAIN_SYNONYMS[bigram]) {
        DOMAIN_SYNONYMS[bigram].forEach((s) => expansions.add(s));
      }
    }
  }

  return Array.from(expansions);
}
```

---

## Step 4 — LLM query expansion via Haiku

Crea `src/lib/search/llm-expansion.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * Espande una query generando varianti semantiche italiane via Haiku.
 * Costo: ~$0.0001 per chiamata, latenza ~400ms.
 *
 * Ritorna array di stringhe, originale inclusa. Max 4 varianti.
 */
export async function expandWithLLM(query: string): Promise<string[]> {
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Genera 3 varianti italiane della seguente query di ricerca, includendo sinonimi, riformulazioni e termini correlati. Mantieni il significato. Rispondi SOLO con un array JSON di stringhe, senza preamboli.

Query: "${query}"

Esempio output: ["variante 1", "variante 2", "variante 3"]`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("");

    const cleaned = text.replace(/```json|```/g, "").trim();
    const variants = JSON.parse(cleaned) as string[];

    return [query, ...variants.slice(0, 3)];
  } catch (err) {
    console.error("[llm-expansion] failed, falling back to original query:", err);
    return [query];
  }
}
```

---

## Step 5 — Tool `find` principale

Crea `src/lib/search/find.ts`:

```typescript
import { supabase } from "@/lib/supabase"; // adatta al tuo path
import { generateEmbedding } from "@/lib/embeddings";
import { expandWithDictionary } from "./synonyms";
import { expandWithLLM } from "./llm-expansion";

// ============================================================================
// Types
// ============================================================================

export type ActionType = "none" | "anytime" | "deadline" | "event";

export type FindParams = {
  query: string;
  scope?: "tiles" | "sparks" | "all";
  filters?: {
    action_type?: ActionType[];
    is_cta?: boolean;             // ortogonale ad action_type
    is_completed?: boolean;
    tag_ids?: string[];
    date_from?: string;            // ISO 8601
    date_to?: string;
    spark_type?: string[];
  };
  limit?: number;
};

export type MatchedSpark = {
  id: string;
  excerpt: string;
  score: number;
};

export type FindTileResult = {
  id: string;
  title: string | null;
  description: string | null;
  action_type: string;
  is_completed: boolean;
  is_cta: boolean | null;
  start_at: string | null;
  score: number;
  matched_via: ("keyword" | "semantic")[];
  matching_sparks: MatchedSpark[];
};

export type FindSparkResult = {
  id: string;
  tile_id: string | null;
  excerpt: string;
  score: number;
  matched_via: ("keyword" | "semantic")[];
};

export type FindResult = {
  tiles: FindTileResult[];
  orphan_sparks: FindSparkResult[];
  total_results: number;
  search_strategies_used: string[];
  expanded_queries: string[];
};

// ============================================================================
// Constants (calibrare in base ai test)
// ============================================================================

const KEYWORD_THRESHOLD = 0.2;
const SEMANTIC_THRESHOLD = 0.55;
const DEFAULT_LIMIT = 20;

// ============================================================================
// Main entry point
// ============================================================================

export async function find(
  userId: string,
  params: FindParams
): Promise<FindResult> {
  const scope = params.scope ?? "all";
  const limit = params.limit ?? DEFAULT_LIMIT;
  const strategies: string[] = [];

  // 1. Query expansion: dizionario + LLM in parallelo
  const [dictExpansions, llmExpansions] = await Promise.all([
    Promise.resolve(expandWithDictionary(params.query)),
    expandWithLLM(params.query),
  ]);
  const expandedQueries = Array.from(
    new Set([...dictExpansions, ...llmExpansions])
  );
  strategies.push(`expanded_to_${expandedQueries.length}_queries`);

  // 2. Embedding della query originale (semantic usa solo l'originale per stabilità)
  const queryEmbeddingPromise = generateEmbedding(params.query);

  // 3. Fan-out
  const tilesKwTask =
    scope !== "sparks"
      ? searchTilesKeyword(userId, expandedQueries, params.filters)
      : Promise.resolve([]);

  const tilesSemTask =
    scope !== "sparks"
      ? queryEmbeddingPromise.then((emb) =>
          searchTilesSemantic(userId, emb, params.filters)
        )
      : Promise.resolve([]);

  const sparksKwTask =
    scope !== "tiles"
      ? searchSparksKeyword(userId, expandedQueries, params.filters)
      : Promise.resolve([]);

  const sparksSemTask =
    scope !== "tiles"
      ? queryEmbeddingPromise.then((emb) =>
          searchSparksSemantic(userId, emb, params.filters)
        )
      : Promise.resolve([]);

  const [tilesKw, tilesSem, sparksKw, sparksSem] = await Promise.all([
    tilesKwTask,
    tilesSemTask,
    sparksKwTask,
    sparksSemTask,
  ]);

  if (scope !== "sparks") strategies.push("tiles_keyword", "tiles_semantic");
  if (scope !== "tiles") strategies.push("sparks_keyword", "sparks_semantic");

  // 4. Merge e scoring
  const merged = mergeAndScore(
    { tilesKw, tilesSem, sparksKw, sparksSem },
    limit
  );

  return {
    ...merged,
    search_strategies_used: strategies,
    expanded_queries: expandedQueries,
  };
}

// ============================================================================
// RPC wrappers
// ============================================================================

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

async function searchTilesKeyword(
  userId: string,
  queries: string[],
  filters?: FindParams["filters"]
): Promise<RawTileHit[]> {
  const { data, error } = await supabase.rpc("find_tiles_keyword", {
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
    console.error("[searchTilesKeyword]", error);
    return [];
  }
  return data ?? [];
}

async function searchTilesSemantic(
  userId: string,
  embedding: number[],
  filters?: FindParams["filters"]
): Promise<RawTileHit[]> {
  const { data, error } = await supabase.rpc("find_tiles_semantic", {
    p_user_id: userId,
    p_embedding: embedding,
    p_threshold: SEMANTIC_THRESHOLD,
    p_action_types: filters?.action_type ?? null,
    p_is_cta: filters?.is_cta ?? null,
    p_is_completed: filters?.is_completed ?? null,
    p_date_from: filters?.date_from ?? null,
    p_date_to: filters?.date_to ?? null,
    p_tag_ids: filters?.tag_ids ?? null,
  });
  if (error) {
    console.error("[searchTilesSemantic]", error);
    return [];
  }
  return data ?? [];
}

async function searchSparksKeyword(
  userId: string,
  queries: string[],
  filters?: FindParams["filters"]
): Promise<RawSparkHit[]> {
  const { data, error } = await supabase.rpc("find_sparks_keyword", {
    p_user_id: userId,
    p_queries: queries.map((q) => q.toLowerCase()),
    p_threshold: KEYWORD_THRESHOLD,
    p_spark_types: filters?.spark_type ?? null,
  });
  if (error) {
    console.error("[searchSparksKeyword]", error);
    return [];
  }
  return data ?? [];
}

async function searchSparksSemantic(
  userId: string,
  embedding: number[],
  filters?: FindParams["filters"]
): Promise<RawSparkHit[]> {
  const { data, error } = await supabase.rpc("find_sparks_semantic", {
    p_user_id: userId,
    p_embedding: embedding,
    p_threshold: SEMANTIC_THRESHOLD,
    p_spark_types: filters?.spark_type ?? null,
  });
  if (error) {
    console.error("[searchSparksSemantic]", error);
    return [];
  }
  return data ?? [];
}

// ============================================================================
// Merge & scoring
// ============================================================================

function mergeAndScore(
  raw: {
    tilesKw: RawTileHit[];
    tilesSem: RawTileHit[];
    sparksKw: RawSparkHit[];
    sparksSem: RawSparkHit[];
  },
  limit: number
): {
  tiles: FindTileResult[];
  orphan_sparks: FindSparkResult[];
  total_results: number;
} {
  // 1. Aggrega tiles per id, max-score con tracking della provenienza
  const tileMap = new Map<string, FindTileResult>();

  for (const hit of raw.tilesKw) upsertTile(tileMap, hit, "keyword");
  for (const hit of raw.tilesSem) upsertTile(tileMap, hit, "semantic");

  // 2. Dedup sparks (keyword+semantic possono trovare lo stesso)
  const sparkMap = new Map<
    string,
    { hit: RawSparkHit; via: ("keyword" | "semantic")[] }
  >();
  for (const s of raw.sparksKw) {
    sparkMap.set(s.id, { hit: s, via: ["keyword"] });
  }
  for (const s of raw.sparksSem) {
    const existing = sparkMap.get(s.id);
    if (existing) {
      existing.hit.score = Math.max(existing.hit.score, s.score);
      if (!existing.via.includes("semantic")) existing.via.push("semantic");
    } else {
      sparkMap.set(s.id, { hit: s, via: ["semantic"] });
    }
  }

  // 3. Distribuisce sparks: se il tile è già nei risultati, attach; altrimenti orphan
  const orphan_sparks: FindSparkResult[] = [];
  for (const { hit, via } of sparkMap.values()) {
    if (hit.tile_id && tileMap.has(hit.tile_id)) {
      const tile = tileMap.get(hit.tile_id)!;
      tile.matching_sparks.push({
        id: hit.id,
        excerpt: makeExcerpt(hit.content),
        score: hit.score,
      });
      // Boost del tile score se ha sparks rilevanti dentro
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

  // 4. Ordina e limita
  const tiles = Array.from(tileMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Ordina anche gli sparks dentro ogni tile per score
  for (const t of tiles) {
    t.matching_sparks.sort((a, b) => b.score - a.score);
    t.matching_sparks = t.matching_sparks.slice(0, 5); // top 5 per tile
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
  via: "keyword" | "semantic"
) {
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
  if (!content) return "";
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen).trimEnd() + "…";
}
```

---

## Step 6 — RPC functions Postgres

Nuova migration con le 4 funzioni RPC:

```sql
-- ============================================================================
-- find_tiles_keyword: trigram search con multi-query (max similarity)
-- ============================================================================
CREATE OR REPLACE FUNCTION find_tiles_keyword(
  p_user_id uuid,
  p_queries text[],
  p_threshold float DEFAULT 0.2,
  p_action_types text[] DEFAULT NULL,
  p_is_cta boolean DEFAULT NULL,
  p_is_completed boolean DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  action_type text,
  is_completed boolean,
  is_cta boolean,
  start_at timestamptz,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.action_type::text,
    t.is_completed,
    t.is_cta,
    t.start_at,
    GREATEST(
      MAX(similarity(immutable_unaccent(lower(coalesce(t.title, ''))), immutable_unaccent(lower(q)))),
      MAX(similarity(immutable_unaccent(lower(coalesce(t.description, ''))), immutable_unaccent(lower(q))))
    )::float AS score
  FROM tiles t
  CROSS JOIN unnest(p_queries) AS q
  WHERE t.user_id = p_user_id
    AND (
      similarity(immutable_unaccent(lower(coalesce(t.title, ''))), immutable_unaccent(lower(q))) > p_threshold
      OR similarity(immutable_unaccent(lower(coalesce(t.description, ''))), immutable_unaccent(lower(q))) > p_threshold
    )
    AND (p_action_types IS NULL OR t.action_type = ANY(p_action_types))
    AND (p_is_cta IS NULL OR t.is_cta = p_is_cta)
    AND (p_is_completed IS NULL OR t.is_completed = p_is_completed)
    AND (p_date_from IS NULL OR coalesce(t.start_at, t.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR coalesce(t.start_at, t.created_at) <= p_date_to)
    AND (
      p_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM tile_tags tt
        WHERE tt.tile_id = t.id AND tt.tag_id = ANY(p_tag_ids)
      )
    )
  GROUP BY t.id, t.title, t.description, t.action_type, t.is_completed, t.is_cta, t.start_at
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- find_tiles_semantic: pgvector cosine similarity
-- ============================================================================
CREATE OR REPLACE FUNCTION find_tiles_semantic(
  p_user_id uuid,
  p_embedding vector(1536),
  p_threshold float DEFAULT 0.55,
  p_action_types text[] DEFAULT NULL,
  p_is_cta boolean DEFAULT NULL,
  p_is_completed boolean DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  action_type text,
  is_completed boolean,
  is_cta boolean,
  start_at timestamptz,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.action_type::text,
    t.is_completed,
    t.is_cta,
    t.start_at,
    (1 - (t.embedding <=> p_embedding))::float AS score
  FROM tiles t
  WHERE t.user_id = p_user_id
    AND t.embedding IS NOT NULL
    AND (1 - (t.embedding <=> p_embedding)) > p_threshold
    AND (p_action_types IS NULL OR t.action_type = ANY(p_action_types))
    AND (p_is_cta IS NULL OR t.is_cta = p_is_cta)
    AND (p_is_completed IS NULL OR t.is_completed = p_is_completed)
    AND (p_date_from IS NULL OR coalesce(t.start_at, t.created_at) >= p_date_from)
    AND (p_date_to IS NULL OR coalesce(t.start_at, t.created_at) <= p_date_to)
    AND (
      p_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM tile_tags tt
        WHERE tt.tile_id = t.id AND tt.tag_id = ANY(p_tag_ids)
      )
    )
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- find_sparks_keyword
-- ============================================================================
CREATE OR REPLACE FUNCTION find_sparks_keyword(
  p_user_id uuid,
  p_queries text[],
  p_threshold float DEFAULT 0.2,
  p_spark_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tile_id uuid,
  content text,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tile_id,
    s.content,
    MAX(similarity(immutable_unaccent(lower(coalesce(s.content, ''))), immutable_unaccent(lower(q))))::float AS score
  FROM sparks s
  CROSS JOIN unnest(p_queries) AS q
  WHERE s.user_id = p_user_id
    AND s.content IS NOT NULL
    AND similarity(immutable_unaccent(lower(s.content)), immutable_unaccent(lower(q))) > p_threshold
    AND (p_spark_types IS NULL OR s.type = ANY(p_spark_types))
  GROUP BY s.id, s.tile_id, s.content
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- find_sparks_semantic
-- (filtra ai_status='completed': solo sparks indicizzati con successo)
-- ============================================================================
CREATE OR REPLACE FUNCTION find_sparks_semantic(
  p_user_id uuid,
  p_embedding vector(1536),
  p_threshold float DEFAULT 0.55,
  p_spark_types text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  tile_id uuid,
  content text,
  score float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.tile_id,
    s.content,
    (1 - (s.embedding <=> p_embedding))::float AS score
  FROM sparks s
  WHERE s.user_id = p_user_id
    AND s.embedding IS NOT NULL
    AND (1 - (s.embedding <=> p_embedding)) > p_threshold
    AND (p_spark_types IS NULL OR s.type = ANY(p_spark_types))
    AND s.ai_status = 'completed'
  ORDER BY score DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Step 7 — Tool definition per l'agente

Aggiungi alla registrazione dei tool che passi all'API Anthropic:

```typescript
{
  name: "find",
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

NON usare get_tile/get_spark per cercare: quelli servono SOLO quando hai già l'ID.`,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "La query in linguaggio naturale italiano. Passa la richiesta dell'utente in modo naturale, non riformularla in keyword.",
      },
      scope: {
        type: "string",
        enum: ["tiles", "sparks", "all"],
        description: "Default 'all' (consigliato).",
      },
      filters: {
        type: "object",
        properties: {
          action_type: {
            type: "array",
            items: { type: "string", enum: ["none", "anytime", "deadline", "event"] },
          },
          is_cta: { type: "boolean", description: "Filtra solo Tile call-to-action" },
          is_completed: { type: "boolean" },
          tag_ids: { type: "array", items: { type: "string" } },
          date_from: { type: "string", description: "ISO 8601" },
          date_to: { type: "string", description: "ISO 8601" },
        },
      },
      limit: { type: "number", description: "Default 20" },
    },
    required: ["query"],
  },
}
```

---

## Step 8 — Aggiornamento SKILL.md

Sostituisci la sezione sulla ricerca dello SKILL.md esistente:

```markdown
## Ricerca

Per QUALSIASI richiesta che implichi cercare contenuti dell'utente, usa il tool `find`.

### Regole

1. **`find` è la porta d'ingresso unica per la ricerca.** Non usare `get_tile`, `get_spark`, `get_tile_sparks` per cercare — servono solo quando hai già l'ID.

2. **Passa la query in modo naturale.** Non riformulare la richiesta in keyword: il tool fa già query expansion (dizionario + LLM). Se l'utente chiede "ho dei corsi di aggiornamento programmati?", passa esattamente quella stringa.

3. **Default scope = `all`.** Specifica `tiles` o `sparks` solo se l'utente ha esplicitamente distinto.

4. **Risultati vuoti: prova UNA volta riformulando, poi fermati.**
   - Se `find` torna vuoto, prova UNA seconda chiamata con riformulazione (es. da "ordine ingegneri" a "albo professionale ingegneri")
   - Se anche la seconda è vuota, comunica all'utente che non hai trovato nulla e chiedi se vuole provare altri termini
   - NON fare 5+ chiamate speculative in sequenza

5. **Interpretazione dei risultati:**
   - `tiles`: i risultati principali, ordinati per rilevanza
   - `orphan_sparks`: sparks rilevanti il cui tile non è nei risultati — menziona come "ho trovato anche alcuni appunti correlati"
   - `matching_sparks` dentro un tile: estratti rilevanti da citare nella risposta
   - `matched_via`: per debugging — se è solo `["semantic"]` con score basso, abbassa la confidenza
   - `expanded_queries`: utile per spiegare all'utente come hai interpretato la richiesta

### Esempi

**Buono:**
> Utente: "cerca il tile ordine ingegneri"
> Agente: `find({ query: "ordine ingegneri" })` → trova il Seminario Ordine Ingegneri via semantic match

**Buono:**
> Utente: "ho programmato corsi di aggiornamento?"
> Agente: `find({ query: "corsi di aggiornamento programmati" })` → trova il Seminario via espansione "corso → seminario"

**Buono (filtro temporale):**
> Utente: "ho impegni il 21 maggio?"
> Agente: `find({ query: "impegni 21 maggio", filters: { date_from: "2026-05-21T00:00:00Z", date_to: "2026-05-21T23:59:59Z" } })`

**Cattivo (vecchio comportamento):**
> Utente: "cerca il tile ordine ingegneri"
> Agente: `search_tiles({ query: "ordine ingegneri" })` → vuoto → si arrende

### Tool deprecati

I seguenti tool restano disponibili per retrocompatibilità ma NON vanno usati per nuove ricerche:
- `search_sparks` → usa `find({ scope: "sparks" })`
- `search_tiles` → usa `find({ scope: "tiles" })`
- `semantic_search` → usa `find()` (il fan-out è automatico)
```

---

## Step 9 — Piano di rollout

1. **Giorno 1 (dev branch):**
   - Esegui migration estensioni + indici trigram + colonna embedding tiles
   - Esegui backfill embedding tiles (`npx tsx src/scripts/backfill-tiles-embeddings.ts`)
   - Aggiungi hook upsert embedding su create/update tile
   - Esegui migration RPC functions
   - Implementa `find.ts`, `synonyms.ts`, `llm-expansion.ts`
   - Registra il tool nell'agente
   - Aggiorna SKILL.md

2. **Giorno 2 (test manuali):**
   - Esegui i casi del Step 10
   - Calibra `KEYWORD_THRESHOLD` e `SEMANTIC_THRESHOLD` se necessario

3. **Giorno 3 (merge → main → prod):**
   - I tool vecchi restano attivi
   - Logga ogni chiamata `find` con `expanded_queries`, `search_strategies_used`, e numero di risultati per future calibrazioni

4. **Settimana 2:**
   - Osserva log: query con 0 risultati → candidate per dizionario sinonimi
   - Marca tool vecchi come deprecati nelle description (`[DEPRECATO — usa find]`)

5. **Settimana 4:**
   - Rimuovi tool vecchi dal registry passato all'agente

---

## Step 10 — Test di regressione (manuali)

Prima del merge su main, verifica che `find` trovi:

| Query | Risultato atteso | Strategia attesa |
|---|---|---|
| `"ordine ingegneri"` | Seminario Ordine Ingegneri | semantic + keyword expanded |
| `"corsi di aggiornamento"` | stesso Seminario | semantic + dictionary expansion `corso→seminario` |
| `"meeting con Mario"` | eventi/sparks con Mario | keyword |
| `"appunti su sopralluogo"` | sparks su ispezioni | semantic + dictionary `sopralluogo→ispezione` |
| `"ingenneri"` (typo) | Seminario Ordine Ingegneri | trigram fuzzy |
| `"perche"` (no accenti) | contenuti con "perché" | unaccent |
| `"impegni 21 maggio"` + filter date | Seminario | date filter + keyword |
| `"todo da fare"` | tile con `action_type=anytime` | filter action_type |

Per ogni test, controlla in console che `expanded_queries` contenga le varianti attese.

---

## Note finali

- **Costi stimati:** ~$0.0001 (Haiku) + ~$0.00002 (embedding) per chiamata = ~$3.6/mese a 1000 ricerche/giorno.
- **Latenza:** ~600-900ms (LLM expansion + 4 query DB in parallelo).
- **Cache opportunity (futuro):** le LLM expansion sono cachabili (chiave: query lowercased, TTL 7 giorni) con Redis/Upstash. Vale la pena solo se vedi pattern di ripetizione nei log.
- **Tuning soglie:** se vedi troppi falsi negativi, abbassa a `KEYWORD_THRESHOLD=0.15`, `SEMANTIC_THRESHOLD=0.5`. Se vedi troppi falsi positivi, alza a `0.25` / `0.6`.
- **Indice IVFFlat** sui tiles ha `lists=100`. Se superi i 100k tiles per utente (improbabile), valuta `lists=500` o `HNSW`.
