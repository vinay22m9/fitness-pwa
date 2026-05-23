import { db } from '@core/db/app.db';
import type { DietTargets } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * DIET TARGETS handler.
 *
 * - Table: `diet_targets`, PK = `user_id` (one row per user)
 * - Local table also keyed by `userId`.
 * - Upsert by user_id is the natural conflict target.
 */
export const dietTargetsHandler: SyncHandler = {
  entity: 'dietTargets',
  tableName: 'diet_targets',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const { error } = await client.from('diet_targets').delete().eq('user_id', recordId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const t = payload as DietTargets;
    const { data, error } = await client
      .from('diet_targets')
      .upsert(toRow(t), { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('diet_targets').select('*').eq('user_id', userId);
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const remoteUpdated = row.updated_at as string;
      const local = await db.dietTargets.get(row.user_id as string);
      const localUpdated = local?.updatedAt ?? '';

      if (remoteUpdated > localUpdated) {
        await db.dietTargets.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(t: DietTargets): Record<string, unknown> {
  return {
    user_id: t.userId,
    mode: t.mode,
    bmi: t.bmi,
    maintenance_kcal: t.maintenanceKcal,
    target_kcal: t.targetKcal,
    protein_g: t.proteinG,
    carbs_g: t.carbsG,
    fats_g: t.fatsG,
    fiber_g: t.fiberG,
    water_ml: t.waterMl,
    workout_day_bonus_ml: t.workoutDayBonusMl,
    computed_at: t.computedAt,
    updated_at: t.updatedAt,
  };
}

function fromRow(r: Record<string, unknown>): DietTargets {
  return {
    userId: r['user_id'] as string,
    mode: r['mode'] as DietTargets['mode'],
    bmi: Number(r['bmi']),
    maintenanceKcal: r['maintenance_kcal'] as number,
    targetKcal: r['target_kcal'] as number,
    proteinG: r['protein_g'] as number,
    carbsG: r['carbs_g'] as number,
    fatsG: r['fats_g'] as number,
    fiberG: r['fiber_g'] as number,
    waterMl: r['water_ml'] as number,
    workoutDayBonusMl: (r['workout_day_bonus_ml'] as number) ?? 500,
    computedAt: r['computed_at'] as string,
    updatedAt: r['updated_at'] as string,
  };
}
