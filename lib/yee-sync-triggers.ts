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
 * Requiring the loaded account to MATCH the signed-in one closes that, and one
 * more failure with it: MMKV is namespaced per account and re-pointed on
 * sign-in, but this store was not reloaded, so after switching accounts a drain
 * could send one auditor's queued work under another's session.
 *
 * Two properties matter in how this is expressed. It is a gate, not an extra
 * trigger — an empty-looking queue must never be read as "nothing to send". And
 * nothing it gates on may be written by the work it permits: gating on the
 * store's `status` caused a request storm, because `refreshRemoteState` moves
 * `status` "ready" -> "loading" -> "ready" and the drain effect called it.
 *
 * Pure and free of React Native imports so the rule is unit-tested in Node —
 * the effect that consumes it lives in `app/_layout.tsx`, which cannot be
 * rendered in this environment.
 */

import type { AuthStatus } from "stores/auth-store";

export interface QueueDrainConditions {
    readonly authStatus: AuthStatus;
    /** Signed-in account, or `null` when there is no session to authorize with. */
    readonly sessionUserId: string | null;
    readonly isOnline: boolean;
    /** The account whose persisted queue is loaded, or `null` if none is. */
    readonly hydratedAccountId: string | null;
}

/**
 * Whether the queue may be drained right now.
 *
 * Every condition is required. the account equality is the one that is
 * easy to forget: without it the drain can run against a queue that has not been
 * read off disk yet, or one belonging to a different auditor.
 */
export function shouldDrainQueue(conditions: QueueDrainConditions): boolean {
    return (
        conditions.authStatus === "authenticated" &&
        conditions.sessionUserId !== null &&
        conditions.isOnline &&
        conditions.hydratedAccountId === conditions.sessionUserId
    );
}
