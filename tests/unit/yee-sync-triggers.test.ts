/**
 * When the offline submission queue may be drained.
 *
 * Three production failures shape this rule, and each is a separate case below.
 *
 * 1. STRANDED DATA. An audit completed offline sat at "Queued for upload"
 *    indefinitely: the drain ran at startup against a store whose persisted
 *    queue had not loaded, saw the empty default, and was never re-run.
 * 2. REQUEST STORM. Gating that drain on the store's `status` made the app call
 *    the backend continuously — `refreshRemoteState` moves `status` through
 *    "loading", and the same effect called it, so the gate re-armed forever.
 * 3. CROSS-ACCOUNT SEND. MMKV is namespaced per account and re-pointed on
 *    sign-in, but this store was never reloaded, so after switching accounts a
 *    drain could transmit one auditor's queued work under another's session.
 *
 * The rule that closes all three: the loaded account must EQUAL the signed-in
 * one. "Not loaded" and "loaded for someone else" are then the same refusal.
 */
import { describe, expect, it } from "vitest";
import { shouldDrainQueue, type QueueDrainConditions } from "lib/yee-sync-triggers";

const AUDITOR_A = "auditor-a";
const AUDITOR_B = "auditor-b";

function conditions(overrides: Partial<QueueDrainConditions> = {}): QueueDrainConditions {
    return {
        authStatus: "authenticated",
        sessionUserId: AUDITOR_A,
        isOnline: true,
        hydratedAccountId: AUDITOR_A,
        ...overrides,
    };
}

describe("shouldDrainQueue", () => {
    it("drains when the signed-in account's own queue is loaded", () => {
        expect(shouldDrainQueue(conditions())).toBe(true);
    });

    it("does NOT drain before any queue has loaded", () => {
        expect(shouldDrainQueue(conditions({ hydratedAccountId: null }))).toBe(false);
    });

    it("does NOT drain another auditor's loaded queue", () => {
        // Auditor B is signed in; the store still holds A's queue.
        expect(
            shouldDrainQueue(
                conditions({ sessionUserId: AUDITOR_B, hydratedAccountId: AUDITOR_A }),
            ),
        ).toBe(false);
    });

    it("does not drain while signed out", () => {
        expect(shouldDrainQueue(conditions({ authStatus: "unauthenticated" }))).toBe(false);
        expect(shouldDrainQueue(conditions({ authStatus: "loading" }))).toBe(false);
        expect(shouldDrainQueue(conditions({ sessionUserId: null }))).toBe(false);
    });

    it("treats two absent accounts as a refusal, not a match", () => {
        // null === null must not read as "the loaded queue belongs to me".
        expect(shouldDrainQueue(conditions({ sessionUserId: null, hydratedAccountId: null }))).toBe(
            false,
        );
    });

    it("does not drain while offline", () => {
        expect(shouldDrainQueue(conditions({ isOnline: false }))).toBe(false);
    });

    it("opens only once the signed-in account's queue finishes loading", () => {
        // The startup sequence that stranded an audit: auth resolves first and
        // the drain is refused, then hydration completes and it is allowed.
        expect(shouldDrainQueue(conditions({ hydratedAccountId: null }))).toBe(false);
        expect(shouldDrainQueue(conditions({ hydratedAccountId: AUDITOR_A }))).toBe(true);
    });
});
