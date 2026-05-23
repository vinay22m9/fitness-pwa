import { Injectable, inject } from '@angular/core';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import type { RoutineKey, SetLog } from '@models/workout.model';

export interface ExerciseBaseline {
  /** Reps achieved in the best set of the last completed session. */
  bestReps?: number;
  /** Weight used in the last completed session (per-set weight assumed consistent). */
  weightKg?: number;
  /** Date of the session we're baselining off (ISO YYYY-MM-DD). */
  fromDate?: string;
  /** Total completed sets in last session — useful for "you did 4/4 last time". */
  completedSets?: number;
}

/**
 * BaselineService — answers "what did I do last time?" per exercise.
 *
 * Used by the active workout page to prefill rep/weight hints (option (a)
 * from your earlier decision: show last session as reference, no auto-suggest).
 *
 * Lookup strategy:
 *   - Query the user's most recent completed log of the same routineKey
 *   - Find the matching exercise by templateId
 *   - Return its set stats
 *
 * Returned baselines are NEVER auto-applied to the active session — the
 * UI displays them as a hint (e.g. "last: 8 reps · 5kg") and the user
 * decides what to enter.
 */
@Injectable({ providedIn: 'root' })
export class BaselineService {
  private readonly auth = inject(AuthService);

  /**
   * Fetch baselines for every exercise template in `templateIds`, for the
   * given routine. Returns a map; templateIds with no prior data simply
   * have no entry.
   */
  async forRoutine(
    routineKey: RoutineKey,
    templateIds: string[],
  ): Promise<Record<string, ExerciseBaseline>> {
    const userId = this.auth.userId();
    if (!userId) return {};

    // Most recent COMPLETED session of this routine.
    const lastSession = await db.workoutLogs
      .where('userId').equals(userId)
      .and((l) => l.routineKey === routineKey && l.status === 'completed')
      .reverse()
      .sortBy('date')
      .then((rows) => rows[0]);

    if (!lastSession) return {};

    const result: Record<string, ExerciseBaseline> = {};
    for (const id of templateIds) {
      const ex = lastSession.exercises.find((e) => e.templateId === id);
      if (!ex) continue;

      const completedSets = ex.sets.filter((s) => s.completed);
      const bestReps = bestRepsOf(completedSets);
      const weightKg = firstWeightOf(completedSets);

      result[id] = {
        bestReps,
        weightKg,
        completedSets: completedSets.length,
        fromDate: lastSession.date,
      };
    }
    return result;
  }
}

function bestRepsOf(sets: SetLog[]): number | undefined {
  const reps = sets.map((s) => s.reps).filter((r): r is number => typeof r === 'number');
  return reps.length ? Math.max(...reps) : undefined;
}

function firstWeightOf(sets: SetLog[]): number | undefined {
  const w = sets.find((s) => typeof s.weightKg === 'number');
  return w?.weightKg;
}
