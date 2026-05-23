import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

/**
 * Bootstrap configuration.
 *
 * Notable choices:
 *  - `withViewTransitions()` enables the View Transitions API on Chrome/Edge
 *    for smoother route changes; falls back gracefully on Safari/Firefox.
 *  - `withComponentInputBinding()` allows route params/data to bind directly
 *    to component inputs via `input()`.
 *  - `provideHttpClient(withFetch())` uses the Fetch API instead of
 *    XMLHttpRequest — required for proper service-worker integration.
 *  - Service worker only registers in production builds, with a delay so
 *    initial load isn't penalised by SW activation.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions(), withComponentInputBinding()),
    provideHttpClient(withFetch()),
    provideAnimationsAsync(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
