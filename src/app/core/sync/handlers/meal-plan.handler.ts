import { db } from '@core/db/app.db';
import type { MealPlan, Meal, DayChoice } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * MEAL PLAN handler.
 *
 * - Table: `meal_plans`, PK = `id` (UUID, client-generated).
 * - Seeded templates have `user_id IS NULL`; user-created have user_id set.
 * - On PULL we fetch both (RLS policy "read meal plans" permits this).
 * - On PUSH we only send rows that have a user_id — never overwrite templates.
 */
export const mealPlanHandler: SyncHandler = {
  entity: 'mealPlan',
  tableName: 'meal_plans',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const { error } = await client.from('meal_plans').delete().eq('id', recordId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const plan = payload as MealPlan;
    // Defensive: never push a seeded template back up. If somebody enqueued
    // one by mistake we silently drop it.
    if (!plan.userId) {
      return { syncedAt: isoNow() };
    }

    const { data, error } = await client
      .from('meal_plans')
      .upsert(toRow(plan), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    // RLS lets us see our own rows + seeded templates (user_id IS NULL).
    // We don't filter by user_id — just trust the policy.
    let query = client.from('meal_plans').select('*');
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const remoteUpdated = row.updated_at as string;
      const local = await db.mealPlans.get(row.id as string);
      const localUpdated = local?.updatedAt ?? '';

      if (remoteUpdated > localUpdated) {
        await db.mealPlans.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(p: MealPlan): Record<string, unknown> {
  return {
    id: p.id,
    user_id: p.userId ?? null,
    name: p.name,
    description: p.description ?? null,
    routine_key: p.routineKey,
    meals: p.meals,
    is_template: p.isTemplate,
    updated_at: p.updatedAt,
  };
}

function fromRow(r: Record<string, unknown>): MealPlan {
  return {
    id: r['id'] as string,
    userId: (r['user_id'] as string) ?? undefined,
    name: r['name'] as string,
    description: (r['description'] as string) ?? undefined,
    routineKey: r['routine_key'] as DayChoice | 'any',
    meals: (r['meals'] as Meal[]) ?? [],
    isTemplate: (r['is_template'] as boolean) ?? false,
    createdAt: r['created_at'] as string,
    updatedAt: r['updated_at'] as string,
  };
}
