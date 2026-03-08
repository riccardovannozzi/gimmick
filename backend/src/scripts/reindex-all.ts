/**
 * Script to reindex sparks.
 * Run with: npx tsx src/scripts/reindex-all.ts          (pending/failed only)
 *       or: npx tsx src/scripts/reindex-all.ts --all     (force ALL sparks)
 */
import { supabaseAdmin } from '../config/supabase.js';
import { processNewSpark } from '../services/indexing.js';

async function main() {
  const forceAll = process.argv.includes('--all');

  let query = supabaseAdmin
    .from('sparks')
    .select('id, type, ai_status');

  if (!forceAll) {
    query = query.in('ai_status', ['pending', 'failed']);
  }

  const { data: sparks, error } = await query;

  if (error) {
    console.error('Failed to fetch sparks:', error);
    process.exit(1);
  }

  if (!sparks || sparks.length === 0) {
    console.log('No sparks to reindex.');
    process.exit(0);
  }

  console.log(`Found ${sparks.length} sparks to reindex.`);

  let completed = 0;
  let failed = 0;

  for (const spark of sparks) {
    try {
      await processNewSpark(spark.id);
      completed++;
      console.log(`[${completed + failed}/${sparks.length}] ${spark.id} (${spark.type}) - OK`);
    } catch (err) {
      failed++;
      console.error(`[${completed + failed}/${sparks.length}] ${spark.id} (${spark.type}) - FAILED:`, err);
    }
  }

  console.log(`\nDone: ${completed} completed, ${failed} failed out of ${sparks.length} total.`);
  process.exit(0);
}

main();
