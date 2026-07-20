import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { upsertTileEmbedding } from '../services/indexing.js';
import { getActiveStatusId } from '../services/statuses.js';
import type { AuthenticatedRequest, Tile } from '../types/index.js';

const ACTION_TYPES = ['none', 'anytime', 'deadline', 'event'] as const;

export const tilesRouter = Router();

// All routes require authentication
tilesRouter.use(authenticate);

// Validation schemas
const createTileSchema = z.object({
  title: z.string().optional(),
});

const updateTileSchema = z.object({
  title: z.string().optional(),
  action_type: z.enum(ACTION_TYPES).optional(),
  is_event: z.boolean().optional(),
  all_day: z.boolean().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  is_completed: z.boolean().optional(),
  is_cta: z.boolean().optional(),
  status_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * GET /api/tiles
 * List user's tiles with pagination and memo count
 */
tilesRouter.get(
  '/',
  validate(querySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { page, limit } = req.query as unknown as {
        page: number;
        limit: number;
      };
      const offset = (page - 1) * limit;

      // Get tiles with sparks, tags, and subtasks (for checklist bar)
      const { data, error, count } = await supabaseAdmin
        .from('tiles')
        .select('*, sparks(id, type, content, storage_path, file_name), tile_tags(tag_id, tags(id, name, tag_type)), tile_subtasks(is_done, sort_order)', { count: 'exact' })
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Get user's root tag (GIMMICK)
      const { data: rootTag } = await supabaseAdmin
        .from('tags')
        .select('id, name')
        .eq('user_id', req.user!.id)
        .eq('is_root', true)
        .single();

      // Row shapes for this query's Supabase joins
      type SparkPreview = {
        id: string;
        type: string;
        content: string | null;
        storage_path: string | null;
        file_name: string | null;
      };
      type TileTag = { id: string; name: string; tag_type?: string };
      type TileTagJoin = { tag_id: string; tags: { id: string; name: string; tag_type: string } | null };
      type SubtaskRow = { is_done: boolean | null; sort_order: number | null };
      type TileListRow = Tile & {
        sparks?: SparkPreview[];
        tile_tags?: TileTagJoin[];
        tile_subtasks?: SubtaskRow[];
      };
      const listRows = (data ?? []) as unknown as TileListRow[];

      // Find tiles without any tags and auto-assign GIMMICK
      if (rootTag && listRows.length) {
        const untaggedIds = listRows
          .filter((tile) => !tile.tile_tags || tile.tile_tags.length === 0)
          .map((tile) => tile.id);

        if (untaggedIds.length > 0) {
          const newLinks = untaggedIds.map((tile_id) => ({
            tile_id,
            tag_id: rootTag.id,
          }));
          await supabaseAdmin
            .from('tile_tags')
            .upsert(newLinks, { onConflict: 'tag_id,tile_id' });
        }
      }

      // Transform data to include spark_count, sparks preview, tags, and subtasks
      const tilesWithCount = listRows.map((tile) => {
        const sparks = Array.isArray(tile.sparks) ? tile.sparks : [];
        const tags: TileTag[] = (tile.tile_tags || [])
          .map((tt) => tt.tags)
          .filter((t): t is { id: string; name: string; tag_type: string } => Boolean(t));
        // If no tags, inject root tag
        if (tags.length === 0 && rootTag) {
          tags.push({ id: rootTag.id, name: rootTag.name });
        }
        // Compact subtasks payload: sorted by sort_order, only is_done kept
        const subtasksRaw = Array.isArray(tile.tile_subtasks) ? tile.tile_subtasks : [];
        const subtasks = subtasksRaw
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => ({ is_done: !!s.is_done }));
        return {
          ...tile,
          spark_count: sparks.length,
          sparks,
          tags,
          subtasks,
          tile_tags: undefined,
          tile_subtasks: undefined,
        };
      });

      res.json({
        success: true,
        data: tilesWithCount as Tile[],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/tiles/graph
 * Get all tiles with their memos for graph visualization
 */
tilesRouter.get('/graph', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Get all tiles
    const { data: tiles, error: tilesError } = await supabaseAdmin
      .from('tiles')
      .select('id, title, created_at, action_type')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (tilesError) throw tilesError;

    // Get all sparks (with tile_id to build connections)
    const { data: sparks, error: sparksError } = await supabaseAdmin
      .from('sparks')
      .select('id, tile_id, type, content, file_name, metadata, created_at, storage_path')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (sparksError) throw sparksError;

    // Get all tags with their tile associations
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('tags')
      .select('id, name, tag_type, created_at, tile_tags(tile_id)')
      .eq('user_id', req.user!.id)
      .order('name');

    if (tagsError) throw tagsError;

    type GraphSpark = {
      id: string;
      tile_id: string | null;
      type: string;
      content: string | null;
      file_name: string | null;
      metadata: { tags?: string[]; summary?: string } | null;
      created_at: string;
      storage_path: string | null;
    };
    type GraphTag = {
      id: string;
      name: string;
      tag_type: string;
      color?: string | null;
      created_at: string;
      tile_tags?: { tile_id: string }[];
    };

    res.json({
      success: true,
      data: {
        tiles: tiles || [],
        sparks: ((sparks ?? []) as unknown as GraphSpark[]).map((s) => ({
          ...s,
          label: s.content?.slice(0, 60) || s.file_name || s.type,
          tags: s.metadata?.tags || [],
          summary: s.metadata?.summary || null,
          storage_path: s.storage_path || null,
        })),
        tags: ((tags ?? []) as unknown as GraphTag[]).map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          created_at: t.created_at,
          tile_ids: (t.tile_tags || []).map((tt) => tt.tile_id),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tiles/:id
 * Get single tile with all its memos
 */
tilesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // Get tile with tags — expose is_root so callers can reliably skip the
    // GIMMICK root without relying on the literal name match.
    const { data: tile, error: tileError } = await supabaseAdmin
      .from('tiles')
      .select('*, tile_tags(tag_id, tags(id, name, tag_type, is_root))')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (tileError || !tile) {
      throw new NotFoundError('Tile not found');
    }

    // Get all sparks for this tile
    const { data: sparks, error: sparksError } = await supabaseAdmin
      .from('sparks')
      .select('*')
      .eq('tile_id', id)
      .order('created_at', { ascending: true });

    if (sparksError) {
      throw sparksError;
    }

    type TileTagDetail = {
      tag_id: string;
      tags: { id: string; name: string; tag_type: string; is_root: boolean } | null;
    };
    const tileRow = tile as unknown as Tile & { tile_tags?: TileTagDetail[] };
    const tags = (tileRow.tile_tags || []).map((tt) => tt.tags).filter(Boolean);

    res.json({
      success: true,
      data: {
        ...tile,
        sparks: sparks || [],
        tags,
        tile_tags: undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tiles
 * Create a new tile (returns tile_id for subsequent memo uploads)
 */
tilesRouter.post(
  '/',
  validate(createTileSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const tileData: Record<string, unknown> = {
        ...req.body,
        user_id: req.user!.id,
      };

      // Default new tiles to the system 'active' status (unless the caller
      // already provided a status_id).
      if (!tileData.status_id) {
        const activeId = await getActiveStatusId(req.user!.id);
        if (activeId) tileData.status_id = activeId;
      }

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .insert(tileData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Auto-tag new tile with GIMMICK (inbox)
      const { data: rootTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', req.user!.id)
        .eq('is_root', true)
        .single();

      if (rootTag) {
        await supabaseAdmin
          .from('tile_tags')
          .insert({ tile_id: data.id, tag_id: rootTag.id });
      }

      // Fire-and-forget: generate semantic embedding for the new tile so the
      // unified `find` tool can match it. Errors are swallowed inside.
      void upsertTileEmbedding(data.id);

      res.status(201).json({
        success: true,
        data: data as Tile,
        message: 'Tile created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/tiles/:id
 * Update a tile
 */
tilesRouter.patch(
  '/:id',
  validate(updateTileSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;
      const updates: Record<string, unknown> = { ...req.body };

      // Sync action_type ↔ is_event
      if (updates.action_type) {
        updates.action_type_reviewed = true;
        if (updates.action_type === 'event') {
          updates.is_event = true;
        } else if (updates.action_type === 'none' || updates.action_type === 'anytime') {
          // Changing to none/anytime → clear date fields
          updates.is_event = false;
          updates.all_day = false;
          updates.start_at = null;
          updates.end_at = null;
        } else if (updates.action_type === 'deadline') {
          updates.is_event = false;
        }
      }
      if (updates.is_event === true && !updates.action_type) {
        updates.action_type = 'event';
        updates.action_type_reviewed = true;
      }

      // Sync is_completed with the 'done' system status whenever status_id changes.
      // The status is now the single source of truth for completion; is_completed
      // is kept around only so existing filters/sorts/doneShape keep working.
      if ('status_id' in updates) {
        if (updates.status_id === null || updates.status_id === undefined) {
          updates.is_completed = false;
        } else {
          const { data: st } = await supabaseAdmin
            .from('statuses')
            .select('name, category')
            .eq('id', updates.status_id)
            .eq('user_id', req.user!.id)
            .maybeSingle();
          updates.is_completed = !!(st && st.category === 'system' && st.name === 'done');
        }
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundError('Tile not found');
      }

      // Refresh the embedding only when the searchable fields actually
      // changed — avoids a wasted OpenAI call on every status / date / tag
      // tweak.
      if ('title' in req.body || 'description' in req.body) {
        void upsertTileEmbedding(data.id as string);
      }

      res.json({
        success: true,
        data: data as Tile,
        message: 'Tile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/tiles/:id
 * Delete a tile and all its memos
 */
tilesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // First get all sparks for this tile to delete their files
    const { data: sparks, error: fetchError } = await supabaseAdmin
      .from('sparks')
      .select('storage_path')
      .eq('tile_id', id)
      .eq('user_id', req.user!.id);

    if (fetchError) {
      throw fetchError;
    }

    // Collect all files to delete
    const filesToDelete: string[] = [];
    sparks?.forEach((spark) => {
      if (spark.storage_path) filesToDelete.push(spark.storage_path);
    });

    // Delete files from storage
    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('sparks').remove(filesToDelete);
    }

    // Delete sparks first (in case FK has no CASCADE)
    const { error: sparksDeleteError } = await supabaseAdmin
      .from('sparks')
      .delete()
      .eq('tile_id', id)
      .eq('user_id', req.user!.id);

    if (sparksDeleteError) {
      throw sparksDeleteError;
    }

    // Delete tile_tags
    await supabaseAdmin
      .from('tile_tags')
      .delete()
      .eq('tile_id', id);

    // Delete tile
    const { error: deleteError } = await supabaseAdmin
      .from('tiles')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Tile and all sparks deleted successfully',
    });
  } catch (error) {
    console.error('[DELETE /tiles/:id] Error:', JSON.stringify(error, null, 2));
    next(error);
  }
});
