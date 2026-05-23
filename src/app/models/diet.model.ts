/**
 * Diet domain models.
 *
 * - Macros can be 'auto' (Mifflin-St Jeor + TDEE + goal) or 'custom'
 *   (user has manually overridden the numbers).
 * - Meal plans are templates of meals; meal logs track which meals
 *   the user actually consumed today.
 */

import type { DayChoice } from './workout.model';

export type DietMode = 'auto' | 'custom';

export interface DietTargets {
  userId: string;
  mode: DietMode;

  // Computed reference (always stored so UI can show "your BMI is X")
  bmi: number;

  maintenanceKcal: number;   // pure TDEE
  targetKcal: number;        // TDEE adjusted by goal

  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG: number;

  waterMl: number;           // baseline daily goal
  workoutDayBonusMl: number; // added on workout days (default 500)

  computedAt: string;
  updatedAt: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface MealItem {
  name: string;
  qty?: string;              // human-readable e.g. "3 idlis", "100g chicken"
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG?: number;
}

export interface Meal {
  id: string;
  slot: MealSlot;
  title: string;             // "Eggs + Oats"
  timeHint?: string;         // "10 AM" — display only
  items: MealItem[];
  // Cached sums (computed at template creation time)
  totalKcal: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatsG: number;
  totalFiberG?: number;
}

/**
 * A reusable meal-plan template. A plan can be tagged to a routine
 * (push/pull_legs/shred/rest) or 'any' for general days.
 */
export interface MealPlan {
  id: string;
  userId?: string;           // undefined for seeded templates
  name: string;              // "Push Day Plan"
  description?: string;
  routineKey: DayChoice | 'any';
  meals: Meal[];
  isTemplate: boolean;       // true for seeded; false for user-created
  createdAt: string;
  updatedAt: string;
}

/**
 * One meal-log entry per (user, date, mealId).
 * `consumed` flips when user taps "Mark Consumed".
 */
export interface MealLog {
  id: string;                // `${userId}_${date}_${mealId}`
  userId: string;
  date: string;              // YYYY-MM-DD
  mealPlanId: string;
  mealId: string;
  mealSlot: MealSlot;
  consumed: boolean;
  consumedAt?: string;
  customAdditions?: MealItem[];  // future quick-add support
  syncedAt?: string;
}
