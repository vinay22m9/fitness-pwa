import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { CardComponent } from '@shared/components/card/card.component';
import { IconComponent } from '@shared/components/icon/icon.component';

import { DietTargetsService } from '@diet/services/diet-targets.service';

/**
 * Custom macros override.
 *
 * Lets the user manually set their daily target kcal and macro grams. Shows
 * a live macro-kcal sum so they can sanity-check that protein·4 + carbs·4 +
 * fats·9 lands near their target.
 *
 * Persisting via `saveCustom()` flips `mode` to 'custom', freezing the
 * auto-recompute effect — so editing profile after this won't blow away
 * their custom numbers. To revert: "Reset to auto" on the diet overview.
 */
@Component({
  selector: 'app-custom-macros',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter min-h-screen flex flex-col">

      <header class="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          type="button"
          class="w-9 h-9 rounded-xl bg-elevated grid place-items-center text-muted hover:text-text"
          (click)="back()"
          aria-label="Back"
        >
          <app-icon name="chevron_left" [size]="20" />
        </button>
        <div>
          <h1 class="text-xl font-extrabold tracking-tight">Custom macros</h1>
          <p class="text-xs text-muted">Override your auto-calculated targets</p>
        </div>
      </header>

      <main class="flex-1 px-5 pt-2 pb-8 space-y-4">

        <app-card class="block">
          <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            Daily calorie target
          </label>
          <div class="flex items-baseline gap-2">
            <input
              type="number"
              inputmode="numeric"
              [(ngModel)]="form.targetKcal"
              name="targetKcal"
              min="1000"
              max="6000"
              class="input-field flex-1 text-2xl"
            />
            <span class="text-muted font-medium">kcal</span>
          </div>
        </app-card>

        <app-card class="block">
          <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Macros (grams)
          </p>
          <div class="space-y-3">
            <div class="macro-row">
              <span class="macro-dot" style="background: rgb(var(--primary));"></span>
              <label class="flex-1 text-sm font-semibold">Protein</label>
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="form.proteinG"
                name="proteinG"
                min="0"
                max="500"
                class="input-field--inline"
              />
            </div>
            <div class="macro-row">
              <span class="macro-dot" style="background: rgb(var(--accent));"></span>
              <label class="flex-1 text-sm font-semibold">Carbs</label>
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="form.carbsG"
                name="carbsG"
                min="0"
                max="800"
                class="input-field--inline"
              />
            </div>
            <div class="macro-row">
              <span class="macro-dot" style="background: rgb(var(--warning));"></span>
              <label class="flex-1 text-sm font-semibold">Fats</label>
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="form.fatsG"
                name="fatsG"
                min="0"
                max="300"
                class="input-field--inline"
              />
            </div>
            <div class="macro-row">
              <span class="macro-dot" style="background: rgb(var(--muted));"></span>
              <label class="flex-1 text-sm font-semibold">Fiber</label>
              <input
                type="number"
                inputmode="numeric"
                [(ngModel)]="form.fiberG"
                name="fiberG"
                min="0"
                max="100"
                class="input-field--inline"
              />
            </div>
          </div>
        </app-card>

        <app-card class="block">
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-9 h-9 rounded-xl grid place-items-center"
              style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
            >
              <app-icon name="droplet" [size]="16" />
            </div>
            <label class="text-xs font-semibold text-muted uppercase tracking-wider flex-1">
              Water (ml)
            </label>
          </div>
          <input
            type="number"
            inputmode="numeric"
            [(ngModel)]="form.waterMl"
            name="waterMl"
            min="500"
            max="6000"
            step="100"
            class="input-field"
          />
        </app-card>

        <!-- Live sanity-check summary -->
        <app-card class="block" variant="subtle">
          <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Sanity check
          </p>
          <div class="space-y-2 text-sm num">
            <div class="flex justify-between">
              <span class="text-muted">From protein</span>
              <span class="font-semibold">{{ proteinKcal() }} kcal</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">From carbs</span>
              <span class="font-semibold">{{ carbsKcal() }} kcal</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">From fats</span>
              <span class="font-semibold">{{ fatsKcal() }} kcal</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-border/60">
              <span class="font-semibold">Macro total</span>
              <span class="font-extrabold">{{ macroTotalKcal() }} kcal</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Your target</span>
              <span class="font-semibold">{{ form.targetKcal }} kcal</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Gap</span>
              <span class="font-extrabold" [style.color]="gapColor()">
                {{ gapLabel() }}
              </span>
            </div>
          </div>
          @if (gapWarning()) {
            <p class="text-xs mt-3" style="color: rgb(var(--warning));">
              ⚠ {{ gapWarning() }}
            </p>
          }
        </app-card>

      </main>

      <footer class="px-5 pb-6 pt-2">
        @if (errorMsg()) {
          <p class="text-sm text-center mb-3" style="color: rgb(var(--danger));">
            {{ errorMsg() }}
          </p>
        }
        <button
          type="button"
          class="btn-primary w-full flex items-center justify-center gap-2"
          [disabled]="!isValid() || saving()"
          (click)="save()"
        >
          @if (saving()) {
            <span>Saving…</span>
          } @else {
            <app-icon name="check" [size]="18" />
            <span>Save custom plan</span>
          }
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .input-field {
      width: 100%;
      background: rgb(var(--elevated));
      color: rgb(var(--text));
      border: 1px solid rgb(var(--border));
      border-radius: 1rem;
      padding: 0.75rem 1rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      outline: none;
    }
    .input-field:focus {
      border-color: rgb(var(--primary));
      box-shadow: 0 0 0 3px rgb(var(--primary) / 0.18);
    }

    .input-field--inline {
      width: 5.5rem;
      background: rgb(var(--bg));
      color: rgb(var(--text));
      border: 1px solid rgb(var(--border));
      border-radius: 0.75rem;
      padding: 0.5rem 0.75rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-align: right;
      outline: none;
    }
    .input-field--inline:focus {
      border-color: rgb(var(--primary));
    }

    .macro-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .macro-dot {
      width: 0.625rem;
      height: 0.625rem;
      border-radius: 999px;
      flex-shrink: 0;
    }
  `],
})
export default class CustomMacrosComponent {
  private readonly targetsService = inject(DietTargetsService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  protected form = {
    targetKcal: 2000,
    proteinG: 140,
    carbsG: 220,
    fatsG: 60,
    fiberG: 30,
    waterMl: 2500,
  };

  constructor() {
    // Initialise from the current targets so the user starts from their
    // existing numbers (auto or custom) rather than a blank slate.
    effect(() => {
      const t = this.targetsService.targets();
      if (!t) return;
      this.form = {
        targetKcal: t.targetKcal,
        proteinG: t.proteinG,
        carbsG: t.carbsG,
        fatsG: t.fatsG,
        fiberG: t.fiberG,
        waterMl: t.waterMl,
      };
    });
  }

  // ---------- Live derived values ----------
  protected readonly proteinKcal = computed(() => this.form.proteinG * 4);
  protected readonly carbsKcal   = computed(() => this.form.carbsG   * 4);
  protected readonly fatsKcal    = computed(() => this.form.fatsG    * 9);

  protected readonly macroTotalKcal = computed(() =>
    this.proteinKcal() + this.carbsKcal() + this.fatsKcal(),
  );

  protected readonly gap = computed(() => this.macroTotalKcal() - this.form.targetKcal);

  protected gapLabel(): string {
    const g = this.gap();
    if (g === 0) return '0 kcal · exact';
    return g > 0 ? `+${g} kcal` : `${g} kcal`;
  }

  protected gapColor(): string {
    const g = Math.abs(this.gap());
    if (g <= 50)  return 'rgb(var(--primary))';
    if (g <= 150) return 'rgb(var(--warning))';
    return 'rgb(var(--danger))';
  }

  protected gapWarning(): string | null {
    const g = this.gap();
    if (Math.abs(g) <= 50) return null;
    if (Math.abs(g) <= 150) {
      return 'Macros are slightly off from your target. Close enough to work, but consider tweaking.';
    }
    return 'Macros and target are far apart. Either re-check the macro numbers or update the target.';
  }

  protected readonly isValid = computed(() => {
    return (
      this.form.targetKcal >= 1000 && this.form.targetKcal <= 6000 &&
      this.form.proteinG >= 0 && this.form.proteinG <= 500 &&
      this.form.carbsG >= 0 && this.form.carbsG <= 800 &&
      this.form.fatsG >= 0 && this.form.fatsG <= 300 &&
      this.form.fiberG >= 0 && this.form.fiberG <= 100 &&
      this.form.waterMl >= 500 && this.form.waterMl <= 6000
    );
  });

  protected back(): void {
    this.location.back();
  }

  protected async save(): Promise<void> {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    try {
      await this.targetsService.saveCustom({
        targetKcal: this.form.targetKcal,
        proteinG: this.form.proteinG,
        carbsG: this.form.carbsG,
        fatsG: this.form.fatsG,
        fiberG: this.form.fiberG,
        waterMl: this.form.waterMl,
      });
      await this.router.navigateByUrl('/diet');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save. Please try again.';
      this.errorMsg.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
