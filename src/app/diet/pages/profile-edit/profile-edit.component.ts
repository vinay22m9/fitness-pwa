import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { IconComponent } from '@shared/components/icon/icon.component';
import type { ActivityLevel, FitnessGoal, Gender } from '@models/index';

import { ProfileService } from '@diet/services/profile.service';

/**
 * Profile edit screen.
 *
 * Single scrollable form (not the multi-step wizard onboarding uses) — the
 * user is already familiar with their data and just wants to tweak one thing.
 * Saving triggers the DietTargetsService auto-recompute effect, so changing
 * weight here ripples into the diet page automatically.
 */
@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter min-h-screen flex flex-col">

      <header class="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          type="button"
          class="w-9 h-9 rounded-xl bg-elevated grid place-items-center text-muted hover:text-text"
          (click)="back()"
          aria-label="Back"
        >
          <app-icon name="chevron_left" [size]="20" />
        </button>
        <h1 class="text-xl font-extrabold tracking-tight">Edit profile</h1>
      </header>

      <main class="flex-1 px-5 pt-2 pb-8 space-y-5">

        <div>
          <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Name
          </label>
          <input
            type="text"
            [(ngModel)]="form.displayName"
            name="displayName"
            class="input-field"
            placeholder="Your name"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-1">
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Age
            </label>
            <input
              type="number"
              inputmode="numeric"
              [(ngModel)]="form.age"
              name="age"
              min="13"
              max="100"
              class="input-field"
            />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Gender
            </label>
            <div class="grid grid-cols-3 gap-2">
              @for (g of GENDERS; track g.value) {
                <button
                  type="button"
                  class="option-pill"
                  [class.option-pill--active]="form.gender === g.value"
                  (click)="form.gender = g.value"
                >
                  {{ g.label }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Height (cm)
            </label>
            <input
              type="number"
              inputmode="decimal"
              [(ngModel)]="form.heightCm"
              name="height"
              min="100"
              max="250"
              class="input-field"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Weight (kg)
            </label>
            <input
              type="number"
              inputmode="decimal"
              [(ngModel)]="form.weightKg"
              name="weight"
              min="30"
              max="250"
              step="0.1"
              class="input-field"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Activity level
          </label>
          <div class="space-y-2">
            @for (a of ACTIVITY_OPTIONS; track a.value) {
              <button
                type="button"
                class="option-row"
                [class.option-row--active]="form.activityLevel === a.value"
                (click)="form.activityLevel = a.value"
              >
                <div class="flex-1 text-left">
                  <p class="font-bold text-sm">{{ a.label }}</p>
                  <p class="text-xs text-muted mt-0.5">{{ a.hint }}</p>
                </div>
                @if (form.activityLevel === a.value) {
                  <div
                    class="w-5 h-5 rounded-full grid place-items-center"
                    style="background: rgb(var(--primary)); color: rgb(var(--bg));"
                  >
                    <app-icon name="check" [size]="12" />
                  </div>
                }
              </button>
            }
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Goal
          </label>
          <div class="grid grid-cols-2 gap-2">
            @for (g of GOAL_OPTIONS; track g.value) {
              <button
                type="button"
                class="goal-tile"
                [class.goal-tile--active]="form.goal === g.value"
                (click)="form.goal = g.value"
              >
                <span class="text-2xl">{{ g.emoji }}</span>
                <p class="text-sm font-bold mt-2">{{ g.label }}</p>
              </button>
            }
          </div>
        </div>

      </main>

      <footer class="px-5 pb-6 pt-2">
        @if (errorMsg()) {
          <p class="text-sm text-center mb-3" style="color: rgb(var(--danger));">
            {{ errorMsg() }}
          </p>
        }
        @if (savedMsg()) {
          <p class="text-sm text-center mb-3" style="color: rgb(var(--primary));">
            {{ savedMsg() }}
          </p>
        }
        <button
          type="button"
          class="btn-primary w-full flex items-center justify-center gap-2"
          [disabled]="!isValid() || !isDirty() || saving()"
          (click)="save()"
        >
          @if (saving()) {
            <span>Saving…</span>
          } @else {
            <app-icon name="check" [size]="18" />
            <span>Save changes</span>
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
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-field:focus {
      border-color: rgb(var(--primary));
      box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
    }

    .option-pill {
      padding: 0.75rem 0.5rem;
      background: rgb(var(--elevated));
      border: 1px solid rgb(var(--border));
      border-radius: 1rem;
      color: rgb(var(--text));
      font-weight: 600;
      font-size: 0.85rem;
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
      padding: 0.875rem 1rem;
      background: rgb(var(--elevated));
      border: 1px solid rgb(var(--border));
      border-radius: 1rem;
      color: rgb(var(--text));
    }
    .option-row--active {
      border-color: rgb(var(--primary));
      box-shadow: 0 0 0 1px rgb(var(--primary) / 0.4) inset;
    }

    .goal-tile {
      padding: 1rem 0.75rem;
      background: rgb(var(--elevated));
      border: 1px solid rgb(var(--border));
      border-radius: 1.25rem;
      color: rgb(var(--text));
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: all 0.15s;
    }
    .goal-tile--active {
      background: rgb(var(--primary) / 0.08);
      border-color: rgb(var(--primary));
    }
  `],
})
export default class ProfileEditComponent {
  private readonly profileService = inject(ProfileService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly savedMsg = signal<string | null>(null);

  protected form: EditableProfile = {
    displayName: '',
    age: 0,
    gender: 'male',
    heightCm: 0,
    weightKg: 0,
    activityLevel: 'moderate',
    goal: 'muscle_gain',
  };

  /** Snapshot we compare against to detect dirty state. */
  private snapshot = signal<EditableProfile | null>(null);

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

  protected readonly GOAL_OPTIONS: { value: FitnessGoal; label: string; emoji: string }[] = [
    { value: 'fat_loss',    label: 'Fat loss',     emoji: '🔥' },
    { value: 'muscle_gain', label: 'Build muscle', emoji: '💪' },
    { value: 'weight_gain', label: 'Gain weight',  emoji: '🍚' },
    { value: 'maintenance', label: 'Maintain',     emoji: '⚖️' },
  ];

  constructor() {
    // Hydrate the form from the loaded profile. We watch the signal so a
    // fresh pull (e.g. cross-device sync) refreshes the form fields — but
    // only if the user hasn't started editing yet.
    effect(() => {
      const p = this.profileService.profile();
      if (!p) return;
      const snap: EditableProfile = {
        displayName: p.displayName ?? '',
        age: p.age,
        gender: p.gender,
        heightCm: p.heightCm,
        weightKg: p.weightKg,
        activityLevel: p.activityLevel,
        goal: p.goal,
      };
      // Only overwrite the form if user hasn't started editing.
      const current = this.snapshot();
      if (!current || this.formMatches(current)) {
        this.form = { ...snap };
        this.snapshot.set(snap);
      }
    });
  }

  protected readonly isValid = computed(() => {
    return (
      this.form.displayName.trim().length > 0 &&
      this.form.age >= 13 && this.form.age <= 100 &&
      this.form.heightCm >= 100 && this.form.heightCm <= 250 &&
      this.form.weightKg >= 30 && this.form.weightKg <= 250 &&
      !!this.form.gender &&
      !!this.form.activityLevel &&
      !!this.form.goal
    );
  });

  protected isDirty(): boolean {
    const snap = this.snapshot();
    if (!snap) return false;
    return !this.formMatches(snap);
  }

  private formMatches(snap: EditableProfile): boolean {
    return (
      this.form.displayName.trim() === snap.displayName.trim() &&
      this.form.age === snap.age &&
      this.form.gender === snap.gender &&
      this.form.heightCm === snap.heightCm &&
      this.form.weightKg === snap.weightKg &&
      this.form.activityLevel === snap.activityLevel &&
      this.form.goal === snap.goal
    );
  }

  protected back(): void {
    this.location.back();
  }

  protected async save(): Promise<void> {
    if (!this.isValid() || !this.isDirty() || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    this.savedMsg.set(null);

    try {
      await this.profileService.save({
        displayName: this.form.displayName.trim(),
        age: this.form.age,
        gender: this.form.gender,
        heightCm: this.form.heightCm,
        weightKg: this.form.weightKg,
        activityLevel: this.form.activityLevel,
        goal: this.form.goal,
      });
      this.snapshot.set({ ...this.form });
      this.savedMsg.set('Saved');
      // Brief confirmation, then drift back to the diet page.
      setTimeout(() => this.router.navigateByUrl('/diet'), 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      this.errorMsg.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}

interface EditableProfile {
  displayName: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
}
