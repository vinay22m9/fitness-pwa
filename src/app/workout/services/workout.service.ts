import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import { todayLocalISO } from '@shared/utils/date.util';
import { uuid } from '@shared/utils/id.util';
import {
  type DayChoice,
  type ExerciseLog,
  type ExerciseTemplate,
  type Routine,
  type RoutineKey,
  type SetLog,
  type WorkoutLog,
} from '@models/workout.model';

import { RoutineService } from './routine.service';
import { RoutineScheduleService } from './routine-schedule.service';

/**
 * WorkoutService — orchestrates active workout sessions.
 *
 * Lifecycle of a session:
 *   1. startSession(routineKey)  → create an 'in_progress' WorkoutLog in Dexie,
 *      seeded from the routine template. Auto-save kicks in.
 *   2. toggleSet / updateSetReps / updateSetWeight  → mutate the active log
 *      in memory + persist via debounced auto-save (300ms).
 *   3. finishSession()  → mark 'completed', set duration, enqueue sync,
 *      tell RoutineScheduleService to advance the rotation.
 *
 * The active session signal lets the active-workout page render reactively
 * and lets the dashboard show "Resume workout" if a session was abandoned.
 *
 * Auto-save policy:
 *   - Writes go to Dexie immediately (debounced 300ms to batch rapid taps).
 *   - Outbox enqueue happens only on finish — we don't want 50 outbox rows
 *     for one session. If the app crashes mid-session, the user can resume
 *     locally and finish; if they never come back, the row stays
 *     'in_progress' and is filtered out of stats.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly auth = inject(AuthService);
  private readonly routines = inject(RoutineService);
  private readonly schedule = inject(RoutineScheduleService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);

  /** The currently active session (null when not working out). */
  private readonly _active = signal<WorkoutLog | null>(null);
  readonly active = this._active.asReadonly();

  /** Quick "is the user in the middle of a workout?" check. */
  readonly hasActiveSession = computed(() => this._active() !== null);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // On user change (or app boot), try to recover any in-progress session
    // for today. This makes the app crash-resistant — close the tab mid-set,
    // reopen, the active workout is right where you left it.
    effect(() => {
      const userId = this.auth.userId();
      if (userId) void this.recoverInProgress(userId);
      else this._active.set(null);
    });

    destroyRef.onDestroy(() => {
      if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    });
  }

  // -------- Lifecycle --------

  /**
   * Begin a new workout session for `routineKey`. If a session is already
   * in progress for the same day, returns the existing one (idempotent).
   */
  async startSession(routineKey: RoutineKey): Promise<WorkoutLog> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot start session: not signed in');

    const routine = this.routines.get(routineKey);
    if (!routine) throw new Error(`Unknown routine: ${routineKey}`);

    const today = todayLocalISO();
    const existing = await db.workoutLogs
      .where('userId').equals(userId)
      .and((l) => l.date === today && l.status === 'in_progress')
      .first();

    if (existing && existing.routineKey === routineKey) {
      this._active.set(existing);
      return existing;
    }

    // If there's an in-progress log for a DIFFERENT routine today, abandon it
    if (existing) {
      await db.workoutLogs.update(existing.id, { status: 'abandoned' });
    }

    const now = new Date().toISOString();
    const log: WorkoutLog = {
      id: uuid(),
      userId,
      routineKey,
      date: today,
      startedAt: now,
      status: 'in_progress',
      exercises: routine.exercises.map(toExerciseLog),
    };

    await db.workoutLogs.put(log);
    this._active.set(log);
    return log;
  }

  /**
   * Toggle a set's `completed` state. Most common action during a workout —
   * one tap per set.
   */
  async toggleSet(exerciseIdx: number, setIdx: number): Promise<void> {
    this.mutate((draft) => {
      const ex = draft.exercises[exerciseIdx];
      if (!ex) return;
      const set = ex.sets[setIdx];
      if (!set) return;
      set.completed = !set.completed;
      ex.completed = ex.sets.every((s) => s.completed);
    });
  }

  /** Update reps for a set. Called when user edits the rep count inline. */
  async updateSetReps(exerciseIdx: number, setIdx: number, reps: number | undefined): Promise<void> {
    this.mutate((draft) => {
      const set = draft.exercises[exerciseIdx]?.sets[setIdx];
      if (set) set.reps = reps;
    });
  }

  /** Update weight for a set. */
  async updateSetWeight(exerciseIdx: number, setIdx: number, weightKg: number | undefined): Promise<void> {
    this.mutate((draft) => {
      const set = draft.exercises[exerciseIdx]?.sets[setIdx];
      if (set) set.weightKg = weightKg;
    });
  }

  /** Update exercise-level notes (free-text). */
  async updateExerciseNotes(exerciseIdx: number, notes: string): Promise<void> {
    this.mutate((draft) => {
      const ex = draft.exercises[exerciseIdx];
      if (ex) ex.notes = notes;
    });
  }

  /**
   * Finish the active session. Marks it completed, sets duration, enqueues
   * sync, and advances the rotation. Returns the finished log.
   */
  async finishSession(): Promise<WorkoutLog | null> {
    const log = this._active();
    if (!log) return null;

    // Flush any pending auto-save first
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    const now = new Date().toISOString();
    const durationMin = log.startedAt
      ? Math.max(1, Math.round((Date.parse(now) - Date.parse(log.startedAt)) / 60000))
      : undefined;

    const finished: WorkoutLog = {
      ...log,
      completedAt: now,
      durationMin,
      status: 'completed',
    };

    await db.workoutLogs.put(finished);
    await this.outbox.enqueue('workoutLog', 'upsert', finished.id, finished);
    await this.schedule.recordCompletion(finished.routineKey, finished.date);
    this.sync.triggerSync();
    this._active.set(null);
    return finished;
  }

  /** Discard the active session without logging. */
  async cancelSession(): Promise<void> {
    const log = this._active();
    if (!log) return;
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    await db.workoutLogs.delete(log.id);
    this._active.set(null);
  }

  /**
   * Log a rest day. One-tap; no session UI.
   */
  async logRestDay(date: string = todayLocalISO()): Promise<WorkoutLog> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot log rest: not signed in');

    // Idempotent: if a log exists for today, replace it.
    const existing = await db.workoutLogs
      .where('userId').equals(userId)
      .and((l) => l.date === date)
      .first();

    const now = new Date().toISOString();
    const log: WorkoutLog = {
      id: existing?.id ?? uuid(),
      userId,
      routineKey: 'rest',
      date,
      startedAt: existing?.startedAt ?? now,
      completedAt: now,
      durationMin: 0,
      status: 'completed',
      exercises: [],
    };

    await db.workoutLogs.put(log);
    await this.outbox.enqueue('workoutLog', 'upsert', log.id, log);
    await this.schedule.recordCompletion('rest', date);
    this.sync.triggerSync();
    return log;
  }

  // -------- Internals --------

  /**
   * Apply a mutation to the active log, then schedule an auto-save.
   * Mutator receives a draft (shallow-cloned exercises/sets array) and
   * mutates in place — this keeps call sites concise without bringing in
   * an immutability library for MVP.
   */
  private mutate(mutator: (draft: WorkoutLog) => void): void {
    const current = this._active();
    if (!current) return;

    // Deep-ish clone: spread top + map exercises + map sets. WorkoutLog isn't
    // deeply nested beyond that.
    const draft: WorkoutLog = {
      ...current,
      exercises: current.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ ...s })),
      })),
    };
    mutator(draft);
    this._active.set(draft);
    this.scheduleAutosave(draft);
  }

  private scheduleAutosave(log: WorkoutLog): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      void db.workoutLogs.put(log);
      this.autosaveTimer = null;
    }, 300);
  }

  /**
   * On app boot or sign-in, look for any in-progress session from today
   * and restore it as the active session. Sessions older than today are
   * marked 'abandoned' so they don't pollute stats.
   */
  private async recoverInProgress(userId: string): Promise<void> {
    const today = todayLocalISO();

    // Abandon stale in-progress logs (any from before today).
    const stale = await db.workoutLogs
      .where('userId').equals(userId)
      .and((l) => l.status === 'in_progress' && l.date !== today)
      .toArray();
    for (const s of stale) {
      await db.workoutLogs.update(s.id, { status: 'abandoned' });
    }

    const todays = await db.workoutLogs
      .where('userId').equals(userId)
      .and((l) => l.date === today && l.status === 'in_progress')
      .first();

    this._active.set(todays ?? null);
  }
}

/** Convert a template exercise into a logged exercise with empty sets. */
function toExerciseLog(t: ExerciseTemplate): ExerciseLog {
  const sets: SetLog[] = Array.from({ length: t.sets }, () => ({ completed: false }));
  return {
    templateId: t.id,
    name: t.name,
    sets,
    completed: false,
  };
}
