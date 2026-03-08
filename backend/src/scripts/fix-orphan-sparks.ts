/**
 * Fix orphan sparks (sparks without tile_id).
 * Creates a single tile per user and assigns all orphan sparks to it.
 *
 * Run with: npx tsx src/scripts/fix-orphan-sparks.ts
 */
import { supabaseAdmin } from '../config/supabase.js';

async function main() {
  const { data: orphans, error } = await supabaseAdmin
    .from('sparks')
    .select('id, user_id')
    .is('tile_id', null);

  if (error) {
    console.error('Error fetching orphan sparks:', error.message);
    process.exit(1);
  }

  if (!orphans || orphans.length === 0) {
    console.log('No orphan sparks found. All good!');
    process.exit(0);
  }

  console.log(`Found ${orphans.length} orphan spark(s).`);

  const byUser = new Map<string, string[]>();
  for (const spark of orphans) {
    const list = byUser.get(spark.user_id) || [];
    list.push(spark.id);
    byUser.set(spark.user_id, list);
  }

  for (const [userId, sparkIds] of byUser) {
    console.log(`\nUser ${userId}: ${sparkIds.length} orphan spark(s)`);

    const { data: tile, error: tileError } = await supabaseAdmin
      .from('tiles')
      .insert({ user_id: userId, title: 'Spark recuperati' })
      .select('id')
      .single();

    if (tileError || !tile) {
      console.error(`  Failed to create tile for user ${userId}:`, tileError?.message);
      continue;
    }

    console.log(`  Created tile ${tile.id}`);

    const { error: updateError } = await supabaseAdmin
      .from('sparks')
      .update({ tile_id: tile.id })
      .in('id', sparkIds);

    if (updateError) {
      console.error(`  Failed to update sparks:`, updateError.message);
    } else {
      console.log(`  Assigned ${sparkIds.length} spark(s) to tile "${tile.id}"`);
    }
  }

  console.log('\nDone!');
  process.exit(0);
}

main();
