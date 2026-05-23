import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ProgressRingComponent } from '@shared/components/progress-ring/progress-ring.component';
import { friendlyDate } from '@shared/utils/date.util';

import { DietTargetsService } from '@diet/services/diet-targets.service';

import { HydrationService } from '@hydration/services/hydration.service';

/**
 * Hydration page — Water tab.
 *
 * Layout:
 *   1. Header: friendly date.
 *   2. Hero ring: big progress ring showing total / goal.
 *      Center text: "1.4 L / 2.5 L" with remaining / "Goal reached" hint.
 *      Workout-day badge if applicable.
 *   3. Quick-add row: +250 / +500 / +750 / +1000 ml buttons.
 *   4. Entries list: today's log entries, each with a delete button.
 *      "Undo last" CTA at the top of the list for the common case.
 *   5. Footer: "Start over" to reset the day.
 *
 * Design notes:
 *   - Big tap targets (every button is ≥44px).
 *   - Electric-blue accent throughout (water = --electric).
 *   - The "+" actions kick straight into HydrationService; no confirmation —
 *     undo is one tap away.
 *   - The list updates reactively via signals — no manual refresh.
 */
@Component({
  selector: 'app-hydration-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, CardComponent, IconComponent, ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6 pb-4">
      <header class="mb-5">
        <p class="text-xs text-muted font-semibold">{{ today }}</p>
        <h1 class="text-2xl font-extrabold tracking-tight mt-1">Water</h1>
      </header>

      <!-- ============== Ring hero ============== -->
      <app-card variant="hero" class="block mb-3">
        <div class="flex items-center justify-center my-2">
          <app-progress-ring
            [value]="totalMl()"
            [max]="goalMl()"
            [size]="200"
            [stroke]="14"
            colorVar="--electric"
          >
            <div class="text-center">
              <p class="text-3xl font-extrabold num tracking-tight">
                {{ totalLiters() | number: '1.2-2' }}
                <span class="text-lg text-muted font-bold">L</span>
              </p>
              <p class="text-xs text-muted font-semibold mt-1 num">
                of {{ goalLiters() | number: '1.1-1' }} L
              </p>
              <p class="text-[10px] uppercase tracking-wider font-bold mt-2"
                 [style.color]="goalReached()
                   ? 'rgb(var(--primary))'
                   : 'rgb(var(--muted))'">
                @if (goalReached()) {
                  Goal reached 🎉
                } @else {
                  {{ remainingMl() }} ml to go
                }
              </p>
            </div>
          </app-progress-ring>
        </div>

        @if (isWorkoutDay()) {
          <div class="flex items-center justify-center mt-3">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
              style="background: rgb(var(--primary) / 0.12); color: rgb(var(--primary));"
            >
              <app-icon name="zap" [size]="12" />
              Workout day · +{{ bonusMl() }} ml
            </span>
          </div>
        }
      </app-card>

      <!-- ============== Quick-add buttons ============== -->
      <p class="text-xs uppercase tracking-wider text-muted font-bold px-1 mt-6 mb-3">
        Quick add
      </p>
      <div class="grid grid-cols-4 gap-2.5">
        @for (preset of presets; track preset) {
          <button
            class="bg-surface rounded-2xl py-4 px-1 flex flex-col items-center gap-1.5
                   border border-border/40 active:opacity-80"
            (click)="quickAdd(preset)"
            [attr.aria-label]="'Add ' + preset + ' millilitres'"
          >
            <div
              class="w-9 h-9 rounded-xl grid place-items-center"
              style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
            >
              <app-icon name="plus" [size]="18" />
            </div>
            <span class="text-sm font-extrabold num">{{ preset }}</span>
            <span class="text-[10px] text-muted font-bold">ml</span>
          </button>
        }
      </div>

      <!-- ============== Entries ============== -->
      <div class="flex items-center justify-between px-1 mt-6 mb-3">
        <p class="text-xs uppercase tracking-wider text-muted font-bold">
          Today
          @if (entries().length > 0) {
            · {{ entries().length }} {{ entries().length === 1 ? 'entry' : 'entries' }}
          }
        </p>
        @if (lastEntry()) {
          <button
            class="text-xs font-bold flex items-center gap-1"
            style="color: rgb(var(--electric));"
            (click)="undoLast()"
            [disabled]="busy()"
          >
            <app-icon name="undo" [size]="14" />
            Undo last
          </button>
        }
      </div>

      @if (entries().length === 0) {
        <app-card class="block text-center">
          <div
            class="w-14 h-14 mx-auto rounded-2xl grid place-items-center mb-3"
            style="background: rgb(var(--electric) / 0.10); color: rgb(var(--electric));"
          >
            <app-icon name="droplet" [size]="24" />
          </div>
          <p class="font-bold">No water logged yet</p>
          <p class="text-xs text-muted mt-1">Tap one of the buttons above to start</p>
        </app-card>
      } @else {
        <ul class="space-y-2">
          @for (entry of reversedEntries(); track entry.at; let i = $index) {
            <li
              class="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3
                     border border-border/30"
            >
              <div
                class="w-10 h-10 rounded-xl grid place-items-center shrink-0"
                style="background: rgb(var(--electric) / 0.12); color: rgb(var(--electric));"
              >
                <app-icon name="droplet" [size]="18" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-extrabold num">+{{ entry.ml }} ml</p>
                <p class="text-xs text-muted num">
                  {{ entry.at | date: 'shortTime' }}
                </p>
              </div>
              <button
                class="w-9 h-9 rounded-xl bg-elevated grid place-items-center text-subtle active:text-danger"
                (click)="removeAt(i)"
                [disabled]="busy()"
                [attr.aria-label]="'Remove ' + entry.ml + ' ml entry'"
              >
                <app-icon name="trash" [size]="16" />
              </button>
            </li>
          }
        </ul>
      }

      <!-- ============== Reset footer ============== -->
      @if (entries().length > 0) {
        <button
          class="mt-6 w-full flex items-center justify-center gap-2 py-3 text-sm text-muted font-semibold"
          (click)="clearAll()"
          [disabled]="busy()"
        >
          <app-icon name="refresh" [size]="14" />
          Start over
        </button>
      }
    </div>
  `,
})
export default class HydrationPageComponent {
  private readonly hydration = inject(HydrationService);
  private readonly dietTargets = inject(DietTargetsService);

  protected readonly today = friendlyDate();
  protected readonly presets = [250, 500, 750, 1000] as const;

  // Re-expose service signals to the template.
  protected readonly totalMl = this.hydration.totalMl;
  protected readonly goalMl = this.hydration.goalMl;
  protected readonly remainingMl = this.hydration.remainingMl;
  protected readonly goalReached = this.hydration.goalReached;
  protected readonly entries = this.hydration.entries;
  protected readonly lastEntry = this.hydration.lastEntry;
  protected readonly isWorkoutDay = this.hydration.isWorkoutDay;

  // Convenience derivations
  protected readonly totalLiters = computed(() => this.totalMl() / 1000);
  protected readonly goalLiters = computed(() => this.goalMl() / 1000);

  /** Entries shown newest-first in the UI (the service stores oldest-first). */
  protected readonly reversedEntries = computed(() =>
    [...this.entries()].reverse(),
  );

  /**
   * Bonus to display in the workout-day chip. Reads it from DietTargets so
   * that customized values stay accurate. Falls back to 500 (model default).
   */
  protected readonly bonusMl = computed(
    () => this.dietTargets.targets()?.workoutDayBonusMl ?? 500,
  );

  /** Flips true during any pending mutation so duplicate taps are ignored. */
  protected readonly busy = signal(false);

  protected async quickAdd(ml: number): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.hydration.add(ml);
    } finally {
      this.busy.set(false);
    }
  }

  protected async undoLast(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.hydration.undoLast();
    } finally {
      this.busy.set(false);
    }
  }

  protected async removeAt(reversedIndex: number): Promise<void> {
    if (this.busy()) return;
    // The list shows entries reversed (newest first), so map back to the
    // service's internal index.
    const total = this.entries().length;
    const realIndex = total - 1 - reversedIndex;
    this.busy.set(true);
    try {
      await this.hydration.removeEntry(realIndex);
    } finally {
      this.busy.set(false);
    }
  }

  protected async clearAll(): Promise<void> {
    if (this.busy()) return;
    if (!confirm("Reset today's water log to zero?")) return;
    this.busy.set(true);
    try {
      await this.hydration.clearToday();
    } finally {
      this.busy.set(false);
    }
  }
}
