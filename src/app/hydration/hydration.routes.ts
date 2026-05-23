import { Routes } from '@angular/router';

/**
 * Hydration routes.
 *
 * Single page for MVP — the water tab opens straight to the tracker.
 * Module 8 (Progress) will add a `/hydration/history` route reading
 * past HydrationLogs.
 */
export const HYDRATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/hydration-page/hydration-page.component'),
  },
];
