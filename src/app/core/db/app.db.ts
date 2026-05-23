import Dexie, { Table } from 'dexie';
import type {
  Profile,
  WorkoutLog,
  HydrationLog,
  DietTargets,
  MealPlan,
  MealLog,
  WeightLog,
  RotationState,
  OutboxItem,
} from '@models/index';

/**
 * IndexedDB schema for the app.
 *
 * Rules:
 *  - Every "log"-style row has a `date` index (we query by date constantly).
 *  - Every row has `userId` indexed (so multi-account in future is a 1-line change).
 *  - `syncedAt` is set after a successful push to Supabase. Null = pending.
 *  - The `outbox` is the authoritative queue for sync operations.
 *
 * Bumping schema:
 *   add `this.version(N).stores({ ... }).upgrade(tx => { ... })`.
 *   Never edit an existing version — always add a new one.
 */
export class AppDB extends Dexie {
  profile!:        Table<Profile, string>;
  workoutLogs!:    Table<WorkoutLog, string>;
  hydrationLogs!:  Table<HydrationLog, string>;
  dietTargets!:    Table<DietTargets, string>;       // PK = userId
  mealPlans!:      Table<MealPlan, string>;
  mealLogs!:       Table<MealLog, string>;
  weightLogs!:     Table<WeightLog, string>;
  rotationState!:  Table<RotationState, string>;     // PK = userId
  outbox!:         Table<OutboxItem, number>;

  constructor() {
    super('fitness-pwa');

    this.version(1).stores({
      profile:        'id, updatedAt',
      workoutLogs:    'id, userId, date, routineKey, syncedAt',
      hydrationLogs:  'id, userId, date, syncedAt',
      dietTargets:    'userId, computedAt, mode',
      mealPlans:      'id, userId, routineKey, isTemplate, updatedAt',
      mealLogs:       'id, userId, date, mealId, consumed, syncedAt',
      weightLogs:     'id, userId, date, syncedAt',
      rotationState:  'userId, updatedAt',
      outbox:         '++id, entity, op, recordId, createdAt',
    });
  }
}

/** Singleton instance. Import this everywhere. */
export const db = new AppDB();
