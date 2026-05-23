import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { liveQuery } from 'dexie';

import { AuthService } from '@auth/services/auth.service';
import { db } from '@core/db/app.db';
import { OutboxService } from '@core/sync/outbox.service';
import { SyncService } from '@core/sync/sync.service';
import type { Profile } from '@models/index';

/**
 * ProfileService — single source of truth for the signed-in user's profile.
 *
 * Reads from Dexie on init (and subscribes via Dexie's `liveQuery` so changes
 * pulled by the sync engine propagate to the UI automatically). Writes go
 * straight to Dexie, then enqueue an outbox upsert for SyncService to drain.
 *
 * Why a separate ProfileService vs reusing AuthService?
 *   - AuthService deals only with the *auth* user (email, id, session).
 *   - ProfileService deals with the *app* profile (age, weight, goal, etc.)
 *     which is a row in our `profiles` table — orthogonal concern.
 *
 * Lifecycle:
 *   - On AuthService.userId() change, this service re-subscribes its liveQuery
 *     to the new user's row.
 *   - On sign-out, the subscription is dropped and the signal goes null.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);
  private readonly outbox = inject(OutboxService);
  private readonly sync = inject(SyncService);

  private readonly _profile = signal<Profile | null>(null);
  private readonly _loaded = signal(false);

  readonly profile = this._profile.asReadonly();
  readonly isLoaded = this._loaded.asReadonly();

  /**
   * True when the user has completed onboarding (i.e. their profile row
   * has the minimum body-metric fields filled in). Used by `onboardingGuard`
   * and the post-sign-in router decision.
   */
  readonly hasCompletedOnboarding = computed<boolean>(() => {
    const p = this._profile();
    if (!p) return false;
    return (
      p.age > 0 &&
      p.heightCm > 0 &&
      p.weightKg > 0 &&
      !!p.gender &&
      !!p.activityLevel &&
      !!p.goal
    );
  });

  private subscription: { unsubscribe(): void } | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Re-bind the Dexie liveQuery whenever the auth user changes.
    effect(() => {
      const userId = this.auth.userId();
      this.bindToUser(userId);
    });

    destroyRef.onDestroy(() => {
      this.subscription?.unsubscribe();
      this.subscription = null;
    });
  }

  /**
   * Create OR update the profile for the current user.
   *
   * Two-write pattern (Dexie first, then outbox):
   *   1. Persist locally — UI updates instantly via liveQuery.
   *   2. Enqueue outbox item — SyncService drains it next online opportunity.
   */
  async save(partial: Partial<Profile>): Promise<Profile> {
    const userId = this.auth.userId();
    if (!userId) throw new Error('Cannot save profile: not signed in');

    const existing = await db.profile.get(userId);
    const now = new Date().toISOString();

    // Build the next row with explicit overrides LAST so the spread can't
    // accidentally re-introduce a stale id or wipe updatedAt.
    const defaults: Profile = {
      id: userId,
      email: this.auth.email() ?? undefined,
      age: 0,
      gender: 'other',
      heightCm: 0,
      weightKg: 0,
      activityLevel: 'moderate',
      goal: 'maintenance',
      createdAt: now,
      updatedAt: now,
    };

    const next: Profile = {
      ...defaults,
      ...existing,
      ...partial,
      id: userId,
      updatedAt: now,
    };

    await db.profile.put(next);
    await this.outbox.enqueue('profile', 'upsert', userId, next);
    this.sync.triggerSync();
    return next;
  }

  /** Convenience: update a single weight reading. */
  async updateWeight(weightKg: number): Promise<Profile | null> {
    if (!this._profile()) return null;
    return this.save({ weightKg });
  }

  private bindToUser(userId: string | null): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (!userId) {
      this._profile.set(null);
      this._loaded.set(false);
      return;
    }

    // liveQuery emits the current row on subscribe and again on any change.
    // SyncService writes to Dexie when pulling from Supabase, so this is
    // how remote changes propagate into the UI.
    const observable = liveQuery(() => db.profile.get(userId));
    this.subscription = observable.subscribe({
      next: (row) => {
        this._profile.set(row ?? null);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('[ProfileService] liveQuery error', err);
        this._profile.set(null);
        this._loaded.set(true);
      },
    });
  }
}
