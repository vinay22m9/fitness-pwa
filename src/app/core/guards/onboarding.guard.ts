import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '@auth/services/auth.service';
import { ProfileService } from '@diet/services/profile.service';

/**
 * Gates the main app behind onboarding.
 *
 * If the user is signed in but hasn't completed onboarding (no profile row,
 * or required fields missing), bounce them to /onboarding.
 *
 * Why a separate guard?
 *   - authGuard answers "is this user logged in?"
 *   - onboardingGuard answers "is this user *set up*?"
 *
 * Wait pattern: we wait for ProfileService.isLoaded() to flip true before
 * deciding, so a freshly-signed-in user doesn't briefly see onboarding while
 * their profile is being pulled from Supabase.
 */
export const onboardingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const profile = inject(ProfileService);
  const router = inject(Router);

  if (!auth.isAuthed()) return true;     // authGuard will handle this case

  // Wait up to ~2s for the profile to load (or for the first sync pull
  // to complete). After that, show onboarding rather than block the UI.
  const deadline = Date.now() + 2000;
  while (!profile.isLoaded() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }

  if (profile.hasCompletedOnboarding()) return true;
  return router.createUrlTree(['/onboarding']);
};

/**
 * Inverse guard for the onboarding route — if the user has ALREADY completed
 * onboarding, send them to /home instead of letting them re-do it.
 */
export const completedOnboardingGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const profile = inject(ProfileService);
  const router = inject(Router);

  if (!auth.isAuthed()) return router.createUrlTree(['/auth/login']);

  const deadline = Date.now() + 2000;
  while (!profile.isLoaded() && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }

  if (profile.hasCompletedOnboarding()) return router.createUrlTree(['/home']);
  return true;
};
