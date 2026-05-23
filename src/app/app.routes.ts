import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { onboardingGuard, completedOnboardingGuard } from '@core/guards/onboarding.guard';

/**
 * App-level routes.
 *
 * Three top-level shells:
 *   /auth/*       → AuthShellComponent      (no bottom nav, guest-only)
 *   /onboarding   → AuthShellComponent      (no bottom nav, requires auth +
 *                                            incomplete profile)
 *   /            → MainShellComponent       (bottom nav, requires auth +
 *                                            completed onboarding)
 *
 * Guard chain on /home/* etc:
 *   authGuard         — must be signed in
 *   onboardingGuard   — profile must be complete (else → /onboarding)
 *
 * All features are lazy-loaded for a lean initial bundle.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./layout/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    // Onboarding shares the auth shell (no bottom nav) since the user hasn't
    // really "entered" the app yet. Sits at the top level so the bottom nav
    // doesn't render during setup.
    path: 'onboarding',
    canActivate: [authGuard, completedOnboardingGuard],
    loadComponent: () =>
      import('./layout/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./diet/pages/onboarding/onboarding.component'),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () =>
      import('./layout/main-shell/main-shell.component').then((m) => m.MainShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./dashboard/dashboard.component'),
      },
      {
        path: 'workout',
        loadChildren: () =>
          import('./workout/workout.routes').then((m) => m.WORKOUT_ROUTES),
      },
      {
        path: 'diet',
        loadChildren: () => import('./diet/diet.routes').then((m) => m.DIET_ROUTES),
      },
      {
        path: 'hydration',
        loadChildren: () =>
          import('./hydration/hydration.routes').then((m) => m.HYDRATION_ROUTES),
      },
      {
        path: 'progress',
        loadChildren: () =>
          import('./progress/progress.routes').then((m) => m.PROGRESS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
