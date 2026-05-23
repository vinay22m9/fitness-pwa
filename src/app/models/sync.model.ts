export type SyncOp = 'upsert' | 'delete';

export type SyncEntity =
  | 'profile'
  | 'workoutLog'
  | 'hydrationLog'
  | 'dietTargets'
  | 'mealPlan'
  | 'mealLog'
  | 'weightLog'
  | 'rotationState';

export interface OutboxItem {
  /** auto-increment in Dexie */
  id?: number;
  entity: SyncEntity;
  op: SyncOp;
  recordId: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
