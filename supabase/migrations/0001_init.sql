-- ============================================================
-- Fitness PWA — Initial schema
-- Run in Supabase SQL Editor (Project → SQL → New query)
-- ============================================================

-- ----- Extensions -----
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- One row per auth user. Holds onboarding data + body metrics.
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  age int,
  gender text check (gender in ('male', 'female', 'other')),
  height_cm numeric,
  weight_kg numeric,
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('muscle_gain', 'fat_loss', 'weight_gain', 'maintenance')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- WORKOUT LOGS
-- One row per workout session (including 'rest' days).
-- exercises stored as JSONB for schema flexibility as routines evolve.
-- ============================================================
create table if not exists workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_key text not null check (routine_key in ('push', 'pull_legs', 'shred', 'rest')),
  date date not null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_min int,
  exercises jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists workout_logs_user_date_idx on workout_logs (user_id, date desc);

-- ============================================================
-- HYDRATION LOGS
-- One row per (user, date) — unique constraint enforces it.
-- entries is a JSONB array of {ml, at}.
-- ============================================================
create table if not exists hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  goal_ml int not null,
  total_ml int not null default 0,
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists hydration_logs_user_date_idx on hydration_logs (user_id, date desc);

-- ============================================================
-- DIET TARGETS
-- One row per user (PK = user_id). Holds either auto-calculated
-- or custom override targets.
-- ============================================================
create table if not exists diet_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null default 'auto' check (mode in ('auto', 'custom')),
  bmi numeric,
  maintenance_kcal int,
  target_kcal int,
  protein_g int,
  carbs_g int,
  fats_g int,
  fiber_g int,
  water_ml int,
  workout_day_bonus_ml int default 500,
  computed_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- MEAL PLANS
-- Reusable meal-plan templates. Can be seeded (user_id null) or
-- user-created. routine_key 'any' means it works on any day.
-- ============================================================
create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  routine_key text check (routine_key in ('push', 'pull_legs', 'shred', 'rest', 'any')),
  meals jsonb not null default '[]'::jsonb,
  is_template boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists meal_plans_user_idx on meal_plans (user_id);

-- ============================================================
-- MEAL LOGS
-- One row per (user, date, meal_id) when consumed.
-- ============================================================
create table if not exists meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_plan_id uuid references meal_plans(id) on delete set null,
  meal_id text not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  consumed boolean default true,
  consumed_at timestamptz default now(),
  custom_additions jsonb,
  created_at timestamptz default now()
);

create index if not exists meal_logs_user_date_idx on meal_logs (user_id, date desc);

-- ============================================================
-- WEIGHT LOGS
-- Flexible frequency — user logs whenever they want.
-- Unique (user_id, date) prevents duplicate same-day entries.
-- ============================================================
create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  note text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists weight_logs_user_date_idx on weight_logs (user_id, date desc);

-- ============================================================
-- ROTATION STATE
-- Tracks where the user is in their workout rotation so the app
-- can suggest (not enforce) the next routine.
-- ============================================================
create table if not exists rotation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rotation_order text[] not null default array['push', 'pull_legs', 'shred', 'push', 'pull_legs', 'shred', 'rest']::text[],
  last_completed_routine text check (last_completed_routine in ('push', 'pull_legs', 'shred', 'rest')),
  last_completed_date date,
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Every table: a user can only read/write their own rows.
-- ============================================================
alter table profiles        enable row level security;
alter table workout_logs    enable row level security;
alter table hydration_logs  enable row level security;
alter table diet_targets    enable row level security;
alter table meal_plans      enable row level security;
alter table meal_logs       enable row level security;
alter table weight_logs     enable row level security;
alter table rotation_state  enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own workout logs" on workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own hydration logs" on hydration_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own diet targets" on diet_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- meal_plans: user can read seeded templates (user_id null) or their own.
-- Only their own can be modified.
create policy "read meal plans" on meal_plans
  for select using (user_id is null or auth.uid() = user_id);
create policy "write own meal plans" on meal_plans
  for insert with check (auth.uid() = user_id);
create policy "update own meal plans" on meal_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own meal plans" on meal_plans
  for delete using (auth.uid() = user_id);

create policy "own meal logs" on meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own weight logs" on weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rotation state" on rotation_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at        before update on profiles        for each row execute function set_updated_at();
create trigger workout_logs_updated_at    before update on workout_logs    for each row execute function set_updated_at();
create trigger hydration_logs_updated_at  before update on hydration_logs  for each row execute function set_updated_at();
create trigger diet_targets_updated_at    before update on diet_targets    for each row execute function set_updated_at();
create trigger meal_plans_updated_at      before update on meal_plans      for each row execute function set_updated_at();
create trigger rotation_state_updated_at  before update on rotation_state  for each row execute function set_updated_at();
