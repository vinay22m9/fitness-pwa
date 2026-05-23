import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, fromEvent, merge, timer } from 'rxjs';

import { NetworkService } from '@core/services/network.service';
import { StorageService } from '@core/services/storage.service';
import { SupabaseService } from '@core/services/supabase.service';
import type { SyncEntity, SyncStatus } from '@models/index';

import { OutboxService } from './outbox.service';
import { PULL_ORDER, SYNC_HANDLERS } from './handlers';
import { SYNC_HEARTBEAT_MS, cursorKey } from './sync.tokens';

/**
 * SyncService — orchestrator for offline-first sync.
 *
 * Lifecycle:
 *   - On user sign-in: AuthService calls `bootstrapForUser(userId)`. The service
 *     does an initial pull (server → local) then drains the outbox.
 *   - While online: drains every SYNC_HEARTBEAT_MS, and immediately on
 *     network-online and window-focus events (debounced).
 *   - On user sign-out: AuthService calls `teardown()`. Active timers stop;
 *     outbox is left intact (the user may sign back in).
 *
 * Triggers (push):
 *   - online event
 *   - visibility/focus event
 *   - SYNC_HEARTBEAT_MS timer
 *   - explicit `triggerSync()` call from a feature service
 *
 * Triggers (pull):
 *   - sign-in only (covers cross-device sync without aggressive polling)
 *   - explicit `pullAll()` call (e.g. user taps a "Refresh" button)
 *
 * NOTE: We do NOT pull on heartbeat. The user picked "Pull only on sign-in
 * + 60s heartbeat" with the heartbeat covering PUSH only — pulls are
 * expensive (1 round trip per entity) and the common multi-device case is
 * sign-in-on-other-device, which is exactly what bootstrap covers.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly supabase = inject(SupabaseService);
  private readonly network = inject(NetworkService);
  private readonly outbox = inject(OutboxService);
  private readonly storage = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // -------- Status --------
  private readonly _status = signal<SyncStatus>('idle');
  private readonly _lastSyncAt = signal<string | null>(null);
  private readonly _lastError = signal<string | null>(null);
  private readonly _currentUserId = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly lastSyncAt = this._lastSyncAt.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  /** Convenience: true if anything is queued or in-flight. */
  readonly isSyncing = computed(() => this._status() === 'syncing');
  /** Convenience: true if anything failed. */
  readonly hasError = computed(() => this._status() === 'error');

  // Trigger stream — debounced so a burst of writes collapses to one drain.
  private readonly drainTrigger$ = new Subject<void>();
  private heartbeatHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // 1. Wire status to network changes — when offline, status reflects it.
    effect(() => {
      const online = this.network.online();
      if (!online && this._status() !== 'syncing') {
        this._status.set('offline');
      } else if (online && this._status() === 'offline') {
        this._status.set('idle');
      }
    });

    // 2. Drain trigger — debounced 300ms so rapid writes (4 hydration taps)
    //    become one drain pass.
    this.drainTrigger$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.runDrain());

    // 3. External triggers — online + visibility + focus → drain
    merge(
      fromEvent(window, 'online'),
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange'),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.network.online() && document.visibilityState === 'visible') {
          this.drainTrigger$.next();
        }
      });

    // 4. Cleanup heartbeat on destroy
    this.destroyRef.onDestroy(() => this.stopHeartbeat());
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Called by AuthService once a user is signed in.
   * Refreshes outbox counts, pulls fresh server state, then drains pending writes.
   * Starts the heartbeat.
   */
  async bootstrapForUser(userId: string): Promise<void> {
    if (this._currentUserId() === userId) return;   // idempotent
    this._currentUserId.set(userId);

    await this.outbox.refreshCounts();

    if (this.network.online()) {
      // Pull first (fresh server state for cross-device), then drain local changes.
      // Pull errors are non-fatal — local data still works.
      try {
        await this.pullAll(userId);
      } catch (err) {
        // Already logged inside pullAll
      }
      await this.runDrain();
    } else {
      this._status.set('offline');
    }

    this.startHeartbeat();
  }

  /**
   * Called by AuthService on sign-out. Stops heartbeat and resets status.
   * Does NOT clear the outbox — if the user signs back in, queued writes
   * still belong to them and will sync.
   */
  teardown(): void {
    this._currentUserId.set(null);
    this.stopHeartbeat();
    this._status.set('idle');
    this._lastError.set(null);
  }

  /**
   * Manually request a drain. Feature services call this after enqueueing
   * a write so the network call happens promptly when online (instead of
   * waiting up to 60s for the heartbeat).
   */
  triggerSync(): void {
    this.drainTrigger$.next();
  }

  /**
   * Pull from all entities in PULL_ORDER. Each handler tracks its own cursor.
   * Sequential (not parallel) so a slow table doesn't fight a fast one for
   * the connection — and to keep the UI's progress story simple.
   */
  async pullAll(userId: string): Promise<void> {
    if (!this.network.online()) return;
    this._status.set('syncing');
    this._lastError.set(null);

    try {
      for (const entity of PULL_ORDER) {
        await this.pullEntity(userId, entity);
      }
      this._lastSyncAt.set(new Date().toISOString());
      this._status.set(this.outbox.failedCount() > 0 ? 'error' : 'idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError.set(`Pull failed: ${message}`);
      this._status.set('error');
      throw err;
    }
  }

  // ============================================================
  // Internals
  // ============================================================

  private async pullEntity(userId: string, entity: SyncEntity): Promise<void> {
    const handler = SYNC_HANDLERS[entity];
    const key = cursorKey(userId, entity);
    const since = this.storage.get<string | null>(key, null);

    const maxSeen = await handler.pull(this.supabase.client, userId, since);
    if (maxSeen) {
      this.storage.set(key, maxSeen);
    }
  }

  private async runDrain(): Promise<void> {
    if (!this.network.online()) {
      this._status.set('offline');
      return;
    }
    if (!this._currentUserId()) return;            // no user → nothing to sync
    if (this._status() === 'syncing') return;      // already in flight

    this._status.set('syncing');
    this._lastError.set(null);

    try {
      const result = await this.outbox.drain();
      // If a previous drain left items in the queue (e.g. partial failure),
      // we still want to recover gracefully — surface the failure but don't crash.
      if (this.outbox.failedCount() > 0) {
        this._lastError.set(`${this.outbox.failedCount()} item(s) failed after retries`);
        this._status.set('error');
      } else if (this.outbox.pendingCount() > 0) {
        // Items got bumped in attempts but not yet failed — still pending.
        this._status.set('idle');
      } else {
        this._status.set('idle');
      }

      if (result.pushed > 0) {
        this._lastSyncAt.set(new Date().toISOString());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._lastError.set(`Drain failed: ${message}`);
      this._status.set('error');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatHandle = setInterval(() => {
      if (this.network.online() && this._currentUserId()) {
        this.drainTrigger$.next();
      }
    }, SYNC_HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatHandle !== null) {
      clearInterval(this.heartbeatHandle);
      this.heartbeatHandle = null;
    }
  }
}
