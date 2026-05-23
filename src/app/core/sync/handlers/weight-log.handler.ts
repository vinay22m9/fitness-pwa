import { db } from '@core/db/app.db';
import type { WeightLog } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * WEIGHT LOG handler.
 *
 * - Table: `weight_logs`, server PK = UUID, but `unique (user_id, date)`
 *   gives us the natural conflict target.
 * - No `updated_at` column — uses `created_at` for pull cursor.
 * - Local id is `${userId}_${date}` so the Progress view can look up
 *   "today's weight" without a query.
 */
export const weightLogHandler: SyncHandler = {
  entity: 'weightLog',
  tableName: 'weight_logs',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const [userId, date] = recordId.split('_');
      const { error } = await client
        .from('weight_logs')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const log = payload as WeightLog;
    const { data, error } = await client
      .from('weight_logs')
      .upsert(toRow(log), { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('weight_logs').select('*').eq('user_id', userId);
    if (since) query = query.gt('created_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxCreated: string | null = null;
    for (const row of data) {
      const remoteCreated = row.created_at as string;
      const localId = `${row.user_id}_${row.date}`;
      const local = await db.weightLogs.get(localId);

      if (!local || !local.syncedAt) {
        await db.weightLogs.put(fromRow(row));
      }
      if (!maxCreated || remoteCreated > maxCreated) maxCreated = remoteCreated;
    }
    return maxCreated;
  },
};

// ---------- column mappers ----------
function toRow(w: WeightLog): Record<string, unknown> {
  return {
    user_id: w.userId,
    date: w.date,
    weight_kg: w.weightKg,
    note: w.note ?? null,
  };
}

function fromRow(r: Record<string, unknown>): WeightLog {
  return {
    id: `${r['user_id']}_${r['date']}`,
    userId: r['user_id'] as string,
    date: r['date'] as string,
    weightKg: Number(r['weight_kg']),
    note: (r['note'] as string) ?? undefined,
    syncedAt: r['created_at'] as string,
  };
}
