/**
 * Backfill delle miniature per gli spark immagine che non ne hanno.
 *
 * Il mobile genera le proprie miniature in fase di compressione, il web no:
 * gli spark caricati dalla dashboard sono rimasti senza `thumbnail_path`, e la
 * lista Tiles del mobile mostra SOLO la miniatura, mai il file pieno. Questo
 * script chiude il buco sullo storico; da qui in avanti ci pensa la pipeline di
 * indicizzazione (`generateImageThumbnail` in services/indexing.ts).
 *
 * Run with: npx tsx src/scripts/backfill-thumbnails.ts
 *       or: npx tsx src/scripts/backfill-thumbnails.ts --dry-run
 */
import { supabaseAdmin } from '../config/supabase.js';
import { generateImageThumbnail } from '../services/indexing.js';
import type { Spark } from '../types/index.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Candidati: spark con un file su storage, senza miniatura, che siano
  // immagini — per tipo (photo/image) oppure allegati con mime image/*.
  const { data, error } = await supabaseAdmin
    .from('sparks')
    .select('*')
    .is('thumbnail_path', null)
    .not('storage_path', 'is', null);

  if (error) {
    console.error('Failed to fetch sparks:', error);
    process.exit(1);
  }

  const candidates = ((data ?? []) as Spark[]).filter(
    (s) =>
      s.type === 'photo' ||
      s.type === 'image' ||
      (s.type === 'file' && !!s.mime_type?.startsWith('image/')),
  );

  if (candidates.length === 0) {
    console.log('Nessuno spark immagine senza miniatura. Niente da fare.');
    process.exit(0);
  }

  console.log(`Trovati ${candidates.length} spark immagine senza miniatura.`);
  if (dryRun) {
    for (const s of candidates) console.log(`  - ${s.id} (${s.type}) ${s.storage_path}`);
    console.log('\n--dry-run: nessuna modifica applicata.');
    process.exit(0);
  }

  let done = 0;
  let failed = 0;

  // Sequenziale di proposito: è un'operazione una tantum su pochi record e la
  // decodifica delle immagini è costosa in memoria. Meglio lenta che OOM.
  for (const spark of candidates) {
    const n = done + failed + 1;
    try {
      const { data: file, error: dlError } = await supabaseAdmin.storage
        .from('sparks')
        .download(spark.storage_path!);
      if (dlError || !file) throw dlError ?? new Error('download vuoto');

      await generateImageThumbnail(await file.arrayBuffer(), spark);
      done++;
      console.log(`[${n}/${candidates.length}] ${spark.id} (${spark.type}) - OK`);
    } catch (err) {
      failed++;
      console.error(`[${n}/${candidates.length}] ${spark.id} (${spark.type}) - FAILED:`, err);
    }
  }

  console.log(`\nFatto: ${done} generate, ${failed} fallite su ${candidates.length} totali.`);
  process.exit(0);
}

main();
