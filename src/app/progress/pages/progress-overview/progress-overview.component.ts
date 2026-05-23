import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { CardComponent } from '@shared/components/card/card.component';
import { LineChartComponent, type ChartPoint } from '@shared/components/charts/line-chart.component';
import { BarChartComponent } from '@shared/components/charts/bar-chart.component';
import { ToastService } from '@shared/services/toast.service';
import { friendlyDate } from '@shared/utils/date.util';

import { WeightLogService } from '@progress/services/weight-log.service';
import { ProgressStatsService } from '@progress/services/progress-stats.service';

/**
 * Progress page — Module 8.
 *
 * Sections, top-to-bottom:
 *   1. Header (date + page title)
 *   2. Streak chip — current workout-day streak
 *   3. Weight card — latest weight + line chart + "Log weight" CTA
 *      (inline form expands when tapped)
 *   4. Sessions per week — last 8 weeks, bar chart
 *   5. Volume trend — last 30 sessions, line chart (weighted or
 *      bodyweight depending on user history)
 *   6. Lifetime stats grid — total workouts / total minutes / this-week
 *
 * Design priorities (per Module 8 refinements):
 *   - Glanceable. Each chart should tell its story in one second.
 *   - No spreadsheet energy: no gridlines, no big axes, no data tables.
 *   - Bodyweight users get equal billing — the volume chart uses whichever
 *     metric matches their training, no "fake gym bro" weight math.
 */
@Component({
  selector: 'app-progress-page',
  standalone: true,
  imports: [
    DecimalPipe,
    CardComponent,
    LineChartComponent,
    BarChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6 pb-4">

      <!-- Header -->
      <header class="mb-5">
        <p class="text-xs text-muted font-semibold">{{ today }}</p>
        <h1 class="text-2xl font-extrabold tracking-tight mt-1">Progress</h1>
      </header>

      <!-- ============== Streak chip ============== -->
      @if (streak() > 0) {
        <div
          class="rounded-2xl px-4 py-3 mb-3 flex items-center gap-3"
          style="background: linear-gradient(135deg, rgb(var(--primary) / 0.15), rgb(var(--accent) / 0.10));"
        >
          <div class="text-2xl">🔥</div>
          <div class="flex-1">
            <p class="text-xs uppercase tracking-wider font-bold text-muted">Workout streak</p>
            <p class="text-xl font-extrabold num">
              {{ streak() }}<span class="text-sm text-muted font-bold">
                {{ streak() === 1 ? ' day' : ' days' }}
              </span>
            </p>
          </div>
        </div>
      } @else {
        <div class="rounded-2xl px-4 py-3 mb-3 bg-elevated/40 flex items-center gap-3">
          <div class="text-2xl opacity-60">💤</div>
          <div class="flex-1">
            <p class="text-xs uppercase tracking-wider font-bold text-muted">Workout streak</p>
            <p class="text-sm text-subtle">Log a workout to start your streak.</p>
          </div>
        </div>
      }

      <!-- ============== Weight ============== -->
      <app-card class="block mb-3">
        <div class="flex items-start justify-between mb-3">
          <div>
            <p class="text-xs uppercase tracking-wider font-bold text-muted">Weight</p>
            @if (latestKg(); as kg) {
              <p class="text-2xl font-extrabold num mt-1">
                {{ kg | number: '1.1-1' }}<span class="text-base text-muted font-bold"> kg</span>
              </p>
              <p class="text-[11px] text-subtle mt-0.5">
                {{ latestRelativeLabel() }}
              </p>
            } @else {
              <p class="text-sm text-subtle mt-1">No weight logged yet.</p>
            }
          </div>
          <button
            type="button"
            class="rounded-xl h-10 px-4 text-sm font-extrabold"
            [style.background]="weightFormOpen() ? 'rgb(var(--elevated))' : 'rgb(var(--primary))'"
            [style.color]="weightFormOpen() ? 'rgb(var(--text))' : 'rgb(var(--bg))'"
            (click)="toggleWeightForm()"
          >
            {{ weightFormOpen() ? 'Cancel' : (todayLogged() ? 'Update' : 'Log') }}
          </button>
        </div>

        <!-- Inline log form -->
        @if (weightFormOpen()) {
          <div class="bg-elevated/40 rounded-xl p-3 mb-3">
            <div class="flex items-center gap-2 mb-2">
              <input
                type="number"
                inputmode="decimal"
                step="0.1"
                min="20"
                max="400"
                class="flex-1 bg-surface rounded-lg px-3 py-2 text-sm font-bold num focus:outline-none"
                placeholder="kg"
                [value]="weightInput()"
                (input)="onWeightInput($event)"
              />
              <input
                type="text"
                maxlength="20"
                class="flex-1 bg-surface rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="Note (optional)"
                [value]="noteInput()"
                (input)="onNoteInput($event)"
              />
            </div>
            <button
              type="button"
              class="w-full rounded-lg py-2 text-sm font-extrabold disabled:opacity-50"
              style="background: rgb(var(--primary)); color: rgb(var(--bg));"
              [disabled]="!canSubmitWeight() || saving()"
              (click)="submitWeight()"
            >
              {{ saving() ? 'Saving…' : 'Save weight' }}
            </button>
          </div>
        }

        <!-- Trend chart -->
        @if (weightChartData().length >= 2) {
          <app-line-chart
            [data]="weightChartData()"
            yLabel="kg"
            colorVar="primary"
            [yDecimals]="1"
            ariaLabel="Weight trend over time"
          />
        } @else if (latestKg() !== null) {
          <p class="text-xs text-subtle text-center py-3">
            Log a few more days to see the trend.
          </p>
        }
      </app-card>

      <!-- ============== Sessions per week ============== -->
      <app-card class="block mb-3">
        <div class="flex items-center justify-between mb-3">
          <p class="text-xs uppercase tracking-wider font-bold text-muted">
            Sessions per week
          </p>
          <span class="text-[10px] text-subtle font-semibold">
            Last 8 weeks
          </span>
        </div>
        <app-bar-chart
          [data]="sessionsByWeekData()"
          colorVar="accent"
          ariaLabel="Workout sessions per week"
        />
      </app-card>

      <!-- ============== Volume trend ============== -->
      <app-card class="block mb-3">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-xs uppercase tracking-wider font-bold text-muted">
              {{ volumeLabel() }}
            </p>
            <p class="text-[10px] text-subtle">
              Last {{ volumeChartData().length }}
              {{ volumeChartData().length === 1 ? 'session' : 'sessions' }}
            </p>
          </div>
        </div>
        <app-line-chart
          [data]="volumeChartData()"
          [yLabel]="volumeUnit()"
          colorVar="electric"
          [yDecimals]="0"
          [showEndpointLabels]="true"
          ariaLabel="Per-session volume trend"
        />
      </app-card>

      <!-- ============== Lifetime stats ============== -->
      <div class="grid grid-cols-3 gap-2 mb-3">
        <app-card variant="subtle" class="block text-center">
          <p class="text-2xl font-extrabold num">{{ totalWorkouts() }}</p>
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold mt-1">
            Workouts
          </p>
        </app-card>
        <app-card variant="subtle" class="block text-center">
          <p class="text-2xl font-extrabold num">{{ totalMinutes() }}</p>
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold mt-1">
            Minutes
          </p>
        </app-card>
        <app-card variant="subtle" class="block text-center">
          <p class="text-2xl font-extrabold num">{{ thisWeekCount() }}</p>
          <p class="text-[10px] uppercase tracking-wider text-muted font-bold mt-1">
            This week
          </p>
        </app-card>
      </div>

      <p class="text-[10px] text-subtle text-center mt-4">
        Last 90 days of activity
      </p>
    </div>
  `,
})
export default class ProgressOverviewComponent {
  private readonly weightLog = inject(WeightLogService);
  private readonly stats = inject(ProgressStatsService);
  private readonly toast = inject(ToastService);

  protected readonly today = friendlyDate();

  // -------- Weight readouts --------
  protected readonly latestKg = this.weightLog.latestKg;
  protected readonly daysSince = this.weightLog.daysSinceLatest;
  protected readonly todayLogged = computed(() => this.weightLog.todayLog() !== null);

  protected readonly latestRelativeLabel = computed(() => {
    const d = this.daysSince();
    if (d === null) return '';
    if (d === 0) return 'Logged today';
    if (d === 1) return 'Logged yesterday';
    return `Logged ${d} days ago`;
  });

  /**
   * Weight chart points — keyed by date label. We thin to last 60 days max
   * so the chart stays readable even after a year of logging.
   */
  protected readonly weightChartData = computed<ChartPoint[]>(() => {
    const logs = this.weightLog.logs();
    if (logs.length === 0) return [];
    const sliced = logs.length > 60 ? logs.slice(-60) : logs;
    return sliced.map((l) => ({
      x: shortDate(l.date),
      y: l.weightKg,
    }));
  });

  // -------- Streak + sessions --------

  protected readonly streak = this.stats.currentStreak;

  protected readonly sessionsByWeekData = computed(() =>
    this.stats.sessionsByWeek().map((w) => ({ x: w.weekLabel, y: w.count })),
  );

  // -------- Volume chart --------

  protected readonly volumeMetric = this.stats.preferredVolumeMetric;

  protected readonly volumeChartData = computed<ChartPoint[]>(() => {
    const sessions = this.stats.sessionVolumes();
    if (sessions.length === 0) return [];
    const metric = this.volumeMetric();
    return sessions.map((s) => ({
      x: shortDate(s.date),
      y: metric === 'weighted' ? s.weightedVolumeKg : s.bodyweightScore,
    }));
  });

  protected readonly volumeLabel = computed(() =>
    this.volumeMetric() === 'weighted' ? 'Volume per session' : 'Session intensity',
  );

  protected readonly volumeUnit = computed(() =>
    this.volumeMetric() === 'weighted' ? ' kg·reps' : '',
  );

  // -------- Lifetime stats --------

  protected readonly totalWorkouts = this.stats.totalWorkouts;
  protected readonly totalMinutes = this.stats.totalMinutes;
  protected readonly thisWeekCount = this.stats.thisWeekCount;

  // -------- Weight form state --------

  protected readonly weightFormOpen = signal(false);
  protected readonly weightInput = signal('');
  protected readonly noteInput = signal('');
  protected readonly saving = signal(false);

  protected readonly canSubmitWeight = computed(() => {
    const v = parseFloat(this.weightInput());
    return Number.isFinite(v) && v >= 20 && v <= 400;
  });

  protected toggleWeightForm(): void {
    const next = !this.weightFormOpen();
    this.weightFormOpen.set(next);
    if (next) {
      // Pre-fill with the current latest weight as a sensible starting point.
      const cur = this.latestKg();
      this.weightInput.set(cur !== null ? cur.toFixed(1) : '');
      this.noteInput.set('');
    }
  }

  protected onWeightInput(event: Event): void {
    this.weightInput.set((event.target as HTMLInputElement).value);
  }

  protected onNoteInput(event: Event): void {
    this.noteInput.set((event.target as HTMLInputElement).value);
  }

  protected async submitWeight(): Promise<void> {
    if (!this.canSubmitWeight() || this.saving()) return;
    const weightKg = parseFloat(this.weightInput());
    this.saving.set(true);
    try {
      const result = await this.weightLog.log({
        weightKg,
        note: this.noteInput().trim() || undefined,
      });
      this.weightFormOpen.set(false);

      // Surface the cascade: only show the "Targets updated" toast when
      // it's actually going to happen, per locked decision.
      if (result.targetsWillRecompute) {
        this.toast.show('Targets updated based on latest weight');
      } else {
        this.toast.show('Weight saved');
      }
    } catch (err) {
      console.error('[Progress] weight save failed', err);
      this.toast.show(
        err instanceof Error ? err.message : 'Could not save weight',
        { tone: 'warning' },
      );
    } finally {
      this.saving.set(false);
    }
  }
}

/** "May 22" — compact label for chart axes. */
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
