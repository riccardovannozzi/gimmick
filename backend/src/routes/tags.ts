import { Router, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest, Tag } from '../types/index.js';
import { updateTagWeights, getTagGraph, getRelatedTags } from '../services/tagGraph.js';

export const tagsRouter = Router();

tagsRouter.use(authenticate);

const tagTypeEnum = z.enum(['project', 'person', 'context', 'place', 'topic']);

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).optional(),
  aliases: z.array(z.string().max(50)).max(20).optional(),
  tag_type: tagTypeEnum.default('topic'),
});

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(7).optional(),
  aliases: z.array(z.string().max(50)).max(20).optional(),
  tag_type: tagTypeEnum.optional(),
});

// ─── Static routes (before :id params) ───────────────────────

/**
 * GET /api/tags
 * List all user tags
 */
tagsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('tags')
      .select('*')
      .eq('user_id', req.user!.id)
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data as Tag[] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags
 * Create a new tag
 */
tagsRouter.post(
  '/',
  validate(createTagSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { name, color, aliases, tag_type } = req.body;

      const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\u00C0-\u024F-]/g, '').replace(/-+/g, '-');

      const { data, error } = await supabaseAdmin
        .from('tags')
        .insert({ name, color, slug, aliases: aliases || [], tag_type: tag_type || 'topic', user_id: req.user!.id })
        .select()
        .single();

      if (error) throw error;

      const newTag = data as Tag;

      // Auto-link new tag to GIMMICK root tag
      const { data: rootTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', req.user!.id)
        .eq('is_root', true)
        .single();

      if (rootTag && rootTag.id !== newTag.id) {
        await supabaseAdmin.from('tag_relations').upsert(
          [
            { user_id: req.user!.id, tag_from: newTag.id, tag_to: rootTag.id, weight: 0, relation_type: 'root-link' },
            { user_id: req.user!.id, tag_from: rootTag.id, tag_to: newTag.id, weight: 0, relation_type: 'root-link' },
          ],
          { onConflict: 'user_id,tag_from,tag_to' }
        );
      }

      res.status(201).json({
        success: true,
        data: newTag,
        message: 'Tag created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/tags/graph
 * Get the full tag co-occurrence graph (nodes + weighted edges)
 */
tagsRouter.get('/graph', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const graph = await getTagGraph(req.user!.id);
    console.log(`[Tags] Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    res.json({ success: true, data: graph });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/tags/relations
 * Manually adjust a tag relation weight
 */
tagsRouter.patch('/relations', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tag_from, tag_to, weight, relation_type } = req.body;

    if (!tag_from || !tag_to) {
      return res.status(400).json({ success: false, error: 'tag_from and tag_to required' });
    }

    // Build update object — only include fields that are provided
    const base: Record<string, unknown> = { user_id: req.user!.id, updated_at: new Date().toISOString() };
    if (weight !== undefined) base.weight = weight;
    if (relation_type !== undefined) base.relation_type = relation_type;

    // Upsert both directions
    const rows = [
      { ...base, tag_from, tag_to },
      { ...base, tag_from: tag_to, tag_to: tag_from },
    ];

    const { error } = await supabaseAdmin
      .from('tag_relations')
      .upsert(rows, { onConflict: 'user_id,tag_from,tag_to' });

    if (error) throw error;

    res.json({ success: true, message: 'Relation updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tags/relations
 * Delete a tag relation (both directions)
 */
tagsRouter.delete('/relations', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { tag_from, tag_to } = req.body;

    if (!tag_from || !tag_to) {
      return res.status(400).json({ success: false, error: 'tag_from and tag_to required' });
    }

    // Delete both directions
    const { error: err1 } = await supabaseAdmin
      .from('tag_relations')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('tag_from', tag_from)
      .eq('tag_to', tag_to);

    const { error: err2 } = await supabaseAdmin
      .from('tag_relations')
      .delete()
      .eq('user_id', req.user!.id)
      .eq('tag_from', tag_to)
      .eq('tag_to', tag_from);

    if (err1) throw err1;
    if (err2) throw err2;

    res.json({ success: true, message: 'Relation deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── Parameterized routes (:id) ──────────────────────────────

/**
 * PATCH /api/tags/:id
 * Update a tag
 */
tagsRouter.patch(
  '/:id',
  validate(updateTagSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { id } = req.params;

      // Block tag_type change on root GIMMICK tag
      if (req.body.tag_type) {
        const { data: existing } = await supabaseAdmin
          .from('tags')
          .select('is_root')
          .eq('id', id)
          .eq('user_id', req.user!.id)
          .single();
        if (existing?.is_root) {
          return res.status(403).json({ success: false, error: 'Cannot change tag_type on root tag' });
        }
      }

      // If name is being updated, also update slug
      const updates = { ...req.body };
      if (updates.name) {
        updates.slug = updates.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\u00C0-\u024F-]/g, '').replace(/-+/g, '-');
      }

      const { data, error } = await supabaseAdmin
        .from('tags')
        .update(updates)
        .eq('id', id)
        .eq('user_id', req.user!.id)
        .select()
        .single();

      if (error || !data) throw new NotFoundError('Tag not found');

      res.json({ success: true, data: data as Tag });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/tags/:id
 * Delete a tag
 */
tagsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check if tag is the root GIMMICK tag
    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('is_root')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!tag) throw new NotFoundError('Tag not found');

    if (tag.is_root) {
      return res.status(403).json({
        success: false,
        error: 'Il tag GIMMICK non può essere eliminato',
      });
    }

    // Find tiles that will become orphans after deletion
    const { data: affectedTileTags } = await supabaseAdmin
      .from('tile_tags')
      .select('tile_id')
      .eq('tag_id', id);

    const affectedTileIds = (affectedTileTags || []).map((tt) => tt.tile_id);

    // Delete the tag (cascade removes tile_tags and tag_relations)
    const { error } = await supabaseAdmin
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    // Reassign orphan tiles to GIMMICK
    if (affectedTileIds.length > 0) {
      const { data: rootTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .eq('is_root', true)
        .single();

      if (rootTag) {
        for (const tileId of affectedTileIds) {
          const { count } = await supabaseAdmin
            .from('tile_tags')
            .select('*', { count: 'exact', head: true })
            .eq('tile_id', tileId);

          if (count === 0) {
            await supabaseAdmin
              .from('tile_tags')
              .insert({ tile_id: tileId, tag_id: rootTag.id });
          }
        }
      }
    }

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/:id/tiles
 * Associate a tag with tiles
 */
tagsRouter.post('/:id/tiles', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: tagId } = req.params;
    const { tile_ids } = req.body as { tile_ids: string[] };

    if (!tile_ids || !Array.isArray(tile_ids)) {
      return res.status(400).json({ success: false, error: 'tile_ids array required' });
    }

    const rows = tile_ids.map((tile_id) => ({ tag_id: tagId, tile_id }));

    const { error } = await supabaseAdmin
      .from('tile_tags')
      .upsert(rows, { onConflict: 'tag_id,tile_id' });

    if (error) throw error;

    // Update tag graph weights for each affected tile (fire-and-forget)
    for (const tileId of tile_ids) {
      updateTagWeights(req.user!.id, tileId).catch((err) =>
        console.error(`[Tags] Weight update failed for tile ${tileId}:`, err)
      );
    }

    res.json({ success: true, message: 'Tiles tagged' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tags/:id/tiles/:tileId
 * Remove tag from a tile
 */
tagsRouter.delete('/:id/tiles/:tileId', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tagId = req.params.id as string;
    const tileId = req.params.tileId as string;

    const { error } = await supabaseAdmin
      .from('tile_tags')
      .delete()
      .eq('tag_id', tagId)
      .eq('tile_id', tileId);

    if (error) throw error;

    // Update tag graph weights after removal (fire-and-forget)
    updateTagWeights(req.user!.id, tileId).catch((err) =>
      console.error(`[Tags] Weight update failed for tile ${tileId}:`, err)
    );

    // If tile is now orphan (no tags left), assign GIMMICK
    const { count } = await supabaseAdmin
      .from('tile_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tile_id', tileId);

    if (count === 0) {
      const { data: rootTag } = await supabaseAdmin
        .from('tags')
        .select('id')
        .eq('user_id', req.user!.id)
        .eq('is_root', true)
        .single();

      if (rootTag) {
        await supabaseAdmin
          .from('tile_tags')
          .insert({ tile_id: tileId, tag_id: rootTag.id });
      }
    }

    res.json({ success: true, message: 'Tag removed from tile' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tags/:id/tiles
 * Get tiles for a specific tag
 */
tagsRouter.get('/:id/tiles', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id: tagId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('tile_tags')
      .select('tile_id, tiles(*)')
      .eq('tag_id', tagId);

    if (error) throw error;

    const tiles = data?.map((row: any) => row.tiles).filter(Boolean) || [];
    res.json({ success: true, data: tiles });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tags/:id/related
 * Get tags related to a specific tag, ordered by co-occurrence weight
 */
tagsRouter.get('/:id/related', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const tagId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const related = await getRelatedTags(req.user!.id, tagId, limit);
    res.json({ success: true, data: related });
  } catch (error) {
    next(error);
  }
});
