import { Injectable } from '@angular/core';

/**
 * Type-safe localStorage wrapper.
 *
 * Use this for small, synchronous prefs (theme, last-used routine, onboarding
 * complete flag). For real data, use IndexedDB via app.db.
 *
 * Why a wrapper?
 *  - centralised key prefix so we don't pollute the global namespace
 *  - graceful fallback when storage is unavailable (private mode, Safari ITP)
 *  - typed get/set with default values
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'app.';
  private readonly available = this.checkAvailable();

  get<T>(key: string, defaultValue: T): T {
    if (!this.available) return defaultValue;
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw === null ? defaultValue : (JSON.parse(raw) as T);
    } catch {
      return defaultValue;
    }
  }

  set<T>(key: string, value: T): void {
    if (!this.available) return;
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage unavailable — silently fail.
    }
  }

  remove(key: string): void {
    if (!this.available) return;
    try {
      localStorage.removeItem(this.prefix + key);
    } catch { /* noop */ }
  }

  /** Remove all keys under our prefix. Used on logout. */
  clearAll(): void {
    if (!this.available) return;
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.prefix)) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* noop */ }
  }

  private checkAvailable(): boolean {
    try {
      const probe = '__probe__';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }
}
