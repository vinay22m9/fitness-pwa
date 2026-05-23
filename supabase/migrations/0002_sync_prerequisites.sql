-- ============================================================
-- Module 3 (Sync Engine) prerequisites
-- ============================================================
-- meal_logs needs a unique constraint on (user_id, date, meal_id) so
-- the client can upsert-by-composite-key without round-tripping a
-- server-issued UUID. This mirrors what hydration_logs and weight_logs
-- already have for their natural keys.
-- ============================================================

alter table meal_logs
  add constraint meal_logs_user_date_meal_unique
  unique (user_id, date, meal_id);
