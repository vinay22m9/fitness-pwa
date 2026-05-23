import { db } from '@core/db/app.db';
import type { RotationState, DayChoice } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * ROTATION STATE handler.
 *
 * - Table: `rotation_state`, PK = `user_id`.
 * - `rotation_order` is a Postgres text[] — supabase-js serializes JS string[]
 *   natively, no special handling needed.
 */
export const rotationStateHandler: SyncHandler = {
  entity: 'rotationState',
  tableName: 'rotation_state',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const { error } = await client.from('rotation_state').delete().eq('user_id', recordId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const state = payload as RotationState;
    const { data, error } = await client
      .from('rotation_state')
      .upsert(toRow(state), { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('rotation_state').select('*').eq('user_id', userId);
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const remoteUpdated = row.updated_at as string;
      const local = await db.rotationState.get(row.user_id as string);
      const localUpdated = local?.updatedAt ?? '';

      if (remoteUpdated > localUpdated) {
        await db.rotationState.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(s: RotationState): Record<string, unknown> {
  return {
    user_id: s.userId,
    rotation_order: s.rotationOrder,
    last_completed_routine: s.lastCompletedRoutine ?? null,
    last_completed_date: s.lastCompletedDate ?? null,
    updated_at: s.updatedAt,
  };
}

function fromRow(r: Record<string, unknown>): RotationState {
  return {
    userId: r['user_id'] as string,
    rotationOrder: (r['rotation_order'] as DayChoice[]) ?? [],
    lastCompletedRoutine: (r['last_completed_routine'] as DayChoice) ?? undefined,
    lastCompletedDate: (r['last_completed_date'] as string) ?? undefined,
    updatedAt: r['updated_at'] as string,
  };
}
