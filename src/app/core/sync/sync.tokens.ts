import type { SyncEntity } from '@models/index';

/**
 * localStorage key for the last-successful-pull cursor of an entity.
 * Keys are scoped per-user so multiple sign-ins on the same device
 * don't trample each other's cursors.
 *
 *   `sync.cursor.${userId}.${entity}`  →  ISO timestamp string
 *
 * On first sign-in the cursor is absent → handler pulls everything.
 * On subsequent pulls the cursor advances to MAX(server.updated_at).
 */
export function cursorKey(userId: string, entity: SyncEntity): string {
  return `sync.cursor.${userId}.${entity}`;
}

/** How often the sync engine wakes up to drain + pull while online. */
export const SYNC_HEARTBEAT_MS = 60_000;

/** Cap how many outbox items we try in a single drain pass. */
export const OUTBOX_BATCH_LIMIT = 50;

/** Cap retries before we surface the error to the user and stop hammering. */
export const MAX_OUTBOX_ATTEMPTS = 5;
