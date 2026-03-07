import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabaseAdmin } from '../config/supabase.js';
import type { Memo, MemoMetadata } from '../types/index.js';

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

/**
 * Uniform sampling: takes start, middle, and end of a long text.
 * Best for embedding generation — gives a representative overview.
 */
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

/**
 * Paragraph-based sampling: picks paragraphs evenly distributed across the doc.
 * Best for tag/summary generation — avoids cutting sentences mid-way.
 */
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

/**
 * Decide max tags based on content length.
 */
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
 * Main entry point — process a newly created memo for AI indexing.
 * Fire-and-forget: never throws.
 */
export async function processNewMemo(memoId: string): Promise<void> {
  await acquireSlot();
  try {
    // Fetch memo
    const { data: memo, error } = await supabaseAdmin
      .from('memos')
      .select('*')
      .eq('id', memoId)
      .single();

    if (error || !memo) {
      console.error(`[Indexing] Memo ${memoId} not found:`, error);
      return;
    }

    // Set status to processing
    await supabaseAdmin
      .from('memos')
      .update({ ai_status: 'processing' })
      .eq('id', memoId);

    let textForAnalysis = '';

    switch (memo.type) {
      case 'text':
        textForAnalysis = memo.content || '';
        break;
      case 'audio_recording':
        textForAnalysis = await analyzeAudio(memo);
        break;
      case 'photo':
      case 'image':
        textForAnalysis = await analyzeImage(memo);
        break;
      case 'video':
        textForAnalysis = await analyzeVideo(memo);
        break;
      case 'file':
        textForAnalysis = await analyzeFile(memo);
        break;
      default:
        textForAnalysis = memo.file_name || memo.type;
    }

    if (!textForAnalysis.trim()) {
      textForAnalysis = `${memo.type} memo: ${memo.file_name || 'untitled'}`;
    }

    // Generate tags and summary — use paragraph sampling for better coverage
    const textForTags = sampleTextByParagraphs(textForAnalysis, 4000);
    const { tags, summary } = await generateTagsAndSummary(textForTags, memo.type);

    // Generate embedding — use uniform sampling for representative vector
    const textForEmbedding = sampleTextUniform(textForAnalysis, 6000);
    const embeddingInput = [summary, tags.join(', '), textForEmbedding]
      .filter(Boolean)
      .join(' | ');
    const embedding = await generateEmbedding(embeddingInput);

    // Build metadata update
    const existingMetadata = (memo.metadata || {}) as MemoMetadata;
    const updatedMetadata: MemoMetadata = {
      ...existingMetadata,
      tags,
      summary,
    };

    // Store extracted text for file-type memos (max 4000 chars)
    if (memo.type === 'file' && textForAnalysis.length > 0 && !textForAnalysis.startsWith('File:')) {
      updatedMetadata.extracted_text = textForAnalysis.slice(0, 4000);
    }

    // Update memo
    await supabaseAdmin
      .from('memos')
      .update({
        metadata: updatedMetadata,
        embedding: JSON.stringify(embedding),
        ai_status: 'completed',
      })
      .eq('id', memoId);

    console.log(`[Indexing] Completed memo ${memoId} (${memo.type}): ${tags.length} tags`);

    // Try to update tile if this memo belongs to one
    if (memo.tile_id) {
      await tryUpdateTileMetadata(memo.tile_id).catch((err) => {
        console.error(`[Indexing] Tile update failed for ${memo.tile_id}:`, err);
      });
    }
  } catch (err) {
    console.error(`[Indexing] Failed for memo ${memoId}:`, err);
    try {
      await supabaseAdmin
        .from('memos')
        .update({ ai_status: 'failed' })
        .eq('id', memoId);
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

/**
 * Transcribe audio with Whisper, store transcript, return text.
 */
async function analyzeAudio(memo: Memo): Promise<string> {
  if (!memo.storage_path) return memo.file_name || 'audio recording';

  const fileBuffer = await downloadFile(memo.storage_path);
  if (!fileBuffer) return memo.file_name || 'audio recording';

  const ext = memo.file_name?.split('.').pop() || 'm4a';
  const file = new File([new Uint8Array(fileBuffer)], `audio.${ext}`, {
    type: memo.mime_type || 'audio/mp4',
  });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'it',
  });

  const transcript = transcription.text;

  // Store transcript in metadata
  const existingMetadata = (memo.metadata || {}) as MemoMetadata;
  await supabaseAdmin
    .from('memos')
    .update({ metadata: { ...existingMetadata, transcript } })
    .eq('id', memo.id);

  return transcript;
}

/**
 * Analyze image with Claude Vision.
 */
async function analyzeImage(memo: Memo): Promise<string> {
  if (!memo.storage_path) return memo.file_name || 'image';

  const fileBuffer = await downloadFile(memo.storage_path);
  if (!fileBuffer) return memo.file_name || 'image';

  const base64 = Buffer.from(fileBuffer).toString('base64');
  const mediaType = (memo.mime_type || 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/gif'
    | 'image/webp';

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
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
            text: 'Describe this image concisely in 1-2 sentences in BOTH Italian and English. Focus on the main subject, objects, and context. Format: Italian description. English description.',
          },
        ],
      },
    ],
  });

  const description =
    response.content[0].type === 'text' ? response.content[0].text : '';

  const existingMetadata = (memo.metadata || {}) as MemoMetadata;
  await supabaseAdmin
    .from('memos')
    .update({ metadata: { ...existingMetadata, ai_description: description } })
    .eq('id', memo.id);

  return description;
}

/**
 * Analyze video — use thumbnail if available, otherwise use filename.
 */
async function analyzeVideo(memo: Memo): Promise<string> {
  const thumbPath = memo.thumbnail_path;
  if (!thumbPath) {
    return `Video: ${memo.file_name || 'untitled'}${memo.duration ? `, duration: ${memo.duration}s` : ''}`;
  }

  const fileBuffer = await downloadFile(thumbPath);
  if (!fileBuffer) return `Video: ${memo.file_name || 'untitled'}`;

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

  const existingMetadata = (memo.metadata || {}) as MemoMetadata;
  await supabaseAdmin
    .from('memos')
    .update({ metadata: { ...existingMetadata, ai_description: description } })
    .eq('id', memo.id);

  return description;
}

/**
 * Analyze file — extract text from docx, pdf, and text-based files.
 * Returns full extracted text (sampling is applied later in processNewMemo).
 */
async function analyzeFile(memo: Memo): Promise<string> {
  if (!memo.storage_path) return memo.file_name || 'file';

  const mimeType = memo.mime_type || '';
  const fileBuffer = await downloadFile(memo.storage_path);
  if (!fileBuffer) return memo.file_name || 'file';

  const buffer = Buffer.from(fileBuffer);

  // --- DOCX ---
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    memo.file_name?.endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      console.log(`[Indexing] DOCX extracted: ${text.length} chars`);
      return text || `File: ${memo.file_name}`;
    } catch (err) {
      console.warn('[Indexing] mammoth failed:', err);
      return `File: ${memo.file_name || 'document.docx'}`;
    }
  }

  // --- PDF ---
  if (mimeType === 'application/pdf' || memo.file_name?.endsWith('.pdf')) {
    try {
      // @ts-expect-error pdf-parse v1 has no type declarations
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const data = await pdfParse(buffer);
      const text = (data.text as string).trim();
      console.log(`[Indexing] PDF extracted: ${text.length} chars, ${data.numpages} pages`);
      return text || `File: ${memo.file_name}`;
    } catch (err) {
      console.warn('[Indexing] pdf-parse failed:', err);
      return `File: ${memo.file_name || 'document.pdf'}`;
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

  // --- Binary files without text extraction ---
  return `File: ${memo.file_name || 'untitled'}, type: ${mimeType}`;
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

/**
 * Call Claude to generate tags and summary.
 * Tag count is proportional to content length.
 */
async function generateTagsAndSummary(
  text: string,
  memoType: string
): Promise<{ tags: string[]; summary: string }> {
  const wordCount = text.split(/\s+/).length;
  const maxTags = computeMaxTags(wordCount);

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Analyze this ${memoType} content and return ONLY valid JSON (no markdown, no backticks):
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

/**
 * Download a file from Supabase Storage.
 */
async function downloadFile(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabaseAdmin.storage
    .from('memos')
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

/**
 * Auto-generate tile title and description when all memos are indexed.
 */
async function tryUpdateTileMetadata(tileId: string): Promise<void> {
  // Check if tile already has a title
  const { data: tile } = await supabaseAdmin
    .from('tiles')
    .select('title')
    .eq('id', tileId)
    .single();

  if (tile?.title) return;

  // Count total and completed memos
  const { count: total } = await supabaseAdmin
    .from('memos')
    .select('*', { count: 'exact', head: true })
    .eq('tile_id', tileId);

  const { count: completed } = await supabaseAdmin
    .from('memos')
    .select('*', { count: 'exact', head: true })
    .eq('tile_id', tileId)
    .eq('ai_status', 'completed');

  if (!total || !completed || completed < total) return;

  // All memos indexed — collect summaries
  const { data: memos } = await supabaseAdmin
    .from('memos')
    .select('metadata, type')
    .eq('tile_id', tileId);

  if (!memos || memos.length === 0) return;

  const summaries = memos
    .map((m) => (m.metadata as MemoMetadata)?.summary)
    .filter(Boolean)
    .join('\n');

  if (!summaries) return;

  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `This is a collection of ${memos.length} memos. Generate a short title (max 5 words) and description (1 sentence) for this collection. Return ONLY valid JSON:
{"title": "...", "description": "..."}

Memo summaries:
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
