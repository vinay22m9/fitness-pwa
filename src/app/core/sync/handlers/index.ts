import type { SyncEntity } from '@models/index';
import type { SyncHandler } from '../sync-handler.interface';

import { profileHandler } from './profile.handler';
import { workoutLogHandler } from './workout-log.handler';
import { hydrationLogHandler } from './hydration-log.handler';
import { dietTargetsHandler } from './diet-targets.handler';
import { mealPlanHandler } from './meal-plan.handler';
import { mealLogHandler } from './meal-log.handler';
import { weightLogHandler } from './weight-log.handler';
import { rotationStateHandler } from './rotation-state.handler';

/**
 * Registry of sync handlers by entity name.
 *
 * To add a new entity:
 *   1. Add the entity name to `SyncEntity` in `models/sync.model.ts`
 *   2. Create `<entity>.handler.ts` here
 *   3. Add it to this map
 *
 * The `Record<SyncEntity, SyncHandler>` type forces exhaustiveness — TypeScript
 * will refuse to compile if a SyncEntity isn't mapped.
 */
export const SYNC_HANDLERS: Record<SyncEntity, SyncHandler> = {
  profile:        profileHandler,
  workoutLog:     workoutLogHandler,
  hydrationLog:   hydrationLogHandler,
  dietTargets:    dietTargetsHandler,
  mealPlan:       mealPlanHandler,
  mealLog:        mealLogHandler,
  weightLog:      weightLogHandler,
  rotationState:  rotationStateHandler,
};

/**
 * Ordered list of entities for pull-on-login. Order matters slightly:
 *   - profile first (other UIs may key on it)
 *   - dietTargets / rotationState (user-level config)
 *   - meal_plans (templates needed before mealLogs reference them)
 *   - then the daily logs
 */
export const PULL_ORDER: SyncEntity[] = [
  'profile',
  'rotationState',
  'dietTargets',
  'mealPlan',
  'workoutLog',
  'hydrationLog',
  'mealLog',
  'weightLog',
];
