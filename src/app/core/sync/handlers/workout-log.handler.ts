import { db } from '@core/db/app.db';
import type { WorkoutLog, ExerciseLog, DayChoice } from '@models/index';
import { SyncHandler, isoNow } from '../sync-handler.interface';

/**
 * WORKOUT LOG handler.
 *
 * - Table: `workout_logs`, PK = `id` (UUID, client-generated)
 * - `exercises` is JSONB — pass the array straight through.
 * - On delete: by id.
 */
export const workoutLogHandler: SyncHandler = {
  entity: 'workoutLog',
  tableName: 'workout_logs',

  async push(client, op, recordId, payload) {
    if (op === 'delete') {
      const { error } = await client.from('workout_logs').delete().eq('id', recordId);
      if (error) throw error;
      return { syncedAt: isoNow() };
    }

    const log = payload as WorkoutLog;
    const { data, error } = await client
      .from('workout_logs')
      .upsert(toRow(log), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return { syncedAt: isoNow(), serverRow: data };
  },

  async pull(client, userId, since) {
    let query = client.from('workout_logs').select('*').eq('user_id', userId);
    if (since) query = query.gt('updated_at', since);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return null;

    let maxUpdated: string | null = null;
    for (const row of data) {
      const id = row.id as string;
      const remoteUpdated = row.updated_at as string;
      const local = await db.workoutLogs.get(id);

      // We track `updatedAt` on the server but not the model — derive it from
      // completedAt/startedAt locally. For sync purposes the server timestamp
      // is authoritative; we just check that local hasn't been touched more
      // recently than its last sync (i.e. has pending changes).
      const localPending = local && !local.syncedAt;
      if (!local || (!localPending && remoteUpdated > (local.syncedAt ?? ''))) {
        await db.workoutLogs.put(fromRow(row));
      }
      if (!maxUpdated || remoteUpdated > maxUpdated) maxUpdated = remoteUpdated;
    }
    return maxUpdated;
  },
};

// ---------- column mappers ----------
function toRow(w: WorkoutLog): Record<string, unknown> {
  return {
    id: w.id,
    user_id: w.userId,
    routine_key: w.routineKey,
    date: w.date,
    started_at: w.startedAt ?? null,
    completed_at: w.completedAt ?? null,
    duration_min: w.durationMin ?? null,
    exercises: w.exercises,
    notes: w.notes ?? null,
    status: w.status ?? 'completed',
    updated_at: isoNow(),
  };
}

function fromRow(r: Record<string, unknown>): WorkoutLog {
  return {
    id: r['id'] as string,
    userId: r['user_id'] as string,
    routineKey: r['routine_key'] as DayChoice,
    date: r['date'] as string,
    startedAt: (r['started_at'] as string) ?? undefined,
    completedAt: (r['completed_at'] as string) ?? undefined,
    durationMin: (r['duration_min'] as number) ?? undefined,
    exercises: (r['exercises'] as ExerciseLog[]) ?? [],
    notes: (r['notes'] as string) ?? undefined,
    status: (r['status'] as WorkoutLog['status']) ?? 'completed',
    syncedAt: r['updated_at'] as string,
  };
}
