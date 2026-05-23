import { Injectable, signal } from '@angular/core';
import { uuid } from '@shared/utils/id.util';

/**
 * Toast — short, non-blocking message at the bottom of the screen.
 *
 * Used for affirming user actions ("Targets updated based on latest weight")
 * and other low-stakes feedback. Errors that need acknowledgment should
 * still use a proper UI state, not a toast.
 *
 * Design:
 *   - Single active toast at a time. New `show()` replaces the previous one.
 *   - Auto-dismisses after 3.5s by default.
 *   - The renderer lives in the main-shell so this is global.
 *
 * Not used for:
 *   - Long messages (use a card or banner)
 *   - Errors needing user action (use inline UI)
 *   - Anything blocking (use a confirm/modal)
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _current = signal<ToastMessage | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly current = this._current.asReadonly();

  /**
   * Show a toast. Replaces any active toast. Auto-dismisses after `durationMs`.
   * Returns the toast id so callers can dismiss it early if needed.
   */
  show(text: string, opts?: { tone?: ToastTone; durationMs?: number }): string {
    const toast: ToastMessage = {
      id: uuid(),
      text,
      tone: opts?.tone ?? 'success',
    };
    const duration = opts?.durationMs ?? 3500;

    if (this.hideTimer) clearTimeout(this.hideTimer);
    this._current.set(toast);

    this.hideTimer = setTimeout(() => {
      // Only clear if this is still the active toast (a newer one may have
      // replaced it while we were waiting).
      if (this._current()?.id === toast.id) {
        this._current.set(null);
      }
      this.hideTimer = null;
    }, duration);

    return toast.id;
  }

  /** Manually dismiss the active toast. No-op if there isn't one. */
  dismiss(id?: string): void {
    const c = this._current();
    if (!c) return;
    if (id && c.id !== id) return;
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this._current.set(null);
  }
}

export type ToastTone = 'success' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
}
