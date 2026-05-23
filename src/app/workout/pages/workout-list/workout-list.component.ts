import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { friendlyDate } from '@shared/utils/date.util';
import {
  ROUTINE_EMOJI,
  ROUTINE_FOCUS,
  ROUTINE_LABELS,
  type DayChoice,
  type RoutineKey,
} from '@models/workout.model';

import { RoutineService } from '@workout/services/routine.service';
import { RoutineScheduleService } from '@workout/services/routine-schedule.service';
import { WorkoutService } from '@workout/services/workout.service';

/**
 * Workout list — landing screen for the Workout tab.
 *
 * Sections:
 *   1. "Today" hero card: the suggested routine (or rest), big Start button.
 *      If a session is in progress → "Resume" instead of "Start".
 *      If today is already logged → "Logged ✓" with a chip showing what.
 *   2. "Choose another" grid: the 3 routines (excluding the suggested one)
 *      so the user can override.
 *   3. Rest day shortcut: explicit "Log Rest Day" button when applicable.
 *   4. History link at bottom.
 */
@Component({
  selector: 'app-workout-list',
  standalone: true,
  imports: [RouterLink, DatePipe, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6 pb-4">
      <header class="mb-5">
        <p class="text-xs text-muted font-semibold">{{ today }}</p>
        <h1 class="text-2xl font-extrabold tracking-tight mt-1">Workout</h1>
      </header>

      <!-- ============= Today / Suggested ============= -->
      <app-card variant="hero" class="block mb-3">
        @if (todayLog(); as logged) {
          <!-- Already logged today -->
          <div class="flex items-start justify-between mb-4">
            <div>
              <span class="chip-primary">
                <app-icon name="check" [size]="12" />
                Logged today
              </span>
              <h2 class="text-xl font-bold mt-2">{{ labelFor(logged.routineKey) }}</h2>
              <p class="text-sm text-muted mt-1">
                @if (logged.routineKey === 'rest') {
                  Recovery day · nice work resting
                } @else if (logged.completedAt) {
                  Completed at {{ logged.completedAt | date: 'shortTime' }}
                  @if (logged.durationMin) {
                    · {{ logged.durationMin }} min
                  }
                } @else {
                  In progress
                }
              </p>
            </div>
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
              style="background: rgb(var(--primary) / 0.12);"
            >
              {{ emojiFor(logged.routineKey) }}
            </div>
          </div>
          @if (logged.status === 'in_progress' && logged.routineKey !== 'rest') {
            <button
              class="btn-primary w-full flex items-center justify-center gap-2"
              (click)="resume(logged.routineKey)"
            >
              <app-icon name="zap" [size]="18" />
              Resume Workout
            </button>
          } @else if (logged.routineKey !== 'rest') {
            <a
              [routerLink]="['/workout/history']"
              class="btn-ghost w-full flex items-center justify-center gap-2"
            >
              <app-icon name="trending_up" [size]="16" />
              View Details
            </a>
          }
        } @else {
          <!-- Suggested routine for today -->
          <div class="flex items-start justify-between mb-4">
            <div>
              <span class="chip-primary">Today · suggested</span>
              <h2 class="text-xl font-bold mt-2">{{ labelFor(suggested()) }}</h2>
              <p class="text-sm text-muted mt-1">{{ focusFor(suggested()) }}</p>
              @if (suggested() !== 'rest') {
                <p class="text-xs text-subtle mt-1.5 num">
                  ~{{ estimatedMinFor(suggested()) }} min
                </p>
              }
            </div>
            <div
              class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
              style="background: rgb(var(--primary) / 0.12);"
            >
              {{ emojiFor(suggested()) }}
            </div>
          </div>

          @if (suggested() === 'rest') {
            <button
              class="btn-primary w-full flex items-center justify-center gap-2"
              (click)="logRest()"
              [disabled]="logging()"
            >
              <app-icon name="bed" [size]="18" />
              Log Rest Day
            </button>
          } @else {
            <button
              class="btn-primary w-full flex items-center justify-center gap-2"
              (click)="start(suggested())"
            >
              <app-icon name="zap" [size]="18" />
              Start Workout
            </button>
          }
        }
      </app-card>

      <!-- ============= Choose another ============= -->
      <p class="text-xs uppercase tracking-wider text-muted font-bold px-1 mt-6 mb-3">
        @if (todayLog()) { Other routines } @else { Choose another }
      </p>

      <div class="grid grid-cols-1 gap-3">
        @for (option of alternatives(); track option) {
          <button
            class="bg-surface rounded-2xl p-4 flex items-center gap-4 text-left
                   border border-border/40"
            (click)="start(option)"
          >
            <div
              class="w-12 h-12 rounded-xl grid place-items-center text-xl shrink-0"
              style="background: rgb(var(--primary) / 0.10);"
            >
              {{ emojiFor(option) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold">{{ labelFor(option) }}</p>
              <p class="text-xs text-muted truncate">{{ focusFor(option) }}</p>
            </div>
            <app-icon name="chevron_right" [size]="20" cssClass="text-subtle" />
          </button>
        }

        @if (suggested() !== 'rest' && !todayLog()) {
          <button
            class="bg-surface rounded-2xl p-4 flex items-center gap-4 text-left
                   border border-border/40"
            (click)="logRest()"
            [disabled]="logging()"
          >
            <div
              class="w-12 h-12 rounded-xl grid place-items-center text-xl shrink-0"
              style="background: rgb(var(--muted) / 0.12);"
            >
              🌿
            </div>
            <div class="flex-1">
              <p class="font-bold">Rest Day</p>
              <p class="text-xs text-muted">Recovery — log today as a rest day</p>
            </div>
            <app-icon name="chevron_right" [size]="20" cssClass="text-subtle" />
          </button>
        }
      </div>

      <!-- ============= History link ============= -->
      <a
        [routerLink]="['/workout/history']"
        class="flex items-center justify-between bg-elevated rounded-2xl px-5 py-4 mt-6"
      >
        <div class="flex items-center gap-3">
          <app-icon name="trending_up" [size]="20" cssClass="text-primary" />
          <span class="font-semibold">Workout History</span>
        </div>
        <app-icon name="chevron_right" [size]="18" cssClass="text-subtle" />
      </a>
    </div>
  `,
})
export default class WorkoutListComponent {
  private readonly router = inject(Router);
  private readonly routineSvc = inject(RoutineService);
  private readonly scheduleSvc = inject(RoutineScheduleService);
  private readonly workoutSvc = inject(WorkoutService);

  protected readonly today = friendlyDate();
  protected readonly suggested = this.scheduleSvc.suggestedToday;
  protected readonly todayLog = this.scheduleSvc.todayLog;

  /** All choices the user might pick today, EXCLUDING the suggested one. */
  protected readonly alternatives = computed<DayChoice[]>(() => {
    const all: DayChoice[] = ['push', 'pull_legs', 'shred'];
    const suggested = this.suggested();
    return all.filter((k) => k !== suggested);
  });

  protected readonly logging = signal(false);

  protected labelFor(k: DayChoice): string { return ROUTINE_LABELS[k]; }
  protected focusFor(k: DayChoice): string { return ROUTINE_FOCUS[k]; }
  protected emojiFor(k: DayChoice): string { return ROUTINE_EMOJI[k]; }
  protected estimatedMinFor(k: DayChoice): number {
    if (k === 'rest') return 0;
    return this.routineSvc.get(k as RoutineKey)?.estimatedMin ?? 30;
  }

  protected async start(choice: DayChoice): Promise<void> {
    if (choice === 'rest') {
      await this.logRest();
      return;
    }
    await this.workoutSvc.startSession(choice as RoutineKey);
    void this.router.navigate(['/workout/active']);
  }

  protected resume(choice: DayChoice): void {
    if (choice === 'rest') return;
    void this.router.navigate(['/workout/active']);
  }

  protected async logRest(): Promise<void> {
    this.logging.set(true);
    try {
      await this.workoutSvc.logRestDay();
    } finally {
      this.logging.set(false);
    }
  }
}
