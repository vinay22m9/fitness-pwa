import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import type { DietTargets, Profile } from '@models/index';

import { DietCalculatorService } from './diet-calculator.service';
import { ProfileService } from './profile.service';

/**
 * DietTargetsService — owns the user's daily calorie + macro + hydration targets.
 *
 * Two modes:
 *   auto    — derived from the user's Profile via DietCalculatorService.
 *             Re-derived whenever the profile changes (weight, goal, activity).
 *   custom  — manual numbers the user typed in. Profile changes do NOT
 *             overwrite custom targets (we respect the user's intent).
 *
 * Storage:
 *   - Local: Dexie `dietTargets` table, PK = userId (one row per user).
 *   - Remote: Supabase `diet_targets`, synced via outbox.
 *
 * Reactivity:
 *   - `targets` signal — current row from Dexie via liveQuery.
 *   - An effect watches `profileService.profile()`. If profile changes AND
 *     mode is 'auto' AND derived numbers differ from current row, re-derive
 *     and save. This is the link between Module 4's two halves: edit profile
 *     → diet automatically recomputes.
 */
@Injectable({ providedIn: 'root' })
export class DietTargetsService {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly calculator = inject(DietCalculatorService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);

  private readonly _targets = signal<DietTargets | null>(null);
  private readonly _loaded = signal(false);

  readonly targets = this._targets.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /** Whether the current row was auto-derived. */
  readonly isAuto = computed(() => this._targets()?.mode === 'auto');

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Bind the Dexie liveQuery to the signed-in user.
    effect(() => {
      const userId = this.auth.userId();
      this.bindToUser(userId);
    });

    // Auto-recompute when the profile changes (and we're in auto mode).
    effect(() => {
      const profile = this.profileService.profile();
      const targets = this._targets();
      if (!profile || !this._loaded()) return;

      // Don't overwrite custom targets — they're the user's explicit choice.
      if (targets?.mode === 'custom') return;

      // First-time derivation: no targets row yet but profile is complete.
      if (!targets && this.profileService.hasCompletedOnboarding()) {
        void this.recomputeFromProfile(profile);
        return;
      }

      // Subsequent derivations: only if a calculator input actually changed.
      // Compare derived numbers against current row to skip no-op writes.
      if (targets && this.profileService.hasCompletedOnboarding()) {
        const fresh = this.calculator.fromProfile(profile);
        if (
          fresh.targetKcal !== targets.targetKcal ||
          fresh.proteinG !== targets.proteinG ||
          fresh.carbsG !== targets.carbsG ||
          fresh.fatsG !== targets.fatsG ||
          fresh.waterMl !== targets.waterMl ||
          fresh.bmi !== targets.bmi
        ) {
          void this.recomputeFromProfile(profile);
        }
      }
    });

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
    });
  }

  /**
   * Re-derive targets from the current profile and persist (auto mode).
   * Idempotent — safe to call repeatedly.
   */
  async recomputeFromProfile(profile: Profile): Promise<DietTargets> {
    const derived = this.calculator.fromProfile(profile);
    const next: DietTargets = {
      ...derived,
      updatedAt: new Date().toISOString(),
    };
    await this.persist(next);
    return next;
  }

  /**
   * Save custom targets. Mode is forced to 'custom' so the auto-recompute
   * effect leaves these numbers alone.
   *
   * BMI and maintenanceKcal are recomputed from the profile — they're
   * informational display values unrelated to the user's macro choices.
   */
  async saveCustom(partial: CustomTargetsInput): Promise<DietTargets> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot save targets: not signed in');

    const profile = this.profileService.profile();
    const current = this._targets();

    const bmi = profile
      ? this.calculator.bmi(profile.weightKg, profile.heightCm)
      : current?.bmi ?? 0;

    const maintenanceKcal = profile
      ? this.calculator.tdee(
          this.calculator.bmr(profile.weightKg, profile.heightCm, profile.age, profile.gender),
          profile.activityLevel,
        )
      : current?.maintenanceKcal ?? 0;

    const now = new Date().toISOString();
    const next: DietTargets = {
      userId,
      mode: 'custom',
      bmi,
      maintenanceKcal,
      targetKcal: partial.targetKcal,
      proteinG: partial.proteinG,
      carbsG: partial.carbsG,
      fatsG: partial.fatsG,
      fiberG: partial.fiberG ?? current?.fiberG ?? 25,
      waterMl: partial.waterMl ?? current?.waterMl ?? 2500,
      workoutDayBonusMl: current?.workoutDayBonusMl ?? 500,
      computedAt: now,
      updatedAt: now,
    };

    await this.persist(next);
    return next;
  }

  /** Switch back to auto mode — re-derives from the current profile. */
  async switchToAuto(): Promise<DietTargets | null> {
    const profile = this.profileService.profile();
    if (!profile) return null;
    return this.recomputeFromProfile(profile);
  }

  private async persist(targets: DietTargets): Promise<void> {
    await db.dietTargets.put(targets);
    await this.outbox.enqueue('dietTargets', 'upsert', targets.userId, targets);
    this.sync.triggerSync();
  }

  private bindToUser(userId: string | null): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._targets.set(null);
      this._loaded.set(false);
      return;
    }

    const observable = liveQuery(() => db.dietTargets.get(userId));
    this.subscription = observable.subscribe({
      next: (row) => {
        this._targets.set(row ?? null);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[DietTargetsService] liveQuery error', err);
        this._targets.set(null);
        this._loaded.set(true);
      },
    });
  }
}

export interface CustomTargetsInput {
  targetKcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG?: number;
  waterMl?: number;
}
