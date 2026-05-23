import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '@core/services/supabase.service';
import { StorageService } from '@core/services/storage.service';
import { AnalyticsService } from '@core/services/analytics.service';
import { SyncService } from '@core/sync/sync.service';

/**
 * AuthService — single source of truth for authentication state.
 *
 * Exposes signals:
 *   user()       — current Supabase user, or null
 *   session()    — current session, or null
 *   isAuthed()   — derived boolean
 *   isReady()    — true once we've checked for a stored session
 *
 * On construction, restores the session from localStorage (Supabase handles
 * this internally via persistSession=true) and subscribes to auth-state
 * changes so signals stay current across sign-in/out and token refreshes.
 *
 * All sign-in / sign-up / sign-out flows return discriminated results
 * `{ ok: true } | { ok: false, error: string }` so the UI can render
 * inline error messages without leaking raw Supabase error objects.
 */

export type AuthResult =
  | { ok: true }
  | { ok: true; needsEmailConfirmation: true }
  | { ok: false; error: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly storage = inject(StorageService);
  private readonly analytics = inject(AnalyticsService);
  private readonly sync = inject(SyncService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // -------- State signals --------
  private readonly _user = signal<User | null>(null);
  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal<boolean>(false);

  readonly user = this._user.asReadonly();
  readonly session = this._session.asReadonly();
  readonly isReady = this._ready.asReadonly();
  readonly isAuthed = computed(() => this._session() !== null);
  readonly userId = computed(() => this._user()?.id ?? null);
  readonly email = computed(() => this._user()?.email ?? null);

  constructor() {
    // 1. Restore any persisted session at startup
    void this.bootstrap();

    // 2. Subscribe to all future auth events
    const { data } = this.supabase.client.auth.onAuthStateChange((event, session) => {
      this.handleAuthChange(event, session);
    });

    this.destroyRef.onDestroy(() => data.subscription.unsubscribe());
  }

  // -------- Public API --------

  /**
   * Sign in with email + password.
   * Returns a discriminated result so the UI can show inline errors.
   */
  async signInWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, error: this.friendlyError(error.message) };
    }
    void this.analytics.capture('auth_signin', { method: 'password' });
    if (data.user) void this.analytics.identify(data.user.id, { email: data.user.email });
    return { ok: true };
  }

  /**
   * Create an account. If email confirmation is enabled in Supabase, the
   * caller will get `{ ok: true, needsEmailConfirmation: true }` and the user
   * will NOT be logged in yet — show a "check your inbox" screen.
   *
   * If confirmation is disabled (recommended for this app), the session
   * is created immediately and the normal `onAuthStateChange` handler
   * kicks in to navigate to /home.
   */
  async signUpWithPassword(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, error: this.friendlyError(error.message) };
    }

    void this.analytics.capture('auth_signup', { method: 'password' });

    // Supabase quirk: when "Confirm email" is ON and the email already exists,
    // Supabase returns a fake user with `identities: []` and no session — instead
    // of an "already registered" error. Detect this and surface a clear message.
    // We check `!== undefined` rather than truthy because Array.isArray([]) is true
    // but [].length is 0 which is falsy — easy mistake on previous attempt.
    if (data.user && !data.session) {
      const identities = data.user.identities;
      if (identities !== undefined && identities.length === 0) {
        return { ok: false, error: 'An account with this email already exists. Try signing in instead.' };
      }
      // Genuine "needs confirmation" path
      return { ok: true, needsEmailConfirmation: true };
    }

    // Defensive: if neither session nor user came back, something odd happened
    if (!data.user && !data.session) {
      return { ok: false, error: 'Sign-up did not complete. Please try again.' };
    }

    return { ok: true };
  }

  /** Send a fresh confirmation / magic-link email. */
  async resendConfirmation(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    if (error) return { ok: false, error: this.friendlyError(error.message) };
    return { ok: true };
  }

  /** Send a password-reset email. */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/login` },
    );
    if (error) return { ok: false, error: this.friendlyError(error.message) };
    return { ok: true };
  }

  /**
   * Sign out and clear local app state.
   * Note: we do NOT wipe Dexie here — local data stays so the user can
   * sign back in and pick up where they left off. Real account deletion
   * (different feature) would wipe everything.
   */
  async signOut(): Promise<void> {
    // Stop sync FIRST so no late heartbeats fire after we clear cursors.
    this.sync.teardown();
    await this.supabase.client.auth.signOut();
    this.storage.clearAll();
    void this.analytics.reset();
    await this.router.navigateByUrl('/auth/login');
  }

  // -------- Internals --------

  private async bootstrap(): Promise<void> {
    const { data } = await this.supabase.client.auth.getSession();
    this._session.set(data.session);
    this._user.set(data.session?.user ?? null);
    this._ready.set(true);

    if (data.session?.user) {
      void this.analytics.identify(data.session.user.id, {
        email: data.session.user.email,
      });
      // Kick off sync — pull fresh server state, then drain any pending writes.
      // Errors are swallowed inside SyncService; local data still works.
      void this.sync.bootstrapForUser(data.session.user.id);
    }
  }

  private handleAuthChange(event: AuthChangeEvent, session: Session | null): void {
    this._session.set(session);
    this._user.set(session?.user ?? null);
    this._ready.set(true);

    // Auto-navigate on the events that matter to the user
    if (event === 'SIGNED_IN') {
      if (session?.user) void this.sync.bootstrapForUser(session.user.id);
      void this.router.navigateByUrl('/home');
    } else if (event === 'SIGNED_OUT') {
      this.sync.teardown();
      void this.router.navigateByUrl('/auth/login');
    }
  }

  /**
   * Map raw Supabase auth errors to user-friendly text.
   * Supabase error messages are exposed verbatim and aren't always nice.
   */
  private friendlyError(raw: string): string {
    const lower = raw.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'Wrong email or password.';
    if (lower.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox.';
    if (lower.includes('user already registered')) return 'An account with this email already exists.';
    if (lower.includes('password should be at least')) return 'Password must be at least 6 characters.';
    if (lower.includes('unable to validate email address')) return 'That email address looks invalid.';
    if (lower.includes('rate limit')) return 'Too many attempts. Please wait a minute and try again.';
    if (lower.includes('network')) return 'Network problem. Check your connection and try again.';
    return raw; // fallback — at least show something
  }
}
