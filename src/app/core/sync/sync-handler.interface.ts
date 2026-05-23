import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncEntity, SyncOp } from '@models/index';

/**
 * Contract every entity sync handler implements.
 *
 * One handler per Supabase table. The orchestrator (`SyncService`) is dumb —
 * it just dispatches to handlers by entity name. All the column mapping,
 * conflict targets, and Dexie writes live in the handler so each entity
 * stays self-contained.
 *
 * THREE responsibilities:
 *   1. push(op, payload)  — apply a single outbox item to Supabase
 *   2. pull(userId, since) — fetch remote changes since cursor, merge into Dexie
 *   3. tableName / entity — identity (used for logs, errors, cursor keys)
 *
 * Conflict resolution: each handler's pull merges via last-write-wins on
 * `updated_at` (or `created_at` for append-only tables). Local rows with
 * `syncedAt < updatedAt` are preserved — they'll get pushed by the next drain.
 */
export interface SyncHandler {
  readonly entity: SyncEntity;
  readonly tableName: string;

  /**
   * Push a single outbox item to Supabase.
   * @throws on network/server error — the caller will requeue with backoff.
   * @returns the server-confirmed row (or null if delete) so the orchestrator
   *          can stamp Dexie's `syncedAt`. Returning null for upsert means
   *          the row was applied but the server didn't return it (rare).
   */
  push(
    client: SupabaseClient,
    op: SyncOp,
    recordId: string,
    payload: unknown,
  ): Promise<{ syncedAt: string; serverRow?: Record<string, unknown> } | null>;

  /**
   * Pull remote rows newer than `since` (or all rows if `since` is null)
   * and merge into Dexie via last-write-wins.
   * @returns the max `updated_at`/`created_at` seen, to advance the cursor.
   *          Null = no rows pulled, cursor unchanged.
   */
  pull(
    client: SupabaseClient,
    userId: string,
    since: string | null,
  ): Promise<string | null>;
}

/**
 * Helper: convert an ISO timestamp string into a Postgres-friendly format.
 * Supabase accepts ISO 8601 directly, so this is just a defensive trim.
 */
export function isoNow(): string {
  return new Date().toISOString();
}
