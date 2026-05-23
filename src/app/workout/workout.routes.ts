import { Routes } from '@angular/router';

/**
 * Workout routes — lazy-loaded sub-pages of the Workout tab.
 *
 *   /workout            → list (today + alternatives + history link)
 *   /workout/active     → active session screen (gym-optimized)
 *   /workout/history    → last 14 days timeline
 *
 * Each page is its own default-exported component so Angular's route-level
 * code splitting kicks in. The active page bypasses to the list if there's
 * no in-progress session, so deep-linking can't break things.
 */
export const WORKOUT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/workout-list/workout-list.component'),
  },
  {
    path: 'active',
    loadComponent: () =>
      import('./pages/workout-active/workout-active.component'),
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./pages/workout-history/workout-history.component'),
  },
];
