import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Tile, ActionType } from '../types/index.js';

const ACTION_TYPES = ['none', 'anytime', 'deadline', 'event'] as const;

export const tilesRouter = Router();

// All routes require authentication
tilesRouter.use(authenticate);

// Validation schemas
const createTileSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const updateTileSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  action_type: z.enum(ACTION_TYPES).optional(),
  is_event: z.boolean().optional(),
  all_day: z.boolean().optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  is_completed: z.boolean().optional(),
  is_cta: z.boolean().optional(),
  pattern_id: z.string().uuid().nullable().optional(),
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

      // Get tiles with sparks and tags
      const { data, error, count } = await supabaseAdmin
        .from('tiles')
        .select('*, sparks(id, type, content, storage_path, file_name), tile_tags(tag_id, tags(id, name, tag_type))', { count: 'exact' })
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

      // Find tiles without any tags and auto-assign GIMMICK
      if (rootTag && data) {
        const untaggedIds = data
          .filter((tile: any) => !tile.tile_tags || tile.tile_tags.length === 0)
          .map((tile: any) => tile.id);

        if (untaggedIds.length > 0) {
          const rows = untaggedIds.map((tile_id: string) => ({
            tile_id,
            tag_id: rootTag.id,
          }));
          await supabaseAdmin
            .from('tile_tags')
            .upsert(rows, { onConflict: 'tag_id,tile_id' });
        }
      }

      // Transform data to include spark_count, sparks preview, and tags
      const tilesWithCount = data?.map((tile: any) => {
        const sparks = Array.isArray(tile.sparks) ? tile.sparks : [];
        const tags = (tile.tile_tags || []).map((tt: any) => tt.tags).filter(Boolean);
        // If no tags, inject root tag
        if (tags.length === 0 && rootTag) {
          tags.push({ id: rootTag.id, name: rootTag.name });
        }
        return {
          ...tile,
          spark_count: sparks.length,
          sparks,
          tags,
          tile_tags: undefined,
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
      .select('id, title, description, created_at, action_type')
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

    res.json({
      success: true,
      data: {
        tiles: tiles || [],
        sparks: (sparks || []).map((s: any) => ({
          ...s,
          label: s.content?.slice(0, 60) || s.file_name || s.type,
          tags: s.metadata?.tags || [],
          summary: s.metadata?.summary || null,
          storage_path: s.storage_path || null,
        })),
        tags: (tags || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          created_at: t.created_at,
          tile_ids: (t.tile_tags || []).map((tt: any) => tt.tile_id),
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

    // Get tile with tags
    const { data: tile, error: tileError } = await supabaseAdmin
      .from('tiles')
      .select('*, tile_tags(tag_id, tags(id, name, tag_type))')
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

    const tags = ((tile as any).tile_tags || []).map((tt: any) => tt.tags).filter(Boolean);

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
      const tileData = {
        ...req.body,
        user_id: req.user!.id,
      };

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
