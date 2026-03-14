import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Spark, SparkType } from '../types/index.js';
import { processNewSpark, generateEmbedding } from '../services/indexing.js';

export const sparksRouter = Router();

// All routes require authentication
sparksRouter.use(authenticate);

/**
 * GET /api/sparks/stats
 * Get spark count grouped by type
 */
sparksRouter.get('/stats', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sparks')
      .select('type, file_size, created_at')
      .eq('user_id', req.user!.id);

    if (error) throw error;

    const counts: Record<string, number> = {};
    const dateCounts: Record<string, number> = {};
    let total = 0;
    let totalSize = 0;

    for (const row of data || []) {
      counts[row.type] = (counts[row.type] || 0) + 1;
      totalSize += row.file_size || 0;
      total++;

      const date = new Date(row.created_at).toISOString().split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }

    res.json({
      success: true,
      data: { counts, total, totalSize, dateCounts },
    });
  } catch (error) {
    next(error);
  }
});

// Validation schemas
const sparkTypeEnum = z.enum([
  'photo',
  'image',
  'video',
  'audio_recording',
  'text',
  'file',
]);

const createSparkSchema = z.object({
  type: sparkTypeEnum,
  tile_id: z.string().uuid().optional(),
  content: z.string().optional(),
  storage_path: z.string().optional(),
  thumbnail_path: z.string().optional(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().int().nonnegative().optional(),
  duration: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSparkSchema = z.object({
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: sparkTypeEnum.optional(),
  tile_id: z.string().uuid().optional(),
});

/**
 * GET /api/sparks
 * List user's sparks with pagination
 */
sparksRouter.get(
  '/',
  validate(querySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { page, limit, type, tile_id } = req.query as unknown as {
        page: number;
        limit: number;
        type?: SparkType;
        tile_id?: string;
      };
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('sparks')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) {
        query = query.eq('type', type);
      }

      if (tile_id) {
        query = query.eq('tile_id', tile_id);
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data as Spark[],
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
 * GET /api/sparks/search
 * Semantic search across user's sparks
 */
sparksRouter.get(
  '/search',
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { q, limit: limitStr } = req.query as { q?: string; limit?: string };

      if (!q || !q.trim()) {
        res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        return;
      }

      const searchLimit = Math.min(parseInt(limitStr || '10', 10) || 10, 50);

      // Generate embedding for the search query
      const queryEmbedding = await generateEmbedding(q);

      // Call the match_sparks RPC function
      const { data, error } = await supabaseAdmin.rpc('match_sparks', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.3,
        match_count: searchLimit,
        match_user_id: req.user!.id,
      });

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        data: data || [],
        query: q,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sparks/reindex-all
 * Re-trigger AI indexing for all pending/failed sparks
 */
sparksRouter.post('/reindex-all', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data: sparks, error } = await supabaseAdmin
      .from('sparks')
      .select('id')
      .eq('user_id', req.user!.id)
      .in('ai_status', ['pending', 'failed']);

    if (error) throw error;

    if (!sparks || sparks.length === 0) {
      res.json({ success: true, message: 'No sparks to reindex', count: 0 });
      return;
    }

    for (const spark of sparks) {
      processNewSpark(spark.id).catch((err) => {
        console.error(`[Sparks] Reindex-all failed for ${spark.id}:`, err);
      });
    }

    res.json({
      success: true,
      message: `Reindexing started for ${sparks.length} sparks`,
      count: sparks.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sparks/:id/reindex
 * Re-trigger AI indexing for a spark
 */
sparksRouter.post('/:id/reindex', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const id = req.params.id as string;

    const { data: spark, error } = await supabaseAdmin
      .from('sparks')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !spark) {
      throw new NotFoundError('Spark not found');
    }

    await supabaseAdmin
      .from('sparks')
      .update({ ai_status: 'pending' })
      .eq('id', id);

    processNewSpark(id).catch((err) => {
      console.error(`[Sparks] Reindex failed for ${id}:`, err);
    });

    res.json({
      success: true,
      message: 'Reindexing started',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/sparks/:id
 * Get single spark by ID
 */
sparksRouter.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('sparks')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Spark not found');
    }

    res.json({
      success: true,
      data: data as Spark,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/sparks
 * Create a new spark
 */
sparksRouter.post(
  '/',
  validate(createSparkSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      let tileId = req.body.tile_id;

      // Auto-create tile if none provided
      if (!tileId) {
        const { data: newTile, error: tileError } = await supabaseAdmin
          .from('tiles')
          .insert({ user_id: req.user!.id })
          .select('id')
          .single();
        if (tileError) throw tileError;
        tileId = newTile.id;
      }

      const sparkData = {
        ...req.body,
        user_id: req.user!.id,
        tile_id: tileId,
      };

      const { data, error } = await supabaseAdmin
        .from('sparks')
        .insert(sparkData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Fire-and-forget AI indexing
      processNewSpark(data.id).catch((err) => {
        console.error(`[Sparks] Indexing trigger failed for ${data.id}:`, err);
      });

      res.status(201).json({
        success: true,
        data: data as Spark,
        message: 'Spark created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/sparks/batch
 * Create multiple sparks at once (optionally with tile_id)
 */
sparksRouter.post(
  '/batch',
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { items, tile_id } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Items array is required',
        });
        return;
      }

      let batchTileId = tile_id;
      if (!batchTileId) {
        const { data: newTile, error: tileError } = await supabaseAdmin
          .from('tiles')
          .insert({ user_id: req.user!.id })
          .select('id')
          .single();
        if (tileError) throw tileError;
        batchTileId = newTile.id;
      }

      const sparksData = items.map((item: unknown) => {
        const parsed = createSparkSchema.parse(item);
        return {
          ...parsed,
          user_id: req.user!.id,
          tile_id: parsed.tile_id || batchTileId,
        };
      });

      const { data, error } = await supabaseAdmin
        .from('sparks')
        .insert(sparksData)
        .select();

      if (error) {
        throw error;
      }

      for (const spark of data) {
        processNewSpark(spark.id).catch((err) => {
          console.error(`[Sparks] Indexing trigger failed for ${spark.id}:`, err);
        });
      }

      res.status(201).json({
        success: true,
        data: data as Spark[],
        message: `${data.length} sparks created successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/sparks/:id
 * Update a spark
 */
sparksRouter.patch(
  '/:id',
  validate(updateSparkSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('sparks')
        .update({
          ...req.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundError('Spark not found');
      }

      res.json({
        success: true,
        data: data as Spark,
        message: 'Spark updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/sparks/:id
 * Delete a spark
 */
sparksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data: spark, error: fetchError } = await supabaseAdmin
      .from('sparks')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !spark) {
      throw new NotFoundError('Spark not found');
    }

    // Delete associated files from storage
    const filesToDelete: string[] = [];
    if (spark.storage_path) filesToDelete.push(spark.storage_path);
    if (spark.thumbnail_path) filesToDelete.push(spark.thumbnail_path);

    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('sparks').remove(filesToDelete);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('sparks')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Spark deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});
