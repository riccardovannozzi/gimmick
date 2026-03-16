/**
 * Script to regenerate tile titles and descriptions in Italian.
 * Uses the updated Italian prompt from indexing.ts.
 *
 * Run with: npx tsx src/scripts/retitle-tiles.ts
 */
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';

const anthropic = new Anthropic();
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

interface SparkMetadata {
  summary?: string;
  [key: string]: unknown;
}

async function main() {
  const { data: tiles, error } = await supabaseAdmin
    .from('tiles')
    .select('id, title')
    .not('title', 'is', null);

  if (error) {
    console.error('Errore fetch tiles:', error);
    process.exit(1);
  }

  if (!tiles || tiles.length === 0) {
    console.log('Nessun tile con titolo da aggiornare.');
    process.exit(0);
  }

  console.log(`Trovati ${tiles.length} tile con titolo da rigenerare in italiano.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const tile of tiles) {
    try {
      const { data: sparks } = await supabaseAdmin
        .from('sparks')
        .select('metadata, type')
        .eq('tile_id', tile.id);

      if (!sparks || sparks.length === 0) {
        skipped++;
        console.log(`[${updated + skipped + failed}/${tiles.length}] ${tile.id} — nessuno spark, skip`);
        continue;
      }

      const summaries = sparks
        .map((s) => (s.metadata as SparkMetadata)?.summary)
        .filter(Boolean)
        .join('\n');

      if (!summaries) {
        skipped++;
        console.log(`[${updated + skipped + failed}/${tiles.length}] ${tile.id} — nessun summary, skip`);
        continue;
      }

      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Questa è una raccolta di ${sparks.length} spark. Genera un titolo breve (max 5 parole) e una descrizione (1 frase) in ITALIANO per questa raccolta. Rispondi SOLO con JSON valido:
{"title": "...", "description": "..."}

Riassunti degli spark:
${summaries.slice(0, 2000)}`,
          },
        ],
      });

      const responseText =
        response.content[0].type === 'text' ? response.content[0].text : '{}';

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        skipped++;
        console.log(`[${updated + skipped + failed}/${tiles.length}] ${tile.id} — no JSON in response, skip`);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title) {
        await supabaseAdmin
          .from('tiles')
          .update({
            title: parsed.title,
            description: parsed.description || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tile.id);

        updated++;
        console.log(`[${updated + skipped + failed}/${tiles.length}] ${tile.id} — "${tile.title}" → "${parsed.title}"`);
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      console.error(`[${updated + skipped + failed}/${tiles.length}] ${tile.id} — ERRORE:`, err);
    }
  }

  console.log(`\nFatto: ${updated} aggiornati, ${skipped} saltati, ${failed} falliti su ${tiles.length} totali.`);
  process.exit(0);
}

main();
