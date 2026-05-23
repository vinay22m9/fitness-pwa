import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Routes } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Login placeholder. Real Supabase Google sign-in arrives in Module 2.
 * For now this gives the auth shell something to render so routing works.
 */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 flex flex-col items-center justify-center px-6">
      <div
        class="w-20 h-20 rounded-3xl grid place-items-center mb-6 text-primary"
        style="background: rgb(var(--primary) / 0.12);"
      >
        <app-icon name="dumbbell" [size]="40" />
      </div>
      <h1 class="text-3xl font-extrabold tracking-tight mb-2">Fitness Coach</h1>
      <p class="text-muted text-center mb-10">
        Personal workouts, diet &amp; hydration — built for you.
      </p>
      <button
        class="btn-primary w-full max-w-sm flex items-center justify-center gap-2"
        disabled
      >
        Continue with Google
      </button>
      <p class="text-xs text-subtle mt-4">Auth ships in Module 2</p>
    </div>
  `,
})
class LoginPlaceholderComponent {}

export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPlaceholderComponent },
];
