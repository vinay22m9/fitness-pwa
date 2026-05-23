import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ENV } from '@core/tokens/env.token';

/**
 * Supabase client wrapper.
 *
 * This module only exposes the client. Auth flows, queries, and realtime
 * subscriptions are implemented by feature-level services (AuthService,
 * SyncService) so that this stays focused and easy to mock in tests.
 *
 * The client is created with `persistSession: true` so the user stays
 * logged in across reloads, and `detectSessionInUrl: true` so OAuth
 * redirects are handled automatically.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly env = inject(ENV);

  readonly client: SupabaseClient = createClient(
    this.env.supabaseUrl,
    this.env.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'app.supabase.auth',
      },
    },
  );
}
