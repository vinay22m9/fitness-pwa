import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, merge } from 'rxjs';

/**
 * Tracks online/offline status as a signal.
 *
 * Reads `navigator.onLine` at startup, then listens for window events.
 * Consumed by SyncService to know when to drain the outbox, and by UI
 * to show an offline banner.
 *
 * NOTE: `navigator.onLine === true` doesn't guarantee server reachability —
 * only that the OS thinks a network is present. For MVP that's good enough;
 * Supabase calls will fail naturally if the server is unreachable and the
 * outbox will retry.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly _online = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  /** Read-only signal — true when browser reports online. */
  readonly online = this._online.asReadonly();

  constructor() {
    const destroyRef = inject(DestroyRef);

    merge(fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this._online.set(navigator.onLine));
  }
}
