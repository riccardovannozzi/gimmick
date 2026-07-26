/**
 * Backfill dello status dei tile legacy.
 *
 * Assegna uno status ai tile creati prima del default automatico, che hanno
 * `status_id = NULL`. Lo status è la fonte di verità per il completamento
 * (vedi routes/tiles.ts), quindi la mappatura preserva lo stato `is_completed`:
 *   - is_completed = true  → status di sistema 'done'
 *   - altrimenti           → status di sistema 'active'
 *
 * Idempotente: tocca solo i tile con status_id nullo. Se lo status 'done' non
 * è seedato per un utente, i tile completati ricadono su 'active'.
 *
 * Uso:
 *   npx tsx src/scripts/backfill-tile-status.ts          # esegue
 *   npx tsx src/scripts/backfill-tile-status.ts --dry     # solo anteprima
 */
import { supabaseAdmin } from '../config/supabase.js';

const DRY = process.argv.includes('--dry');

interface NullStatusTile {
  id: string;
  user_id: string;
  is_completed: boolean | null;
}

async function main() {
  const { data: tiles, error } = await supabaseAdmin
    .from('tiles')
    .select('id, user_id, is_completed')
    .is('status_id', null);

  if (error) {
    console.error('Errore lettura tiles:', error.message);
    process.exit(1);
  }

  const rows = (tiles ?? []) as NullStatusTile[];
  if (rows.length === 0) {
    console.log('Nessun tile con status nullo. Tutto a posto!');
    process.exit(0);
  }

  console.log(`${DRY ? '[DRY] ' : ''}Trovati ${rows.length} tile senza status.`);

  // Raggruppa per utente (gli status sono per-utente).
  const byUser = new Map<string, NullStatusTile[]>();
  for (const t of rows) {
    const list = byUser.get(t.user_id) ?? [];
    list.push(t);
    byUser.set(t.user_id, list);
  }

  let totalActive = 0;
  let totalDone = 0;
  let skippedUsers = 0;

  for (const [userId, list] of byUser) {
    const { data: statuses, error: stErr } = await supabaseAdmin
      .from('statuses')
      .select('id, name')
      .eq('user_id', userId)
      .eq('category', 'system');

    if (stErr) {
      console.error(`  Utente ${userId}: errore lettura statuses: ${stErr.message} — salto`);
      skippedUsers++;
      continue;
    }

    const activeId = (statuses ?? []).find((s) => s.name === 'active')?.id;
    const doneId = (statuses ?? []).find((s) => s.name === 'done')?.id;

    if (!activeId) {
      console.error(`  Utente ${userId}: status 'active' non seedato — salto ${list.length} tile`);
      skippedUsers++;
      continue;
    }

    // done se completato (fallback su active se 'done' manca), altrimenti active.
    const doneTarget = doneId ?? activeId;
    const doneTiles = list.filter((t) => t.is_completed === true).map((t) => t.id);
    const activeTiles = list.filter((t) => t.is_completed !== true).map((t) => t.id);

    console.log(`  Utente ${userId}: ${activeTiles.length} → active, ${doneTiles.length} → ${doneId ? 'done' : 'active(fallback)'}`);

    if (DRY) {
      totalActive += activeTiles.length;
      totalDone += doneTiles.length;
      continue;
    }

    if (activeTiles.length > 0) {
      const { error: uErr } = await supabaseAdmin.from('tiles').update({ status_id: activeId }).in('id', activeTiles);
      if (uErr) console.error(`    Errore update active: ${uErr.message}`);
      else totalActive += activeTiles.length;
    }
    if (doneTiles.length > 0) {
      const { error: uErr } = await supabaseAdmin.from('tiles').update({ status_id: doneTarget }).in('id', doneTiles);
      if (uErr) console.error(`    Errore update done: ${uErr.message}`);
      else totalDone += doneTiles.length;
    }
  }

  console.log(
    `\n${DRY ? '[DRY] ' : ''}Fatto. active: ${totalActive}, done: ${totalDone}` +
      (skippedUsers ? `, utenti saltati: ${skippedUsers}` : ''),
  );
  process.exit(0);
}

main();
