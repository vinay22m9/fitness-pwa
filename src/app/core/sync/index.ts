/**
 * Public API for the sync subsystem.
 *
 * Feature services should import from `@core/sync` and use ONLY:
 *   - SyncService  (read status signals, optionally call triggerSync)
 *   - OutboxService (call enqueue() after every local write)
 *
 * Handlers and internals are NOT exported — keep the surface minimal.
 */

export { SyncService } from './sync.service';
export { OutboxService } from './outbox.service';
