/**
 * Workout domain models.
 *
 * Three base routines (Push / Pull-Legs / Shred) + an explicit Rest.
 * The user can override the suggested rotation any day.
 *
 * Schema is intentionally extensible for future features (supersets, AI
 * recommendations, equipment filters, media). Fields added in MVP but not
 * yet surfaced in UI are marked with a comment.
 */

export type RoutineKey = 'push' | 'pull_legs' | 'shred';
export type DayChoice = RoutineKey | 'rest';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ExerciseTemplate {
  id: string;
  name: string;
  sets: number;
  reps: string;              // "15", "Max", "40 sec", "10-12"
  weightKg?: number;
  restSec?: number;
  notes?: string;            // e.g. "Hold 1 sec at top"

  // ---- Future-proofing fields (defined now, not yet surfaced in UI) ----
  /** Equipment tags: "dumbbells", "bodyweight", "chair", "sofa", "pullup_bar". */
  equipment?: string[];
  /** Coarse difficulty label for future filtering / AI prompting. */
  difficulty?: Difficulty;
  /**
   * Optional grouping key for supersets. Exercises in the same routine that
   * share a supersetId are performed alternating without rest until both done.
   */
  supersetId?: string;
  /** Optional URL to a demo video / GIF (later phase). */
  mediaUrl?: string;
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

  // ---- Future-proofing ----
  /**
   * Status of this log. 'in_progress' is set while the user is actively
   * doing a session and auto-save is on. When they tap Finish, it becomes
   * 'completed'. 'abandoned' is for sessions never finished after 24h.
   * Defaults to 'completed' for backwards compatibility.
   */
  status?: 'in_progress' | 'completed' | 'abandoned';
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

/**
 * Display labels for routine keys. Centralised so the UI never hardcodes
 * "Pull & Legs" etc. and so future i18n is a one-file change.
 */
export const ROUTINE_LABELS: Record<DayChoice, string> = {
  push: 'Push',
  pull_legs: 'Pull & Legs',
  shred: 'Shred',
  rest: 'Rest',
};

export const ROUTINE_FOCUS: Record<DayChoice, string> = {
  push: 'Chest, Shoulders, Triceps',
  pull_legs: 'Back, Biceps, Quads',
  shred: 'Core & Cardio',
  rest: 'Recovery day',
};

export const ROUTINE_EMOJI: Record<DayChoice, string> = {
  push: '💪',
  pull_legs: '🦵',
  shred: '🔥',
  rest: '🌿',
};
