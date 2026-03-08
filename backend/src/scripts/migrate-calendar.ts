/**
 * Migration: add calendar fields to tiles table.
 * Run with: npx tsx src/scripts/migrate-calendar.ts
 */
import { supabaseAdmin } from '../config/supabase.js';

async function main() {
  console.log('Adding calendar fields to tiles table...');

  // Add scheduled_at, scheduled_end, is_event columns
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      ALTER TABLE tiles
        ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;

      CREATE INDEX IF NOT EXISTS idx_tiles_scheduled_at ON tiles (scheduled_at)
        WHERE scheduled_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_tiles_is_event ON tiles (is_event)
        WHERE is_event = TRUE;
    `,
  });

  if (error) {
    // If rpc doesn't exist, run raw SQL via direct connection
    console.error('RPC exec_sql not available, trying direct SQL...');
    console.log('Please run the following SQL in your Supabase SQL Editor:\n');
    console.log(`
ALTER TABLE tiles
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tiles_scheduled_at ON tiles (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tiles_is_event ON tiles (is_event)
  WHERE is_event = TRUE;
    `);
    process.exit(1);
  }

  console.log('Migration completed successfully!');
  process.exit(0);
}

main();
