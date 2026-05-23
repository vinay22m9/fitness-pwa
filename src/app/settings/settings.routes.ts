import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Routes } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-enter px-5 pt-6">
      <header class="mb-6">
        <h1 class="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p class="text-sm text-muted mt-1">Profile, preferences, about</p>
      </header>
      <div class="bg-surface rounded-3xl p-8 text-center">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-elevated grid place-items-center mb-4 text-muted">
          <app-icon name="settings" [size]="28" />
        </div>
        <p class="font-bold mb-1">Settings module — coming soon</p>
        <p class="text-sm text-muted">Module 10 of the MVP roadmap</p>
      </div>
    </div>
  `,
})
class SettingsPlaceholderComponent {}

export const SETTINGS_ROUTES: Routes = [
  { path: '', component: SettingsPlaceholderComponent },
];
