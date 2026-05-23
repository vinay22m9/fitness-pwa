import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Unauthenticated shell — bare layout without the bottom nav.
 * Used for the login screen and any future onboarding flows.
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-bg text-text flex flex-col">
      <router-outlet />
    </div>
  `,
})
export class AuthShellComponent {}
