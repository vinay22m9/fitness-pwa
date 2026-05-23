import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardComponent } from '@shared/components/card/card.component';
import { ProgressRingComponent } from '@shared/components/progress-ring/progress-ring.component';
import { friendlyDate } from '@shared/utils/date.util';

/**
 * Dashboard / Home placeholder.
 *
 * This is a STATIC mock for Module 1 — real data integration arrives with
 * the dashboard module (Phase 4). For now it renders the design language
 * with hardcoded values so we can validate the visual system end-to-end.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconComponent, CardComponent, ProgressRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">

      <!-- Header -->
      <header class="flex items-start justify-between mb-6">
        <div>
          <p class="text-xs text-muted font-semibold">{{ today }}</p>
          <h1 class="text-2xl font-extrabold tracking-tight mt-1">
            Good morning
          </h1>
        </div>
        <button
          class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted"
          aria-label="Settings"
        >
          <app-icon name="user" [size]="20" />
        </button>
      </header>

      <!-- Hero workout card -->
      <app-card variant="hero" class="block mb-3">
        <div class="flex items-start justify-between mb-4">
          <div>
            <span class="chip-primary">Today · Pull &amp; Legs</span>
            <h2 class="text-xl font-bold mt-2">5 exercises</h2>
            <p class="text-sm text-muted mt-1">~45 min · Back, Biceps, Quads</p>
          </div>
          <div
            class="w-14 h-14 rounded-2xl grid place-items-center text-2xl"
            style="background: rgb(var(--primary) / 0.12);"
          >
            💪
          </div>
        </div>
        <button class="btn-primary w-full flex items-center justify-center gap-2">
          <app-icon name="zap" [size]="18" />
          Start Workout
        </button>
      </app-card>

      <!-- Stats row -->
      <div class="grid grid-cols-2 gap-3 mb-3">
        <app-card>
          <div class="flex items-center gap-2 mb-3">
            <div
              class="w-7 h-7 rounded-lg grid place-items-center"
              style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
            >
              <app-icon name="droplet" [size]="14" />
            </div>
            <span class="text-xs text-muted font-semibold">Water</span>
          </div>
          <p class="text-xl font-bold num">
            1.8<span class="text-sm text-muted font-medium">/3.0L</span>
          </p>
          <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              style="width: 60%; background: rgb(var(--electric));"
            ></div>
          </div>
        </app-card>

        <app-card>
          <div class="flex items-center gap-2 mb-3">
            <div
              class="w-7 h-7 rounded-lg grid place-items-center"
              style="background: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
            >
              <app-icon name="flame" [size]="14" />
            </div>
            <span class="text-xs text-muted font-semibold">Calories</span>
          </div>
          <p class="text-xl font-bold num">
            1,450<span class="text-sm text-muted font-medium">/2,600</span>
          </p>
          <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              style="width: 55%; background: rgb(var(--accent));"
            ></div>
          </div>
        </app-card>
      </div>

      <!-- Macros card -->
      <app-card class="block mb-3">
        <p class="text-xs uppercase tracking-wider text-muted font-bold mb-4">
          Macros
        </p>

        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Protein</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">92</span> / 140 g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                style="width: 66%; background: rgb(var(--primary));"
              ></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Carbs</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">180</span> / 280 g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                style="width: 64%; background: rgb(var(--accent));"
              ></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Fats</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">42</span> / 70 g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                style="width: 60%; background: rgb(var(--warning));"
              ></div>
            </div>
          </div>
        </div>
      </app-card>

      <p class="text-center text-xs text-subtle mt-6 mb-2">
        Module 1 · Shell &amp; Foundation
      </p>
    </div>
  `,
})
export default class DashboardComponent {
  protected readonly today = friendlyDate();
}
