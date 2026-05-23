import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import { todayLocalISO } from '@shared/utils/date.util';
import type { WeightLog } from '@models/index';

import { DietTargetsService } from '@diet/services/diet-targets.service';
import { ProfileService } from '@diet/services/profile.service';

/**
 * WeightLogService — owns the user's weight history.
 *
 * MVP storage model:
 *   - One row per (user, date) — server unique key is `(user_id, date)`,
 *     local PK matches: `${userId}_${date}`. Re-logging the same day
 *     overwrites the value. This is the most honest interpretation of
 *     PROGRESS.md's "raw plot in MVP" and matches the existing schema.
 *   - Multi-per-day support is intentionally deferred: dropping the unique
 *     constraint, switching IDs to UUIDs, and adding a `time` column is a
 *     real chunk of work for a feature most users don't need yet. The
 *     `note` field is a perfectly serviceable hint for "morning" /
 *     "post-workout" if the user wants to flag context.
 *
 * Profile sync (per locked decision):
 *   - When a new latest-day weight is logged, `profile.weightKg` is updated.
 *   - `DietTargetsService` has an effect on `profile()` that recomputes
 *     targets in auto mode (custom mode is preserved). So weight → profile
 *     → targets fall out for free.
 *   - We return `{ targetsRecomputed }` so the page can fire the right
 *     toast: only when mode === 'auto' AND the weight actually changed.
 *
 * Reactivity:
 *   _logs   — full history, sorted asc by date
 *   _loaded — first liveQuery emission settled
 *   latestKg, latestDate — most recent entry
 */
@Injectable({ providedIn: 'root' })
export class WeightLogService {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);
  private readonly profileService = inject(ProfileService);
  private readonly dietTargets = inject(DietTargetsService);

  private readonly _logs = signal<WeightLog[]>([]);
  private readonly _loaded = signal(false);

  readonly logs = this._logs.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /** Most recent entry. null if no logs yet. */
  readonly latest = computed<WeightLog | null>(() => {
    const list = this._logs();
    return list.length > 0 ? list[list.length - 1] : null;
  });

  readonly latestKg   = computed<number | null>(() => this.latest()?.weightKg ?? null);
  readonly latestDate = computed<string | null>(() => this.latest()?.date ?? null);

  /** How many days ago the latest entry was logged. null if no logs. */
  readonly daysSinceLatest = computed<number | null>(() => {
    const date = this.latestDate();
    if (!date) return null;
    const then = new Date(date + 'T00:00:00');
    const now = new Date(todayLocalISO() + 'T00:00:00');
    return Math.round((now.getTime() - then.getTime()) / (24 * 60 * 60 * 1000));
  });

  /** Just today's entry if any (for the "Log weight" CTA to switch to "Update"). */
  readonly todayLog = computed<WeightLog | null>(() => {
    const today = todayLocalISO();
    return this._logs().find((l) => l.date === today) ?? null;
  });

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const userId = this.auth.userId();
      this.bindToUser(userId);
    });

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
    });
  }

  // ---- Public mutations -------------------------------------------------

  /**
   * Log (or update) today's weight. Returns metadata about side effects so
   * the UI can fire a toast accurately.
   *
   *   - same-day re-log overwrites
   *   - if this becomes the new latest entry (i.e. date >= existing latest),
   *     also updates `profile.weightKg`
   *   - DietTargetsService picks up the profile change automatically and
   *     recomputes targets when mode === 'auto'
   *
   * Returns:
   *   - `weightChanged`: true if the new weight differs from the previously
   *     stored profile weight (the surprise-recompute case)
   *   - `targetsWillRecompute`: true if `weightChanged && targets.mode === 'auto'`
   */
  async log(args: {
    weightKg: number;
    date?: string;       // defaults to today
    note?: string;
  }): Promise<LogResult> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot log weight: not signed in');

    const weight = Math.round(args.weightKg * 10) / 10;  // 0.1 kg granularity
    if (!Number.isFinite(weight) || weight < 20 || weight > 400) {
      throw new Error('Weight out of reasonable range (20–400 kg)');
    }

    const date = args.date ?? todayLocalISO();
    const id = `${userId}_${date}`;

    const row: WeightLog = {
      id,
      userId,
      date,
      weightKg: weight,
      note: args.note?.trim() || undefined,
    };

    await db.weightLogs.put(row);
    await this.outbox.enqueue('weightLog', 'upsert', id, row);
    this.sync.triggerSync();

    // Profile + targets cascade — only if this is the new latest entry.
    const prevLatest = this.latest();
    const becomesLatest = !prevLatest || date >= prevLatest.date;

    let weightChanged = false;
    let targetsWillRecompute = false;

    if (becomesLatest) {
      const currentProfileWeight = this.profileService.profile()?.weightKg;
      weightChanged = currentProfileWeight !== weight;
      if (weightChanged) {
        await this.profileService.updateWeight(weight);
        // DietTargetsService.targets() is mode-aware. We peek at the mode
        // here to predict whether a recompute will happen. The effect
        // there fires async so this is just a prediction — it's the
        // signal we use for the toast, which is conceptually right.
        targetsWillRecompute = this.dietTargets.targets()?.mode === 'auto';
      }
    }

    return { weightChanged, targetsWillRecompute, becomesLatest };
  }

  /**
   * Delete a weight entry. Useful for cleaning up a mistaken log; trivial
   * server semantics via the existing handler's delete path.
   */
  async remove(log: WeightLog): Promise<void> {
    await db.weightLogs.delete(log.id);
    await this.outbox.enqueue('weightLog', 'delete', log.id, null);
    this.sync.triggerSync();
  }

  // ---- Internals --------------------------------------------------------

  private bindToUser(userId: string | null): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._logs.set([]);
      this._loaded.set(false);
      return;
    }

    // Pull everything — weight history is small (kilobytes even after years).
    // Sorted asc so latest is `logs[logs.length - 1]` and charts can iterate
    // in chronological order without resorting.
    this.subscription = liveQuery(() =>
      db.weightLogs.where('userId').equals(userId).sortBy('date'),
    ).subscribe({
      next: (rows) => {
        this._logs.set(rows);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[WeightLogService] liveQuery error', err);
        this._logs.set([]);
        this._loaded.set(true);
      },
    });
  }
}

export interface LogResult {
  /** True if this entry changed the user's profile weight. */
  weightChanged: boolean;
  /** True if profile changed AND diet targets are in auto mode. */
  targetsWillRecompute: boolean;
  /** True if this entry's date is the most recent in history. */
  becomesLatest: boolean;
}
