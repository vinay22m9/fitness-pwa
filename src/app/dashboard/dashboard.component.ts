import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '@auth/services/auth.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardComponent } from '@shared/components/card/card.component';
import { friendlyDate } from '@shared/utils/date.util';

import { DietTargetsService } from '@diet/services/diet-targets.service';
import { MealLogService } from '@diet/services/meal-log.service';
import { MealPlanService } from '@diet/services/meal-plan.service';
import { ProfileService } from '@diet/services/profile.service';

import { HydrationService } from '@hydration/services/hydration.service';

import { RoutineScheduleService } from '@workout/services/routine-schedule.service';
import {
  ROUTINE_EMOJI,
  ROUTINE_FOCUS,
  ROUTINE_LABELS,
  type DayChoice,
} from '@models/workout.model';

/**
 * Dashboard / Home.
 *
 * Module 7 — every number on this screen is now real:
 *   - Workout hero: RoutineScheduleService
 *   - Water card: HydrationService
 *   - Calories + Macros: MealLogService aggregating consumed meals from
 *     the active MealPlanService plan
 *
 * No mock values. The dashboard is a pure reactive read; user actions
 * happen on the feature pages and changes flow back through signals.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">

      <!-- Header -->
      <header class="flex items-start justify-between mb-6">
        <div>
          <p class="text-xs text-muted font-semibold">{{ today }}</p>
          <h1 class="text-2xl font-extrabold tracking-tight mt-1">
            {{ greeting() }}
          </h1>
        </div>
        <button
          class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted hover:text-text transition-colors"
          (click)="signOut()"
          aria-label="Sign out"
        >
          <app-icon name="user" [size]="20" />
        </button>
      </header>

      <!-- Hero workout card — wired to RoutineScheduleService -->
      <app-card variant="hero" class="block mb-3">
        @if (todayLog(); as logged) {
          <div class="flex items-start justify-between mb-4">
            <div>
              <span class="chip-primary">
                <app-icon name="check" [size]="12" />
                {{ logged.status === 'in_progress' ? 'In progress' : 'Logged today' }}
              </span>
              <h2 class="text-xl font-bold mt-2">{{ workoutLabel(logged.routineKey) }}</h2>
              <p class="text-sm text-muted mt-1">
                @if (logged.routineKey === 'rest') {
                  Recovery day
                } @else if (logged.status === 'in_progress') {
                  Resume where you left off
                } @else {
                  Nice work
                }
              </p>
            </div>
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
              style="background: rgb(var(--primary) / 0.12);"
            >
              {{ workoutEmoji(logged.routineKey) }}
            </div>
          </div>
          @if (logged.status === 'in_progress') {
            <a
              [routerLink]="['/workout/active']"
              class="btn-primary w-full flex items-center justify-center gap-2"
            >
              <app-icon name="zap" [size]="18" />
              Resume Workout
            </a>
          } @else {
            <a
              [routerLink]="['/workout']"
              class="btn-ghost w-full flex items-center justify-center gap-2"
            >
              View Workout
              <app-icon name="chevron_right" [size]="16" />
            </a>
          }
        } @else {
          <div class="flex items-start justify-between mb-4">
            <div>
              <span class="chip-primary">Today · suggested</span>
              <h2 class="text-xl font-bold mt-2">{{ workoutLabel(suggestedToday()) }}</h2>
              <p class="text-sm text-muted mt-1">{{ workoutFocus(suggestedToday()) }}</p>
            </div>
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
              style="background: rgb(var(--primary) / 0.12);"
            >
              {{ workoutEmoji(suggestedToday()) }}
            </div>
          </div>
          <a
            [routerLink]="['/workout']"
            class="btn-primary w-full flex items-center justify-center gap-2"
          >
            <app-icon name="zap" [size]="18" />
            @if (suggestedToday() === 'rest') {
              Log Rest Day
            } @else {
              Start Workout
            }
          </a>
        }
      </app-card>

      <!-- Stats row — water + calories. Now reading real targets. -->
      <div class="grid grid-cols-2 gap-3 mb-3">
        <a [routerLink]="['/hydration']" class="block">
          <app-card>
            <div class="flex items-center gap-2 mb-3">
              <div
                class="w-7 h-7 rounded-lg grid place-items-center"
                style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
              >
                <app-icon name="droplet" [size]="14" />
              </div>
              <span class="text-xs text-muted font-semibold">Water</span>
            </div>
            <p class="text-xl font-bold num">
              {{ waterTotalLiters() | number: '1.1-1' }}<span class="text-sm text-muted font-medium">
                / {{ waterGoalLiters() | number: '1.1-1' }}L
              </span>
            </p>
            <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                [style.width.%]="waterProgressPct()"
                style="background: rgb(var(--electric));"
              ></div>
            </div>
          </app-card>
        </a>

        <a [routerLink]="['/diet']" class="block">
          <app-card>
            <div class="flex items-center gap-2 mb-3">
              <div
                class="w-7 h-7 rounded-lg grid place-items-center"
                style="background: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
              >
                <app-icon name="flame" [size]="14" />
              </div>
              <span class="text-xs text-muted font-semibold">Calories</span>
            </div>
            <p class="text-xl font-bold num">
              {{ consumedKcal() | number }}<span class="text-sm text-muted font-medium">
                / {{ targetKcal() | number }}
              </span>
            </p>
            <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                [style.width.%]="kcalProgressPct()"
                [style.background]="overTarget()
                  ? 'rgb(var(--warning))'
                  : 'rgb(var(--accent))'"
              ></div>
            </div>
          </app-card>
        </a>
      </div>

      <!-- Macros card -->
      <app-card class="block mb-3">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs uppercase tracking-wider text-muted font-bold">Macros</p>
          <a
            routerLink="/diet"
            class="text-xs font-semibold"
            style="color: rgb(var(--primary));"
          >
            View plan →
          </a>
        </div>
        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Protein</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">{{ consumedProteinG() }}</span> / {{ proteinG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="proteinConsumedPct()"
                   style="background: rgb(var(--primary));"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Carbs</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">{{ consumedCarbsG() }}</span> / {{ carbsG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="carbsConsumedPct()"
                   style="background: rgb(var(--accent));"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Fats</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">{{ consumedFatsG() }}</span> / {{ fatsG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="fatsConsumedPct()"
                   style="background: rgb(var(--warning));"></div>
            </div>
          </div>
        </div>
      </app-card>

      @if (email()) {
        <p class="text-center text-xs text-subtle mt-6 mb-2">
          Signed in as {{ email() }} · tap avatar to sign out
        </p>
      }
    </div>
  `,
})
export default class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly targetsService = inject(DietTargetsService);
  private readonly hydration = inject(HydrationService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly mealLogService = inject(MealLogService);
  private readonly schedule = inject(RoutineScheduleService);

  protected readonly today = friendlyDate();
  protected readonly email = this.auth.email;

  // -------- Workout signals (Module 5) --------
  protected readonly suggestedToday = this.schedule.suggestedToday;
  protected readonly todayLog = this.schedule.todayLog;

  constructor() {
    // Wire today's routine into MealPlanService so it can pick the right
    // plan for routine-keyed custom plans (future). The dashboard is the
    // most common entry-point so doing it here means the diet page also
    // sees a primed value when navigated to.
    effect(() => {
      const log = this.todayLog();
      const suggested = this.suggestedToday();
      this.mealPlanService.setCurrentRoutine(log?.routineKey ?? suggested);
    });
  }

  protected workoutLabel(k: DayChoice): string { return ROUTINE_LABELS[k]; }
  protected workoutFocus(k: DayChoice): string { return ROUTINE_FOCUS[k]; }
  protected workoutEmoji(k: DayChoice): string { return ROUTINE_EMOJI[k]; }

  // -------- Greeting --------
  // Prefer profile.displayName (set during onboarding). Fall back to the
  // local-part of the email, then to a generic greeting.
  protected readonly greeting = computed(() => {
    const name = this.profileService.profile()?.displayName?.trim();
    if (name) return `Good morning, ${name.split(' ')[0]}`;
    const e = this.auth.email();
    if (e) {
      const local = e.split('@')[0];
      const first = local.split(/[._-]/)[0];
      return `Good morning, ${first.charAt(0).toUpperCase() + first.slice(1)}`;
    }
    return 'Good morning';
  });

  // -------- Diet targets readouts --------
  // Sensible fallbacks so the dashboard never shows "NaN/0" while the
  // targets row is loading.
  protected readonly targetKcal = computed(() => this.targetsService.targets()?.targetKcal ?? 2000);
  protected readonly proteinG   = computed(() => this.targetsService.targets()?.proteinG   ?? 140);
  protected readonly carbsG     = computed(() => this.targetsService.targets()?.carbsG     ?? 220);
  protected readonly fatsG      = computed(() => this.targetsService.targets()?.fatsG      ?? 60);

  // -------- Consumed today (Module 7) --------
  // Aggregate is a function on MealLogService taking the active plan as
  // input. Wrapping the call in a computed registers both the plan signal
  // (via mealPlanService.todayPlan()) AND the consumedIds signal (via
  // mealLogService.aggregate's internal read) as deps, so the bars update
  // both when the user taps a meal AND when the day's plan changes at
  // midnight.
  private readonly consumed = computed(() =>
    this.mealLogService.aggregate(this.mealPlanService.todayPlan()),
  );

  protected readonly consumedKcal     = computed(() => this.consumed().kcal);
  protected readonly consumedProteinG = computed(() => this.consumed().proteinG);
  protected readonly consumedCarbsG   = computed(() => this.consumed().carbsG);
  protected readonly consumedFatsG    = computed(() => this.consumed().fatsG);

  protected readonly overTarget = computed(() => this.consumedKcal() > this.targetKcal());

  protected readonly kcalProgressPct = computed(() =>
    Math.min(100, (this.consumedKcal() / Math.max(1, this.targetKcal())) * 100),
  );

  protected readonly proteinConsumedPct = computed(() =>
    Math.min(100, (this.consumedProteinG() / Math.max(1, this.proteinG())) * 100),
  );
  protected readonly carbsConsumedPct = computed(() =>
    Math.min(100, (this.consumedCarbsG() / Math.max(1, this.carbsG())) * 100),
  );
  protected readonly fatsConsumedPct = computed(() =>
    Math.min(100, (this.consumedFatsG() / Math.max(1, this.fatsG())) * 100),
  );

  // -------- Hydration readouts (Module 6) --------
  // Read from HydrationService. The goal already accounts for the
  // workout-day bonus when applicable — no need to recombine here.
  protected readonly waterTotalLiters = computed(() => this.hydration.totalMl() / 1000);
  protected readonly waterGoalLiters  = computed(() => this.hydration.goalMl() / 1000);
  protected readonly waterProgressPct = computed(() =>
    Math.min(100, this.hydration.progressPct() * 100),
  );

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
