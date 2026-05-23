import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import { addDays, todayLocalISO } from '@shared/utils/date.util';
import {
  DEFAULT_ROTATION_ORDER,
  type DayChoice,
  type RotationState,
  type WorkoutLog,
} from '@models/workout.model';

/**
 * RoutineScheduleService — owns the rotation logic.
 *
 * Responsibilities:
 *   - Track the user's RotationState (last completed routine + date)
 *   - Suggest today's routine based on the rotation order
 *   - Apply the "rolling 7-day, 6 workout days per week" rule:
 *       if the user has already completed 6 workouts in the last 7 days,
 *       today's suggestion becomes 'rest' regardless of rotation position.
 *
 * The user can always override the suggestion. Suggestion logic is
 * intentionally simple and explainable — no opaque ML, no surprises.
 */
@Injectable({ providedIn: 'root' })
export class RoutineScheduleService {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);

  private readonly _state = signal<RotationState | null>(null);
  private readonly _recentLogs = signal<WorkoutLog[]>([]);
  private readonly _loaded = signal(false);

  readonly state = this._state.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /**
   * Today's suggestion. Pure function of state + recent logs + rotation order.
   * Logic:
   *   1. If user already logged something today → that's today's choice (no override).
   *   2. If user did 6+ workouts in last 7 days → suggest 'rest'.
   *   3. Otherwise → next item after `lastCompletedRoutine` in `rotationOrder`.
   *      Falls back to the first item if no rotation history.
   */
  readonly suggestedToday = computed<DayChoice>(() => {
    const today = todayLocalISO();
    const logs = this._recentLogs();

    // Already logged today? Show that.
    const todayLog = logs.find((l) => l.date === today);
    if (todayLog) return todayLog.routineKey;

    // Rolling 7-day check: count actual workouts (not rest days) in last 7 days
    const sevenDaysAgo = todayLocalISO(addDays(new Date(), -6));
    const recentWorkoutCount = logs.filter(
      (l) => l.date >= sevenDaysAgo && l.routineKey !== 'rest' && l.status !== 'abandoned',
    ).length;
    if (recentWorkoutCount >= 6) return 'rest';

    // Otherwise advance the rotation
    const state = this._state();
    const order = state?.rotationOrder?.length
      ? state.rotationOrder
      : DEFAULT_ROTATION_ORDER;

    const last = state?.lastCompletedRoutine;
    if (!last) return order[0];

    const idx = order.indexOf(last);
    if (idx === -1) return order[0];
    return order[(idx + 1) % order.length];
  });

  /** True if there's already a log entry for today (any status). */
  readonly hasLoggedToday = computed<boolean>(() => {
    const today = todayLocalISO();
    return this._recentLogs().some((l) => l.date === today);
  });

  /** Today's log if any (for resume-in-progress / view-completed flows). */
  readonly todayLog = computed<WorkoutLog | null>(() => {
    const today = todayLocalISO();
    return this._recentLogs().find((l) => l.date === today) ?? null;
  });

  private stateSub: { unsubscribe(): void } | null = null;
  private logsSub: { unsubscribe(): void } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const userId = this.auth.userId();
      this.bindToUser(userId);
    });

    destroyRef.onDestroy(() => {
      this.stateSub?.unsubscribe();
      this.logsSub?.unsubscribe();
    });
  }

  /**
   * Record a routine as completed. Updates lastCompletedRoutine + date.
   * Called after a workout session is finished (or rest day logged).
   */
  async recordCompletion(routineKey: DayChoice, date: string): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;

    const now = new Date().toISOString();
    const existing = this._state();

    const next: RotationState = {
      userId,
      rotationOrder: existing?.rotationOrder?.length
        ? existing.rotationOrder
        : [...DEFAULT_ROTATION_ORDER],
      lastCompletedRoutine: routineKey,
      lastCompletedDate: date,
      updatedAt: now,
    };

    await db.rotationState.put(next);
    await this.outbox.enqueue('rotationState', 'upsert', userId, next);
    this.sync.triggerSync();
  }

  private bindToUser(userId: string | null): void {
    this.stateSub?.unsubscribe();
    this.logsSub?.unsubscribe();
    this.stateSub = null;
    this.logsSub = null;

    if (!userId) {
      this._state.set(null);
      this._recentLogs.set([]);
      this._loaded.set(false);
      return;
    }

    // Rotation state
    this.stateSub = liveQuery(() => db.rotationState.get(userId)).subscribe({
      next: (row) => this._state.set(row ?? null),
      error: (err) => console.error('[RoutineScheduleService] state liveQuery', err),
    });

    // Recent logs (last 14 days — wide enough for rolling-7 check + history view)
    const cutoff = todayLocalISO(addDays(new Date(), -14));
    this.logsSub = liveQuery(() =>
      db.workoutLogs
        .where('userId').equals(userId)
        .and((l) => l.date >= cutoff)
        .reverse()
        .sortBy('date'),
    ).subscribe({
      next: (rows) => {
        this._recentLogs.set(rows);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[RoutineScheduleService] logs liveQuery', err);
        this._recentLogs.set([]);
        this._loaded.set(true);
      },
    });
  }
}
