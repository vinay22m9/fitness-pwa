import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Routes } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-diet-page',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">
      <header class="mb-6">
        <h1 class="text-2xl font-extrabold tracking-tight">Diet</h1>
        <p class="text-sm text-muted mt-1">Today's meal plan</p>
      </header>
      <div class="bg-surface rounded-3xl p-8 text-center">
        <div
          class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4"
          style="background: rgb(var(--accent) / 0.15); color: rgb(var(--accent));"
        >
          <app-icon name="fork" [size]="28" />
        </div>
        <p class="font-bold mb-1">Diet module — coming soon</p>
        <p class="text-sm text-muted">Module 4 &amp; 5 of the MVP roadmap</p>
      </div>
    </div>
  `,
})
class DietPlaceholderComponent {}

export const DIET_ROUTES: Routes = [
  { path: '', component: DietPlaceholderComponent },
];
