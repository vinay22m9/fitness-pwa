import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '@auth/services/auth.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardComponent } from '@shared/components/card/card.component';
import { friendlyDate } from '@shared/utils/date.util';

import { DietTargetsService } from '@diet/services/diet-targets.service';
import { ProfileService } from '@diet/services/profile.service';

/**
 * Dashboard / Home.
 *
 * Module 4: the dashboard now reads REAL diet targets from DietTargetsService
 * (which derives them from the user's profile via DietCalculatorService).
 *
 * Consumed-today metrics (calories logged, water drunk, macros eaten) are
 * still mock values — those come from Modules 5/6 (meal logs + hydration).
 * We surface them as zero-progress bars so the UI is structurally complete
 * and ready to wire up.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">

      <!-- Header -->
      <header class="flex items-start justify-between mb-6">
        <div>
          <p class="text-xs text-muted font-semibold">{{ today }}</p>
          <h1 class="text-2xl font-extrabold tracking-tight mt-1">
            {{ greeting() }}
          </h1>
        </div>
        <button
          class="w-10 h-10 rounded-2xl bg-elevated grid place-items-center text-muted hover:text-text transition-colors"
          (click)="signOut()"
          aria-label="Sign out"
        >
          <app-icon name="user" [size]="20" />
        </button>
      </header>

      <!-- Hero workout card (still mock — Module 6 wires this up to RotationState) -->
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

      <!-- Stats row — water + calories. Now reading real targets. -->
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
            0<span class="text-sm text-muted font-medium">
              / {{ (waterGoalMl() / 1000).toFixed(1) }}L
            </span>
          </p>
          <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              [style.width.%]="0"
              style="background: rgb(var(--electric));"
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
            0<span class="text-sm text-muted font-medium">
              / {{ targetKcal() | number }}
            </span>
          </p>
          <div class="mt-2.5 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              [style.width.%]="0"
              style="background: rgb(var(--accent));"
            ></div>
          </div>
        </app-card>
      </div>

      <!-- Macros card -->
      <app-card class="block mb-3">
        <div class="flex items-center justify-between mb-4">
          <p class="text-xs uppercase tracking-wider text-muted font-bold">Macros</p>
          <a
            routerLink="/diet"
            class="text-xs font-semibold"
            style="color: rgb(var(--primary));"
          >
            View plan →
          </a>
        </div>
        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Protein</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">0</span> / {{ proteinG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="0"
                   style="background: rgb(var(--primary));"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Carbs</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">0</span> / {{ carbsG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="0"
                   style="background: rgb(var(--accent));"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-semibold">Fats</span>
              <span class="text-muted num">
                <span class="text-text font-semibold">0</span> / {{ fatsG() }} g
              </span>
            </div>
            <div class="h-1.5 bg-border rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                   [style.width.%]="0"
                   style="background: rgb(var(--warning));"></div>
            </div>
          </div>
        </div>
      </app-card>

      @if (email()) {
        <p class="text-center text-xs text-subtle mt-6 mb-2">
          Signed in as {{ email() }} · tap avatar to sign out
        </p>
      }
    </div>
  `,
})
export default class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly targetsService = inject(DietTargetsService);

  protected readonly today = friendlyDate();
  protected readonly email = this.auth.email;

  // -------- Greeting --------
  // Prefer profile.displayName (set during onboarding). Fall back to the
  // local-part of the email, then to a generic greeting.
  protected readonly greeting = computed(() => {
    const name = this.profileService.profile()?.displayName?.trim();
    if (name) return `Good morning, ${name.split(' ')[0]}`;
    const e = this.auth.email();
    if (e) {
      const local = e.split('@')[0];
      const first = local.split(/[._-]/)[0];
      return `Good morning, ${first.charAt(0).toUpperCase() + first.slice(1)}`;
    }
    return 'Good morning';
  });

  // -------- Diet targets readouts --------
  // Sensible fallbacks so the dashboard never shows "NaN/0" while the
  // targets row is loading.
  protected readonly targetKcal = computed(() => this.targetsService.targets()?.targetKcal ?? 2000);
  protected readonly proteinG   = computed(() => this.targetsService.targets()?.proteinG   ?? 140);
  protected readonly carbsG     = computed(() => this.targetsService.targets()?.carbsG     ?? 220);
  protected readonly fatsG      = computed(() => this.targetsService.targets()?.fatsG      ?? 60);
  protected readonly waterGoalMl = computed(() => this.targetsService.targets()?.waterMl   ?? 2500);

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
