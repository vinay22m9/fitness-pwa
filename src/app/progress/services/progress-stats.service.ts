import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { addDays, todayLocalISO } from '@shared/utils/date.util';
import type { ExerciseLog, WorkoutLog } from '@models/index';

/**
 * ProgressStatsService — derives streaks, weekly cadence, and per-session
 * volume from the user's workout history.
 *
 * Why a separate service (vs reusing RoutineScheduleService)?
 *   - RoutineScheduleService only loads 14 days of logs for rolling-7 check.
 *   - The Progress page needs a much wider window (90 days) for trends.
 *   - Two services keeps the schedule service tight & focused.
 *
 * Streak definition (Module 8 locked decision):
 *   - Workout streak only (no hydration/nutrition streak in MVP).
 *   - Counts any logged workout day, INCLUDING explicit rest days.
 *   - "Abandoned" sessions don't count (the user gave up).
 *   - A streak survives a single missing day ONLY if today hasn't ended;
 *     i.e. if the latest log is yesterday and today has no log yet, the
 *     streak is still alive — we just haven't broken it yet.
 *   - As soon as the calendar shows a fully-elapsed day with no log, the
 *     streak resets at the next check.
 *
 * Volume math (hybrid-friendly per Module 8 refinement):
 *   - Sessions with any weighted exercise contribute `weightedVolumeKg`.
 *   - Bodyweight-only sessions contribute `bodyweightScore` instead.
 *   - Both numbers are computed for every session — UI picks which to
 *     display based on what's dominant in the recent history.
 *
 * Reactivity:
 *   _logs    — last 90 days of workout logs, sorted asc by date
 *   _loaded  — first emission settled
 *
 *   currentStreak    — current workout-day streak in days (0 if broken)
 *   sessionsByWeek   — last 8 weeks, oldest first
 *   sessionVolumes   — last 30 completed sessions, oldest first
 *   totalWorkouts    — lifetime in window
 *   totalMinutes     — lifetime minutes in window
 *   thisWeekCount    — completed workouts (non-rest) in current ISO week
 */
@Injectable({ providedIn: 'root' })
export class ProgressStatsService {
  private readonly auth = inject(AuthService);

  private readonly _logs = signal<WorkoutLog[]>([]);
  private readonly _loaded = signal(false);

  readonly logs = this._logs.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  // ---- Streak ----------------------------------------------------------

  /**
   * Current workout-day streak. Walks backwards from today (or yesterday
   * if today isn't logged yet) and counts consecutive logged days.
   *
   * Examples (Today = Fri):
   *   logged: Mon, Tue, Wed, Thu, Fri  → 5
   *   logged: Mon, Tue, Wed, Thu       → 4 (Fri not yet logged, still alive)
   *   logged: Mon, Tue, Wed            → 0 (Thu skipped, broken)
   */
  readonly currentStreak = computed<number>(() => {
    const logs = this._logs();
    if (logs.length === 0) return 0;

    // Build a Set of dates with valid logs (non-abandoned).
    const dates = new Set<string>();
    for (const log of logs) {
      if (log.status === 'abandoned') continue;
      dates.add(log.date);
    }
    if (dates.size === 0) return 0;

    // Walk backwards from today. If today isn't logged yet, that doesn't
    // break the streak — start counting from yesterday.
    let cursor = new Date();
    const today = todayLocalISO(cursor);
    if (!dates.has(today)) {
      cursor = addDays(cursor, -1);
    }

    let streak = 0;
    while (true) {
      const iso = todayLocalISO(cursor);
      if (!dates.has(iso)) break;
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  });

  // ---- Sessions / week -------------------------------------------------

  /**
   * Last 8 ISO weeks of session counts. Each bucket = Mon-Sun, count of
   * non-rest, non-abandoned sessions in that week. Oldest first so the
   * chart reads left-to-right by time.
   */
  readonly sessionsByWeek = computed<WeekBucket[]>(() => {
    const logs = this._logs();
    const buckets: WeekBucket[] = [];

    // Find Monday of the current week, then walk back 7 weeks.
    const today = new Date();
    const monday = mondayOf(today);

    for (let w = 7; w >= 0; w--) {
      const start = addDays(monday, -7 * w);
      const end = addDays(start, 7);
      const startISO = todayLocalISO(start);
      const endISO = todayLocalISO(end);

      const count = logs.filter(
        (l) =>
          l.date >= startISO &&
          l.date < endISO &&
          l.routineKey !== 'rest' &&
          l.status !== 'abandoned',
      ).length;

      buckets.push({
        weekStart: startISO,
        weekLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count,
      });
    }
    return buckets;
  });

  // ---- Per-session volume ---------------------------------------------

  /**
   * Last 30 completed (non-rest) sessions, oldest first. Each carries both
   * `weightedVolumeKg` (set-rep-weight product for weighted exercises) and
   * `bodyweightScore` (intensity-weighted sets×reps for bodyweight), plus
   * counts. UI picks which dominant metric to chart.
   */
  readonly sessionVolumes = computed<SessionVolume[]>(() => {
    const logs = this._logs()
      .filter((l) => l.routineKey !== 'rest' && l.status !== 'abandoned')
      .slice(-30);
    return logs.map(volumeForSession);
  });

  // ---- Lifetime / current-week ----------------------------------------

  readonly totalWorkouts = computed(
    () => this._logs().filter((l) => l.routineKey !== 'rest' && l.status !== 'abandoned').length,
  );

  readonly totalMinutes = computed(() => {
    let mins = 0;
    for (const l of this._logs()) {
      if (l.routineKey === 'rest' || l.status === 'abandoned') continue;
      mins += l.durationMin ?? 0;
    }
    return mins;
  });

  readonly thisWeekCount = computed(() => {
    const weeks = this.sessionsByWeek();
    return weeks.length > 0 ? weeks[weeks.length - 1].count : 0;
  });

  /**
   * The "preferred" metric for the volume chart based on the user's recent
   * habits. If most of the last 10 sessions had weighted exercises, show
   * weighted volume; otherwise bodyweight score.
   */
  readonly preferredVolumeMetric = computed<'weighted' | 'bodyweight'>(() => {
    const recent = this.sessionVolumes().slice(-10);
    if (recent.length === 0) return 'bodyweight';
    const weightedSessions = recent.filter((s) => s.weightedVolumeKg > 0).length;
    return weightedSessions >= recent.length / 2 ? 'weighted' : 'bodyweight';
  });

  // ---- Lifecycle ------------------------------------------------------

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect(() => {
      const userId = this.auth.userId();
      this.bindToUser(userId);
    });

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
    });
  }

  private bindToUser(userId: string | null): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._logs.set([]);
      this._loaded.set(false);
      return;
    }

    // 90-day window. Logged workouts are small (sub-KB each) so even a
    // year of daily training is well under a megabyte.
    const cutoff = todayLocalISO(addDays(new Date(), -90));
    this.subscription = liveQuery(() =>
      db.workoutLogs
        .where('userId').equals(userId)
        .and((l) => l.date >= cutoff)
        .sortBy('date'),
    ).subscribe({
      next: (rows) => {
        this._logs.set(rows);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[ProgressStatsService] liveQuery error', err);
        this._logs.set([]);
        this._loaded.set(true);
      },
    });
  }
}

// ---- Helpers ---------------------------------------------------------

/** Monday of the ISO week containing `d`. */
function mondayOf(d: Date): Date {
  const day = d.getDay();            // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;  // shift to Monday
  return addDays(d, diff);
}

/**
 * Compute both volume metrics for a single session.
 *
 * `intensityScore` uses a coarse rep-range multiplier:
 *   - ≤7 reps  → 1.5× (lower-rep / strength territory)
 *   - 8–14 reps → 1.2× (hypertrophy)
 *   - ≥15 reps → 1.0× (endurance / bodyweight default)
 *
 * It's a *score*, not a science. Designed so consistency and gradual rep
 * progression in bodyweight exercises trend up over time without faking
 * a "weight lifted" number.
 */
function volumeForSession(log: WorkoutLog): SessionVolume {
  let weightedVolumeKg = 0;
  let bodyweightScore = 0;
  let completedSets = 0;
  let totalReps = 0;

  for (const ex of log.exercises) {
    for (const set of ex.sets) {
      if (!set.completed) continue;
      completedSets++;
      const reps = set.reps ?? 0;
      totalReps += reps;

      if ((set.weightKg ?? 0) > 0 && reps > 0) {
        weightedVolumeKg += (set.weightKg ?? 0) * reps;
      } else if (reps > 0) {
        bodyweightScore += reps * intensityMultiplier(reps);
      } else if (set.durationSec) {
        // Time-based set (e.g. plank). Score it as 1 unit per 10 seconds.
        bodyweightScore += set.durationSec / 10;
      }
    }
  }

  return {
    date: log.date,
    routineKey: log.routineKey,
    weightedVolumeKg: Math.round(weightedVolumeKg),
    bodyweightScore: Math.round(bodyweightScore),
    completedSets,
    totalReps,
    durationMin: log.durationMin ?? 0,
  };
}

function intensityMultiplier(reps: number): number {
  if (reps <= 7) return 1.5;
  if (reps <= 14) return 1.2;
  return 1.0;
}

// ---- Types -----------------------------------------------------------

export interface WeekBucket {
  weekStart: string;     // YYYY-MM-DD of Monday
  weekLabel: string;     // "May 12"
  count: number;
}

export interface SessionVolume {
  date: string;
  routineKey: string;
  weightedVolumeKg: number;
  bodyweightScore: number;
  completedSets: number;
  totalReps: number;
  durationMin: number;
}
