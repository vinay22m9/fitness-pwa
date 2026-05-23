/**
 * Generates a UUID v4. Uses crypto.randomUUID when available (modern browsers,
 * 99% coverage); falls back to a non-cryptographic implementation otherwise.
 *
 * IDs are user-scoped client-generated so writes can happen offline without
 * needing the server to assign one.
 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (very old browsers only)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
