-- ============================================================
-- Module 7 — Nutrition UX refinement
-- Adds: skipped column on meal_logs to distinguish "explicitly skipped"
--       from "haven't decided yet" (no row).
-- Run this in Supabase SQL Editor after 0002_*.sql migrations.
-- ============================================================

alter table meal_logs
  add column if not exists skipped boolean not null default false;

-- Optional index for future "skipped meals report" queries. Cheap to have.
create index if not exists meal_logs_user_date_skipped_idx
  on meal_logs (user_id, date, skipped);
