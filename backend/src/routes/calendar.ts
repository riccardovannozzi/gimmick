import { Router, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { getActiveStatusId } from '../services/statuses.js';
import type { AuthenticatedRequest, Tile } from '../types/index.js';


const anthropic = new Anthropic();

export const calendarRouter = Router();
calendarRouter.use(authenticate);

// Validation schemas
const scheduleSchema = z.object({
  tile_id: z.string().uuid(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  title: z.string().optional(),
  auto_detect: z.boolean().optional(),
});

const createEventSchema = z.object({
  title: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
});

const rescheduleSchema = z.object({
  start_at: z.string(),
  end_at: z.string().optional(),
});

const rangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  tag_id: z.string().uuid().optional(),
});

const aiFilterSchema = z.object({
  query: z.string().min(1),
  start: z.coerce.date().optional(),
  end: z.coerce.date().optional(),
});

// Row shapes for the Supabase joins used in this module
type CalendarTag = { id: string; name: string; tag_type: string };
type CalendarTileRow = Tile & {
  sparks?: { count: number }[];
  tile_tags?: { tag_id: string; tags: CalendarTag | null }[];
};

type SparkContentRow = {
  content?: string | null;
  file_name?: string | null;
  metadata?: { summary?: string; extracted_text?: string } | null;
};
type AiFilterEventRow = {
  id: string;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  sparks?: SparkContentRow[];
};
type DetectTileInput = {
  title?: string | null;
  sparks?: SparkContentRow[];
};

/**
 * GET /api/calendar/events
 * List events in a date range, optionally filtered by tag
 */
calendarRouter.get(
  '/events',
  validate(rangeSchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { start, end, tag_id } = req.query as unknown as {
        start: Date;
        end: Date;
        tag_id?: string;
      };

      // Events live on start_at; deadlines live on end_at. Query both independently
      // and merge — a single OR doesn't work because each branch needs its own date column.
      const select = '*, sparks(count), tile_tags(tag_id, tags(id, name, tag_type))';
      const [eventsRes, deadlinesRes] = await Promise.all([
        supabaseAdmin
          .from('tiles')
          .select(select)
          .eq('user_id', req.user!.id)
          .eq('is_event', true)
          .not('start_at', 'is', null)
          .gte('start_at', start.toISOString())
          .lte('start_at', end.toISOString()),
        supabaseAdmin
          .from('tiles')
          .select(select)
          .eq('user_id', req.user!.id)
          .eq('action_type', 'deadline')
          .not('end_at', 'is', null)
          .gte('end_at', start.toISOString())
          .lte('end_at', end.toISOString()),
      ]);
      if (eventsRes.error) throw eventsRes.error;
      if (deadlinesRes.error) throw deadlinesRes.error;

      const seen = new Set<string>();
      const rows = [
        ...(eventsRes.data || []),
        ...(deadlinesRes.data || []),
      ] as unknown as CalendarTileRow[];
      const merged = rows.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      let events = merged.map((tile) => ({
        ...tile,
        spark_count: tile.sparks?.[0]?.count || 0,
        sparks: undefined,
        tags: (tile.tile_tags || [])
          .map((tt) => tt.tags)
          .filter((t): t is CalendarTag => Boolean(t)),
        tile_tags: undefined,
      }));

      // Sort by effective date (deadlines by end_at, events by start_at)
      events.sort((a, b) => {
        const ad = a.action_type === 'deadline' ? (a.end_at || a.start_at) : (a.start_at || a.end_at);
        const bd = b.action_type === 'deadline' ? (b.end_at || b.start_at) : (b.start_at || b.end_at);
        return new Date(ad ?? '').getTime() - new Date(bd ?? '').getTime();
      });

      if (tag_id) {
        events = events.filter((e) =>
          e.tags.some((t) => t.id === tag_id)
        );
      }

      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calendar/schedule
 * Schedule a tile as a calendar event (with optional AI date detection)
 */
calendarRouter.post(
  '/schedule',
  validate(scheduleSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { tile_id, start_at, end_at, title, auto_detect } = req.body;

      // Verify tile ownership
      const { data: tile, error: fetchError } = await supabaseAdmin
        .from('tiles')
        .select('*, sparks(content, file_name, metadata)')
        .eq('id', tile_id)
        .eq('user_id', req.user!.id)
        .single();

      if (fetchError || !tile) throw new NotFoundError('Tile not found');

      let finalStartAt = start_at;
      let finalEndAt = end_at;

      // AI auto-detection of date/time from tile content
      if (auto_detect || (!start_at && !end_at)) {
        const detected = await detectDateTimeFromTile(tile);
        if (detected) {
          finalStartAt = finalStartAt || detected.start_at;
          finalEndAt = finalEndAt || detected.end_at;
        }
      }

      if (!finalStartAt) {
        finalStartAt = new Date().toISOString();
      }

      if (!finalEndAt) {
        const endDate = new Date(finalStartAt);
        endDate.setHours(endDate.getHours() + 1);
        finalEndAt = endDate.toISOString();
      }

      const updateData: Record<string, unknown> = {
        start_at: finalStartAt,
        end_at: finalEndAt,
        is_event: true,
        action_type: 'event',
        action_type_reviewed: true,
        updated_at: new Date().toISOString(),
      };
      if (title) updateData.title = title;

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update(updateData)
        .eq('id', tile_id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error) throw error;

      res.json({
        success: true,
        data: data as Tile,
        message: 'Tile scheduled successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calendar/create-event
 * Create a new tile AND schedule it as an event in one atomic operation.
 * Every calendar event corresponds to a real tile.
 */
calendarRouter.post(
  '/create-event',
  validate(createEventSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { title, start_at, end_at } = req.body;

      // Normalize dates
      const finalStartAt = start_at ? new Date(start_at).toISOString() : new Date().toISOString();
      const finalEndAt = end_at
        ? new Date(end_at).toISOString()
        : new Date(new Date(finalStartAt).getTime() + 3600000).toISOString();

      const activeId = await getActiveStatusId(req.user!.id);

      // Create tile + schedule in a single insert
      const { data, error } = await supabaseAdmin
        .from('tiles')
        .insert({
          user_id: req.user!.id,
          title: title || 'Nuovo evento',
          start_at: finalStartAt,
          end_at: finalEndAt,
          is_event: true,
          action_type: 'event',
          action_type_reviewed: true,
          ...(activeId ? { status_id: activeId } : {}),
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        data: data as Tile,
        message: 'Event created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/calendar/events/:id/reschedule
 * Move an event to a new date/time (drag-and-drop)
 */
calendarRouter.patch(
  '/events/:id/reschedule',
  validate(rescheduleSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const { start_at, end_at } = req.body;

      const updateData: Record<string, unknown> = {
        start_at,
        updated_at: new Date().toISOString(),
      };
      if (end_at) updateData.end_at = end_at;

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .eq('is_event', true)
        .select()
        .single();

      if (error || !data) throw new NotFoundError('Event not found');

      res.json({ success: true, data: data as Tile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/calendar/events/:id
 * Update event details (title, times)
 */
calendarRouter.patch(
  '/events/:id',
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const { title, start_at, end_at, action_type, all_day } = req.body;

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (title !== undefined) updateData.title = title;
      if (start_at) updateData.start_at = start_at;
      if (end_at) updateData.end_at = end_at;
      if (action_type !== undefined) {
        updateData.action_type = action_type;
        updateData.action_type_reviewed = true;
        updateData.is_event = action_type === 'event';
      }
      if (all_day !== undefined) updateData.all_day = all_day;

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) throw new NotFoundError('Event not found');

      res.json({ success: true, data: data as Tile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/calendar/events/:id/unschedule
 * Remove from calendar (does NOT delete the tile, just unschedules it)
 */
calendarRouter.delete(
  '/events/:id/unschedule',
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update({
          start_at: null,
          end_at: null,
          is_event: false,
          action_type: 'none',
          action_type_reviewed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) throw new NotFoundError('Event not found');

      res.json({ success: true, message: 'Event removed from calendar' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/calendar/ai-filter
 * Use AI to filter events based on natural language query
 */
calendarRouter.post(
  '/ai-filter',
  validate(aiFilterSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { query, start, end } = req.body;

      let dbQuery = supabaseAdmin
        .from('tiles')
        .select('id, title, start_at, end_at, sparks(content, file_name, metadata)')
        .eq('user_id', req.user!.id)
        .eq('is_event', true)
        .order('start_at', { ascending: true })
        .limit(100);

      if (start) dbQuery = dbQuery.gte('start_at', new Date(start).toISOString());
      if (end) dbQuery = dbQuery.lte('start_at', new Date(end).toISOString());

      const { data: events, error } = await dbQuery;
      if (error) throw error;
      if (!events || events.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      const rows = events as unknown as AiFilterEventRow[];
      const eventSummaries = rows.map((e, i) => {
        const sparkTexts = (e.sparks || [])
          .map((s) => s.content || s.file_name || s.metadata?.summary || '')
          .filter(Boolean)
          .join('; ');
        return `[${i}] "${e.title || 'Senza titolo'}" (${e.start_at}) ${sparkTexts}`.trim();
      });

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Given these calendar events:\n${eventSummaries.join('\n')}\n\nThe user asks: "${query}"\n\nReturn ONLY a JSON array of the indices (numbers) of matching events. Example: [0, 3, 5]. If none match, return [].`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
      const match = text.match(/\[[\d,\s]*\]/);
      const indices: number[] = match ? JSON.parse(match[0]) : [];

      const filtered = indices
        .filter((i) => i >= 0 && i < rows.length)
        .map((i) => {
          const e = rows[i];
          return { ...e, sparks: undefined };
        });

      res.json({ success: true, data: filtered });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * AI date/time detection from tile content (used by schedule endpoint)
 */
async function detectDateTimeFromTile(tile: DetectTileInput): Promise<{ start_at: string; end_at?: string } | null> {
  const textParts: string[] = [];
  if (tile.title) textParts.push(`Titolo: ${tile.title}`);

  const sparks = tile.sparks || [];
  for (const spark of sparks) {
    if (spark.content) textParts.push(spark.content);
    if (spark.file_name) textParts.push(`File: ${spark.file_name}`);
    if (spark.metadata?.summary) textParts.push(spark.metadata.summary as string);
    if (spark.metadata?.extracted_text) textParts.push((spark.metadata.extracted_text as string).slice(0, 500));
  }

  if (textParts.length === 0) return null;

  const content = textParts.join('\n').slice(0, 2000);
  const now = new Date();
  const isoNow = now.toISOString();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Current date/time: ${isoNow}

Analyze this content and extract any specific date and time for a calendar event.

Content:
${content}

If you find a specific date/time, respond with ONLY a JSON object:
{"start_at": "ISO_DATETIME", "end_at": "ISO_DATETIME_OR_NULL"}

If no date/time is found, respond with: null

Rules:
- Use ISO 8601 format with timezone (e.g. 2026-03-15T14:00:00+01:00)
- Use Europe/Rome timezone
- If only a date is mentioned (no time), default to 09:00
- If no end time, set end_at 1 hour after start
- Be precise: "domani alle 15" means tomorrow at 15:00`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (!text || text === 'null') return null;

    const match = text.match(/\{[^}]+\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (parsed.start_at) {
      return {
        start_at: new Date(parsed.start_at).toISOString(),
        end_at: parsed.end_at ? new Date(parsed.end_at).toISOString() : undefined,
      };
    }
  } catch (err) {
    console.error('[Calendar] AI date detection failed:', err);
  }

  return null;
}
