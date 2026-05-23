import { Injectable, inject, signal } from '@angular/core';
import { db } from '@core/db/app.db';
import { SupabaseService } from '@core/services/supabase.service';
import type { OutboxItem, SyncEntity, SyncOp } from '@models/index';
import { SYNC_HANDLERS } from './handlers';
import { MAX_OUTBOX_ATTEMPTS, OUTBOX_BATCH_LIMIT } from './sync.tokens';
import { isoNow } from './sync-handler.interface';

/**
 * Outbox — the single write path out of the device.
 *
 * Feature services call `enqueue()` after every local write. The actual
 * Supabase call happens later via `drain()`, which is triggered by SyncService
 * on online/focus/heartbeat events.
 *
 * Design notes:
 *   - Dedupe: multiple upserts to the same (entity, recordId) collapse to
 *     the latest payload. Hydration "+250ml × 4 taps offline" becomes 1 call.
 *   - Backoff: failed items get `attempts++` and stay in the queue until
 *     MAX_OUTBOX_ATTEMPTS, then they're surfaced via `failedCount`.
 *   - Drain returns counts so SyncService can decide whether to pull next.
 *
 * The outbox is intentionally NOT typed-per-entity — payloads are `unknown`
 * and handlers cast. This keeps the queue trivially serializable in IndexedDB
 * and avoids a generic-soup interface.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly supabase = inject(SupabaseService);

  // Public signals for UI / SyncService consumption
  private readonly _pendingCount = signal(0);
  private readonly _failedCount = signal(0);
  readonly pendingCount = this._pendingCount.asReadonly();
  readonly failedCount = this._failedCount.asReadonly();

  /** Initial count refresh — call from SyncService.bootstrap. */
  async refreshCounts(): Promise<void> {
    const all = await db.outbox.toArray();
    this._pendingCount.set(all.filter((i) => i.attempts < MAX_OUTBOX_ATTEMPTS).length);
    this._failedCount.set(all.filter((i) => i.attempts >= MAX_OUTBOX_ATTEMPTS).length);
  }

  /**
   * Enqueue a write. Called by feature services after they write to Dexie.
   * Dedupes: if an unsynced item already exists for (entity, recordId), its
   * payload is replaced — older queued versions are obsolete.
   */
  async enqueue(entity: SyncEntity, op: SyncOp, recordId: string, payload: unknown): Promise<void> {
    // Dedupe — find any item for this record that hasn't started attempting
    const existing = await db.outbox
      .where({ entity, recordId })
      .filter((i) => i.attempts === 0)
      .first();

    if (existing && existing.id !== undefined) {
      await db.outbox.update(existing.id, { op, payload, createdAt: isoNow() });
    } else {
      const item: OutboxItem = {
        entity,
        op,
        recordId,
        payload,
        createdAt: isoNow(),
        attempts: 0,
      };
      await db.outbox.add(item);
    }

    await this.refreshCounts();
  }

  /**
   * Drain the outbox. Returns the number of items successfully pushed.
   * Caller should check `failedCount` afterwards to decide whether to alert.
   *
   * Strategy: collapse duplicates before sending. Pull a batch, group by
   * (entity, recordId), keep the latest of each, push them in parallel,
   * delete on success, increment attempts on failure.
   */
  async drain(): Promise<{ pushed: number; failed: number }> {
    const batch = await db.outbox
      .where('attempts')
      .below(MAX_OUTBOX_ATTEMPTS)
      .limit(OUTBOX_BATCH_LIMIT)
      .toArray();

    if (batch.length === 0) {
      await this.refreshCounts();
      return { pushed: 0, failed: 0 };
    }

    // Group by (entity, recordId), keeping the LATEST item per group.
    // The earlier ones can be deleted in the same transaction — they're stale.
    const latest = new Map<string, OutboxItem>();
    const stale: number[] = [];

    for (const item of batch) {
      const key = `${item.entity}|${item.recordId}`;
      const existing = latest.get(key);
      if (!existing || item.createdAt > existing.createdAt) {
        if (existing?.id !== undefined) stale.push(existing.id);
        latest.set(key, item);
      } else if (item.id !== undefined) {
        stale.push(item.id);
      }
    }

    if (stale.length > 0) {
      await db.outbox.bulkDelete(stale);
    }

    // Push each unique item. Run in parallel — Supabase tolerates concurrent
    // upserts and the handlers are isolated per entity.
    const results = await Promise.allSettled(
      Array.from(latest.values()).map((item) => this.pushOne(item)),
    );

    let pushed = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') pushed++;
      else failed++;
    }

    await this.refreshCounts();
    return { pushed, failed };
  }

  /** Push a single item via its handler. On success, delete it. On failure, bump attempts. */
  private async pushOne(item: OutboxItem): Promise<void> {
    const handler = SYNC_HANDLERS[item.entity];
    if (!handler) {
      // Unknown entity — drop it. Probably a stale outbox from before a model rename.
      if (item.id !== undefined) await db.outbox.delete(item.id);
      return;
    }

    try {
      await handler.push(this.supabase.client, item.op, item.recordId, item.payload);
      // Stamp Dexie's syncedAt on the corresponding row so the UI knows it's safe.
      await this.stampSynced(item);
      if (item.id !== undefined) await db.outbox.delete(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (item.id !== undefined) {
        await db.outbox.update(item.id, {
          attempts: (item.attempts ?? 0) + 1,
          lastError: message,
        });
      }
      throw err; // bubble up so Promise.allSettled records a rejection
    }
  }

  /**
   * After a successful push, update the synced row's `syncedAt`.
   * We do this generically: each entity's local table has a corresponding
   * record we can look up by recordId.
   */
  private async stampSynced(item: OutboxItem): Promise<void> {
    if (item.op !== 'upsert') return;
    const stamp = isoNow();

    switch (item.entity) {
      case 'profile':
        // Profile has no syncedAt field — updatedAt is enough.
        break;
      case 'workoutLog':
        await db.workoutLogs.update(item.recordId, { syncedAt: stamp });
        break;
      case 'hydrationLog':
        await db.hydrationLogs.update(item.recordId, { syncedAt: stamp });
        break;
      case 'dietTargets':
        // dietTargets has no `syncedAt` field on the model.
        break;
      case 'mealPlan':
        // mealPlan has no `syncedAt` field on the model — updatedAt is the source of truth.
        break;
      case 'mealLog':
        await db.mealLogs.update(item.recordId, { syncedAt: stamp });
        break;
      case 'weightLog':
        await db.weightLogs.update(item.recordId, { syncedAt: stamp });
        break;
      case 'rotationState':
        // rotationState has no syncedAt — updatedAt is the source of truth.
        break;
    }
  }

  /**
   * Manual override — clear ALL items including failed ones.
   * Used by a hypothetical "Force resync" debug button.
   */
  async clearAll(): Promise<void> {
    await db.outbox.clear();
    await this.refreshCounts();
  }

  /**
   * Reset attempts on failed items so they're retried.
   * Used by the network-back-online handler in case the failures were transient.
   */
  async retryFailed(): Promise<void> {
    const failed = await db.outbox.where('attempts').aboveOrEqual(MAX_OUTBOX_ATTEMPTS).toArray();
    for (const item of failed) {
      if (item.id !== undefined) {
        await db.outbox.update(item.id, { attempts: 0, lastError: undefined });
      }
    }
    await this.refreshCounts();
  }
}
