import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { todayLocalISO } from '@shared/utils/date.util';
import type { MealPlan } from '@models/index';
import type { DayChoice } from '@models/workout.model';

import { ALL_SEED_PLANS, PLAN_BY_WEEKDAY } from '@diet/data/meal-plans.seed';

/**
 * MealPlanService — resolves today's meal plan from templates.
 *
 * Resolution order (highest priority first):
 *   1. User custom plans in Dexie matching today's routine or 'any'
 *      (future feature — `userPlans()` already wired through liveQuery so
 *      the day a custom plan is written, it just works).
 *   2. Weekday → seeded template, mapping per `personal_diet__plan.txt`
 *      (Mon=Light Veg, Tue=High Fiber, Wed=Chicken, etc.).
 *
 * For MVP we always fall through to (2). The architecture above keeps the
 * future "AI suggestion" and "custom override" paths from needing a rewrite.
 *
 * Signals:
 *   - `todayPlan` — the MealPlan in effect right now. Always resolves to a
 *      plan (the seeded fallback guarantees never-null).
 *   - `planSource` — 'template' | 'custom' | 'ai' — for showing a chip in UI.
 *   - `allTemplates` — convenience for a future "browse plans" page.
 */
@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly auth = inject(AuthService);

  /** All user-owned plans in Dexie. Empty for MVP; populated when custom plans land. */
  private readonly _userPlans = signal<MealPlan[]>([]);

  /** Bumped at midnight to force re-resolution of `todayPlan`. */
  private readonly _today = signal<string>(todayLocalISO());

  /**
   * Current routine for today. Wired by callers via `setCurrentRoutine()` so
   * MealPlanService doesn't need a hard dep on RoutineScheduleService — keeps
   * the diet feature buildable in isolation and avoids a circular import risk.
   * Defaults to null until set by the diet-overview page.
   */
  private readonly _currentRoutine = signal<DayChoice | null>(null);

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    // Bind to Dexie's user-plans table whenever userId changes.
    effect(() => {
      const userId = this.auth.userId();
      this.bindUserPlans(userId);
    });
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * The plan to show today. Always returns a plan — falls back to the
   * weekday-mapped seed template if nothing else applies.
   */
  readonly todayPlan = computed<MealPlan>(() => {
    // Track today + routine + custom plans so re-resolution is reactive.
    const _ = this._today();
    const routine = this._currentRoutine();
    const customs = this._userPlans();

    // 1. Custom plan for this routine (or 'any')?
    const customMatch = customs.find(
      (p) => p.routineKey === routine || p.routineKey === 'any',
    );
    if (customMatch) return customMatch;

    // 2. Weekday → seeded template.
    const weekday = new Date().getDay();
    return PLAN_BY_WEEKDAY[weekday] ?? PLAN_BY_WEEKDAY[5]; // Friday as safety net
  });

  /**
   * Where today's plan came from. Used by the UI to show a "Template" /
   * "Custom" / "AI" chip without leaking resolution internals.
   */
  readonly planSource = computed<'template' | 'custom' | 'ai'>(() => {
    const p = this.todayPlan();
    if (p.isTemplate) return 'template';
    // Future: detect AI-generated plans via a flag on the row.
    return 'custom';
  });

  /** All seeded templates. Read-only — for a "browse" page later. */
  readonly allTemplates = ALL_SEED_PLANS;

  /**
   * Called by the diet-overview page (or dashboard) to inject the current
   * routine context. Lets `todayPlan` re-resolve when the user changes
   * today's workout choice.
   */
  setCurrentRoutine(routine: DayChoice | null): void {
    this._currentRoutine.set(routine);
  }

  /**
   * Manually bump the today signal — wired up via msUntilLocalMidnight in
   * a future scheduler if needed. For now MealPlanService relies on the user
   * reopening the app at some point per day, which always re-renders this
   * page; an explicit midnight tick will be added if Module 8 surfaces it.
   */
  refreshDate(): void {
    this._today.set(todayLocalISO());
  }

  // ---- Internals ----------------------------------------------------------

  private bindUserPlans(userId: string | null): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._userPlans.set([]);
      return;
    }

    // Only user-owned, non-template rows are candidates for override.
    this.subscription = liveQuery(() =>
      db.mealPlans
        .where('userId').equals(userId)
        .and((p) => p.isTemplate === false)
        .toArray(),
    ).subscribe({
      next: (rows) => this._userPlans.set(rows),
      error: (err) => {
        console.error('[MealPlanService] userPlans liveQuery', err);
        this._userPlans.set([]);
      },
    });
  }
}
