/**
 * Script to backfill embeddings on existing tiles.
 *
 * Concatenates `title` + `description` and stores the OpenAI embedding so the
 * `find` tool can do semantic search over tiles in addition to sparks.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-tiles-embeddings.ts          # only tiles missing an embedding
 *   npx tsx src/scripts/backfill-tiles-embeddings.ts --force  # regenerate every tile
 *
 * Idempotent: re-running without `--force` is a no-op once everything is filled.
 */
import { supabaseAdmin } from '../config/supabase.js';
import { generateEmbedding } from '../services/indexing.js';

const FORCE = process.argv.includes('--force');
const BATCH_SIZE = 50;

interface TileRow {
  id: string;
  title: string | null;
  description: string | null;
}

async function main(): Promise<void> {
  console.log(`[backfill-tiles] Starting${FORCE ? ' (FORCE mode)' : ''}`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let lastId: string | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabaseAdmin
      .from('tiles')
      .select('id, title, description')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) query = query.gt('id', lastId);
    if (!FORCE) query = query.is('embedding', null);

    const { data, error } = await query;
    if (error) {
      console.error('[backfill-tiles] fetch failed:', error);
      process.exit(1);
    }
    const tiles = (data ?? []) as TileRow[];
    if (tiles.length === 0) break;

    for (const tile of tiles) {
      lastId = tile.id;
      const text = [tile.title, tile.description].filter(Boolean).join(' — ').trim();
      if (!text) {
        skipped++;
        continue;
      }

      try {
        const embedding = await generateEmbedding(text);
        const { error: updateError } = await supabaseAdmin
          .from('tiles')
          .update({
            embedding,
            embedding_updated_at: new Date().toISOString(),
          })
          .eq('id', tile.id);

        if (updateError) {
          console.error(`[backfill-tiles] update failed ${tile.id}:`, updateError);
          failed++;
        } else {
          processed++;
          if (processed % 10 === 0) console.log(`[backfill-tiles] processed ${processed}`);
        }
      } catch (err) {
        console.error(`[backfill-tiles] embed failed ${tile.id}:`, err);
        failed++;
      }
    }
  }

  console.log(`[backfill-tiles] Done. processed=${processed} skipped=${skipped} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[backfill-tiles] fatal:', err);
  process.exit(1);
});
