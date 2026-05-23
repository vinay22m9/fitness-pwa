/**
 * Workout domain models.
 *
 * Three base routines (Push / Pull-Legs / Shred) + an explicit Rest.
 * The user can override the suggested rotation any day.
 */

export type RoutineKey = 'push' | 'pull_legs' | 'shred';
export type DayChoice = RoutineKey | 'rest';

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets: number;
  reps: string;              // "15", "Max", "40 sec", "10-12"
  weightKg?: number;
  restSec?: number;
  notes?: string;            // e.g. "Hold 1 sec at top"
}

export interface Routine {
  key: RoutineKey;
  title: string;             // "PUSH Workout"
  focus: string;             // "Chest, Shoulders, Triceps"
  emoji: string;             // 💪
  estimatedMin: number;
  warmup: string[];
  exercises: ExerciseTemplate[];
  cooldown: string[];
}

/** A single set log within an exercise during a session. */
export interface SetLog {
  reps?: number;
  weightKg?: number;
  durationSec?: number;
  completed: boolean;
}

export interface ExerciseLog {
  templateId: string;
  name: string;
  sets: SetLog[];
  notes?: string;
  completed: boolean;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  routineKey: DayChoice;     // 'rest' is a valid logged choice
  date: string;              // YYYY-MM-DD (local)
  startedAt?: string;        // ISO
  completedAt?: string;      // ISO
  durationMin?: number;
  exercises: ExerciseLog[];
  notes?: string;
  syncedAt?: string;
}

/**
 * Tracks where the user is in their rotation so the app can
 * SUGGEST (not enforce) the next routine.
 */
export interface RotationState {
  userId: string;
  /** Default order. User can edit later. */
  rotationOrder: DayChoice[];
  lastCompletedRoutine?: DayChoice;
  lastCompletedDate?: string;   // YYYY-MM-DD
  updatedAt: string;
}

export const DEFAULT_ROTATION_ORDER: DayChoice[] = [
  'push', 'pull_legs', 'shred', 'push', 'pull_legs', 'shred', 'rest',
];
