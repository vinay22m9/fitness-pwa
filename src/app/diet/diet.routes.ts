import { Routes } from '@angular/router';

/**
 * Diet feature routes.
 *
 *   /diet           — overview (targets, BMI, macros, water)
 *   /diet/profile   — edit profile
 *   /diet/macros    — custom macros override
 *
 * All routes are protected by the outer authGuard on the main shell.
 * The onboardingGuard sits at the app level, so a user landing here
 * before onboarding is bounced to /onboarding automatically.
 */
export const DIET_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/diet-overview/diet-overview.component'),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile-edit/profile-edit.component'),
  },
  {
    path: 'macros',
    loadComponent: () =>
      import('./pages/custom-macros/custom-macros.component'),
  },
];
