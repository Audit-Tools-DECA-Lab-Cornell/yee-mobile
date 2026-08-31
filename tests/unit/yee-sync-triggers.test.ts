/**
 * When the offline submission queue may be drained.
 *
 * The bug these pin: an audit completed offline sat at "Queued for upload"
 * indefinitely, on a tablet with working wifi, because the drain ran once at
 * startup against a store whose persisted queue had not loaded yet. It found an
 * empty queue, reported success, and nothing re-ran it — for that session or any
 * later one, since the race repeats on every launch.
 */
import { describe, expect, it } from "vitest";
import { shouldDrainQueue, type QueueDrainConditions } from "lib/yee-sync-triggers";

function conditions(overrides: Partial<QueueDrainConditions> = {}): QueueDrainConditions {
    return {
        authStatus: "authenticated",
        hasSession: true,
        isOnline: true,
        offlineStatus: "ready",
        ...overrides,
    };
}

describe("shouldDrainQueue", () => {
    it("drains when signed in, online, and the persisted queue is loaded", () => {
        expect(shouldDrainQueue(conditions())).toBe(true);
    });

    it("does NOT drain before the persisted queue has loaded", () => {
        // The regression. Auth resolves first because it reads two keys, while
        // hydration reads six and awaits a reachability probe. Draining here
        // reads an unloaded queue as an empty outbox.
        expect(shouldDrainQueue(conditions({ offlineStatus: "loading" }))).toBe(false);
    });

    it("does not drain from the store's initial state", () => {
        expect(shouldDrainQueue(conditions({ offlineStatus: "idle" }))).toBe(false);
    });

    it("does not drain when loading the offline state failed", () => {
        // The queue is unknown, not empty. Sending nothing is right; claiming
        // there was nothing to send is not.
        expect(shouldDrainQueue(conditions({ offlineStatus: "error" }))).toBe(false);
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
        const beforeHydration = shouldDrainQueue(conditions({ offlineStatus: "loading" }));
        const afterHydration = shouldDrainQueue(conditions({ offlineStatus: "ready" }));
        expect(beforeHydration).toBe(false);
        expect(afterHydration).toBe(true);
    });
});
