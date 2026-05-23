import { Injectable, inject } from '@angular/core';
import { ENV } from '@core/tokens/env.token';

/**
 * Thin PostHog wrapper.
 *
 * MVP: no-op if `posthogKey` is empty (which it is in dev by default).
 * When you add the key, this auto-initialises on first capture call.
 *
 * Why a wrapper?
 *  - allows the rest of the app to call analytics.capture('event') without
 *    null checks or feature flags
 *  - centralised place to add user identification, opt-out, etc.
 */

type PosthogLike = {
  init: (key: string, opts: Record<string, unknown>) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly env = inject(ENV);
  private posthog: PosthogLike | null = null;
  private initialised = false;
  private initPromise: Promise<void> | null = null;

  /** Lazy-load PostHog only when first event fires. Saves ~30KB on initial load. */
  private async ensureReady(): Promise<void> {
    if (this.initialised) return;
    if (!this.env.posthogKey) return;            // analytics disabled

    if (!this.initPromise) {
      this.initPromise = import('posthog-js').then((mod) => {
        this.posthog = mod.default as unknown as PosthogLike;
        this.posthog.init(this.env.posthogKey, {
          api_host: this.env.posthogHost,
          capture_pageview: false,                // we'll fire manually on route change
          persistence: 'localStorage',
          disable_session_recording: true,        // privacy-respecting MVP
        });
        this.initialised = true;
      });
    }
    return this.initPromise;
  }

  async capture(event: string, props?: Record<string, unknown>): Promise<void> {
    await this.ensureReady();
    this.posthog?.capture(event, props);
  }

  async identify(userId: string, props?: Record<string, unknown>): Promise<void> {
    await this.ensureReady();
    this.posthog?.identify(userId, props);
  }

  async reset(): Promise<void> {
    await this.ensureReady();
    this.posthog?.reset();
  }
}
