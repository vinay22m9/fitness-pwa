export type Gender = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'      // little/no exercise — desk job
  | 'light'          // 1–3 workouts/week
  | 'moderate'       // 3–5 workouts/week
  | 'active'         // 6–7 workouts/week
  | 'very_active';   // intense daily training / physical job

export type FitnessGoal =
  | 'muscle_gain'
  | 'fat_loss'
  | 'weight_gain'
  | 'maintenance';

export interface Profile {
  id: string;                 // matches supabase auth.user.id
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  createdAt: string;
  updatedAt: string;
}
