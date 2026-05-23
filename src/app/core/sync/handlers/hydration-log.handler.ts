import { db } from '@core/db/app.db';
import type { HydrationLog, HydrationEntry } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * HYDRATION LOG handler.
 *
 * KEY DESIGN NOTE — composite vs UUID id:
 *   Locally we key by `${userId}_${date}` so the workout/diet/dashboard code can
 *   look up "today's hydration" without a date query. Supabase, however, has a
 *   UUID PK plus a `unique (user_id, date)` constraint.
 *
 *   So on PUSH we upsert with `onConflict: 'user_id,date'` — Supabase resolves
 *   to the existing row (or creates a new one with its own UUID). We DO NOT
 *   round-trip the server's UUID into Dexie; the composite local id stays
 *   stable forever, which is what every other service in the app expects.
 *
 *   On PULL we rebuild the composite id (`${user_id}_${date}`) so the merged
 *   row slots into the same Dexie key.
 */
export const hydrationLogHandler: SyncHandler = {
  entity: 'hydrationLog',
  tableName: 'hydration_logs',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      // Local id is `${userId}_${date}` — split it to delete by composite key
      const [userId, date] = recordId.split('_');
      const { error } = await client
        .from('hydration_logs')
        .delete()
        .eq('user_id', userId)
        .eq('date', date);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const log = payload as HydrationLog;
    const { data, error } = await client
      .from('hydration_logs')
      .upsert(toRow(log), { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('hydration_logs').select('*').eq('user_id', userId);
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const remoteUpdated = row.updated_at as string;
      const localId = `${row.user_id}_${row.date}`;
      const local = await db.hydrationLogs.get(localId);

      const localPending = local && !local.syncedAt;
      if (!local || (!localPending && remoteUpdated > (local.syncedAt ?? ''))) {
        await db.hydrationLogs.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(h: HydrationLog): Record<string, unknown> {
  return {
    // Don't send `id` — server will manage its own UUID.
    user_id: h.userId,
    date: h.date,
    goal_ml: h.goalMl,
    total_ml: h.totalMl,
    entries: h.entries,
    updated_at: isoNow(),
  };
}

function fromRow(r: Record<string, unknown>): HydrationLog {
  return {
    id: `${r['user_id']}_${r['date']}`,         // composite local id
    userId: r['user_id'] as string,
    date: r['date'] as string,
    goalMl: r['goal_ml'] as number,
    totalMl: r['total_ml'] as number,
    entries: (r['entries'] as HydrationEntry[]) ?? [],
    syncedAt: r['updated_at'] as string,
  };
}
