import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

import { AuthService } from '@auth/services/auth.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ProgressRingComponent } from '@shared/components/progress-ring/progress-ring.component';
import type {
  ActivityLevel,
  FitnessGoal,
  Gender,
  Profile,
} from '@models/index';

import { DietCalculatorService } from '@diet/services/diet-calculator.service';
import { DietTargetsService } from '@diet/services/diet-targets.service';
import { ProfileService } from '@diet/services/profile.service';

/**
 * Onboarding flow — 6 steps with a live preview at the end.
 *
 * Steps:
 *   1. name
 *   2. age & gender
 *   3. height & weight
 *   4. activity level
 *   5. goal
 *   6. review (live BMI/TDEE/macros/water preview)
 *
 * On finish: save profile → derive diet targets → navigate to /home.
 *
 * Design notes:
 *   - One screen per step keeps the form mobile-friendly.
 *   - Local working copy (not persisted) until Finish, so a user who taps
 *     Back doesn't accidentally trigger the auto-recompute effect with
 *     half-filled data.
 *   - Live preview on review uses DietCalculatorService directly — no
 *     service write happens until Finish.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, DecimalPipe, IconComponent, ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-bg text-text flex flex-col">

      <!-- Step indicator -->
      <header class="px-5 pt-6 pb-4">
        <div class="flex items-center justify-between mb-3">
          @if (step() > 1) {
            <button
              type="button"
              class="w-9 h-9 rounded-xl bg-elevated grid place-items-center text-muted hover:text-text"
              (click)="back()"
              aria-label="Back"
            >
              <app-icon name="chevron_left" [size]="20" />
            </button>
          } @else {
            <div class="w-9 h-9"></div>
          }
          <p class="text-xs text-muted font-semibold num">
            Step {{ step() }} of {{ totalSteps }}
          </p>
          <div class="w-9 h-9"></div>
        </div>
        <div class="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            [style.width.%]="(step() / totalSteps) * 100"
            style="background: rgb(var(--primary));"
          ></div>
        </div>
      </header>

      <main class="flex-1 px-5 pt-6 pb-8 page-enter" [attr.data-step]="step()">

        @switch (step()) {

          @case (1) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">Welcome 👋</h1>
              <p class="text-muted mb-8">Let's get to know you. What should we call you?</p>

              <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                type="text"
                [(ngModel)]="draft.displayName"
                name="displayName"
                placeholder="e.g. Nani"
                autocomplete="given-name"
                class="input-field"
                (keyup.enter)="next()"
              />
            </div>
          }

          @case (2) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">About you</h1>
              <p class="text-muted mb-8">We use these to estimate your daily calorie needs.</p>

              <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Age (years)
              </label>
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="draft.age"
                name="age"
                min="13"
                max="100"
                placeholder="30"
                class="input-field mb-6"
              />

              <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                Gender
              </label>
              <div class="grid grid-cols-3 gap-2">
                @for (g of GENDERS; track g.value) {
                  <button
                    type="button"
                    class="option-pill"
                    [class.option-pill--active]="draft.gender === g.value"
                    (click)="draft.gender = g.value"
                  >
                    {{ g.label }}
                  </button>
                }
              </div>
            </div>
          }

          @case (3) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">Your body</h1>
              <p class="text-muted mb-8">Height and current weight.</p>

              <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Height (cm)
              </label>
              <input
                type="number"
                inputmode="decimal"
                [(ngModel)]="draft.heightCm"
                name="height"
                min="100"
                max="250"
                placeholder="170"
                class="input-field mb-6"
              />

              <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Weight (kg)
              </label>
              <input
                type="number"
                inputmode="decimal"
                [(ngModel)]="draft.weightKg"
                name="weight"
                min="30"
                max="250"
                step="0.1"
                placeholder="70"
                class="input-field"
              />
            </div>
          }

          @case (4) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">How active are you?</h1>
              <p class="text-muted mb-8">Outside of planned workouts.</p>

              <div class="space-y-2">
                @for (a of ACTIVITY_OPTIONS; track a.value) {
                  <button
                    type="button"
                    class="option-row"
                    [class.option-row--active]="draft.activityLevel === a.value"
                    (click)="draft.activityLevel = a.value"
                  >
                    <div class="flex-1 text-left">
                      <p class="font-bold">{{ a.label }}</p>
                      <p class="text-sm text-muted mt-0.5">{{ a.hint }}</p>
                    </div>
                    @if (draft.activityLevel === a.value) {
                      <div
                        class="w-6 h-6 rounded-full grid place-items-center"
                        style="background: rgb(var(--primary)); color: rgb(var(--bg));"
                      >
                        <app-icon name="check" [size]="14" />
                      </div>
                    }
                  </button>
                }
              </div>
            </div>
          }

          @case (5) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">Your goal</h1>
              <p class="text-muted mb-8">We'll set calories and macros to match.</p>

              <div class="space-y-2">
                @for (g of GOAL_OPTIONS; track g.value) {
                  <button
                    type="button"
                    class="option-row"
                    [class.option-row--active]="draft.goal === g.value"
                    (click)="draft.goal = g.value"
                  >
                    <div class="text-2xl mr-3">{{ g.emoji }}</div>
                    <div class="flex-1 text-left">
                      <p class="font-bold">{{ g.label }}</p>
                      <p class="text-sm text-muted mt-0.5">{{ g.hint }}</p>
                    </div>
                    @if (draft.goal === g.value) {
                      <div
                        class="w-6 h-6 rounded-full grid place-items-center"
                        style="background: rgb(var(--primary)); color: rgb(var(--bg));"
                      >
                        <app-icon name="check" [size]="14" />
                      </div>
                    }
                  </button>
                }
              </div>
            </div>
          }

          @case (6) {
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight mb-2">Your plan</h1>
              <p class="text-muted mb-6">Here's what we calculated. You can tweak anytime in Settings.</p>

              <!-- BMI ring -->
              <div class="bg-surface rounded-3xl p-5 mb-3 flex items-center gap-5">
                <app-progress-ring
                  [value]="bmiRingValue()"
                  [max]="40"
                  [size]="96"
                  [stroke]="9"
                  [colorVar]="bmiColorVar()"
                >
                  <div class="text-center">
                    <p class="text-2xl font-extrabold num leading-none">{{ preview().bmi }}</p>
                    <p class="text-[10px] text-muted font-semibold uppercase tracking-wider mt-1">BMI</p>
                  </div>
                </app-progress-ring>
                <div>
                  <p class="text-xs text-muted font-semibold uppercase tracking-wider">Category</p>
                  <p class="text-lg font-bold mt-1 capitalize">{{ preview().bmiCategory }}</p>
                  <p class="text-xs text-subtle mt-1">For reference only</p>
                </div>
              </div>

              <!-- Calorie target -->
              <div class="bg-surface rounded-3xl p-5 mb-3">
                <div class="flex items-center justify-between mb-3">
                  <p class="text-xs text-muted font-semibold uppercase tracking-wider">Daily target</p>
                  <span class="chip">{{ goalShortLabel() }}</span>
                </div>
                <p class="text-4xl font-extrabold num leading-tight">
                  {{ preview().targetKcal | number }}
                  <span class="text-base text-muted font-medium">kcal</span>
                </p>
                <p class="text-xs text-subtle mt-2 num">
                  Maintenance ≈ {{ preview().maintenanceKcal | number }} kcal
                </p>
              </div>

              <!-- Macros -->
              <div class="bg-surface rounded-3xl p-5 mb-3">
                <p class="text-xs text-muted font-semibold uppercase tracking-wider mb-4">
                  Macros
                </p>
                <div class="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p class="text-2xl font-extrabold num" style="color: rgb(var(--primary));">
                      {{ preview().proteinG }}
                    </p>
                    <p class="text-xs text-muted font-semibold mt-1">PROTEIN · g</p>
                  </div>
                  <div>
                    <p class="text-2xl font-extrabold num" style="color: rgb(var(--accent));">
                      {{ preview().carbsG }}
                    </p>
                    <p class="text-xs text-muted font-semibold mt-1">CARBS · g</p>
                  </div>
                  <div>
                    <p class="text-2xl font-extrabold num" style="color: rgb(var(--warning));">
                      {{ preview().fatsG }}
                    </p>
                    <p class="text-xs text-muted font-semibold mt-1">FATS · g</p>
                  </div>
                </div>
                <p class="text-xs text-subtle mt-4 num text-center">
                  Fiber goal {{ preview().fiberG }}g · 1g protein = 4 kcal, 1g fat = 9 kcal
                </p>
              </div>

              <!-- Water -->
              <div class="bg-surface rounded-3xl p-5 mb-3 flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-2xl grid place-items-center"
                  style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
                >
                  <app-icon name="droplet" [size]="22" />
                </div>
                <div class="flex-1">
                  <p class="text-xs text-muted font-semibold uppercase tracking-wider">Water baseline</p>
                  <p class="text-xl font-bold num mt-0.5">
                    {{ (preview().waterMl / 1000).toFixed(1) }}
                    <span class="text-sm text-muted font-medium">L / day</span>
                  </p>
                </div>
                <p class="text-xs text-subtle">+500ml<br/>on workout days</p>
              </div>
            </div>
          }
        }
      </main>

      <footer class="px-5 pb-6 pt-2">
        @if (errorMsg()) {
          <p class="text-sm text-center mb-3" style="color: rgb(var(--danger));">
            {{ errorMsg() }}
          </p>
        }

        <button
          type="button"
          class="btn-primary w-full flex items-center justify-center gap-2"
          [disabled]="!canAdvance() || saving()"
          (click)="next()"
        >
          @if (saving()) {
            <span>Saving…</span>
          } @else if (step() < totalSteps) {
            <span>Continue</span>
            <app-icon name="chevron_right" [size]="18" />
          } @else {
            <app-icon name="check" [size]="18" />
            <span>Finish setup</span>
          }
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .input-field {
      width: 100%;
      background: rgb(var(--elevated));
      color: rgb(var(--text));
      border: 1px solid rgb(var(--border));
      border-radius: 1rem;
      padding: 0.875rem 1rem;
      font-size: 1rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-field:focus {
      border-color: rgb(var(--primary));
      box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
    }
    .input-field::placeholder { color: rgb(var(--subtle)); font-weight: 500; }

    .option-pill {
      padding: 0.875rem 0.5rem;
      background: rgb(var(--elevated));
      border: 1px solid rgb(var(--border));
      border-radius: 1rem;
      color: rgb(var(--text));
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.15s;
    }
    .option-pill--active {
      background: rgb(var(--primary) / 0.12);
      border-color: rgb(var(--primary));
      color: rgb(var(--primary));
    }

    .option-row {
      width: 100%;
      display: flex;
      align-items: center;
      padding: 1rem 1.125rem;
      background: rgb(var(--elevated));
      border: 1px solid rgb(var(--border));
      border-radius: 1.25rem;
      color: rgb(var(--text));
      transition: all 0.15s;
    }
    .option-row--active {
      border-color: rgb(var(--primary));
      box-shadow: 0 0 0 1px rgb(var(--primary) / 0.4) inset;
    }
  `],
})
export default class OnboardingComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly targetsService = inject(DietTargetsService);
  private readonly calculator = inject(DietCalculatorService);
  private readonly router = inject(Router);

  protected readonly totalSteps = 6;
  protected readonly step = signal(1);
  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  /** Mutable working copy — only persisted on Finish. */
  protected draft: DraftProfile = {
    displayName: '',
    age: 0,
    gender: 'male',
    heightCm: 0,
    weightKg: 0,
    activityLevel: 'moderate',
    goal: 'muscle_gain',
  };

  protected readonly GENDERS: { value: Gender; label: string }[] = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  protected readonly ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
    { value: 'sedentary',   label: 'Sedentary',         hint: 'Desk job, little walking' },
    { value: 'light',       label: 'Lightly active',    hint: '1–3 light workouts / week' },
    { value: 'moderate',    label: 'Moderately active', hint: '3–5 workouts / week' },
    { value: 'active',      label: 'Very active',       hint: '6–7 workouts / week' },
    { value: 'very_active', label: 'Athlete',           hint: 'Daily intense training or physical job' },
  ];

  protected readonly GOAL_OPTIONS: { value: FitnessGoal; label: string; hint: string; emoji: string }[] = [
    { value: 'fat_loss',    label: 'Fat loss',     hint: 'Lose fat, keep muscle',               emoji: '🔥' },
    { value: 'muscle_gain', label: 'Build muscle', hint: 'Recomposition with a small surplus', emoji: '💪' },
    { value: 'weight_gain', label: 'Gain weight',  hint: 'Aggressive surplus for size',         emoji: '🍚' },
    { value: 'maintenance', label: 'Maintain',     hint: 'Stay where you are, feel better',     emoji: '⚖️' },
  ];

  /** Required fields for the current step. */
  protected readonly canAdvance = computed(() => {
    switch (this.step()) {
      case 1: return this.draft.displayName.trim().length > 0;
      case 2: return this.draft.age >= 13 && this.draft.age <= 100 && !!this.draft.gender;
      case 3: return this.draft.heightCm >= 100 && this.draft.heightCm <= 250
                 && this.draft.weightKg >= 30 && this.draft.weightKg <= 250;
      case 4: return !!this.draft.activityLevel;
      case 5: return !!this.draft.goal;
      case 6: return true;
      default: return false;
    }
  });

  /** Live calculator preview shown on the review step. */
  protected readonly preview = computed(() => {
    // Build a synthetic Profile from the draft (without saving) so we can
    // reuse the calculator's `fromProfile`. The id/timestamps don't matter
    // for the math.
    const synthetic: Profile = {
      id: this.auth.userId() ?? 'preview',
      displayName: this.draft.displayName,
      age: this.draft.age,
      gender: this.draft.gender,
      heightCm: this.draft.heightCm,
      weightKg: this.draft.weightKg,
      activityLevel: this.draft.activityLevel,
      goal: this.draft.goal,
      createdAt: '',
      updatedAt: '',
    };
    const t = this.calculator.fromProfile(synthetic);
    return {
      ...t,
      bmiCategory: this.calculator.bmiCategory(t.bmi),
    };
  });

  /** BMI ring fills against 40 as a sensible upper bound. */
  protected readonly bmiRingValue = computed(() => Math.min(40, this.preview().bmi));

  /** Lime if normal, amber for over/under, red for obese. */
  protected readonly bmiColorVar = computed(() => {
    const cat = this.preview().bmiCategory;
    if (cat === 'normal') return '--primary';
    if (cat === 'obese')  return '--danger';
    return '--warning';
  });

  protected goalShortLabel(): string {
    return this.GOAL_OPTIONS.find((g) => g.value === this.draft.goal)?.label ?? '';
  }

  // ---------- Navigation ----------
  protected back(): void {
    this.errorMsg.set(null);
    if (this.step() > 1) this.step.update((s) => s - 1);
  }

  protected async next(): Promise<void> {
    if (!this.canAdvance() || this.saving()) return;
    this.errorMsg.set(null);

    if (this.step() < this.totalSteps) {
      this.step.update((s) => s + 1);
      return;
    }

    await this.finish();
  }

  private async finish(): Promise<void> {
    this.saving.set(true);
    try {
      const profile = await this.profileService.save({
        displayName: this.draft.displayName.trim(),
        age: this.draft.age,
        gender: this.draft.gender,
        heightCm: this.draft.heightCm,
        weightKg: this.draft.weightKg,
        activityLevel: this.draft.activityLevel,
        goal: this.draft.goal,
      });

      // Auto-derive diet targets immediately so the dashboard shows real
      // numbers as soon as the user lands on /home. The auto-recompute
      // effect would do this on the next tick anyway, but doing it inline
      // lets us surface any error before navigating away.
      await this.targetsService.recomputeFromProfile(profile);

      await this.router.navigateByUrl('/home');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      this.errorMsg.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}

interface DraftProfile {
  displayName: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
}
