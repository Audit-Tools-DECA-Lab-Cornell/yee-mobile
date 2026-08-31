/**
 * When the app may drain the offline submission queue.
 *
 * The queue lives in MMKV and is loaded into the store by `hydrateOfflineState`.
 * Startup fires that load and `initializeAuth` concurrently, without awaiting
 * either, and auth almost always wins: it reads two keys, while hydration reads
 * six and first awaits `NetInfo.fetch()`, whose reachability probe can take
 * seconds.
 *
 * So the moment auth completes, the drain trigger fires against a store whose
 * `syncQueue` is still the empty default. `drainQueue` sees nothing to send and
 * returns successfully — and because nothing else re-runs it (no interval, and
 * the queue is only re-driven on a connectivity or auth change), a submission
 * created offline stays at "Queued for upload" for the whole session, and for
 * every session after it, since the race repeats on each launch.
 *
 * Requiring the offline state to be loaded closes that. It is a gate rather
 * than an extra trigger on purpose: an empty-looking queue must not be read as
 * "nothing to send".
 *
 * Pure and free of React Native imports so the rule is unit-tested in Node —
 * the effect that consumes it lives in `app/_layout.tsx`, which cannot be
 * rendered in this environment.
 */

import type { AuthStatus } from "stores/auth-store";
import type { YeeMobileStoreStatus } from "stores/yee-mobile-store";

export interface QueueDrainConditions {
    readonly authStatus: AuthStatus;
    /** Whether a restored session is available to authorize the requests. */
    readonly hasSession: boolean;
    readonly isOnline: boolean;
    /** Status of the offline store, i.e. whether the persisted queue is loaded. */
    readonly offlineStatus: YeeMobileStoreStatus;
}

/**
 * Whether the queue may be drained right now.
 *
 * Every condition is required. `offlineStatus` is the one that is easy to
 * forget: without it the drain can run against a queue that has not been read
 * off disk yet and mistake that for an empty outbox.
 */
export function shouldDrainQueue(conditions: QueueDrainConditions): boolean {
    return (
        conditions.authStatus === "authenticated" &&
        conditions.hasSession &&
        conditions.isOnline &&
        conditions.offlineStatus === "ready"
    );
}
