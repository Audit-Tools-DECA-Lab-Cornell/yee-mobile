/**
 * When the offline submission queue may be drained.
 *
 * Two bugs are pinned here, and the second was caused by the fix for the first.
 *
 * 1. An audit completed offline sat at "Queued for upload" indefinitely on a
 *    tablet with working wifi, because the drain ran once at startup against a
 *    store whose persisted queue had not loaded yet, saw an empty queue, and was
 *    never re-run.
 *
 * 2. Gating that drain on the store's `status` sent the app into a request
 *    storm. `refreshRemoteState` moves `status` "ready" -> "loading" -> "ready",
 *    and the same effect calls it — so the gate re-enabled itself on every
 *    refresh and the app called the backend continuously from the home screen.
 *
 * Hence the flag: the gate must be MONOTONIC — something no refresh can move
 * back.
 */
import { describe, expect, it } from "vitest";
import { shouldDrainQueue, type QueueDrainConditions } from "lib/yee-sync-triggers";

function conditions(overrides: Partial<QueueDrainConditions> = {}): QueueDrainConditions {
    return {
        authStatus: "authenticated",
        hasSession: true,
        isOnline: true,
        hasLoadedOfflineState: true,
        ...overrides,
    };
}

describe("shouldDrainQueue", () => {
    it("drains when signed in, online, and the persisted queue is loaded", () => {
        expect(shouldDrainQueue(conditions())).toBe(true);
    });

    it("does NOT drain before the persisted queue has loaded", () => {
        // Bug 1. Auth resolves first because it reads two keys, while hydration
        // reads six and awaits a reachability probe. Draining here reads an
        // unloaded queue as an empty outbox.
        expect(shouldDrainQueue(conditions({ hasLoadedOfflineState: false }))).toBe(false);
    });

    it("does not drain while signed out", () => {
        expect(shouldDrainQueue(conditions({ authStatus: "unauthenticated" }))).toBe(false);
        expect(shouldDrainQueue(conditions({ authStatus: "loading" }))).toBe(false);
    });

    it("does not drain without a session to authorize the request", () => {
        expect(shouldDrainQueue(conditions({ hasSession: false }))).toBe(false);
    });

    it("does not drain while offline", () => {
        expect(shouldDrainQueue(conditions({ isOnline: false }))).toBe(false);
    });

    it("becomes true once hydration finishes, so the queue gets a second chance", () => {
        // The startup sequence that used to strand a submission: auth lands
        // first and the drain is refused, then hydration completes and it is
        // allowed. The value CHANGING is what re-runs the effect.
        expect(shouldDrainQueue(conditions({ hasLoadedOfflineState: false }))).toBe(false);
        expect(shouldDrainQueue(conditions({ hasLoadedOfflineState: true }))).toBe(true);
    });

    it("stays true across a remote refresh, so the drain cannot re-trigger itself", () => {
        // Bug 2. A refresh must not be able to flip the gate off and back on;
        // that is what turned one drain into an unbounded request loop. The
        // store-level guarantee behind this is covered in
        // yee-mobile-store.hydration.test.ts.
        const duringRefresh = conditions({ hasLoadedOfflineState: true });
        expect(shouldDrainQueue(duringRefresh)).toBe(true);
        expect(shouldDrainQueue({ ...duringRefresh, hasLoadedOfflineState: true })).toBe(true);
    });
});
