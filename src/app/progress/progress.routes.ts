import { Routes } from '@angular/router';

/**
 * Progress routes — Module 8.
 *
 *   /progress           → overview (streak + weight + sessions + volume + stats)
 *
 * Single page for MVP. Future:
 *   /progress/weight    → full weight history with edit/delete
 *   /progress/sessions  → session-level drilldown
 */
export const PROGRESS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/progress-overview/progress-overview.component'),
  },
];
