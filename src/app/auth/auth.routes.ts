import { Routes } from '@angular/router';
import { guestGuard } from '@core/guards/auth.guard';

/**
 * Auth routes — gated by `guestGuard` so that already-signed-in users
 * skip past these screens straight to /home.
 *
 * All pages are lazy-loaded; the auth shell provides the layout.
 */
export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page'),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/signup/signup.page'),
  },
  {
    path: 'verify',
    loadComponent: () => import('./pages/verify/verify.page'),
  },
];
