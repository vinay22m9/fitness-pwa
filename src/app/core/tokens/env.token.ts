import { InjectionToken } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Inject environment config via DI instead of importing `environment.ts`
 * everywhere. Makes services trivially testable (override in tests via
 * { provide: ENV, useValue: { ... } }).
 */
export type AppEnv = typeof environment;

export const ENV = new InjectionToken<AppEnv>('APP_ENV', {
  providedIn: 'root',
  factory: () => environment,
});
