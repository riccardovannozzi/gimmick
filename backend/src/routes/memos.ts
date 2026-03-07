import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Memo, MemoType } from '../types/index.js';
import { processNewMemo, generateEmbedding } from '../services/indexing.js';

export const memosRouter = Router();

// All routes require authentication
memosRouter.use(authenticate);

// Validation schemas
const memoTypeEnum = z.enum([
  'photo',
  'image',
  'video',
  'audio_recording',
  'text',
  'file',
]);

const createMemoSchema = z.object({
  type: memoTypeEnum,
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

const updateMemoSchema = z.object({
  content: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: memoTypeEnum.optional(),
  tile_id: z.string().uuid().optional(),
});

/**
 * GET /api/memos
 * List user's memos with pagination
 */
memosRouter.get(
  '/',
  validate(querySchema, 'query'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { page, limit, type, tile_id } = req.query as unknown as {
        page: number;
        limit: number;
        type?: MemoType;
        tile_id?: string;
      };
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('memos')
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
        data: data as Memo[],
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
 * GET /api/memos/search
 * Semantic search across user's memos
 */
memosRouter.get(
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

      // Call the match_memos RPC function
      const { data, error } = await supabaseAdmin.rpc('match_memos', {
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
 * POST /api/memos/reindex-all
 * Re-trigger AI indexing for all pending/failed memos
 */
memosRouter.post('/reindex-all', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    // Find all memos that need indexing
    const { data: memos, error } = await supabaseAdmin
      .from('memos')
      .select('id')
      .eq('user_id', req.user!.id)
      .in('ai_status', ['pending', 'failed']);

    if (error) throw error;

    if (!memos || memos.length === 0) {
      res.json({ success: true, message: 'No memos to reindex', count: 0 });
      return;
    }

    // Fire-and-forget indexing for each memo (concurrency limiter handles throttling)
    for (const memo of memos) {
      processNewMemo(memo.id).catch((err) => {
        console.error(`[Memos] Reindex-all failed for ${memo.id}:`, err);
      });
    }

    res.json({
      success: true,
      message: `Reindexing started for ${memos.length} memos`,
      count: memos.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/memos/:id/reindex
 * Re-trigger AI indexing for a memo
 */
memosRouter.post('/:id/reindex', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const id = req.params.id as string;

    // Verify ownership
    const { data: memo, error } = await supabaseAdmin
      .from('memos')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !memo) {
      throw new NotFoundError('Memo not found');
    }

    // Reset status and fire indexing
    await supabaseAdmin
      .from('memos')
      .update({ ai_status: 'pending' })
      .eq('id', id);

    processNewMemo(id).catch((err) => {
      console.error(`[Memos] Reindex failed for ${id}:`, err);
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
 * GET /api/memos/:id
 * Get single memo by ID
 */
memosRouter.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('memos')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !data) {
      throw new NotFoundError('Memo not found');
    }

    res.json({
      success: true,
      data: data as Memo,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/memos
 * Create a new memo
 */
memosRouter.post(
  '/',
  validate(createMemoSchema),
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

      const memoData = {
        ...req.body,
        user_id: req.user!.id,
        tile_id: tileId,
      };

      const { data, error } = await supabaseAdmin
        .from('memos')
        .insert(memoData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Fire-and-forget AI indexing
      processNewMemo(data.id).catch((err) => {
        console.error(`[Memos] Indexing trigger failed for ${data.id}:`, err);
      });

      res.status(201).json({
        success: true,
        data: data as Memo,
        message: 'Memo created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/memos/batch
 * Create multiple memos at once (optionally with tile_id)
 */
memosRouter.post(
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

      // Auto-create tile if none provided at batch or item level
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

      // Validate and add user_id and tile_id to each item
      const memosData = items.map((item: unknown) => {
        const parsed = createMemoSchema.parse(item);
        return {
          ...parsed,
          user_id: req.user!.id,
          tile_id: parsed.tile_id || batchTileId,
        };
      });

      const { data, error } = await supabaseAdmin
        .from('memos')
        .insert(memosData)
        .select();

      if (error) {
        throw error;
      }

      // Fire-and-forget AI indexing for each memo
      for (const memo of data) {
        processNewMemo(memo.id).catch((err) => {
          console.error(`[Memos] Indexing trigger failed for ${memo.id}:`, err);
        });
      }

      res.status(201).json({
        success: true,
        data: data as Memo[],
        message: `${data.length} memos created successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/memos/:id
 * Update a memo
 */
memosRouter.patch(
  '/:id',
  validate(updateMemoSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabaseAdmin
        .from('memos')
        .update({
          ...req.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) {
        throw new NotFoundError('Memo not found');
      }

      res.json({
        success: true,
        data: data as Memo,
        message: 'Memo updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/memos/:id
 * Delete a memo
 */
memosRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    // First get the memo to check ownership and get storage paths
    const { data: memo, error: fetchError } = await supabaseAdmin
      .from('memos')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user!.id)
      .single();

    if (fetchError || !memo) {
      throw new NotFoundError('Memo not found');
    }

    // Delete associated files from storage
    const filesToDelete: string[] = [];
    if (memo.storage_path) filesToDelete.push(memo.storage_path);
    if (memo.thumbnail_path) filesToDelete.push(memo.thumbnail_path);

    if (filesToDelete.length > 0) {
      await supabaseAdmin.storage.from('memos').remove(filesToDelete);
    }

    // Delete memo from database
    const { error: deleteError } = await supabaseAdmin
      .from('memos')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({
      success: true,
      message: 'Memo deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});
