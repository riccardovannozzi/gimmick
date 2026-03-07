/**
 * Fix orphan memos (memos without tile_id).
 * Creates a single tile per user and assigns all orphan memos to it.
 *
 * Run with: npx tsx src/scripts/fix-orphan-memos.ts
 */
import { supabaseAdmin } from '../config/supabase.js';

async function main() {
  // Find all memos without a tile_id
  const { data: orphans, error } = await supabaseAdmin
    .from('memos')
    .select('id, user_id')
    .is('tile_id', null);

  if (error) {
    console.error('Error fetching orphan memos:', error.message);
    process.exit(1);
  }

  if (!orphans || orphans.length === 0) {
    console.log('No orphan memos found. All good!');
    process.exit(0);
  }

  console.log(`Found ${orphans.length} orphan memo(s).`);

  // Group by user_id
  const byUser = new Map<string, string[]>();
  for (const memo of orphans) {
    const list = byUser.get(memo.user_id) || [];
    list.push(memo.id);
    byUser.set(memo.user_id, list);
  }

  for (const [userId, memoIds] of byUser) {
    console.log(`\nUser ${userId}: ${memoIds.length} orphan memo(s)`);

    // Create one tile for this user's orphans
    const { data: tile, error: tileError } = await supabaseAdmin
      .from('tiles')
      .insert({ user_id: userId, title: 'Memo recuperati' })
      .select('id')
      .single();

    if (tileError || !tile) {
      console.error(`  Failed to create tile for user ${userId}:`, tileError?.message);
      continue;
    }

    console.log(`  Created tile ${tile.id}`);

    // Assign all orphan memos to this tile
    const { error: updateError } = await supabaseAdmin
      .from('memos')
      .update({ tile_id: tile.id })
      .in('id', memoIds);

    if (updateError) {
      console.error(`  Failed to update memos:`, updateError.message);
    } else {
      console.log(`  Assigned ${memoIds.length} memo(s) to tile "${tile.id}"`);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main();
