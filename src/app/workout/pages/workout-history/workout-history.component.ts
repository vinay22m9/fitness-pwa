import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Location } from '@angular/common';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { addDays, todayLocalISO } from '@shared/utils/date.util';
import {
  ROUTINE_EMOJI,
  ROUTINE_LABELS,
  type DayChoice,
  type WorkoutLog,
} from '@models/workout.model';

/**
 * Workout history — last 14 days, chronological (most recent first).
 *
 * MVP shows a simple list. Future Module 8 (Progress) will reuse this same
 * underlying query to power streaks, volume trends, and progression charts.
 *
 * Filtering rule: 'abandoned' sessions are HIDDEN (the user never finished
 * them, so they're noise). 'in_progress' is shown as "In progress" with a
 * resume link.
 */
@Component({
  selector: 'app-workout-history',
  standalone: true,
  imports: [DatePipe, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6 pb-4">
      <header class="flex items-center gap-3 mb-5">
        <button
          class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted"
          (click)="goBack()"
          aria-label="Back"
        >
          <app-icon name="chevron_left" [size]="20" />
        </button>
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight">History</h1>
          <p class="text-xs text-muted mt-0.5">Last 14 days</p>
        </div>
      </header>

      <!-- Stats strip -->
      <div class="grid grid-cols-3 gap-3 mb-5">
        <app-card class="block text-center" variant="subtle">
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold">
            Workouts
          </p>
          <p class="text-2xl font-extrabold num mt-1" style="color: rgb(var(--primary));">
            {{ workoutCount() }}
          </p>
        </app-card>
        <app-card class="block text-center" variant="subtle">
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold">
            Rest Days
          </p>
          <p class="text-2xl font-extrabold num mt-1" style="color: rgb(var(--muted));">
            {{ restCount() }}
          </p>
        </app-card>
        <app-card class="block text-center" variant="subtle">
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold">
            Total Sets
          </p>
          <p class="text-2xl font-extrabold num mt-1" style="color: rgb(var(--accent));">
            {{ totalSets() }}
          </p>
        </app-card>
      </div>

      <!-- Timeline -->
      @if (visibleLogs().length === 0) {
        <app-card class="block text-center">
          <div
            class="w-14 h-14 mx-auto rounded-2xl bg-elevated grid place-items-center mb-3
                   text-muted"
          >
            <app-icon name="dumbbell" [size]="24" />
          </div>
          <p class="font-bold mb-1">No workouts yet</p>
          <p class="text-sm text-muted">Your last 14 days will appear here.</p>
        </app-card>
      } @else {
        <div class="space-y-3">
          @for (log of visibleLogs(); track log.id) {
            <app-card class="block">
              <div class="flex items-center gap-4">
                <div
                  class="w-12 h-12 rounded-xl grid place-items-center text-xl shrink-0"
                  [style.background]="bgFor(log.routineKey)"
                >
                  {{ emojiFor(log.routineKey) }}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-2">
                    <p class="font-bold truncate">{{ labelFor(log.routineKey) }}</p>
                    <p class="text-xs text-muted shrink-0 num">
                      {{ log.date | date: 'EEE, MMM d' }}
                    </p>
                  </div>
                  <p class="text-xs text-muted mt-0.5">
                    @if (log.status === 'in_progress') {
                      <span style="color: rgb(var(--warning));">In progress</span>
                    } @else if (log.routineKey === 'rest') {
                      Recovery day
                    } @else {
                      <span class="num">{{ completedSetsOf(log) }}</span> sets
                      @if (log.durationMin) {
                        · <span class="num">{{ log.durationMin }}</span> min
                      }
                    }
                  </p>
                </div>
              </div>
            </app-card>
          }
        </div>
      }
    </div>
  `,
})
export default class WorkoutHistoryComponent {
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly logs = signal<WorkoutLog[]>([]);

  /** Hide 'abandoned' from the list — but include 'in_progress' (with a tag). */
  protected readonly visibleLogs = computed(() =>
    this.logs().filter((l) => l.status !== 'abandoned'),
  );

  protected readonly workoutCount = computed(
    () => this.visibleLogs().filter((l) => l.routineKey !== 'rest' && l.status === 'completed').length,
  );
  protected readonly restCount = computed(
    () => this.visibleLogs().filter((l) => l.routineKey === 'rest').length,
  );
  protected readonly totalSets = computed(() =>
    this.visibleLogs()
      .filter((l) => l.routineKey !== 'rest')
      .reduce(
        (sum, l) => sum + l.exercises.reduce((s, ex) => s + ex.sets.filter((x) => x.completed).length, 0),
        0,
      ),
  );

  constructor() {
    const userId = this.auth.userId();
    if (!userId) return;

    const cutoff = todayLocalISO(addDays(new Date(), -14));
    const sub = liveQuery(() =>
      db.workoutLogs
        .where('userId').equals(userId)
        .and((l) => l.date >= cutoff)
        .reverse()
        .sortBy('date'),
    ).subscribe({
      next: (rows) => this.logs.set(rows),
      error: (err) => console.error('[WorkoutHistory] liveQuery', err),
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected labelFor(k: DayChoice): string { return ROUTINE_LABELS[k]; }
  protected emojiFor(k: DayChoice): string { return ROUTINE_EMOJI[k]; }

  protected bgFor(k: DayChoice): string {
    const map: Record<DayChoice, string> = {
      push:      'rgb(var(--primary) / 0.12)',
      pull_legs: 'rgb(var(--primary) / 0.12)',
      shred:     'rgb(var(--warning) / 0.12)',
      rest:      'rgb(var(--muted) / 0.12)',
    };
    return map[k];
  }

  protected completedSetsOf(log: WorkoutLog): number {
    return log.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0,
    );
  }

  protected goBack(): void {
    this.location.back();
  }
}
