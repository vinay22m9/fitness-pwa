/**
 * Date utilities — all operate in DEVICE LOCAL TIME.
 *
 * The app stores dates as ISO date strings (YYYY-MM-DD) representing
 * the *user's local calendar day*, not UTC. This means a workout logged
 * at 11:30 PM Friday in Hyderabad is "2026-05-22" — not "2026-05-23"
 * which UTC would give you.
 *
 * Daily reset (hydration, meals) happens at local midnight.
 */

/** Today's date in device local time as YYYY-MM-DD. */
export function todayLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Yesterday's date in device local time as YYYY-MM-DD. */
export function yesterdayLocalISO(d: Date = new Date()): string {
  const t = new Date(d);
  t.setDate(t.getDate() - 1);
  return todayLocalISO(t);
}

/** Add (or subtract) days. Returns a new Date. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Day-of-week for display: 0=Sun, 1=Mon, ... 6=Sat. */
export function dayOfWeek(d: Date = new Date()): number {
  return d.getDay();
}

/** Full weekday name e.g. "Friday". */
export function weekdayLong(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

/** "Friday, May 22" — friendly header label. */
export function friendlyDate(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** "9:41 AM" — display time. */
export function friendlyTime(d: Date = new Date()): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Returns true if `iso` (YYYY-MM-DD) is today in local time. */
export function isToday(iso: string): boolean {
  return iso === todayLocalISO();
}

/** Milliseconds until the next local midnight. Used by daily-reset schedulers. */
export function msUntilLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);            // setHours(24,...) rolls to next day at 00:00
  return next.getTime() - now.getTime();
}
