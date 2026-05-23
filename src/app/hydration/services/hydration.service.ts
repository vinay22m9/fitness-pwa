import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import { msUntilLocalMidnight, todayLocalISO } from '@shared/utils/date.util';
import type { HydrationEntry, HydrationLog } from '@models/index';

import { DietTargetsService } from '@diet/services/diet-targets.service';
import { RoutineScheduleService } from '@workout/services/routine-schedule.service';

/**
 * HydrationService — facade over Dexie + outbox for the daily hydration log.
 *
 * Storage model:
 *   - One HydrationLog row per (user, day). Local PK = `${userId}_${date}`.
 *   - `entries[]` is an append-mostly log of every quick-add. `totalMl` is
 *     the cached sum so the UI doesn't re-reduce on every render.
 *   - `goalMl` is stamped on the row so historical days keep the goal they
 *     had at the time (workout-day bonus may have applied).
 *
 * Goal computation:
 *   - Baseline goal lives on DietTargets (`waterMl`, default 35 ml/kg).
 *   - Workout-day bonus (`workoutDayBonusMl`, default 500) is added IF the
 *     user has a completed, non-rest workout logged today (or one in
 *     progress — we count "they're putting in the work" as enough).
 *   - The goal is re-evaluated reactively. When the user finishes a workout
 *     mid-day, the goal silently bumps up.
 *
 * Daily reset:
 *   - There's no "delete yesterday's row" — yesterday stays in Dexie as a
 *     historical record. The reset is simply "the date key changes at
 *     midnight, so liveQuery now binds to a new row".
 *   - We schedule a single setTimeout at local-midnight that nudges the
 *     `_today` signal, which re-triggers the liveQuery binding.
 *
 * Reactivity layout (signals only — NO computed() over plain-object fields):
 *   _today       (date string)         — bumped at midnight
 *   _log         (HydrationLog | null) — current Dexie row
 *   _loaded      (boolean)             — first liveQuery emission done
 *
 *   totalMl      computed              — log()?.totalMl ?? 0
 *   entries      computed              — log()?.entries ?? []
 *   goalMl       computed              — baseline + (workout-today ? bonus : 0)
 *   progressPct  computed              — clamp(total/goal, 0..1)
 *   remainingMl  computed              — max(goal - total, 0)
 *
 * IMPORTANT (Known Issue #1 in PROGRESS.md):
 *   We never write `computed(() => somePlainObject.foo)` — that silently
 *   caches the initial reference. Every value above is derived from a
 *   SIGNAL READ (`this._log()`, etc.), so change-detection works correctly.
 */
@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);
  private readonly dietTargets = inject(DietTargetsService);
  private readonly schedule = inject(RoutineScheduleService);

  // ---- Core signals -------------------------------------------------------

  /** Current local date — bumped at midnight to roll the day over. */
  private readonly _today = signal<string>(todayLocalISO());

  /** Today's hydration row (or null if user hasn't logged anything yet). */
  private readonly _log = signal<HydrationLog | null>(null);

  /** True once the first liveQuery emission has fired for the current user/day. */
  private readonly _loaded = signal(false);

  readonly today = this._today.asReadonly();
  readonly log = this._log.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  // ---- Derived signals ----------------------------------------------------

  /** Total ml drunk today. 0 if no row yet. */
  readonly totalMl = computed(() => this._log()?.totalMl ?? 0);

  /** Today's entries, most-recent-last (preserves insertion order). */
  readonly entries = computed<readonly HydrationEntry[]>(() => this._log()?.entries ?? []);

  /** Most recent entry for the "undo" affordance. null when there are none. */
  readonly lastEntry = computed<HydrationEntry | null>(() => {
    const e = this.entries();
    return e.length > 0 ? e[e.length - 1] : null;
  });

  /**
   * Effective daily goal in ml. Combines the baseline from DietTargets with
   * the workout-day bonus when applicable.
   *
   * The bonus applies whenever today's workout log has a non-rest routine
   * AND its status is not 'abandoned'. We DON'T require completion —
   * starting a session is enough to commit to the extra water.
   */
  readonly goalMl = computed<number>(() => {
    const targets = this.dietTargets.targets();
    const baseline = targets?.waterMl ?? 2500;
    const bonus = targets?.workoutDayBonusMl ?? 500;
    return baseline + (this.isWorkoutDay() ? bonus : 0);
  });

  /** Progress as a fraction in [0, 1.5]. Capped at 1.5 so overflow is bounded. */
  readonly progressPct = computed<number>(() => {
    const goal = this.goalMl();
    if (goal <= 0) return 0;
    return Math.min(1.5, this.totalMl() / goal);
  });

  /** Whether the user has hit their goal today. */
  readonly goalReached = computed<boolean>(() => this.totalMl() >= this.goalMl());

  /** Remaining ml to hit the goal. 0 if already met. */
  readonly remainingMl = computed<number>(() => Math.max(0, this.goalMl() - this.totalMl()));

  /** Whether today is a workout day (non-rest log exists for today). */
  readonly isWorkoutDay = computed<boolean>(() => {
    const t = this.schedule.todayLog();
    return !!t && t.routineKey !== 'rest' && t.status !== 'abandoned';
  });

  // ---- Lifecycle ----------------------------------------------------------

  private subscription: { unsubscribe(): void } | null = null;
  private midnightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Bind the Dexie liveQuery to (userId, today). Re-runs whenever either
    // changes — sign in/out, or local midnight ticks over.
    effect(() => {
      const userId = this.auth.userId();
      const date = this._today();
      this.bindToUser(userId, date);
    });

    // Whenever the goal recomputes (e.g. the user just finished a workout
    // and the bonus kicked in), persist the new `goalMl` snapshot to the
    // row so the historical record reflects it. We do this defensively —
    // skip if the row doesn't exist yet (no entries means no row).
    effect(() => {
      const log = this._log();
      const goal = this.goalMl();
      if (!log) return;
      if (log.goalMl === goal) return;
      // Stamp the new goal silently. Doesn't affect totalMl or entries.
      void this.persistGoalSnapshot(log, goal);
    });

    // Schedule the daily reset.
    this.scheduleMidnightReset();

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
      if (this.midnightTimer) clearTimeout(this.midnightTimer);
    });
  }

  // ---- Public mutations ---------------------------------------------------

  /**
   * Quick-add some ml of water. Creates today's row if it doesn't exist.
   * Returns the updated total.
   */
  async add(ml: number): Promise<number> {
    if (!Number.isFinite(ml) || ml <= 0) return this.totalMl();
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot log water: not signed in');

    const date = this._today();
    const now = new Date().toISOString();
    const current = this._log();

    const entry: HydrationEntry = { ml: Math.round(ml), at: now };

    const next: HydrationLog = current
      ? {
          ...current,
          totalMl: current.totalMl + entry.ml,
          entries: [...current.entries, entry],
          goalMl: this.goalMl(),  // refresh snapshot
        }
      : {
          id: `${userId}_${date}`,
          userId,
          date,
          goalMl: this.goalMl(),
          totalMl: entry.ml,
          entries: [entry],
        };

    await this.persist(next);
    return next.totalMl;
  }

  /**
   * Undo the most recent entry. No-op if there are none.
   * Returns the updated total.
   */
  async undoLast(): Promise<number> {
    const current = this._log();
    if (!current || current.entries.length === 0) return 0;

    const last = current.entries[current.entries.length - 1];
    const remainingEntries = current.entries.slice(0, -1);

    const next: HydrationLog = {
      ...current,
      totalMl: Math.max(0, current.totalMl - last.ml),
      entries: remainingEntries,
      goalMl: this.goalMl(),
    };

    await this.persist(next);
    return next.totalMl;
  }

  /**
   * Remove a specific entry by index (used by the entry list "delete" affordance).
   * No-op if the index is out of range.
   */
  async removeEntry(index: number): Promise<number> {
    const current = this._log();
    if (!current) return 0;
    if (index < 0 || index >= current.entries.length) return current.totalMl;

    const removed = current.entries[index];
    const remainingEntries = [
      ...current.entries.slice(0, index),
      ...current.entries.slice(index + 1),
    ];

    const next: HydrationLog = {
      ...current,
      totalMl: Math.max(0, current.totalMl - removed.ml),
      entries: remainingEntries,
      goalMl: this.goalMl(),
    };

    await this.persist(next);
    return next.totalMl;
  }

  /**
   * Wipe today's log. Hard reset for the "Start over" action.
   * Leaves the row in place (just with empty entries / zero total) so the
   * goal snapshot is preserved.
   */
  async clearToday(): Promise<void> {
    const current = this._log();
    if (!current) return;

    const next: HydrationLog = {
      ...current,
      totalMl: 0,
      entries: [],
      goalMl: this.goalMl(),
    };

    await this.persist(next);
  }

  // ---- Internals ----------------------------------------------------------

  /**
   * Write `next` to Dexie and enqueue a sync upsert. The liveQuery will
   * push the new row back into `_log` so we don't `set()` it directly here.
   */
  private async persist(next: HydrationLog): Promise<void> {
    await db.hydrationLogs.put(next);
    await this.outbox.enqueue('hydrationLog', 'upsert', next.id, next);
    this.sync.triggerSync();
  }

  /**
   * Stamp a new `goalMl` on an existing row without changing entries/total.
   * Bypasses outbox if total hasn't changed? — no, we DO sync, because the
   * server-side row should reflect the snapshot too. Cheap idempotent upsert.
   */
  private async persistGoalSnapshot(log: HydrationLog, goalMl: number): Promise<void> {
    const next: HydrationLog = { ...log, goalMl };
    await db.hydrationLogs.put(next);
    await this.outbox.enqueue('hydrationLog', 'upsert', next.id, next);
    // No triggerSync — this is a passive snapshot update, the next user
    // action or the 60s heartbeat will push it. Keeps the network quiet
    // when the page is just sitting there.
  }

  private bindToUser(userId: string | null, date: string): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._log.set(null);
      this._loaded.set(false);
      return;
    }

    const id = `${userId}_${date}`;
    const observable = liveQuery(() => db.hydrationLogs.get(id));
    this.subscription = observable.subscribe({
      next: (row) => {
        this._log.set(row ?? null);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[HydrationService] liveQuery error', err);
        this._log.set(null);
        this._loaded.set(true);
      },
    });
  }

  /**
   * Schedule a single setTimeout to fire at local midnight, which bumps the
   * `_today` signal. The effect in the constructor will then rebind the
   * liveQuery to tomorrow's row.
   *
   * After firing, we recurse to schedule the next day's reset.
   */
  private scheduleMidnightReset(): void {
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    // Add a small safety pad (1s) so we're definitely past the boundary
    // when we recompute the date.
    const ms = msUntilLocalMidnight() + 1000;
    this.midnightTimer = setTimeout(() => {
      this._today.set(todayLocalISO());
      this.scheduleMidnightReset();
    }, ms);
  }
}
