export interface WeightLog {
  id: string;
  userId: string;
  date: string;             // YYYY-MM-DD
  weightKg: number;
  note?: string;
  syncedAt?: string;
}

/** Pre-aggregated daily snapshot used by the dashboard. */
export interface DailySummary {
  date: string;
  workoutCompleted: boolean;
  workoutRoutine?: string;
  hydrationMl: number;
  hydrationGoalMl: number;
  caloriesConsumed: number;
  caloriesTarget: number;
  proteinConsumedG: number;
  proteinTargetG: number;
}
