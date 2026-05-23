import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { friendlyDate } from '@shared/utils/date.util';

import { DietCalculatorService } from '@diet/services/diet-calculator.service';
import { DietTargetsService } from '@diet/services/diet-targets.service';
import { MealLogService } from '@diet/services/meal-log.service';
import { MealPlanService } from '@diet/services/meal-plan.service';
import { ProfileService } from '@diet/services/profile.service';

import { RoutineScheduleService } from '@workout/services/routine-schedule.service';

import type { Meal, MealLog, MealPlan, MealSlot } from '@models/index';

/**
 * Diet overview — the page behind the "Diet" bottom-nav tab.
 *
 * Module 7 refinement (post-build UX pass): this page is plan-focused, not
 * accounting-focused. Lead with "what to eat today" — big tap-to-eat
 * buttons, items hidden behind an overflow menu, macros collapsed into one
 * neutral progress line at the top.
 *
 * Layout:
 *   1. Header (date + greeting)
 *   2. Tiny one-line progress strip (no bars, no hero — just momentum)
 *   3. Today's plan: name + description
 *   4. Meal cards — pending meals show a big "Eat" button + an overflow
 *      menu (items, skip, undo). Consumed and skipped meals collapse into
 *      a single subtle row. Snacks are visually de-emphasised (smaller).
 *   5. Quick-add items inline (with remove)
 *   6. "+ Quick add" trigger — opens an inline panel with preset kcal chips
 *   7. Plan details disclosure — targets / BMI / water / profile (collapsed
 *      by default; for the user who wants to check)
 *
 * The dashboard remains the accountability surface — calorie + macro bars,
 * over-target warnings, etc. The diet page is for daily usability.
 */
@Component({
  selector: 'app-diet-overview',
  standalone: true,
  imports: [DecimalPipe, RouterLink, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6 pb-4">

      <!-- Header -->
      <header class="flex items-start justify-between mb-4">
        <div>
          <p class="text-xs text-muted font-semibold">{{ today }}</p>
          <h1 class="text-2xl font-extrabold tracking-tight mt-1">
            {{ greeting() }}
          </h1>
        </div>
        <a
          routerLink="/diet/profile"
          class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted hover:text-text transition-colors"
          aria-label="Edit profile"
        >
          <app-icon name="settings" [size]="20" />
        </a>
      </header>

      @if (!targets()) {
        <!-- Fallback if targets haven't pulled yet (normally caught by guard) -->
        <app-card class="block text-center">
          <div
            class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4"
            style="background: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
          >
            <app-icon name="fork" [size]="28" />
          </div>
          <p class="font-bold mb-1">Let's set up your plan</p>
          <p class="text-sm text-muted mb-4">Tell us about you and we'll calculate your targets.</p>
          <a routerLink="/onboarding" class="btn-primary inline-flex items-center gap-2">
            <span>Start setup</span>
            <app-icon name="chevron_right" [size]="16" />
          </a>
        </app-card>
      } @else {
        @if (todayPlan(); as plan) {

        <!-- ============== Tiny progress strip ============== -->
        <!-- One line. No bars, no chart. Just momentum awareness. -->
        @if (targets(); as t) {
          <p class="text-xs text-muted num mb-5 px-1">
            <span class="font-bold text-text">{{ consumedProteinG() }}</span>
            <span class="text-subtle"> / {{ t.proteinG }}g P</span>
            <span class="text-subtle"> · </span>
            <span class="font-bold text-text">{{ consumedKcal() | number }}</span>
            <span class="text-subtle"> / {{ t.targetKcal | number }} kcal</span>
            @if (consumedCount() > 0) {
              <span class="text-subtle"> · </span>
              <span style="color: rgb(var(--primary));">{{ consumedCount() }} logged</span>
            }
          </p>
        }

        <!-- ============== Today's plan header ============== -->
        <div class="mb-3 px-1">
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold">
            Today's plan
          </p>
          <p class="text-lg font-extrabold mt-0.5">{{ plan.name }}</p>
          @if (plan.description) {
            <p class="text-xs text-subtle mt-0.5">{{ plan.description }}</p>
          }
        </div>

        <!-- ============== Meal cards ============== -->
        <ul class="space-y-2">
          @for (meal of plan.meals; track meal.id) {
            @let status = statusFor(meal.id);
            @let isSnack = meal.slot === 'snack';
            @let expanded = expandedMealId() === meal.id;

            @if (status === 'pending') {
              <!-- ============= PENDING MEAL CARD ============= -->
              <li
                class="bg-surface rounded-2xl border border-border/40 transition-colors"
                [class.px-4]="!isSnack"
                [class.py-3.5]="!isSnack"
                [class.px-3]="isSnack"
                [class.py-2.5]="isSnack"
              >
                <div class="flex items-center gap-3">
                  <!-- Slot badge -->
                  <div
                    class="grid place-items-center shrink-0 rounded-xl"
                    [class.w-11]="!isSnack"
                    [class.h-11]="!isSnack"
                    [class.text-lg]="!isSnack"
                    [class.w-9]="isSnack"
                    [class.h-9]="isSnack"
                    [class.text-base]="isSnack"
                    style="background: rgb(var(--accent) / 0.12);"
                  >
                    {{ slotEmoji(meal.slot) }}
                  </div>

                  <!-- Title block -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="uppercase tracking-wider font-bold text-muted"
                        [class.text-[10px]]="!isSnack"
                        [class.text-[9px]]="isSnack"
                      >
                        {{ slotLabel(meal.slot) }}
                      </span>
                      @if (meal.timeHint) {
                        <span
                          class="text-subtle num"
                          [class.text-[10px]]="!isSnack"
                          [class.text-[9px]]="isSnack"
                        >· {{ meal.timeHint }}</span>
                      }
                    </div>
                    <p
                      class="font-bold leading-tight truncate"
                      [class.text-base]="!isSnack"
                      [class.text-sm]="isSnack"
                    >{{ meal.title }}</p>
                    <p
                      class="text-subtle num mt-0.5"
                      [class.text-xs]="!isSnack"
                      [class.text-[11px]]="isSnack"
                    >{{ meal.totalKcal }} kcal</p>
                  </div>

                  <!-- Overflow menu trigger -->
                  <button
                    type="button"
                    class="w-9 h-9 rounded-xl grid place-items-center text-subtle bg-elevated/60 active:text-text shrink-0"
                    (click)="toggleExpanded(meal.id)"
                    [attr.aria-label]="expanded ? 'Hide details' : 'Show details'"
                    [attr.aria-expanded]="expanded"
                  >
                    <app-icon name="more_horizontal" [size]="18" />
                  </button>

                  <!-- Big primary "Eat" CTA -->
                  <button
                    type="button"
                    class="rounded-xl font-extrabold shrink-0 active:opacity-80"
                    [class.h-11]="!isSnack"
                    [class.h-9]="isSnack"
                    [class.px-5]="!isSnack"
                    [class.px-4]="isSnack"
                    [class.text-sm]="!isSnack"
                    [class.text-xs]="isSnack"
                    style="background: rgb(var(--primary)); color: rgb(var(--bg));"
                    (click)="onEat(plan, meal)"
                    [disabled]="busy()"
                  >
                    Eat
                  </button>
                </div>

                <!-- Expanded: items list + skip action -->
                @if (expanded) {
                  <div class="mt-3 pt-3 border-t border-border/40">
                    <ul class="text-xs text-muted space-y-1">
                      @for (item of meal.items; track item.name) {
                        <li class="flex items-baseline gap-2">
                          <span class="text-subtle">•</span>
                          <span class="flex-1 min-w-0">
                            <span class="text-text">{{ item.name }}</span>
                            @if (item.qty) {
                              <span class="text-subtle"> · {{ item.qty }}</span>
                            }
                          </span>
                          <span class="text-subtle num shrink-0">{{ item.kcal }} kcal</span>
                        </li>
                      }
                    </ul>
                    <button
                      type="button"
                      class="mt-3 w-full text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 text-muted active:text-text bg-elevated/40"
                      (click)="onSkip(plan, meal)"
                      [disabled]="busy()"
                    >
                      <app-icon name="skip" [size]="13" />
                      Skip this meal
                    </button>
                  </div>
                }
              </li>
            } @else {
              <!-- ============= CONSUMED OR SKIPPED — COLLAPSED ============= -->
              <li
                class="rounded-xl flex items-center gap-3 transition-colors"
                [class.px-4]="!isSnack"
                [class.py-2.5]="!isSnack"
                [class.px-3]="isSnack"
                [class.py-2]="isSnack"
                [style.background]="status === 'consumed'
                  ? 'rgb(var(--primary) / 0.08)'
                  : 'rgb(var(--elevated) / 0.5)'"
              >
                <div
                  class="w-7 h-7 rounded-lg grid place-items-center shrink-0"
                  [style.background]="status === 'consumed'
                    ? 'rgb(var(--primary) / 0.18)'
                    : 'rgb(var(--subtle) / 0.15)'"
                  [style.color]="status === 'consumed'
                    ? 'rgb(var(--primary))'
                    : 'rgb(var(--subtle))'"
                >
                  <app-icon
                    [name]="status === 'consumed' ? 'check' : 'skip'"
                    [size]="14"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p
                    class="text-sm font-semibold truncate"
                    [class.line-through]="status === 'skipped'"
                    [style.color]="status === 'skipped'
                      ? 'rgb(var(--muted))'
                      : ''"
                  >
                    {{ slotLabel(meal.slot) }} · {{ meal.title }}
                  </p>
                </div>
                <button
                  type="button"
                  class="text-[10px] font-bold uppercase tracking-wider text-subtle active:text-text shrink-0 px-2 py-1 rounded-lg"
                  (click)="onUndo(meal)"
                  [disabled]="busy()"
                >
                  Undo
                </button>
              </li>
            }
          }

          <!-- ============== Quick-add rows ============== -->
          @for (q of quickAdds(); track q.id) {
            @let qItem = q.customAdditions?.[0];
            <li
              class="rounded-xl flex items-center gap-3 px-4 py-2.5"
              style="background: rgb(var(--primary) / 0.08);"
            >
              <div
                class="w-7 h-7 rounded-lg grid place-items-center shrink-0"
                style="background: rgb(var(--primary) / 0.18); color: rgb(var(--primary));"
              >
                <app-icon name="plus" [size]="14" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate">
                  Quick add · {{ qItem?.name || 'Item' }}
                </p>
                <p class="text-[10px] text-subtle num">
                  {{ qItem?.kcal || 0 }} kcal
                </p>
              </div>
              <button
                type="button"
                class="w-8 h-8 rounded-lg grid place-items-center text-subtle active:text-danger shrink-0"
                (click)="onRemoveQuickAdd(q)"
                [disabled]="busy()"
                aria-label="Remove quick-add"
              >
                <app-icon name="x" [size]="14" />
              </button>
            </li>
          }
        </ul>

        <!-- ============== Quick-add trigger / panel ============== -->
        @if (quickAddOpen()) {
          <div
            class="mt-3 bg-surface rounded-2xl p-4 border"
            style="border-color: rgb(var(--primary) / 0.4);"
          >
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs uppercase tracking-wider font-bold text-muted">
                Quick add
              </p>
              <button
                type="button"
                class="w-7 h-7 rounded-lg grid place-items-center text-subtle"
                (click)="closeQuickAdd()"
                aria-label="Cancel"
              >
                <app-icon name="x" [size]="14" />
              </button>
            </div>

            <input
              type="text"
              class="w-full bg-elevated rounded-xl px-3 py-2.5 text-sm font-medium placeholder:text-subtle focus:outline-none mb-3"
              placeholder="What did you eat?"
              [value]="quickAddName()"
              (input)="onQuickAddName($event)"
              maxlength="60"
            />

            <p class="text-[10px] uppercase tracking-wider font-bold text-muted mb-2">
              Calories
            </p>
            <div class="grid grid-cols-4 gap-2">
              @for (kcal of quickAddPresets; track kcal) {
                <button
                  type="button"
                  class="rounded-xl py-2.5 text-sm font-extrabold num transition-colors"
                  [style.background]="quickAddKcal() === kcal
                    ? 'rgb(var(--primary))'
                    : 'rgb(var(--elevated))'"
                  [style.color]="quickAddKcal() === kcal
                    ? 'rgb(var(--bg))'
                    : 'rgb(var(--text))'"
                  (click)="quickAddKcal.set(kcal)"
                >
                  {{ kcal }}
                </button>
              }
            </div>

            <button
              type="button"
              class="btn-primary w-full mt-3 flex items-center justify-center gap-2"
              [disabled]="!canSubmitQuickAdd() || busy()"
              (click)="submitQuickAdd(plan)"
            >
              <app-icon name="check" [size]="16" />
              Log it
            </button>
          </div>
        } @else {
          <button
            type="button"
            class="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-elevated/60 text-sm font-semibold text-muted active:text-text border border-border/40 active:border-border"
            (click)="openQuickAdd()"
          >
            <app-icon name="plus" [size]="14" />
            Quick add food
          </button>
        }

        <!-- ============== Plan details disclosure ============== -->
        <div class="mt-6">
          <button
            type="button"
            class="w-full flex items-center justify-between py-2 px-1"
            (click)="detailsOpen.set(!detailsOpen())"
            [attr.aria-expanded]="detailsOpen()"
          >
            <span class="text-xs uppercase tracking-wider font-bold text-muted">
              Plan details
            </span>
            <app-icon
              [name]="detailsOpen() ? 'chevron_left' : 'chevron_right'"
              [size]="14"
              cssClass="text-subtle"
            />
          </button>

          @if (detailsOpen()) {
            @if (targets(); as t) {
              <div class="space-y-3 mt-2">
                <!-- Targets summary -->
                <app-card variant="subtle" class="block">
                  <p class="text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                    Daily targets
                  </p>
                  <div class="grid grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                    <div class="flex justify-between">
                      <span class="text-muted">Calories</span>
                      <span class="font-semibold num">{{ t.targetKcal | number }} kcal</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Protein</span>
                      <span class="font-semibold num">{{ t.proteinG }}g</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Carbs</span>
                      <span class="font-semibold num">{{ t.carbsG }}g</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Fats</span>
                      <span class="font-semibold num">{{ t.fatsG }}g</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Fiber</span>
                      <span class="font-semibold num">{{ t.fiberG }}g</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-muted">Water</span>
                      <span class="font-semibold num">{{ (t.waterMl / 1000).toFixed(1) }}L</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-xs">
                    <span class="chip">
                      <app-icon name="refresh" [size]="12" />
                      {{ t.mode === 'auto' ? 'Auto-calculated' : 'Custom' }}
                    </span>
                    <a
                      routerLink="/diet/macros"
                      class="font-semibold"
                      style="color: rgb(var(--primary));"
                    >
                      Customise →
                    </a>
                  </div>
                </app-card>

                <!-- BMI mini card -->
                <app-card variant="subtle" class="block">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-[10px] uppercase tracking-wider text-muted font-bold">BMI</p>
                      <p class="text-xl font-extrabold num mt-0.5">{{ t.bmi }}</p>
                      <p class="text-[10px] text-subtle capitalize">{{ bmiCategory() }} · {{ bmiHint() }}</p>
                    </div>
                    @if (profile(); as p) {
                      <div class="text-right text-xs">
                        <p class="text-muted">{{ p.weightKg }}kg · {{ p.heightCm }}cm</p>
                        <p class="text-subtle capitalize">{{ activityLabel() }}</p>
                        <a
                          routerLink="/diet/profile"
                          class="text-[10px] font-semibold"
                          style="color: rgb(var(--primary));"
                        >Edit profile →</a>
                      </div>
                    }
                  </div>
                </app-card>
              </div>
            }
          }
        </div>
        }
      }
    </div>
  `,
})
export default class DietOverviewComponent {
  private readonly profileService = inject(ProfileService);
  private readonly targetsService = inject(DietTargetsService);
  private readonly calculator = inject(DietCalculatorService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly mealLogService = inject(MealLogService);
  private readonly schedule = inject(RoutineScheduleService);

  protected readonly today = friendlyDate();
  protected readonly profile = this.profileService.profile;
  protected readonly targets = this.targetsService.targets;

  // -------- Meal plan & logs --------
  protected readonly todayPlan = this.mealPlanService.todayPlan;
  protected readonly consumedCount = this.mealLogService.consumedCount;
  protected readonly quickAdds = this.mealLogService.quickAdds;

  constructor() {
    // Push current routine into MealPlanService so future routine-keyed
    // custom plans resolve correctly.
    effect(() => {
      const log = this.schedule.todayLog();
      const suggested = this.schedule.suggestedToday();
      this.mealPlanService.setCurrentRoutine(log?.routineKey ?? suggested);
    });
  }

  // -------- Per-meal state for UI --------

  protected statusFor = (mealId: string): 'consumed' | 'skipped' | 'pending' =>
    this.mealLogService.statusFor(mealId);

  /** Which pending meal is currently expanded (showing items + skip). One at a time. */
  protected readonly expandedMealId = signal<string | null>(null);

  protected toggleExpanded(mealId: string): void {
    this.expandedMealId.update((curr) => (curr === mealId ? null : mealId));
  }

  // -------- Consumed aggregates (for the tiny progress strip) --------

  private readonly consumed = computed(() =>
    this.mealLogService.aggregate(this.todayPlan()),
  );

  protected readonly consumedKcal     = computed(() => this.consumed().kcal);
  protected readonly consumedProteinG = computed(() => this.consumed().proteinG);

  // -------- Meal actions (single-tap, no confirmations) --------

  protected readonly busy = signal(false);

  protected async onEat(plan: MealPlan, meal: Meal): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.mealLogService.markConsumed(plan, meal);
      // Collapse the expanded card if it was the one we just ate.
      if (this.expandedMealId() === meal.id) {
        this.expandedMealId.set(null);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async onSkip(plan: MealPlan, meal: Meal): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.mealLogService.markSkipped(plan, meal);
      if (this.expandedMealId() === meal.id) {
        this.expandedMealId.set(null);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async onUndo(meal: Meal): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.mealLogService.undo(meal);
    } finally {
      this.busy.set(false);
    }
  }

  protected async onRemoveQuickAdd(log: MealLog): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.mealLogService.removeQuickAdd(log);
    } finally {
      this.busy.set(false);
    }
  }

  // -------- Quick-add panel state --------

  protected readonly quickAddOpen = signal(false);
  protected readonly quickAddName = signal('');
  protected readonly quickAddKcal = signal<number | null>(null);
  protected readonly quickAddPresets = [100, 200, 300, 500] as const;

  protected readonly canSubmitQuickAdd = computed(
    () => this.quickAddName().trim().length > 0 && this.quickAddKcal() !== null,
  );

  protected openQuickAdd(): void {
    this.quickAddName.set('');
    this.quickAddKcal.set(null);
    this.quickAddOpen.set(true);
  }

  protected closeQuickAdd(): void {
    this.quickAddOpen.set(false);
  }

  protected onQuickAddName(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.quickAddName.set(target.value);
  }

  protected async submitQuickAdd(plan: MealPlan): Promise<void> {
    if (!this.canSubmitQuickAdd() || this.busy()) return;
    const kcal = this.quickAddKcal();
    if (kcal === null) return;
    this.busy.set(true);
    try {
      await this.mealLogService.quickAdd({
        plan,
        name: this.quickAddName(),
        kcal,
        // For MVP we don't ask for per-macro breakdown — kcal only.
        // The dashboard aggregator just sees the kcal contribution; macros
        // stay zero. Honest about what we measured.
      });
      this.closeQuickAdd();
    } finally {
      this.busy.set(false);
    }
  }

  // -------- Plan details disclosure --------

  protected readonly detailsOpen = signal(false);

  // -------- Display helpers --------

  protected slotLabel(slot: MealSlot): string {
    switch (slot) {
      case 'breakfast': return 'Breakfast';
      case 'lunch':     return 'Lunch';
      case 'snack':     return 'Snack';
      case 'dinner':    return 'Dinner';
    }
  }

  protected slotEmoji(slot: MealSlot): string {
    switch (slot) {
      case 'breakfast': return '🌅';
      case 'lunch':     return '🥗';
      case 'snack':     return '🥜';
      case 'dinner':    return '🌙';
    }
  }

  protected readonly greeting = computed(() => {
    const name = this.profile()?.displayName;
    return name ? `${name}'s plan` : 'Your plan';
  });

  // -------- BMI helpers (kept for the details panel) --------

  protected readonly bmiCategory = computed(() => {
    const bmi = this.targets()?.bmi ?? 0;
    return this.calculator.bmiCategory(bmi);
  });

  protected bmiHint(): string {
    switch (this.bmiCategory()) {
      case 'underweight': return 'Below 18.5';
      case 'normal':      return '18.5 – 24.9';
      case 'overweight':  return '25 – 29.9';
      case 'obese':       return '30 +';
    }
  }

  protected activityLabel(): string {
    return (this.profile()?.activityLevel ?? '').replace('_', ' ');
  }
}
