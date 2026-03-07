/**
 * Script to reindex memos.
 * Run with: npx tsx src/scripts/reindex-all.ts          (pending/failed only)
 *       or: npx tsx src/scripts/reindex-all.ts --all     (force ALL memos)
 */
import { supabaseAdmin } from '../config/supabase.js';
import { processNewMemo } from '../services/indexing.js';

async function main() {
  const forceAll = process.argv.includes('--all');

  let query = supabaseAdmin
    .from('memos')
    .select('id, type, ai_status');

  if (!forceAll) {
    query = query.in('ai_status', ['pending', 'failed']);
  }

  const { data: memos, error } = await query;

  if (error) {
    console.error('Failed to fetch memos:', error);
    process.exit(1);
  }

  if (!memos || memos.length === 0) {
    console.log('No memos to reindex.');
    process.exit(0);
  }

  console.log(`Found ${memos.length} memos to reindex.`);

  let completed = 0;
  let failed = 0;

  for (const memo of memos) {
    try {
      await processNewMemo(memo.id);
      completed++;
      console.log(`[${completed + failed}/${memos.length}] ${memo.id} (${memo.type}) - OK`);
    } catch (err) {
      failed++;
      console.error(`[${completed + failed}/${memos.length}] ${memo.id} (${memo.type}) - FAILED:`, err);
    }
  }

  console.log(`\nDone: ${completed} completed, ${failed} failed out of ${memos.length} total.`);
  process.exit(0);
}

main();
