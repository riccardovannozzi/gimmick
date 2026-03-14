import { supabaseAdmin } from '../config/supabase.js';

// ---------- Types ----------

export interface TagNode {
  id: string;
  name: string;
  slug: string;
  color?: string;
  usage_count: number;
  is_root?: boolean;
}

export interface TagEdge {
  id: string;
  tag_from: string;
  tag_to: string;
  weight: number;
  relation_type?: string;
}

export interface TagGraph {
  nodes: TagNode[];
  edges: TagEdge[];
}

// ---------- Helpers ----------

/** Generate a URL-safe slug from a tag name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u00C0-\u024F-]/g, '') // keep accented chars
    .replace(/-+/g, '-');
}

// ---------- Service ----------

/**
 * Ensure a tag has a slug. Called on create/update if slug is missing.
 */
export async function ensureTagSlug(tagId: string, name: string): Promise<void> {
  const slug = slugify(name);
  await supabaseAdmin
    .from('tags')
    .update({ slug })
    .eq('id', tagId)
    .is('slug', null);
}

/**
 * Update co-occurrence weights after tags change on a tile.
 * Call this AFTER inserting/removing tile_tags for a tile.
 *
 * Strategy: recalculate all pairs for the given tile.
 */
export async function updateTagWeights(userId: string, tileId: string): Promise<void> {
  // Get all tag_ids currently on this tile
  const { data: tileTags, error } = await supabaseAdmin
    .from('tile_tags')
    .select('tag_id')
    .eq('tile_id', tileId);

  if (error || !tileTags) return;

  const tagIds = tileTags.map((tt) => tt.tag_id);

  // Update usage_count for each tag involved
  for (const tagId of tagIds) {
    const { count } = await supabaseAdmin
      .from('tile_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', tagId);

    await supabaseAdmin
      .from('tags')
      .update({ usage_count: count || 0 })
      .eq('id', tagId);
  }

  // Need at least 2 tags on the tile for co-occurrence
  if (tagIds.length < 2) return;

  // Generate all ordered pairs (both directions)
  const pairs: { tag_from: string; tag_to: string }[] = [];
  for (let i = 0; i < tagIds.length; i++) {
    for (let j = 0; j < tagIds.length; j++) {
      if (i !== j) {
        pairs.push({ tag_from: tagIds[i], tag_to: tagIds[j] });
      }
    }
  }

  // For each pair, compute global weight (count of tiles sharing both tags)
  for (const pair of pairs) {
    // Count tiles that have BOTH tags
    const { data: sharedTiles } = await supabaseAdmin
      .from('tile_tags')
      .select('tile_id')
      .eq('tag_id', pair.tag_from);

    const fromTileIds = (sharedTiles || []).map((r) => r.tile_id);

    if (fromTileIds.length === 0) continue;

    const { count } = await supabaseAdmin
      .from('tile_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', pair.tag_to)
      .in('tile_id', fromTileIds);

    const weight = count || 0;

    if (weight > 0) {
      await supabaseAdmin
        .from('tag_relations')
        .upsert(
          {
            user_id: userId,
            tag_from: pair.tag_from,
            tag_to: pair.tag_to,
            weight,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,tag_from,tag_to' }
        );
    } else {
      // Remove relation if weight drops to 0
      await supabaseAdmin
        .from('tag_relations')
        .delete()
        .eq('user_id', userId)
        .eq('tag_from', pair.tag_from)
        .eq('tag_to', pair.tag_to);
    }
  }
}

/**
 * Get the full tag graph for a user (nodes + edges).
 */
export async function getTagGraph(userId: string): Promise<TagGraph> {
  const [nodesResult, edgesResult] = await Promise.all([
    supabaseAdmin
      .from('tags')
      .select('id, name, slug, color, usage_count, is_root')
      .eq('user_id', userId)
      .order('name'),
    supabaseAdmin
      .from('tag_relations')
      .select('id, tag_from, tag_to, weight, relation_type')
      .eq('user_id', userId)
      .or('weight.gt.0,relation_type.eq.root-link'),
  ]);

  return {
    nodes: (nodesResult.data || []) as TagNode[],
    edges: (edgesResult.data || []) as TagEdge[],
  };
}

/**
 * Get tags related to a specific tag, ordered by weight.
 */
export async function getRelatedTags(
  userId: string,
  tagId: string,
  limit = 10
): Promise<(TagNode & { weight: number })[]> {
  const { data: relations } = await supabaseAdmin
    .from('tag_relations')
    .select('tag_to, weight')
    .eq('user_id', userId)
    .eq('tag_from', tagId)
    .gt('weight', 0)
    .order('weight', { ascending: false })
    .limit(limit);

  if (!relations || relations.length === 0) return [];

  const relatedIds = relations.map((r) => r.tag_to);

  const { data: tags } = await supabaseAdmin
    .from('tags')
    .select('id, name, slug, color, usage_count')
    .in('id', relatedIds);

  if (!tags) return [];

  // Merge weight into tag data, maintain weight ordering
  const weightMap = new Map(relations.map((r) => [r.tag_to, r.weight]));
  return relatedIds
    .map((id) => {
      const tag = tags.find((t) => t.id === id);
      if (!tag) return null;
      return { ...tag, weight: weightMap.get(id) || 0 } as TagNode & { weight: number };
    })
    .filter(Boolean) as (TagNode & { weight: number })[];
}
