import { db } from '@core/db/app.db';
import type { MealLog, MealItem, MealSlot } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * MEAL LOG handler.
 *
 * Two oddities here vs other entities:
 *
 *   1. Server `meal_logs` has NO `updated_at` column — these rows are
 *      essentially append-only (you consume a meal or you don't). We use
 *      `created_at` as the pull cursor and the "freshness" comparator.
 *
 *   2. Local id is `${userId}_${date}_${mealId}` (composite for fast lookup
 *      in the diet UI) but server PK is a UUID. We upsert on
 *      `(user_id, date, meal_id)` via the unique constraint added in
 *      0002_sync_prerequisites.sql. The composite local id stays stable.
 */
export const mealLogHandler: SyncHandler = {
  entity: 'mealLog',
  tableName: 'meal_logs',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      // recordId is `${userId}_${date}_${mealId}`
      const parts = recordId.split('_');
      const userId = parts[0];
      const date = parts[1];
      const mealId = parts.slice(2).join('_');   // mealIds may contain underscores
      const { error } = await client
        .from('meal_logs')
        .delete()
        .eq('user_id', userId)
        .eq('date', date)
        .eq('meal_id', mealId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const log = payload as MealLog;
    const { data, error } = await client
      .from('meal_logs')
      .upsert(toRow(log), { onConflict: 'user_id,date,meal_id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    // No `updated_at` on this table — use `created_at`.
    let query = client.from('meal_logs').select('*').eq('user_id', userId);
    if (since) query = query.gt('created_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxCreated: string | null = null;
    for (const row of data) {
      const remoteCreated = row.created_at as string;
      const localId = `${row.user_id}_${row.date}_${row.meal_id}`;
      const local = await db.mealLogs.get(localId);

      // No updated_at means: if it exists locally and is synced, leave it.
      // If it doesn't exist locally, pull it. If it has unsynced local changes,
      // the next drain will push them — server's view will catch up.
      if (!local || !local.syncedAt) {
        // Either new to us, or local has pending changes — but for append-only
        // logs we can safely overwrite when local is unsynced because the
        // server already accepted whatever we sent before.
        await db.mealLogs.put(fromRow(row));
      }
      if (!maxCreated || remoteCreated > maxCreated) maxCreated = remoteCreated;
    }
    return maxCreated;
  },
};

// ---------- column mappers ----------
function toRow(m: MealLog): Record<string, unknown> {
  return {
    // Don't send id — server manages its own UUID.
    user_id: m.userId,
    date: m.date,
    meal_plan_id: m.mealPlanId,
    meal_id: m.mealId,
    meal_slot: m.mealSlot,
    consumed: m.consumed,
    consumed_at: m.consumedAt ?? null,
    custom_additions: m.customAdditions ?? null,
  };
}

function fromRow(r: Record<string, unknown>): MealLog {
  const userId = r['user_id'] as string;
  const date = r['date'] as string;
  const mealId = r['meal_id'] as string;
  return {
    id: `${userId}_${date}_${mealId}`,
    userId,
    date,
    mealPlanId: r['meal_plan_id'] as string,
    mealId,
    mealSlot: r['meal_slot'] as MealSlot,
    consumed: (r['consumed'] as boolean) ?? true,
    consumedAt: (r['consumed_at'] as string) ?? undefined,
    customAdditions: (r['custom_additions'] as MealItem[]) ?? undefined,
    syncedAt: r['created_at'] as string,
  };
}
