import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NetworkService } from '@core/services/network.service';

/**
 * Root component.
 *
 * Holds:
 *  - the router outlet
 *  - the global offline banner (visible only when offline)
 *
 * Anything global that needs DOM presence on every page lives here.
 * Per-page chrome (headers, bottom nav) lives in the shells.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!network.online()) {
      <div
        class="fixed top-0 left-0 right-0 z-50 text-center text-xs font-semibold py-1.5
               text-bg"
        style="background: rgb(var(--warning)); padding-top: calc(env(safe-area-inset-top, 0px) + 6px);"
      >
        Offline · changes will sync when you reconnect
      </div>
    }
    <router-outlet />
  `,
})
export class AppComponent {
  protected readonly network = inject(NetworkService);
}
