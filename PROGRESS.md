# Fitness PWA — Project Progress

Single source of truth for module status, locked decisions, and next-up work.
**Update this file at the end of each module.**

---

## ✅ Modules Completed

### Module 1 — Foundation
- Angular 19 standalone scaffold, Tailwind 3, PWA service worker
- Dark-only theme via CSS variables; lime / cyan / electric blue palette on `#0B0F14`
- Floating bottom nav (5 tabs); Settings via top-right avatar
- Full Dexie schema (v1, 9 tables) — see `src/app/core/db/app.db.ts`
- All domain models defined under `src/app/models/`
- Path aliases: `@core`, `@shared`, `@models`, `@auth`, `@diet`, `@workout`, `@env`

### Module 2 — Auth
- Email + password (no Google OAuth)
- `AuthService` with signals: `user`, `session`, `isAuthed`, `isReady`, `userId`, `email`
- `authGuard` + `guestGuard`
- Pages: login, signup, verify (for email-confirmation flow)
- Session restores on app boot

### Module 3 — Sync Engine
- Outbox pattern (`OutboxService`)
- `SyncService` drains outbox on online + every 60s
- 8 entity handlers: profile, workoutLog, hydrationLog, dietTargets, mealPlan, mealLog, weightLog, rotationState
- Last-write-wins via `updated_at`
- Pull-on-login pulls all server data into Dexie

### Module 4 — Profile + Diet Calculator
- `ProfileService`, `DietTargetsService`, `DietCalculatorService`
- Mifflin-St Jeor BMR + activity multiplier TDEE + goal-adjusted target
- Macro split: 2.0 / 2.2 / 1.6 / 1.8 g/kg protein by goal, 25–30 % fats, rest carbs
- Water = 35 ml/kg baseline + 500 ml workout-day bonus
- Two modes: `auto` (recomputes on profile change) or `custom` (manual override stays put)
- Pages: onboarding (6 steps), diet-overview, profile-edit, custom-macros
- `onboardingGuard` blocks main app until profile is complete

### Module 5 — Workout
- All 3 routines seeded from `3_Workout_routines.txt` in `src/app/workout/data/routines.seed.ts`
- `RoutineService` — catalog access
- `RoutineScheduleService` — suggests today's routine via rotation + rolling 7-day rule
- `WorkoutService` — session lifecycle, auto-save (300 ms debounce), recovery on app reopen
- `BaselineService` — last-session reps/weight per exercise for prefill hints
- Pages: workout-list, workout-active (gym-optimised, tap-to-complete), workout-history
- Rest day: one-tap log, advances rotation
- Dashboard hero card wired to real schedule
- `WorkoutLog.status` field added (`in_progress` / `completed` / `abandoned`)
- Migration `0002_workout_status.sql` adds the column server-side

### Module 6 — Hydration
- `HydrationService` — facade over Dexie + outbox; signals for `totalMl`, `entries`, `goalMl`, `progressPct`, `remainingMl`, `goalReached`, `isWorkoutDay`, `lastEntry`
- Daily reset via `msUntilLocalMidnight()` setTimeout that re-schedules itself; bumps `_today` signal which rebinds the liveQuery to the new day's row
- Quick-add buttons: +250 / +500 / +750 / +1000 ml
- Per-entry delete + "Undo last" CTA + "Start over" reset
- Workout-day bonus auto-applied: reads `RoutineScheduleService.todayLog()` reactively — when a workout is started/completed mid-day, the goal silently bumps up by `workoutDayBonusMl` (default 500), and the new snapshot is stamped onto the row via a self-stabilising effect
- Hero progress ring on the page (200×14 stroke, electric-blue) re-using `ProgressRingComponent`
- Dashboard water card now reads real `totalMl / goalMl` and links to `/hydration`
- `@hydration/*` path alias added to `tsconfig.json` (was missing)
- New icons added: `trash`, `minus`, `undo`

### Module 7 — Nutrition tracking + Dashboard wire-up
Scope expanded mid-module: the dashboard couldn't be wired without first
building the missing meal-plan / meal-log feature. Treated as foundational
infrastructure rather than dashboard polish.

- **Meal-plan seed** — `src/app/diet/data/meal-plans.seed.ts` contains 7 templates (one per weekday) seeded verbatim from `personal_diet__plan.txt`. Husband portions only per the locked decision. Each meal has stable `seed_<day>_<slot>` IDs, item-level macros, and cached `totalKcal/P/C/F/Fiber` sums. Weekday→plan mapping mirrors the source doc exactly (Fri=Chicken, Sat=Veg/Egg, Sun=Mutton, Mon=Light Veg, Tue=High Fiber, Wed=Chicken, Thu=Fish).
- **`MealPlanService`** — resolves `todayPlan` reactively. Resolution order: user custom plans matching today's routine → weekday-mapped seed template (always falls through to a non-null plan). `planSource` signal returns `'template' | 'custom' | 'ai'` for the UI chip. `setCurrentRoutine()` lets the dashboard / diet page push routine context in without a circular import on `RoutineScheduleService`.
- **`MealLogService`** — Dexie liveQuery scoped to `userId + date`, midnight reset via the same `msUntilLocalMidnight()` pattern as hydration. Three-state per-meal status: `consumed` / `skipped` / `pending` (no row). Quick-add rows live in the same table with synthetic `quick_<uuid>` mealIds and macros on `customAdditions`. The aggregator pulls totals from both sources transparently. Mutations: `markConsumed`, `markSkipped`, `undo`, `quickAdd`, `removeQuickAdd`, `clearToday`. Old `toggleConsumed` retained as deprecated for safety.
- **`MealLog.skipped` field** added to the model. Server migration `0003_meal_log_skipped.sql` adds the column.
- **Diet page UI (refined)** — *Plan-focused, not accounting-focused.* Layout: tiny one-line progress strip ("95g / 140g P · 1450 / 2100 kcal · N logged") → plan name + description → meal cards → quick-add → collapsible "Plan details" disclosure. Pending meals show a big lime "Eat" CTA and a `⋯` overflow that expands to show items + a "Skip this meal" action. Consumed and skipped meals collapse into a single subtle row with an "Undo" affordance. Snacks render slightly smaller (h-9 badge vs h-11, smaller typography) to de-emphasise without hiding. Quick-add panel: text-name input + 4 kcal preset chips (100/200/300/500 — no manual number-pad typing). No calorie hero card, no macro bars on this page — those belong on the dashboard.
- **Dashboard wired** — calorie card and macro bars read `consumedKcal / consumedProteinG / ...` from `MealLogService.aggregate(MealPlanService.todayPlan())`. Calorie bar flips to amber when over target. Cards link to `/diet`.
- **Architecture** — extensible for AI / custom plans / grocery / analytics: `MealPlanService.todayPlan` is a signal already considering user-owned plans first; `aggregate()` takes any plan, not a hardcoded one; quick-add slot is preserved on `MealLog.mealSlot` for future grouping by time of day. MVP path stays lightweight: template-driven, no food DB, no manual macro entry, presets only.

### Module 8 — Progress (Weight + Trends + Streaks)

- **`WeightLogService`** — facade over weight history. Signals: `logs`, `latestKg`, `latestDate`, `daysSinceLatest`, `todayLog`. Method: `log({ weightKg, date?, note? })` returns `{ weightChanged, targetsWillRecompute, becomesLatest }` so the UI can fire the right toast accurately. Calls `profileService.updateWeight()` when the new entry becomes the latest, which cascades into `DietTargetsService`'s auto-mode recompute. **MVP storage decision (locked):** one entry per (user, date) — same-day re-log overwrites. Honours the existing server `unique (user_id, date)` constraint. Multi-per-day deferred until users actually need it; `note` field handles "morning"/"post-workout" hints.
- **`ProgressStatsService`** — derives streaks + cadence + per-session volume from a 90-day window of workout logs (RoutineScheduleService only loads 14 days, so this needs its own liveQuery). Signals: `currentStreak`, `sessionsByWeek` (8 weeks), `sessionVolumes` (last 30), `totalWorkouts`, `totalMinutes`, `thisWeekCount`, `preferredVolumeMetric`. **Streak definition (locked):** any logged workout day counts, INCLUDING rest days; abandoned sessions don't; today-with-no-log-yet doesn't break the streak.
- **Hybrid volume math** — every session log carries BOTH `weightedVolumeKg` (sets×reps×weight for weighted exercises) AND `bodyweightScore` (intensity-weighted sets×reps for bodyweight). Intensity multipliers: ≤7 reps → 1.5×, 8–14 → 1.2×, ≥15 → 1.0× (rough strength/hypertrophy/endurance proxy). Per-session also exposes `completedSets`, `totalReps`, `durationMin`. The chart picks which metric to display via `preferredVolumeMetric` based on what's dominant in the user's recent 10 sessions — no fake "gym bro" numbers for bodyweight users.
- **Shared chart components** — `LineChartComponent` and `BarChartComponent` in `@shared/components/charts/`. Both are pure SVG, minimal: no gridlines, no axes, just the line/bars + optional endpoint labels. Single faint area-fill below the line. Most-recent point highlighted. Each ~120 lines. Reusable for any future trend chart.
- **`ToastService` + `ToastComponent`** — global, single-active-toast, auto-dismisses after 3.5s. Tones: success / info / warning. Mounted once in `MainShellComponent`. Used by the weight-save flow to surface "Targets updated based on latest weight" only when auto-mode targets actually recomputed.
- **Progress page** — replaces the placeholder at `/progress`. Sections: streak chip, weight card (latest + chart + inline log form), sessions-per-week bar chart, volume trend line chart, lifetime stats grid. The weight form pre-fills with the current latest weight, uses `inputmode="decimal"` for the mobile number keyboard, validates 20–400 kg range.
- **Dashboard streak chip** — small lime `🔥 N` chip in the header next to the avatar, only when `streak > 0`. Tappable; links to `/progress`. Sized as a 40-px pill matching the avatar so the header stays balanced.
- **`@progress/*` path alias** added to `tsconfig.json` to match the established feature-folder pattern.

---

## 🔜 Next Up

### Module 9 — AI Coach
- Move Gemini key to Supabase Edge Function
- Chat-style UI with context-aware prompts

### Module 10 — Polish
- Real PWA icons (currently README placeholders only)
- Install prompt
- Animations + haptics
- PostHog wired with actual key

---

## 🔐 Decisions Locked

| Topic | Choice |
|---|---|
| Theme | Dark only, no light theme |
| Palette | Lime `#A3E635` / cyan `#22D3EE` / electric blue `#3B82F6` on `#0B0F14` |
| Nav | 5-tab floating bottom nav (Home/Workout/Diet/Water/Progress); Settings via top-right avatar |
| Auth | Email + password only |
| Multi-user | No — one app instance per logged-in user |
| Routine rotation | Suggest next, allow override anytime; rolling 7-day; 6 workout / 1 rest week |
| Rest day | Explicit log button, not "didn't open app" |
| Diet model | Show plan + macros + meal-completion ticking (not food DB) |
| Diet plan source | Husband portions for logged-in user; templates editable later |
| Macros | Auto by default, custom override supported |
| Water | Auto by default, custom override; +500 ml on workout days |
| Weight tracking | Flexible frequency, raw plot in MVP, rolling avg later |
| Time zone | Device local time; daily reset at local midnight |
| Exercise progression | Show last session as baseline, no auto-suggest in MVP |
| Notifications | Architecture-ready (SW from day 1), features deferred |
| Backend | Supabase only for MVP. Edge Functions for Gemini in Module 9. No .NET. |

---

## ⚠️ Known Issues / Watch-outs

1. **`computed()` with plain-object reads silently caches.** Module 4 onboarding had this — `canAdvance = computed(() => this.draft.x)` cached `false` because `draft` isn't a signal. Fixed by converting to a method. Same trap fixed in `preview()` and `bmiColorVar()`.
2. **Angular control-flow `@else if (...; as t)` is invalid.** `as` only works on the primary `@if`. Use nested `@if` inside `@else` if needed.
3. **Standalone components need explicit `DecimalPipe`/`DatePipe` imports** to use `\| number` and `\| date`. `CommonModule` works but bloats bundle.
4. **Email-confirmation already-registered case** returns a fake user with `identities: []`. `AuthService.signUpWithPassword` detects this and shows a friendly error.
5. **`MealPlanService.setCurrentRoutine()` is called from two places** (the dashboard and the diet-overview page) via parallel `effect()`s. Both write the same value computed from `RoutineScheduleService`, so it's idempotent — but if a future page wants to *force* a different routine context (e.g. "preview plan for Push Day"), it'll race with whichever of those is mounted. If that ever happens, move the wiring into `MealPlanService`'s constructor and inject `RoutineScheduleService` there.

---

## 📦 Manual Setup Steps (Still Required)

- [ ] Supabase project created
- [ ] Migration `0001_init.sql` applied
- [ ] Migration `0002_workout_status.sql` applied (recommended, not blocking)
- [ ] Migration `0003_meal_log_skipped.sql` applied (recommended, not blocking — local schema already supports `skipped`)
- [ ] `supabaseUrl` + `supabaseAnonKey` in `src/environments/environment.ts`
- [ ] Email confirmation toggle decided (currently ON, slight friction for signup)
- [ ] PWA icons generated and placed in `public/icons/` (currently placeholder README)
- [ ] PostHog key (optional)
- [ ] Gemini API key (Module 9)

---

## 🗂 Project Structure Quick Reference

```
src/app/
├── core/             singletons, sync engine, db, guards, tokens
├── shared/           reusable components & utils
├── models/           all domain interfaces (barrel: @models/index)
├── layout/           main-shell (with bottom nav), auth-shell
├── auth/             login / signup / verify + AuthService
├── dashboard/        home screen
├── diet/             profile + targets + meal plans + meal logs (Modules 4, 7)
├── workout/          routines + sessions + history (Module 5)
├── hydration/        water tracker (Module 6)
├── progress/         weight log + streak + trends (Module 8)
└── settings/         Module 10 — placeholder
```

---

*Last updated: end of Module 8*
