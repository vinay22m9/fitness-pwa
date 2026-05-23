import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '@auth/services/auth.service';

/**
 * Route guard for authenticated areas.
 *
 * Behaviour:
 *   - If auth state isn't ready yet, wait for it (this handles the case
 *     where the app is opened cold and we need to restore the session
 *     from localStorage before deciding).
 *   - If authed, allow.
 *   - If not authed, redirect to /auth/login.
 *
 * Why an effect instead of a Subject? We use signals everywhere; this
 * keeps the codebase consistent. The promise resolves as soon as
 * `isReady()` flips to true.
 */
export const authGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for the initial session-restore to complete.
  if (!auth.isReady()) {
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (auth.isReady()) {
          clearInterval(id);
          resolve();
        }
      }, 30);
    });
  }

  if (auth.isAuthed()) return true;
  return router.createUrlTree(['/auth/login']);
};

/**
 * Inverse guard — used on auth routes so an already-signed-in user
 * doesn't see the login screen. Bounces them to /home.
 */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isReady()) {
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (auth.isReady()) {
          clearInterval(id);
          resolve();
        }
      }, 30);
    });
  }

  if (!auth.isAuthed()) return true;
  return router.createUrlTree(['/home']);
};
