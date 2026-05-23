import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Routes } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-hydration-page',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">
      <header class="mb-6">
        <h1 class="text-2xl font-extrabold tracking-tight">Water</h1>
        <p class="text-sm text-muted mt-1">Today's hydration</p>
      </header>
      <div class="bg-surface rounded-3xl p-8 text-center">
        <div
          class="w-16 h-16 mx-auto rounded-2xl grid place-items-center mb-4"
          style="background: rgb(var(--electric) / 0.15); color: rgb(var(--electric));"
        >
          <app-icon name="droplet" [size]="28" />
        </div>
        <p class="font-bold mb-1">Hydration module — coming soon</p>
        <p class="text-sm text-muted">Module 6 of the MVP roadmap</p>
      </div>
    </div>
  `,
})
class HydrationPlaceholderComponent {}

export const HYDRATION_ROUTES: Routes = [
  { path: '', component: HydrationPlaceholderComponent },
];
