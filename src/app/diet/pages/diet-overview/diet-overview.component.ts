import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ProgressRingComponent } from '@shared/components/progress-ring/progress-ring.component';
import { friendlyDate } from '@shared/utils/date.util';

import { DietCalculatorService } from '@diet/services/diet-calculator.service';
import { DietTargetsService } from '@diet/services/diet-targets.service';
import { ProfileService } from '@diet/services/profile.service';

/**
 * Diet overview — the page behind the "Diet" bottom-nav tab.
 *
 * The public face of Module 4: shows the result of all the onboarding math.
 * Meals / meal-logs are Module 5 — for now this page is informational, with
 * actions to edit profile or override macros.
 */
@Component({
  selector: 'app-diet-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent, IconComponent, ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">

      <header class="flex items-start justify-between mb-5">
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

      @if (!targets() && !profile()) {
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
        @if (targets(); as t) {

        <!-- Calorie target hero -->
        <app-card variant="hero" class="block mb-3">
          <div class="flex items-start justify-between mb-4">
            <div>
              <span class="chip-primary">{{ goalLabel() }}</span>
              <p class="text-4xl font-extrabold num leading-tight mt-3">
                {{ t.targetKcal | number }}
                <span class="text-base text-muted font-medium">kcal</span>
              </p>
              <p class="text-xs text-subtle mt-1 num">
                Maintenance ≈ {{ t.maintenanceKcal | number }} kcal · {{ adjustmentLabel() }}
              </p>
            </div>
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
              style="background: rgb(var(--accent) / 0.12);"
            >
              🍽️
            </div>
          </div>

          <div class="flex items-center justify-between text-xs">
            <span class="chip">
              <app-icon name="refresh" [size]="12" />
              {{ t.mode === 'auto' ? 'Auto-calculated' : 'Custom' }}
            </span>
            <div class="flex gap-2">
              @if (t.mode === 'custom') {
                <button
                  type="button"
                  class="text-xs font-semibold text-muted hover:text-text"
                  (click)="resetToAuto()"
                >
                  Reset to auto
                </button>
              }
              <a
                routerLink="/diet/macros"
                class="text-xs font-semibold"
                style="color: rgb(var(--primary));"
              >
                Customise →
              </a>
            </div>
          </div>
        </app-card>

        <!-- Macros -->
        <app-card class="block mb-3">
          <p class="text-xs uppercase tracking-wider text-muted font-bold mb-4">
            Daily macros
          </p>
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="text-center">
              <p class="text-2xl font-extrabold num" style="color: rgb(var(--primary));">
                {{ t.proteinG }}
              </p>
              <p class="text-[10px] text-muted font-semibold mt-1 tracking-wider">PROTEIN · g</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-extrabold num" style="color: rgb(var(--accent));">
                {{ t.carbsG }}
              </p>
              <p class="text-[10px] text-muted font-semibold mt-1 tracking-wider">CARBS · g</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-extrabold num" style="color: rgb(var(--warning));">
                {{ t.fatsG }}
              </p>
              <p class="text-[10px] text-muted font-semibold mt-1 tracking-wider">FATS · g</p>
            </div>
          </div>

          <!-- Energy share visual -->
          <div class="flex h-2 rounded-full overflow-hidden bg-border">
            <div [style.width.%]="proteinPct()" style="background: rgb(var(--primary));"></div>
            <div [style.width.%]="carbsPct()"   style="background: rgb(var(--accent));"></div>
            <div [style.width.%]="fatsPct()"    style="background: rgb(var(--warning));"></div>
          </div>
          <div class="flex justify-between mt-2 text-[10px] text-muted font-semibold num">
            <span>{{ proteinPct() }}% P</span>
            <span>{{ carbsPct() }}% C</span>
            <span>{{ fatsPct() }}% F</span>
          </div>
          <p class="text-xs text-subtle mt-3 text-center">
            Plus {{ t.fiberG }}g fiber from whole foods
          </p>
        </app-card>

        <!-- BMI + Water row -->
        <div class="grid grid-cols-2 gap-3 mb-3">

          <app-card>
            <p class="text-[10px] uppercase tracking-wider text-muted font-bold mb-3">BMI</p>
            <div class="flex items-center gap-3">
              <app-progress-ring
                [value]="bmiRingValue()"
                [max]="40"
                [size]="64"
                [stroke]="6"
                [colorVar]="bmiColorVar()"
              >
                <p class="text-sm font-extrabold num">{{ t.bmi }}</p>
              </app-progress-ring>
              <div>
                <p class="text-sm font-bold capitalize">{{ bmiCategory() }}</p>
                <p class="text-[10px] text-subtle">{{ bmiHint() }}</p>
              </div>
            </div>
          </app-card>

          <app-card>
            <div class="flex items-center gap-2 mb-3">
              <div
                class="w-7 h-7 rounded-lg grid place-items-center"
                style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
              >
                <app-icon name="droplet" [size]="14" />
              </div>
              <span class="text-[10px] text-muted font-semibold tracking-wider">WATER</span>
            </div>
            <p class="text-xl font-bold num">
              {{ (t.waterMl / 1000).toFixed(1) }}<span class="text-sm text-muted font-medium">L</span>
            </p>
            <p class="text-[10px] text-subtle mt-1.5 num">
              +{{ t.workoutDayBonusMl }}ml on workout days
            </p>
          </app-card>
        </div>

        <!-- Profile snapshot -->
        @if (profile(); as p) {
          <app-card class="block mb-3">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs uppercase tracking-wider text-muted font-bold">Your profile</p>
              <a
                routerLink="/diet/profile"
                class="text-xs font-semibold"
                style="color: rgb(var(--primary));"
              >
                Edit
              </a>
            </div>
            <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <div class="flex justify-between">
                <span class="text-muted">Age</span>
                <span class="font-semibold num">{{ p.age }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Weight</span>
                <span class="font-semibold num">{{ p.weightKg }}kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Height</span>
                <span class="font-semibold num">{{ p.heightCm }}cm</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Activity</span>
                <span class="font-semibold capitalize">{{ activityLabel() }}</span>
              </div>
            </div>
          </app-card>
        }

        <!-- Meals placeholder (Module 5) -->
        <app-card class="block text-center" variant="subtle">
          <p class="font-bold mb-1 text-sm">Today's meals</p>
          <p class="text-xs text-muted">Coming in Module 5 — meal plans & tracking</p>
        </app-card>
        }
      }
    </div>
  `,
})
export default class DietOverviewComponent {
  private readonly profileService = inject(ProfileService);
  private readonly targetsService = inject(DietTargetsService);
  private readonly calculator = inject(DietCalculatorService);

  protected readonly today = friendlyDate();
  protected readonly profile = this.profileService.profile;
  protected readonly targets = this.targetsService.targets;

  protected readonly greeting = computed(() => {
    const name = this.profile()?.displayName;
    return name ? `${name}'s plan` : 'Your plan';
  });

  // ---------- Macro energy share ----------
  // Computed from kcal-equivalents so the bar reflects energy share, not gram share.
  private readonly totalMacroKcal = computed(() => {
    const t = this.targets();
    if (!t) return 0;
    return t.proteinG * 4 + t.carbsG * 4 + t.fatsG * 9;
  });

  protected readonly proteinPct = computed(() => {
    const t = this.targets();
    const total = this.totalMacroKcal();
    if (!t || total === 0) return 0;
    return Math.round((t.proteinG * 4 / total) * 100);
  });

  protected readonly carbsPct = computed(() => {
    const t = this.targets();
    const total = this.totalMacroKcal();
    if (!t || total === 0) return 0;
    return Math.round((t.carbsG * 4 / total) * 100);
  });

  protected readonly fatsPct = computed(() => {
    const t = this.targets();
    const total = this.totalMacroKcal();
    if (!t || total === 0) return 0;
    return Math.round((t.fatsG * 9 / total) * 100);
  });

  // ---------- BMI ----------
  protected readonly bmiRingValue = computed(() => Math.min(40, this.targets()?.bmi ?? 0));

  protected readonly bmiCategory = computed(() => {
    const bmi = this.targets()?.bmi ?? 0;
    return this.calculator.bmiCategory(bmi);
  });

  protected readonly bmiColorVar = computed(() => {
    const cat = this.bmiCategory();
    if (cat === 'normal') return '--primary';
    if (cat === 'obese')  return '--danger';
    return '--warning';
  });

  protected bmiHint(): string {
    switch (this.bmiCategory()) {
      case 'underweight': return 'Below 18.5';
      case 'normal':      return '18.5 – 24.9';
      case 'overweight':  return '25 – 29.9';
      case 'obese':       return '30 +';
    }
  }

  // ---------- Goal & activity labels ----------
  protected goalLabel(): string {
    switch (this.profile()?.goal) {
      case 'fat_loss':    return 'Fat loss';
      case 'muscle_gain': return 'Muscle gain';
      case 'weight_gain': return 'Weight gain';
      case 'maintenance': return 'Maintenance';
      default:            return 'Plan';
    }
  }

  protected adjustmentLabel(): string {
    switch (this.profile()?.goal) {
      case 'fat_loss':    return '−500 kcal deficit';
      case 'muscle_gain': return '+300 kcal surplus';
      case 'weight_gain': return '+500 kcal surplus';
      default:            return 'no adjustment';
    }
  }

  protected activityLabel(): string {
    return (this.profile()?.activityLevel ?? '').replace('_', ' ');
  }

  protected async resetToAuto(): Promise<void> {
    await this.targetsService.switchToAuto();
  }
}
