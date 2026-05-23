import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from '@shared/components/bottom-nav/bottom-nav.component';
import { ToastComponent } from '@shared/components/toast/toast.component';

/**
 * Main authenticated shell.
 *
 * Layout:
 *  - Full-height container with scrollable content area
 *  - Floating bottom nav fixed at bottom (rendered via portal-style positioning)
 *  - Content gets bottom padding so the nav never overlaps it
 *
 * Why a separate shell from auth?
 *  - Auth screens (login) shouldn't show the bottom nav
 *  - Keeps the unauthenticated bundle smaller
 */
@Component({
  selector: 'app-main-shell',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent, ToastComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-bg text-text">
      <!-- Content area. Bottom padding clears the floating nav (~88px). -->
      <main class="pb-28">
        <router-outlet />
      </main>

      <app-bottom-nav />
      <app-toast />
    </div>
  `,
})
export class MainShellComponent {}
