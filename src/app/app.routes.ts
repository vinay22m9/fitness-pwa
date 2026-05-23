import { Routes } from '@angular/router';

/**
 * App-level routes.
 *
 * Auth shell is mounted at /auth, main shell at root.
 * Every feature is lazy-loaded — initial bundle stays lean.
 *
 * The auth guard is NOT applied yet — it arrives with the Auth module.
 * Right now all routes are publicly reachable so we can navigate the
 * shell without sign-in.
 */
export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./layout/auth-shell/auth-shell.component').then((m) => m.AuthShellComponent),
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
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
