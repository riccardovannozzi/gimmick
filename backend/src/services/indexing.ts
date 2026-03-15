import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabaseAdmin } from '../config/supabase.js';
import type { Spark, SparkMetadata, ActionType } from '../types/index.js';

const anthropic = new Anthropic();
const openai = new OpenAI();

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Simple concurrency limiter
let activeJobs = 0;
const MAX_CONCURRENT = 3;
const queue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT) {
    activeJobs++;
    return;
  }
  return new Promise((resolve) => {
    queue.push(() => {
      activeJobs++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeJobs--;
  const next = queue.shift();
  if (next) next();
}

// ---------------------------------------------------------------------------
// Text sampling utilities
// ---------------------------------------------------------------------------

function sampleTextUniform(text: string, maxChars: number = 6000): string {
  if (text.length <= maxChars) return text;

  const chunkSize = Math.floor(maxChars / 3);

  const start = text.slice(0, chunkSize);
  const mid = text.slice(
    Math.floor(text.length / 2) - Math.floor(chunkSize / 2),
    Math.floor(text.length / 2) + Math.floor(chunkSize / 2)
  );
  const end = text.slice(-chunkSize);

  return `${start}\n\n[...]\n\n${mid}\n\n[...]\n\n${end}`;
}

function sampleTextByParagraphs(text: string, maxChars: number = 4000): string {
  if (text.length <= maxChars) return text;

  const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 50);
  if (paragraphs.length === 0) return text.slice(0, maxChars);

  const targetParagraphs = 10;
  const step = Math.max(1, Math.ceil(paragraphs.length / targetParagraphs));

  const sampled = paragraphs
    .filter((_, i) => i % step === 0)
    .join('\n\n');

  return sampled.slice(0, maxChars);
}

function computeMaxTags(wordCount: number): number {
  if (wordCount < 50) return 3;
  if (wordCount < 200) return 5;
  if (wordCount < 500) return 8;
  return 12;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Main entry point — process a newly created spark for AI indexing.
 * Fire-and-forget: never throws.
 */
export async function processNewSpark(sparkId: string): Promise<void> {
  await acquireSlot();
  try {
    const { data: spark, error } = await supabaseAdmin
      .from('sparks')
      .select('*')
      .eq('id', sparkId)
      .single();

    if (error || !spark) {
      console.error(`[Indexing] Spark ${sparkId} not found:`, error);
      return;
    }

    await supabaseAdmin
      .from('sparks')
      .update({ ai_status: 'processing' })
      .eq('id', sparkId);

    let textForAnalysis = '';

    switch (spark.type) {
      case 'text':
        textForAnalysis = spark.content || '';
        break;
      case 'audio_recording':
        textForAnalysis = await analyzeAudio(spark);
        break;
      case 'photo':
      case 'image':
        textForAnalysis = await analyzeImage(spark);
        break;
      case 'video':
        textForAnalysis = await analyzeVideo(spark);
        break;
      case 'file':
        textForAnalysis = await analyzeFile(spark);
        break;
      default:
        textForAnalysis = spark.file_name || spark.type;
    }

    if (!textForAnalysis.trim()) {
      textForAnalysis = `${spark.type} spark: ${spark.file_name || 'untitled'}`;
    }

    // Generate tags and summary
    const textForTags = sampleTextByParagraphs(textForAnalysis, 4000);
    const { tags, summary } = await generateTagsAndSummary(textForTags, spark.type);

    // Generate embedding
    const textForEmbedding = sampleTextUniform(textForAnalysis, 6000);
    const embeddingInput = [summary, tags.join(', '), textForEmbedding]
      .filter(Boolean)
      .join(' | ');
    const embedding = await generateEmbedding(embeddingInput);

    const existingMetadata = (spark.metadata || {}) as SparkMetadata;
    const updatedMetadata: SparkMetadata = {
      ...existingMetadata,
      tags,
      summary,
    };

    // Store extracted text for file-type sparks (max 4000 chars)
    if (spark.type === 'file' && textForAnalysis.length > 0 && !textForAnalysis.startsWith('File:')) {
      updatedMetadata.extracted_text = textForAnalysis.slice(0, 4000);
    }

    // Update spark
    await supabaseAdmin
      .from('sparks')
      .update({
        metadata: updatedMetadata,
        embedding: JSON.stringify(embedding),
        ai_status: 'completed',
      })
      .eq('id', sparkId);

    console.log(`[Indexing] Completed spark ${sparkId} (${spark.type}): ${tags.length} tags`);

    // Try to update tile metadata + detect dates for calendar
    if (spark.tile_id) {
      await tryUpdateTileMetadata(spark.tile_id).catch((err) => {
        console.error(`[Indexing] Tile update failed for ${spark.tile_id}:`, err);
      });

      // Date extraction for text and audio sparks
      if (spark.type === 'text' || spark.type === 'audio_recording') {
        await tryExtractEventDate(spark.tile_id, textForAnalysis).catch((err) => {
          console.error(`[Indexing] Date extraction failed for tile ${spark.tile_id}:`, err);
        });
      }

      // GTD action type classification
      await classifyActionType(spark.tile_id).catch((err) => {
        console.error(`[Indexing] Action type classification failed for tile ${spark.tile_id}:`, err);
      });
    }
  } catch (err) {
    console.error(`[Indexing] Failed for spark ${sparkId}:`, err);
    try {
      await supabaseAdmin
        .from('sparks')
        .update({ ai_status: 'failed' })
        .eq('id', sparkId);
    } catch {
      // ignore
    }
  } finally {
    releaseSlot();
  }
}

// ---------------------------------------------------------------------------
// Content analyzers
// ---------------------------------------------------------------------------

async function analyzeAudio(spark: Spark): Promise<string> {
  if (!spark.storage_path) return spark.file_name || 'audio recording';

  const fileBuffer = await downloadFile(spark.storage_path);
  if (!fileBuffer) return spark.file_name || 'audio recording';

  const ext = spark.file_name?.split('.').pop() || 'm4a';
  const file = new File([new Uint8Array(fileBuffer)], `audio.${ext}`, {
    type: spark.mime_type || 'audio/mp4',
  });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'it',
  });

  const transcript = transcription.text;

  const existingMetadata = (spark.metadata || {}) as SparkMetadata;
  await supabaseAdmin
    .from('sparks')
    .update({ metadata: { ...existingMetadata, transcript } })
    .eq('id', spark.id);

  return transcript;
}

async function analyzeImage(spark: Spark): Promise<string> {
  if (!spark.storage_path) return spark.file_name || 'image';

  const fileBuffer = await downloadFile(spark.storage_path);
  if (!fileBuffer) return spark.file_name || 'image';

  const base64 = Buffer.from(fileBuffer).toString('base64');
  const mediaType = (spark.mime_type || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';

const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analizza questa immagine in dettaglio per permettere ricerche future. Descrivi in italiano:

                  1. PERSONE: numero, sesso approssimativo, età approssimativa, abbigliamento (colori e capi specifici), accessori
                  2. OGGETTI: elenca tutti gli oggetti visibili con i loro colori
                  3. AMBIENTE: interno/esterno, tipo di luogo, illuminazione, ora del giorno
                  4. COLORI DOMINANTI: elenca i 3-5 colori principali presenti
                  5. AZIONI: cosa sta succedendo, cosa stanno facendo le persone
                  6. TESTO VISIBILE: se presente, trascrivilo

Sii specifico e usa aggettivi precisi. Questa descrizione serve per trovare l'immagine tramite ricerca testuale.`,
          },
        ],
      },
    ],
  });

  const description =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const existingMetadata = (spark.metadata || {}) as SparkMetadata;
  await supabaseAdmin
    .from('sparks')
    .update({ metadata: { ...existingMetadata, ai_description: description } })
    .eq('id', spark.id);

  return description;
}

async function analyzeVideo(spark: Spark): Promise<string> {
  const thumbPath = spark.thumbnail_path;
  if (!thumbPath) {
    return `Video: ${spark.file_name || 'untitled'}${spark.duration ? `, duration: ${spark.duration}s` : ''}`;
  }

  const fileBuffer = await downloadFile(thumbPath);
  if (!fileBuffer) return `Video: ${spark.file_name || 'untitled'}`;

  const base64 = Buffer.from(fileBuffer).toString('base64');

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: 'This is a thumbnail from a video. Describe what the video appears to be about in 1-2 sentences in BOTH Italian and English. Format: Italian description. English description.',
          },
        ],
      },
    ],
  });

  const description =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const existingMetadata = (spark.metadata || {}) as SparkMetadata;
  await supabaseAdmin
    .from('sparks')
    .update({ metadata: { ...existingMetadata, ai_description: description } })
    .eq('id', spark.id);

  return description;
}

async function analyzeFile(spark: Spark): Promise<string> {
  if (!spark.storage_path) return spark.file_name || 'file';

  const mimeType = spark.mime_type || '';
  const fileBuffer = await downloadFile(spark.storage_path);
  if (!fileBuffer) return spark.file_name || 'file';

  const buffer = Buffer.from(fileBuffer);

  // --- DOCX ---
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    spark.file_name?.endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      console.log(`[Indexing] DOCX extracted: ${text.length} chars`);
      return text || `File: ${spark.file_name}`;
    } catch (err) {
      console.warn('[Indexing] mammoth failed:', err);
      return `File: ${spark.file_name || 'document.docx'}`;
    }
  }

  // --- PDF ---
  if (mimeType === 'application/pdf' || spark.file_name?.endsWith('.pdf')) {
    try {
      // @ts-expect-error pdf-parse v1 has no type declarations
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const data = await pdfParse(buffer);
      const text = (data.text as string).trim();
      console.log(`[Indexing] PDF extracted: ${text.length} chars, ${data.numpages} pages`);
      return text || `File: ${spark.file_name}`;
    } catch (err) {
      console.warn('[Indexing] pdf-parse failed:', err);
      return `File: ${spark.file_name || 'document.pdf'}`;
    }
  }

  // --- Text-based files ---
  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  ) {
    return new TextDecoder().decode(fileBuffer);
  }

  return `File: ${spark.file_name || 'untitled'}, type: ${mimeType}`;
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

async function generateTagsAndSummary(
  text: string,
  sparkType: string
): Promise<{ tags: string[]; summary: string }> {
  const wordCount = text.split(/\s+/).length;
  const maxTags = computeMaxTags(wordCount);

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Analyze this ${sparkType} content and return ONLY valid JSON (no markdown, no backticks):
{"tags": ["tag1", "tag2", ...], "summary": "One sentence summary"}

Rules:
- Generate up to ${maxTags} tags based on content richness (this content has ~${wordCount} words)
- Include ONLY tags that reflect actual topics present in the content
- No redundant, generic, or filler tags
- Tags in the same language as the content
- Summary: 1-2 concise sentences in Italian

Content:
${text}`,
      },
    ],
  });

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, maxTags) : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch {
    console.warn('[Indexing] Failed to parse tags/summary:', responseText.slice(0, 200));
    return { tags: [], summary: text.slice(0, 100) };
  }
}

/**
 * Generate OpenAI embedding for semantic search.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, 8000);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
  });

  return response.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function downloadFile(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabaseAdmin.storage
    .from('sparks')
    .download(storagePath);

  if (error || !data) {
    console.error(`[Indexing] Download failed for ${storagePath}:`, error);
    return null;
  }

  return data.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Tile auto-metadata
// ---------------------------------------------------------------------------

async function tryUpdateTileMetadata(tileId: string): Promise<void> {
  const { data: tile } = await supabaseAdmin
    .from('tiles')
    .select('title')
    .eq('id', tileId)
    .single();

  if (tile?.title) return;

  const { count: total } = await supabaseAdmin
    .from('sparks')
    .select('*', { count: 'exact', head: true })
    .eq('tile_id', tileId);

  const { count: completed } = await supabaseAdmin
    .from('sparks')
    .select('*', { count: 'exact', head: true })
    .eq('tile_id', tileId)
    .eq('ai_status', 'completed');

  if (!total || !completed || completed < total) return;

  const { data: sparks } = await supabaseAdmin
    .from('sparks')
    .select('metadata, type')
    .eq('tile_id', tileId);

  if (!sparks || sparks.length === 0) return;

  const summaries = sparks
    .map((s) => (s.metadata as SparkMetadata)?.summary)
    .filter(Boolean)
    .join('\n');

  if (!summaries) return;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `This is a collection of ${sparks.length} sparks. Generate a short title (max 5 words) and description (1 sentence) for this collection. Return ONLY valid JSON:
{"title": "...", "description": "..."}

Spark summaries:
${summaries.slice(0, 2000)}`,
      },
    ],
  });

  const responseText =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.title) {
      await supabaseAdmin
        .from('tiles')
        .update({
          title: parsed.title,
          description: parsed.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tileId);

      console.log(`[Indexing] Tile ${tileId} auto-titled: "${parsed.title}"`);
    }
  } catch {
    console.warn('[Indexing] Failed to parse tile metadata');
  }
}

// ---------------------------------------------------------------------------
// AI date extraction for calendar events
// ---------------------------------------------------------------------------

/**
 * Classify tile action type using GTD methodology.
 * Called after tile metadata and date extraction are complete.
 */
async function classifyActionType(tileId: string): Promise<void> {
  const { data: tile } = await supabaseAdmin
    .from('tiles')
    .select('id, title, description, action_type_reviewed, action_type, start_at, is_event')
    .eq('id', tileId)
    .single();

  if (!tile) return;
  if (tile.action_type_reviewed) return; // User already decided

  // Gather text from tile + spark summaries
  const { data: sparks } = await supabaseAdmin
    .from('sparks')
    .select('metadata, content, type')
    .eq('tile_id', tileId)
    .eq('ai_status', 'completed');

  const textParts: string[] = [];
  if (tile.title) textParts.push(`Titolo: ${tile.title}`);
  if (tile.description) textParts.push(`Descrizione: ${tile.description}`);
  for (const s of sparks || []) {
    const meta = s.metadata as SparkMetadata;
    if (meta?.summary) textParts.push(meta.summary);
    if (s.content) textParts.push(s.content.slice(0, 500));
  }

  if (textParts.length === 0) return;

  const content = textParts.join('\n').slice(0, 2000);

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Sei un assistente di produttività che classifica note e attività secondo la metodologia GTD.

Analizza il contenuto e restituisci SOLO un oggetto JSON:
{"action_type": "none" | "anytime" | "deadline" | "event", "confidence": 0.0-1.0}

Definizioni:
- "none": appunto, riferimento, conoscenza pura. NON richiede alcuna azione futura.
- "anytime": azione da compiere appena possibile, senza vincolo temporale preciso.
- "deadline": azione da completare ENTRO una data limite (parole: "entro", "prima di", "scadenza").
- "event": accade A una data/ora specifica (parole: orari espliciti, "riunione", "appuntamento").

Regole:
- Se ambiguo tra "none" e "anytime", scegli "none".
- Se presente un orario specifico, preferisci "event".
- Se solo una data senza orario implica scadenza, preferisci "deadline".
- Confidence alta (>0.85) solo quando il segnale è chiaro.

Contenuto:
${content}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  if (!text) return;

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]);
    const actionType = parsed.action_type as ActionType;
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

    if (!['none', 'anytime', 'deadline', 'event'].includes(actionType)) return;

    const updates: Record<string, unknown> = {
      action_type_ai: actionType,
      action_type_confidence: confidence,
      updated_at: new Date().toISOString(),
    };

    // Auto-apply if high confidence
    if (confidence >= 0.85) {
      updates.action_type = actionType;

      // Sync with event fields
      if (actionType === 'event' && !tile.is_event && tile.start_at) {
        updates.is_event = true;
      }
    }

    await supabaseAdmin
      .from('tiles')
      .update(updates)
      .eq('id', tileId);

    console.log(`[Indexing] Action type for tile ${tileId}: ${actionType} (confidence: ${confidence})`);
  } catch (err) {
    console.error('[Indexing] Action type parse failed:', err);
  }
}

/**
 * Extract date/time from spark content and save to tile if confidence is high.
 * Called after indexing text and audio_recording sparks.
 */
async function tryExtractEventDate(tileId: string, textContent: string): Promise<void> {
  // Skip if tile already has dates
  const { data: tile } = await supabaseAdmin
    .from('tiles')
    .select('start_at, is_event')
    .eq('id', tileId)
    .single();

  if (tile?.start_at || tile?.is_event) return;

  if (!textContent || textContent.trim().length < 10) return;

  const now = new Date();
  const isoNow = now.toISOString();

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Current date/time: ${isoNow}

Analyze this content and determine if it mentions a specific date and/or time for an event, appointment, meeting, deadline, etc.

Content:
${textContent.slice(0, 2000)}

Return ONLY valid JSON:
{"start_at": "ISO_DATETIME_OR_NULL", "end_at": "ISO_DATETIME_OR_NULL", "confidence": 0.0}

Rules:
- confidence: 0.0 to 1.0 — how certain you are that a specific event date is mentioned
- Use ISO 8601 with Europe/Rome timezone (e.g. 2026-03-15T14:00:00+01:00)
- If only a date is mentioned (no time), default to 09:00
- If no end time, set end_at 1 hour after start_at
- If NO date/time is found at all, return {"start_at": null, "end_at": null, "confidence": 0.0}
- "domani alle 15" = tomorrow at 15:00, confidence ~0.9
- "forse la prossima settimana" = low confidence ~0.3
- Explicit dates like "15 marzo alle 14:30" = confidence ~0.95`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  if (!text) return;

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]);
    if (!parsed.start_at) return;

    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const startAt = new Date(parsed.start_at).toISOString();
    const endAt = parsed.end_at ? new Date(parsed.end_at).toISOString() : new Date(new Date(startAt).getTime() + 3600000).toISOString();

    if (confidence >= 0.8) {
      // High confidence → auto-save on tile
      await supabaseAdmin
        .from('tiles')
        .update({
          start_at: startAt,
          end_at: endAt,
          is_event: true,
          action_type: 'event',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tileId);

      console.log(`[Indexing] Auto-scheduled tile ${tileId} (confidence: ${confidence})`);
    } else if (confidence >= 0.3) {
      // Low confidence → save as pending_event in spark metadata for user confirmation
      // Find the most recent spark for this tile to attach the pending event
      const { data: latestSpark } = await supabaseAdmin
        .from('sparks')
        .select('id, metadata')
        .eq('tile_id', tileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (latestSpark) {
        const existingMeta = (latestSpark.metadata || {}) as SparkMetadata;
        await supabaseAdmin
          .from('sparks')
          .update({
            metadata: {
              ...existingMeta,
              pending_event: { start_at: startAt, end_at: endAt, confidence },
            },
          })
          .eq('id', latestSpark.id);

        console.log(`[Indexing] Pending event for tile ${tileId} (confidence: ${confidence})`);
      }
    }
  } catch (err) {
    console.error('[Indexing] Date extraction parse failed:', err);
  }
}
