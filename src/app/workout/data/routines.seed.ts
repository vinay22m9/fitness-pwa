/**
 * Routine seed data — verbatim from the user's 3_Workout_routines.txt.
 *
 * These are the DEFAULT routines used by the app until/unless the user
 * customises them. Each exercise has stable IDs (kebab-cased name) so
 * baseline lookups across sessions work even if the routine is later edited.
 *
 * The data here intentionally lives in code (not Dexie) for MVP because:
 *   - It's small (~30 exercises total)
 *   - It doesn't change across users
 *   - Shipping it in the bundle means it works offline from first install
 *   - Future "edit routine" feature can copy this seed into Dexie on first edit
 */

import type { Routine } from '@models/workout.model';

export const PUSH_ROUTINE: Routine = {
  key: 'push',
  title: 'PUSH Workout',
  focus: 'Chest, Shoulders, Triceps',
  emoji: '💪',
  estimatedMin: 45,
  warmup: ['Arm circles', 'Neck rotations', '20 jumping jacks'],
  exercises: [
    {
      id: 'decline-pushups',
      name: 'Decline Pushups',
      sets: 4,
      reps: '15-20',
      restSec: 60,
      notes: 'Feet elevated on sofa',
      equipment: ['bodyweight', 'sofa'],
      difficulty: 'medium',
    },
    {
      id: 'db-overhead-press',
      name: 'Dumbbell Overhead Press',
      sets: 4,
      reps: '15',
      weightKg: 5,
      restSec: 60,
      notes: 'Seated',
      equipment: ['dumbbells'],
      difficulty: 'medium',
    },
    {
      id: 'db-lateral-raises',
      name: 'Dumbbell Lateral Raises',
      sets: 4,
      reps: '20',
      weightKg: 3,
      restSec: 45,
      notes: 'Hold 1 sec at top',
      equipment: ['dumbbells'],
      difficulty: 'medium',
    },
    {
      id: 'chair-dips',
      name: 'Chair Dips',
      sets: 3,
      reps: '15',
      restSec: 45,
      equipment: ['bodyweight', 'chair'],
      difficulty: 'medium',
    },
    {
      id: 'diamond-pushups',
      name: 'Diamond Pushups',
      sets: 3,
      reps: 'Max',
      restSec: 60,
      equipment: ['bodyweight'],
      difficulty: 'hard',
    },
  ],
  cooldown: ['Chest stretch (hold 30 sec)'],
};

export const PULL_LEGS_ROUTINE: Routine = {
  key: 'pull_legs',
  title: 'PULL & LEGS Workout',
  focus: 'Back, Biceps, Quads',
  emoji: '🦵',
  estimatedMin: 50,
  warmup: ['Hip rotations', 'Cat-cow stretch'],
  exercises: [
    {
      id: 'wide-pullups',
      name: 'Wide-Grip Pull-ups',
      sets: 4,
      reps: 'Max',
      restSec: 90,
      notes: 'Push for +1 rep each week',
      equipment: ['pullup_bar'],
      difficulty: 'hard',
    },
    {
      id: 'db-rows',
      name: 'Dumbbell Rows',
      sets: 4,
      reps: '15 per arm',
      weightKg: 5,
      restSec: 60,
      equipment: ['dumbbells'],
      difficulty: 'medium',
    },
    {
      id: 'db-squats',
      name: 'Dumbbell Squats',
      sets: 4,
      reps: '25',
      weightKg: 5,
      restSec: 75,
      equipment: ['dumbbells'],
      difficulty: 'medium',
    },
    {
      id: 'db-lunges',
      name: 'Dumbbell Lunges',
      sets: 3,
      reps: '12 per leg',
      weightKg: 5,
      restSec: 60,
      equipment: ['dumbbells'],
      difficulty: 'medium',
    },
    {
      id: 'db-bicep-curls',
      name: 'Dumbbell Bicep Curls',
      sets: 3,
      reps: '15',
      weightKg: 5,
      restSec: 45,
      equipment: ['dumbbells'],
      difficulty: 'easy',
    },
  ],
  cooldown: ['Child\u2019s pose', 'Hamstring stretch'],
};

export const SHRED_ROUTINE: Routine = {
  key: 'shred',
  title: 'SHRED Workout',
  focus: 'Core & Cardio',
  emoji: '🔥',
  estimatedMin: 30,
  warmup: ['Light jog in place — 60 sec', 'Torso twists'],
  exercises: [
    {
      id: 'hanging-leg-raises',
      name: 'Hanging Leg Raises',
      sets: 4,
      reps: '10-12',
      restSec: 60,
      equipment: ['pullup_bar'],
      difficulty: 'hard',
    },
    {
      id: 'mountain-climbers',
      name: 'Mountain Climbers',
      sets: 3,
      reps: '40 sec',
      restSec: 60,
      equipment: ['bodyweight'],
      difficulty: 'medium',
    },
    {
      id: 'russian-twists',
      name: 'Russian Twists (Weighted)',
      sets: 3,
      reps: '20',
      weightKg: 5,
      restSec: 45,
      equipment: ['dumbbells', 'bodyweight'],
      difficulty: 'medium',
    },
    {
      id: 'plank-shoulder-taps',
      name: 'Plank with Shoulder Taps',
      sets: 3,
      reps: '20 taps',
      restSec: 45,
      equipment: ['bodyweight'],
      difficulty: 'medium',
    },
    {
      id: 'burpees',
      name: 'Burpees',
      sets: 3,
      reps: '10',
      restSec: 60,
      equipment: ['bodyweight'],
      difficulty: 'hard',
    },
  ],
  cooldown: ['Deep breathing — 1 min', 'Full-body stretch'],
};

export const ROUTINES: Record<'push' | 'pull_legs' | 'shred', Routine> = {
  push: PUSH_ROUTINE,
  pull_legs: PULL_LEGS_ROUTINE,
  shred: SHRED_ROUTINE,
};
