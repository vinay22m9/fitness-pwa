-- ============================================================
-- Module 5 — Workout module
-- Adds: status column on workout_logs for in-progress / completed / abandoned
-- Run this in Supabase SQL Editor after 0001_init.sql
-- ============================================================

-- workout_logs.status (optional; locally we treat undefined as 'completed')
alter table workout_logs
  add column if not exists status text
  check (status in ('in_progress', 'completed', 'abandoned'))
  default 'completed';

-- Index for filtering completed sessions when computing stats / baselines
create index if not exists workout_logs_user_status_idx
  on workout_logs (user_id, status);
