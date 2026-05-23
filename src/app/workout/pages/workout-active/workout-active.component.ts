import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import {
  ROUTINE_LABELS,
  type ExerciseTemplate,
} from '@models/workout.model';

import { RoutineService } from '@workout/services/routine.service';
import { WorkoutService } from '@workout/services/workout.service';
import {
  BaselineService,
  type ExerciseBaseline,
} from '@workout/services/baseline.service';

/**
 * Active workout page — the gym screen.
 *
 * Design priorities (in order):
 *   1. Tap-to-complete sets — never make the user type during an exercise
 *   2. Minimal typing — only when changing reps/weight from baseline
 *   3. Big tap targets (≥48×48) — sweaty fingers don't aim well
 *   4. Always-visible Finish button — users want to stop when they're done
 *   5. Show what they did last time as a hint, no pressure to match
 *
 * Auto-save runs in WorkoutService (300ms debounce). If the page is closed
 * mid-workout, the in-progress log is recovered on next app open.
 */
@Component({
  selector: 'app-workout-active',
  standalone: true,
  imports: [FormsModule, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active(); as session) {
      <div class="page-enter px-5 pt-6 pb-32">

        <!-- Header -->
        <header class="flex items-start justify-between mb-5">
          <div>
            <p class="text-xs uppercase tracking-wider text-muted font-bold">
              In progress
            </p>
            <h1 class="text-2xl font-extrabold tracking-tight mt-1">
              {{ routineLabel() }}
            </h1>
            <p class="text-xs text-muted mt-1.5 num">
              {{ completedSetsCount() }} / {{ totalSetsCount() }} sets ·
              {{ elapsedMinutes() }} min
            </p>
          </div>
          <button
            class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted
                   hover:text-text transition-colors"
            (click)="cancelConfirm()"
            aria-label="Cancel workout"
          >
            <app-icon name="x" [size]="20" />
          </button>
        </header>

        <!-- Overall progress bar -->
        <div class="h-1.5 bg-border rounded-full overflow-hidden mb-5">
          <div
            class="h-full rounded-full transition-all duration-500"
            [style.width.%]="progressPct()"
            style="background: rgb(var(--primary));"
          ></div>
        </div>

        <!-- Exercises -->
        @for (ex of session.exercises; track ex.templateId; let exIdx = $index) {
          <app-card class="block mb-3">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base leading-snug">{{ ex.name }}</h3>
                @if (templateFor(ex.templateId); as t) {
                  <p class="text-xs text-muted mt-1 num">
                    Target: {{ t.sets }} × {{ t.reps }}
                    @if (t.weightKg) { · {{ t.weightKg }}kg }
                  </p>
                  @if (t.notes) {
                    <p class="text-[11px] text-subtle mt-1">{{ t.notes }}</p>
                  }
                }
                @if (baselineFor(ex.templateId); as b) {
                  <p
                    class="text-[11px] mt-1.5 font-semibold inline-flex items-center gap-1.5
                           px-2 py-0.5 rounded-md"
                    style="background: rgb(var(--accent) / 0.12); color: rgb(var(--accent));"
                  >
                    <app-icon name="trending_up" [size]="11" />
                    Last:
                    @if (b.bestReps !== undefined) {
                      <span class="num">{{ b.bestReps }} reps</span>
                    }
                    @if (b.weightKg !== undefined) {
                      <span class="num">· {{ b.weightKg }}kg</span>
                    }
                  </p>
                }
              </div>
              @if (ex.completed) {
                <div
                  class="w-8 h-8 rounded-full grid place-items-center shrink-0"
                  style="background: rgb(var(--primary)); color: rgb(var(--bg));"
                >
                  <app-icon name="check" [size]="16" [strokeWidth]="3" />
                </div>
              }
            </div>

            <!-- Sets grid -->
            <div class="space-y-2">
              @for (set of ex.sets; track $index; let setIdx = $index) {
                <div class="flex items-center gap-2">
                  <span
                    class="w-7 text-center text-xs font-bold text-subtle num shrink-0"
                  >
                    {{ setIdx + 1 }}
                  </span>

                  <!-- Reps input -->
                  <input
                    type="number"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="999"
                    [value]="set.reps ?? ''"
                    (input)="onRepsInput(exIdx, setIdx, $event)"
                    placeholder="reps"
                    class="flex-1 min-w-0 bg-elevated text-text rounded-xl px-3 py-2.5
                           text-sm num outline-none border border-transparent
                           focus:border-primary placeholder:text-subtle text-center"
                  />

                  <!-- Weight input (only if template has weight) -->
                  @if (templateFor(ex.templateId)?.weightKg !== undefined) {
                    <input
                      type="number"
                      inputmode="decimal"
                      step="0.5"
                      min="0"
                      max="999"
                      [value]="set.weightKg ?? ''"
                      (input)="onWeightInput(exIdx, setIdx, $event)"
                      placeholder="kg"
                      class="w-16 bg-elevated text-text rounded-xl px-2 py-2.5
                             text-sm num outline-none border border-transparent
                             focus:border-primary placeholder:text-subtle text-center"
                    />
                  }

                  <!-- Tap-to-complete (big target) -->
                  <button
                    type="button"
                    class="w-12 h-11 rounded-xl grid place-items-center shrink-0
                           transition-colors"
                    [class.bg-elevated]="!set.completed"
                    [style.background]="set.completed ? 'rgb(var(--primary))' : null"
                    [style.color]="set.completed ? 'rgb(var(--bg))' : 'rgb(var(--subtle))'"
                    (click)="toggleSet(exIdx, setIdx)"
                    [attr.aria-label]="set.completed ? 'Mark set incomplete' : 'Mark set complete'"
                  >
                    <app-icon
                      name="check"
                      [size]="18"
                      [strokeWidth]="set.completed ? 3 : 2"
                    />
                  </button>
                </div>
              }
            </div>
          </app-card>
        }

        <!-- Warmup / cooldown reminder -->
        @if (routine(); as r) {
          <app-card variant="subtle" class="block mb-3 text-xs">
            <p class="font-bold mb-1.5 text-muted uppercase tracking-wider text-[11px]">
              Cooldown
            </p>
            <p class="text-text/80">{{ r.cooldown.join(' · ') }}</p>
          </app-card>
        }
      </div>

      <!-- Sticky finish bar -->
      <div
        class="fixed left-0 right-0 z-30 px-5 pb-5"
        [style.bottom]="'env(safe-area-inset-bottom, 0px)'"
      >
        <div class="bg-bg/80 backdrop-blur rounded-3xl p-3 border border-border/60">
          <button
            class="btn-primary w-full flex items-center justify-center gap-2"
            (click)="finish()"
            [disabled]="finishing()"
          >
            @if (finishing()) {
              <span class="animate-pulse-soft">Finishing…</span>
            } @else if (completedSetsCount() === 0) {
              <span>Finish (no sets done)</span>
            } @else if (completedSetsCount() < totalSetsCount()) {
              <span>Finish · {{ completedSetsCount() }}/{{ totalSetsCount() }} sets</span>
            } @else {
              <app-icon name="check" [size]="18" [strokeWidth]="3" />
              <span>Complete Workout</span>
            }
          </button>
        </div>
      </div>
    } @else {
      <!-- No active session — bounce back -->
      <div class="page-enter px-5 pt-12 text-center">
        <div
          class="w-16 h-16 mx-auto rounded-2xl bg-elevated grid place-items-center mb-4
                 text-muted"
        >
          <app-icon name="dumbbell" [size]="28" />
        </div>
        <p class="font-bold mb-1">No workout in progress</p>
        <p class="text-sm text-muted mb-5">Pick a routine from the workout tab.</p>
        <button class="btn-primary inline-flex items-center gap-2" (click)="goBack()">
          <app-icon name="chevron_left" [size]="16" />
          Back to Workout
        </button>
      </div>
    }
  `,
})
export default class WorkoutActiveComponent {
  private readonly router = inject(Router);
  private readonly routineSvc = inject(RoutineService);
  private readonly workoutSvc = inject(WorkoutService);
  private readonly baselineSvc = inject(BaselineService);

  protected readonly active = this.workoutSvc.active;
  protected readonly finishing = signal(false);

  /** Baseline map keyed by templateId. Loaded once per session. */
  protected readonly baselines = signal<Record<string, ExerciseBaseline>>({});

  /** Elapsed minutes since session start — updates every 30s. */
  private readonly nowTick = signal(Date.now());

  protected readonly routine = computed(() => {
    const a = this.active();
    if (!a || a.routineKey === 'rest') return undefined;
    return this.routineSvc.get(a.routineKey);
  });

  protected readonly routineLabel = computed(() => {
    const a = this.active();
    return a ? ROUTINE_LABELS[a.routineKey] : '';
  });

  protected readonly totalSetsCount = computed(() => {
    const a = this.active();
    if (!a) return 0;
    return a.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  });

  protected readonly completedSetsCount = computed(() => {
    const a = this.active();
    if (!a) return 0;
    return a.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0,
    );
  });

  protected readonly progressPct = computed(() => {
    const total = this.totalSetsCount();
    if (total === 0) return 0;
    return Math.round((this.completedSetsCount() / total) * 100);
  });

  protected readonly elapsedMinutes = computed(() => {
    const a = this.active();
    if (!a?.startedAt) return 0;
    const ms = this.nowTick() - Date.parse(a.startedAt);
    return Math.max(0, Math.floor(ms / 60000));
  });

  constructor() {
    // Load baselines once when a session becomes active.
    effect(() => {
      const a = this.active();
      if (!a || a.routineKey === 'rest') {
        this.baselines.set({});
        return;
      }
      const templateIds = a.exercises.map((e) => e.templateId);
      void this.baselineSvc
        .forRoutine(a.routineKey, templateIds)
        .then((map) => this.baselines.set(map));
    });

    // Tick the timer every 30s so elapsed minutes refresh.
    const interval = setInterval(() => this.nowTick.set(Date.now()), 30_000);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => clearInterval(interval));
  }

  protected templateFor(templateId: string): ExerciseTemplate | undefined {
    const r = this.routine();
    return r?.exercises.find((e) => e.id === templateId);
  }

  protected baselineFor(templateId: string): ExerciseBaseline | undefined {
    const b = this.baselines()[templateId];
    if (!b) return undefined;
    if (b.bestReps === undefined && b.weightKg === undefined) return undefined;
    return b;
  }

  protected toggleSet(exIdx: number, setIdx: number): void {
    void this.workoutSvc.toggleSet(exIdx, setIdx);
  }

  protected onRepsInput(exIdx: number, setIdx: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const v = target.value.trim();
    const reps = v === '' ? undefined : Math.max(0, Math.min(999, Number(v)));
    void this.workoutSvc.updateSetReps(exIdx, setIdx, reps);
  }

  protected onWeightInput(exIdx: number, setIdx: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const v = target.value.trim();
    const weight = v === '' ? undefined : Math.max(0, Math.min(999, Number(v)));
    void this.workoutSvc.updateSetWeight(exIdx, setIdx, weight);
  }

  protected async finish(): Promise<void> {
    if (this.finishing()) return;
    this.finishing.set(true);
    try {
      await this.workoutSvc.finishSession();
      void this.router.navigate(['/workout']);
    } finally {
      this.finishing.set(false);
    }
  }

  protected cancelConfirm(): void {
    // Native confirm is acceptable in MVP; a custom sheet can replace this later.
    const ok = window.confirm('Cancel this workout? Progress will be lost.');
    if (!ok) return;
    void this.workoutSvc.cancelSession().then(() => {
      void this.router.navigate(['/workout']);
    });
  }

  protected goBack(): void {
    void this.router.navigate(['/workout']);
  }
}
