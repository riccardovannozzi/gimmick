import { supabaseAdmin } from '../config/supabase.js';

/**
 * Returns the id of a user's system 'active' status (the default for new tiles).
 * Returns null if the row hasn't been seeded yet — callers should leave
 * `status_id` unset in that case rather than failing the write.
 */
export async function getActiveStatusId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('statuses')
    .select('id')
    .eq('user_id', userId)
    .eq('category', 'system')
    .eq('name', 'active')
    .maybeSingle();
  return data?.id ?? null;
}
