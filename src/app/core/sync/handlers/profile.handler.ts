import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '@core/db/app.db';
import type { Profile, SyncOp } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * PROFILE handler.
 *
 * - Table: `profiles`, PK = `id` (matches auth.users.id)
 * - One row per user. Upsert by id.
 * - Delete is supported but in practice profiles are never deleted from the
 *   client — that's an account-deletion flow which lives elsewhere.
 */
export const profileHandler: SyncHandler = {
  entity: 'profile',
  tableName: 'profiles',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const { error } = await client.from('profiles').delete().eq('id', recordId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const profile = payload as Profile;
    const row = toRow(profile);

    const { data, error } = await client
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('profiles').select('*').eq('id', userId);
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const local = await db.profile.get(row.id);
      const localUpdated = local?.updatedAt ?? '';
      const remoteUpdated = row.updated_at as string;

      // Last-write-wins: only overwrite local if remote is newer
      if (remoteUpdated > localUpdated) {
        await db.profile.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(p: Profile): Record<string, unknown> {
  return {
    id: p.id,
    email: p.email ?? null,
    display_name: p.displayName ?? null,
    avatar_url: p.avatarUrl ?? null,
    age: p.age,
    gender: p.gender,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    activity_level: p.activityLevel,
    goal: p.goal,
    updated_at: p.updatedAt,
  };
}

function fromRow(r: Record<string, unknown>): Profile {
  return {
    id: r['id'] as string,
    email: (r['email'] as string) ?? undefined,
    displayName: (r['display_name'] as string) ?? undefined,
    avatarUrl: (r['avatar_url'] as string) ?? undefined,
    age: r['age'] as number,
    gender: r['gender'] as Profile['gender'],
    heightCm: Number(r['height_cm']),
    weightKg: Number(r['weight_kg']),
    activityLevel: r['activity_level'] as Profile['activityLevel'],
    goal: r['goal'] as Profile['goal'],
    createdAt: r['created_at'] as string,
    updatedAt: r['updated_at'] as string,
  };
}
