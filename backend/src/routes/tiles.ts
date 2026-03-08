import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Tile } from '../types/index.js';

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

      // Get tiles with memo count and tags
      const { data, error, count } = await supabaseAdmin
        .from('tiles')
        .select('*, memos(count), tile_tags(tag_id, tags(id, name, color))', { count: 'exact' })
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      // Transform data to include memo_count and tags
      const tilesWithCount = data?.map((tile: any) => ({
        ...tile,
        memo_count: tile.memos?.[0]?.count || 0,
        memos: undefined,
        tags: (tile.tile_tags || []).map((tt: any) => tt.tags).filter(Boolean),
        tile_tags: undefined,
      }));

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
      .select('id, title, description, created_at')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (tilesError) throw tilesError;

    // Get all memos (with tile_id to build connections)
    const { data: memos, error: memosError } = await supabaseAdmin
      .from('memos')
      .select('id, tile_id, type, content, file_name, metadata, created_at')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    if (memosError) throw memosError;

    // Get all tags with their tile associations
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from('tags')
      .select('id, name, color, created_at, tile_tags(tile_id)')
      .eq('user_id', req.user!.id)
      .order('name');

    if (tagsError) throw tagsError;

    res.json({
      success: true,
      data: {
        tiles: tiles || [],
        memos: (memos || []).map((m: any) => ({
          ...m,
          label: m.content?.slice(0, 60) || m.file_name || m.type,
          tags: m.metadata?.tags || [],
          summary: m.metadata?.summary || null,
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

    // Get tile
    const { data: tile, error: tileError } = await supabaseAdmin
      .from('tiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (tileError || !tile) {
      throw new NotFoundError('Tile not found');
    }

    // Get all memos for this tile
    const { data: memos, error: memosError } = await supabaseAdmin
      .from('memos')
      .select('*')
      .eq('tile_id', id)
      .order('created_at', { ascending: true });

    if (memosError) {
      throw memosError;
    }

    res.json({
      success: true,
      data: {
        ...tile,
        memos: memos || [],
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

      const { data, error } = await supabaseAdmin
        .from('tiles')
        .update({
          ...req.body,
          updated_at: new Date().toISOString(),
        })
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

    // First get all memos for this tile to delete their files
    const { data: memos, error: fetchError } = await supabaseAdmin
      .from('memos')
      .select('storage_path, thumbnail_path')
      .eq('tile_id', id)
      .eq('user_id', req.user!.id);

    if (fetchError) {
      throw fetchError;
    }

    // Collect all files to delete
    const filesToDelete: string[] = [];
    memos?.forEach((memo) => {
      if (memo.storage_path) filesToDelete.push(memo.storage_path);
      if (memo.thumbnail_path) filesToDelete.push(memo.thumbnail_path);
    });

    // Delete files from storage
    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('memos').remove(filesToDelete);
    }

    // Delete tile (cascade will delete memos)
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
      message: 'Tile and all memos deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});
