import { Injectable } from '@angular/core';
import type {
  ActivityLevel,
  DietTargets,
  FitnessGoal,
  Gender,
  Profile,
} from '@models/index';

/**
 * Diet Calculator — PURE math, zero side effects.
 *
 * All formulas live here so they can be unit-tested in isolation without
 * touching Dexie, Supabase, or signals. Other services (DietTargetsService)
 * call into this to derive numbers.
 *
 * Formulas:
 *   BMR     — Mifflin-St Jeor (the modern standard, more accurate than
 *             Harris-Benedict for adults).
 *   TDEE    — BMR × activity multiplier.
 *   target  — TDEE adjusted by goal (−500 fat loss, +300 muscle, +500 weight gain).
 *   macros  — protein-first split (g/kg by goal), fats at ~25% of kcal,
 *             carbs as the remainder. Avoids the "60% carbs by default"
 *             pitfall of naive calculators.
 *   hydration — 35 ml × kg (common rule-of-thumb baseline). The workout-day
 *             bonus is layered on by the hydration module — not here.
 */
@Injectable({ providedIn: 'root' })
export class DietCalculatorService {

  // BMR (Mifflin-St Jeor)
  bmr(weightKg: number, heightCm: number, age: number, gender: Gender): number {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    switch (gender) {
      case 'male':   return Math.round(base + 5);
      case 'female': return Math.round(base - 161);
      case 'other':  return Math.round(base - 78);
    }
  }

  tdee(bmr: number, activity: ActivityLevel): number {
    return Math.round(bmr * ACTIVITY_MULTIPLIER[activity]);
  }

  // Target kcal: TDEE + goal adjustment
  targetKcal(tdee: number, goal: FitnessGoal): number {
    return tdee + GOAL_KCAL_ADJUSTMENT[goal];
  }

  // Macros — protein-anchored split.
  //   Protein g/kg: muscle_gain 1.8, fat_loss 2.0, weight_gain 1.6, maintenance 1.4
  //   Fats: 25% of target kcal (≈ 0.8–1.0 g/kg, healthy floor)
  //   Carbs: remainder
  //   Fiber: 14 g per 1000 kcal (conservative public-health number)
  macros(targetKcal: number, weightKg: number, goal: FitnessGoal): MacroSplit {
    const proteinG = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);
    const proteinKcal = proteinG * 4;

    const fatKcal = Math.round(targetKcal * 0.25);
    const fatsG = Math.round(fatKcal / 9);

    const carbsKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
    const carbsG = Math.round(carbsKcal / 4);

    const fiberG = Math.round((targetKcal / 1000) * 14);

    return { proteinG, fatsG, carbsG, fiberG };
  }

  // BMI = kg / m² (1 decimal)
  bmi(weightKg: number, heightCm: number): number {
    if (heightCm <= 0) return 0;
    const m = heightCm / 100;
    return Math.round((weightKg / (m * m)) * 10) / 10;
  }

  /** WHO BMI categories. Display-only — no clinical recommendations. */
  bmiCategory(bmi: number): BmiCategory {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25)   return 'normal';
    if (bmi < 30)   return 'overweight';
    return 'obese';
  }

  // Hydration baseline: 35 ml × kg, rounded to nearest 100 ml
  hydrationMl(weightKg: number): number {
    const raw = weightKg * 35;
    return Math.round(raw / 100) * 100;
  }

  /**
   * Take a Profile, produce a fully-filled DietTargets (auto mode).
   * This is the one call the rest of the app should reach for.
   */
  fromProfile(profile: Profile): Omit<DietTargets, 'updatedAt'> {
    const bmrVal = this.bmr(profile.weightKg, profile.heightCm, profile.age, profile.gender);
    const tdeeVal = this.tdee(bmrVal, profile.activityLevel);
    const target = this.targetKcal(tdeeVal, profile.goal);
    const macros = this.macros(target, profile.weightKg, profile.goal);
    const bmiVal = this.bmi(profile.weightKg, profile.heightCm);
    const waterMl = this.hydrationMl(profile.weightKg);

    return {
      userId: profile.id,
      mode: 'auto',
      bmi: bmiVal,
      maintenanceKcal: tdeeVal,
      targetKcal: target,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatsG: macros.fatsG,
      fiberG: macros.fiberG,
      waterMl,
      workoutDayBonusMl: 500,
      computedAt: new Date().toISOString(),
    };
  }
}

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG: number;
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

const GOAL_KCAL_ADJUSTMENT: Record<FitnessGoal, number> = {
  fat_loss:    -500,
  muscle_gain:  300,
  weight_gain:  500,
  maintenance:  0,
};

const PROTEIN_G_PER_KG: Record<FitnessGoal, number> = {
  muscle_gain: 1.8,
  fat_loss:    2.0,
  weight_gain: 1.6,
  maintenance: 1.4,
};
