import { Injectable } from '@angular/core';

import type { Routine, RoutineKey } from '@models/workout.model';
import { ROUTINES } from '@workout/data/routines.seed';

/**
 * RoutineService — read-only catalog of routine templates.
 *
 * For MVP this is a thin wrapper over the seed data. In a future "edit
 * routines" feature, this service will check Dexie for user overrides
 * first and fall back to the seed.
 *
 * Keep all routine lookups going through this service so the future
 * upgrade is a one-file change.
 */
@Injectable({ providedIn: 'root' })
export class RoutineService {
  /** Get all 3 routines (Rest is not a routine — it's a logged choice). */
  all(): Routine[] {
    return [ROUTINES.push, ROUTINES.pull_legs, ROUTINES.shred];
  }

  /** Get a single routine by key. Returns undefined for 'rest' or unknown. */
  get(key: RoutineKey): Routine | undefined {
    return ROUTINES[key];
  }
}
