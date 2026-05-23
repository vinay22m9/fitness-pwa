import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import { msUntilLocalMidnight, todayLocalISO } from '@shared/utils/date.util';
import { uuid } from '@shared/utils/id.util';
import type { Meal, MealItem, MealLog, MealPlan, MealSlot } from '@models/index';

/**
 * MealLogService — facade over Dexie + outbox for today's meal logs.
 *
 * State machine per (user, date, mealId):
 *   no row          — user hasn't decided yet (default for plan meals)
 *   consumed=true   — user ate it
 *   skipped=true    — user explicitly skipped it (off-day, didn't eat)
 *   both false      — re-toggled back to neutral (rare; effectively no row)
 *
 * Quick-add rows:
 *   mealId = `quick_<uuid>`, customAdditions = [MealItem]
 *   These don't correspond to a plan meal, so the aggregator reads totals
 *   from customAdditions instead of looking the meal up on the plan.
 *
 * Reactivity layout (signals only — Known Issue #1 sidestepped):
 *   _today      — date string, bumped at midnight
 *   _logs       — today's MealLog rows from liveQuery
 *   _loaded     — first emission settled
 *
 *   consumedIds — Set of mealIds where consumed=true
 *   skippedIds  — Set of mealIds where skipped=true
 *   quickAdds   — only the synthetic quick-add rows, for UI listing
 *
 * Aggregate macros require a MealPlan input (for template-meal lookup) and
 * also walk the quickAdds. Called from consumers' computed()s.
 */
@Injectable({ providedIn: 'root' })
export class MealLogService {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);

  // ---- Core signals -------------------------------------------------------

  private readonly _today = signal<string>(todayLocalISO());
  private readonly _logs = signal<MealLog[]>([]);
  private readonly _loaded = signal(false);

  readonly today = this._today.asReadonly();
  readonly logs = this._logs.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /** mealIds the user has consumed today. O(1) lookup. */
  readonly consumedIds = computed<ReadonlySet<string>>(() => {
    const out = new Set<string>();
    for (const log of this._logs()) {
      if (log.consumed) out.add(log.mealId);
    }
    return out;
  });

  /** mealIds the user has explicitly skipped today. */
  readonly skippedIds = computed<ReadonlySet<string>>(() => {
    const out = new Set<string>();
    for (const log of this._logs()) {
      if (log.skipped) out.add(log.mealId);
    }
    return out;
  });

  /** Just the quick-add rows (synthetic mealIds starting with `quick_`). */
  readonly quickAdds = computed<MealLog[]>(() =>
    this._logs().filter((l) => l.mealId.startsWith('quick_') && l.consumed),
  );

  /** Count of meals consumed today (includes quick-adds). */
  readonly consumedCount = computed(() => this.consumedIds().size);

  // ---- Lifecycle ----------------------------------------------------------

  private subscription: { unsubscribe(): void } | null = null;
  private midnightTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const userId = this.auth.userId();
      const date = this._today();
      this.bindToUser(userId, date);
    });

    this.scheduleMidnightReset();

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
      if (this.midnightTimer) clearTimeout(this.midnightTimer);
    });
  }

  // ---- Public lookups -----------------------------------------------------

  isConsumed(mealId: string): boolean { return this.consumedIds().has(mealId); }
  isSkipped(mealId: string): boolean  { return this.skippedIds().has(mealId); }

  /**
   * Three-way meal state for the UI:
   *   'consumed' | 'skipped' | 'pending'
   */
  statusFor(mealId: string): 'consumed' | 'skipped' | 'pending' {
    if (this.isConsumed(mealId)) return 'consumed';
    if (this.isSkipped(mealId))  return 'skipped';
    return 'pending';
  }

  /**
   * Sum macros for what the user consumed today.
   *
   * Two sources:
   *   1. Plan meals where log.consumed=true — totals come from the meal template.
   *   2. Quick-adds (synthetic mealIds) — totals come from log.customAdditions.
   */
  aggregate(plan: MealPlan | null | undefined): MacroTotals {
    const empty: MacroTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatsG: 0, fiberG: 0 };
    const logs = this._logs();

    // Index plan meals once for O(1) lookup.
    const byId = new Map<string, Meal>();
    if (plan) {
      for (const m of plan.meals) byId.set(m.id, m);
    }

    let kcal = 0, p = 0, c = 0, f = 0, fb = 0;
    for (const log of logs) {
      if (!log.consumed) continue;

      // Quick-add: totals live on customAdditions.
      if (log.mealId.startsWith('quick_')) {
        for (const item of log.customAdditions ?? []) {
          kcal += item.kcal;
          p += item.proteinG;
          c += item.carbsG;
          f += item.fatsG;
          fb += item.fiberG ?? 0;
        }
        continue;
      }

      // Plan meal: pull totals from the template.
      const meal = byId.get(log.mealId);
      if (!meal) continue;  // log refers to a meal not in current plan (deleted/swapped)
      kcal += meal.totalKcal;
      p += meal.totalProteinG;
      c += meal.totalCarbsG;
      f += meal.totalFatsG;
      fb += meal.totalFiberG ?? 0;
    }
    return { kcal, proteinG: p, carbsG: c, fatsG: f, fiberG: fb };
  }

  // ---- Mutations: plan meals ---------------------------------------------

  /**
   * Mark a plan meal consumed. Idempotent — second call is a no-op. Clears
   * any prior `skipped` state since "eaten" wins over "skipped."
   */
  async markConsumed(plan: MealPlan, meal: Meal): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot log meal: not signed in');

    const date = this._today();
    const id = `${userId}_${date}_${meal.id}`;
    const existing = await db.mealLogs.get(id);
    const now = new Date().toISOString();

    if (existing?.consumed && !existing.skipped) return;

    const next: MealLog = {
      id,
      userId,
      date,
      mealPlanId: plan.id,
      mealId: meal.id,
      mealSlot: meal.slot,
      consumed: true,
      consumedAt: existing?.consumedAt ?? now,
      skipped: false,
      customAdditions: existing?.customAdditions,
    };
    await this.persist(next);
  }

  /**
   * Mark a plan meal explicitly skipped. Idempotent. Clears `consumed`.
   */
  async markSkipped(plan: MealPlan, meal: Meal): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot log meal: not signed in');

    const date = this._today();
    const id = `${userId}_${date}_${meal.id}`;
    const existing = await db.mealLogs.get(id);

    if (existing?.skipped && !existing.consumed) return;

    const next: MealLog = {
      id,
      userId,
      date,
      mealPlanId: plan.id,
      mealId: meal.id,
      mealSlot: meal.slot,
      consumed: false,
      consumedAt: undefined,
      skipped: true,
    };
    await this.persist(next);
  }

  /**
   * Undo any decision for a plan meal — return it to 'pending'.
   * Deletes the row entirely (no row = no decision).
   */
  async undo(meal: Meal): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const id = `${userId}_${this._today()}_${meal.id}`;
    const existing = await db.mealLogs.get(id);
    if (!existing) return;

    await db.mealLogs.delete(id);
    await this.outbox.enqueue('mealLog', 'delete', id, null);
    this.sync.triggerSync();
  }

  // ---- Mutations: quick-add ----------------------------------------------

  /**
   * Add an off-plan item to today's log. Each quick-add gets a fresh
   * synthetic mealId so multiple ones don't collide.
   *
   * `slot` is metadata only — used if we later group quick-adds by part of
   * day. For MVP we just write 'snack' as the default.
   */
  async quickAdd(args: {
    plan: MealPlan;
    slot?: MealSlot;
    name: string;
    kcal: number;
    proteinG?: number;
    carbsG?: number;
    fatsG?: number;
    fiberG?: number;
  }): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot quick-add: not signed in');

    const date = this._today();
    const synthId = `quick_${uuid()}`;
    const id = `${userId}_${date}_${synthId}`;
    const now = new Date().toISOString();

    const item: MealItem = {
      name: args.name.trim() || 'Quick add',
      kcal: Math.max(0, Math.round(args.kcal)),
      proteinG: Math.max(0, Math.round(args.proteinG ?? 0)),
      carbsG: Math.max(0, Math.round(args.carbsG ?? 0)),
      fatsG: Math.max(0, Math.round(args.fatsG ?? 0)),
      fiberG: args.fiberG !== undefined ? Math.max(0, Math.round(args.fiberG)) : undefined,
    };

    const next: MealLog = {
      id,
      userId,
      date,
      mealPlanId: args.plan.id,
      mealId: synthId,
      mealSlot: args.slot ?? 'snack',
      consumed: true,
      consumedAt: now,
      skipped: false,
      customAdditions: [item],
    };
    await this.persist(next);
  }

  /** Remove a quick-add row entirely. (Plan meals get `undo()` instead.) */
  async removeQuickAdd(log: MealLog): Promise<void> {
    if (!log.mealId.startsWith('quick_')) return;
    await db.mealLogs.delete(log.id);
    await this.outbox.enqueue('mealLog', 'delete', log.id, null);
    this.sync.triggerSync();
  }

  // ---- Mutations: bulk ---------------------------------------------------

  /** Wipe all of today's logs — for a "reset day" debug action. */
  async clearToday(): Promise<void> {
    const userId = this.auth.userId();
    if (!userId) return;
    const date = this._today();
    const rows = await db.mealLogs
      .where('userId').equals(userId)
      .and((l) => l.date === date)
      .toArray();
    for (const row of rows) {
      await db.mealLogs.delete(row.id);
      await this.outbox.enqueue('mealLog', 'delete', row.id, null);
    }
    this.sync.triggerSync();
  }

  // ---- Deprecated -------------------------------------------------------

  /**
   * @deprecated Use `markConsumed` / `markSkipped` / `undo` instead — the
   * binary toggle conflated "skipped" with "haven't decided yet."
   * Kept for any stragglers; will be removed when no callers remain.
   */
  async toggleConsumed(plan: MealPlan, meal: Meal): Promise<void> {
    if (this.isConsumed(meal.id)) {
      await this.undo(meal);
    } else {
      await this.markConsumed(plan, meal);
    }
  }

  // ---- Internals ---------------------------------------------------------

  private async persist(log: MealLog): Promise<void> {
    await db.mealLogs.put(log);
    await this.outbox.enqueue('mealLog', 'upsert', log.id, log);
    this.sync.triggerSync();
  }

  private bindToUser(userId: string | null, date: string): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._logs.set([]);
      this._loaded.set(false);
      return;
    }

    const observable = liveQuery(() =>
      db.mealLogs
        .where('userId').equals(userId)
        .and((l) => l.date === date)
        .toArray(),
    );
    this.subscription = observable.subscribe({
      next: (rows) => {
        this._logs.set(rows);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[MealLogService] liveQuery error', err);
        this._logs.set([]);
        this._loaded.set(true);
      },
    });
  }

  private scheduleMidnightReset(): void {
    if (this.midnightTimer) clearTimeout(this.midnightTimer);
    const ms = msUntilLocalMidnight() + 1000;
    this.midnightTimer = setTimeout(() => {
      this._today.set(todayLocalISO());
      this.scheduleMidnightReset();
    }, ms);
  }
}

export interface MacroTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG: number;
}
