/**
 * Account-bound hydration, and the drain invariant that depends on it.
 *
 * These drive the REAL store rather than a pure rule. All three production
 * failures in this area lived in wiring, and the pure-rule tests that existed at
 * the time passed throughout every one of them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";
import { readSyncQueue, upsertSyncQueueItem } from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import { YEE_SYNC_MAX_ATTEMPTS, type YeeSyncQueueItem } from "lib/yee-types";
import { useYeeMobileStore } from "stores/yee-mobile-store";

let failStorageReads = false;
vi.mock("lib/yee-offline-storage", async () => {
    const actual =
        await vi.importActual<typeof import("lib/yee-offline-storage")>("lib/yee-offline-storage");
    return {
        ...actual,
        readSyncQueue: () =>
            failStorageReads
                ? Promise.reject(new Error("MMKV read failed"))
                : actual.readSyncQueue(),
    };
});

const submitAuditMock = vi.fn();
vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        submitAudit: (...args: unknown[]) => submitAuditMock(...args),
        saveAuditDraft: () => Promise.resolve({}),
        fetchMyAudits: () => Promise.resolve([]),
        fetchAssignedPlaces: () => Promise.resolve([]),
        fetchYeeInstrument: () => Promise.resolve({}),
    };
});

const AUDITOR_A = "auditor-a";
const AUDITOR_B = "auditor-b";

function sessionFor(userId: string): AuthSession {
    return {
        accessToken: `token-${userId}`,
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
            id: userId,
            email: `${userId}@example.org`,
            name: userId,
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
    };
}

function queuedSubmission(placeId: string): YeeSyncQueueItem {
    return {
        id: `submission-${placeId}`,
        placeId,
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
        kind: "submission",
        payload: {
            participant_info: {},
            responses: {},
            place_id: placeId,
            idempotency_key: `yee-${placeId}-key`,
        },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
        failureReason: null,
    };
}

/** Put a queued submission into the given account's storage. */
async function seedQueueFor(accountId: string, placeId: string): Promise<void> {
    setActiveAccount(accountId);
    await upsertSyncQueueItem(queuedSubmission(placeId));
}

beforeEach(() => {
    failStorageReads = false;
    submitAuditMock.mockReset();
    submitAuditMock.mockResolvedValue({
        id: "server-1",
        place_id: "place-a",
        place_name: "Place",
        auditor_id: "a",
        auditor_generated_id: null,
        submitted_at: "2026-08-31T01:00:00.000Z",
        participant_info: {},
        responses: {},
        score: {
            total_score: 1,
            section_scores: {},
            category_scores: {},
            matched_scored_answers: 0,
        },
    });
    useYeeMobileStore.setState({
        hydratedAccountId: null,
        status: "idle",
        syncQueue: [],
        isOnline: true,
    });
});

describe("account-bound hydration", () => {
    it("records the account whose queue it loaded", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        expect(useYeeMobileStore.getState().hydratedAccountId).toBe(AUDITOR_A);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(1);
    });

    it("replaces one auditor's queue with the next auditor's on switch", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await seedQueueFor(AUDITOR_B, "place-b");

        setActiveAccount(AUDITOR_A);
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        expect(useYeeMobileStore.getState().syncQueue[0]?.placeId).toBe("place-a");

        setActiveAccount(AUDITOR_B);
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_B);
        expect(useYeeMobileStore.getState().hydratedAccountId).toBe(AUDITOR_B);
        expect(useYeeMobileStore.getState().syncQueue[0]?.placeId).toBe("place-b");
    });

    it("is a no-op when the same account is already loaded", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        const first = useYeeMobileStore.getState().syncQueue;

        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        // Same reference: callers may ask on every foreground without cost.
        expect(useYeeMobileStore.getState().syncQueue).toBe(first);
    });

    it("clearing the snapshot drops the in-memory queue but NOT the stored one", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        useYeeMobileStore.getState().clearOfflineSnapshot();

        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(0);
        expect(useYeeMobileStore.getState().hydratedAccountId).toBeNull();
        // Sign-out must never cost an auditor their unsynced field work.
        setActiveAccount(AUDITOR_A);
        expect(await readSyncQueue()).toHaveLength(1);
    });

    it("readiness probe never sets a hydrated account, so it cannot open the gate", async () => {
        await useYeeMobileStore.getState().probeOfflineReadiness();
        expect(useYeeMobileStore.getState().hydratedAccountId).toBeNull();
    });
});

describe("drainQueue account invariant", () => {
    it("sends the signed-in account's own queued submission", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));

        expect(submitAuditMock).toHaveBeenCalledTimes(1);
    });

    it("REFUSES to send auditor A's queue under auditor B's session", async () => {
        // The cross-account defect. A's queue is loaded in memory; B signs in.
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(1);

        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_B));

        expect(submitAuditMock).not.toHaveBeenCalled();
        // And A's item is untouched, not re-persisted under B.
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(1);
    });

    it("refuses to send before any queue has been loaded", async () => {
        // The stranding defect, from the other direction: an unloaded queue has
        // no account, so it can never be mistaken for an empty outbox.
        await seedQueueFor(AUDITOR_A, "place-a");

        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));

        expect(submitAuditMock).not.toHaveBeenCalled();
    });
});

describe("drain interval floor", () => {
    it("runs a user-initiated drain immediately, even back to back", async () => {
        // A person tapping submit must never wait on a cooldown.
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        const started = Date.now();
        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));
        await upsertSyncQueueItem(queuedSubmission("place-a2"));
        useYeeMobileStore.setState({ syncQueue: [queuedSubmission("place-a2")] });
        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));

        expect(Date.now() - started).toBeLessThan(1_000);
        expect(submitAuditMock).toHaveBeenCalledTimes(2);
    });

    it("defers an automatic drain that arrives inside the interval", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        const session = sessionFor(AUDITOR_A);

        await useYeeMobileStore.getState().syncPendingQueue(session);
        expect(submitAuditMock).toHaveBeenCalledTimes(1);

        // A misfiring automatic trigger cannot turn into a request stream.
        useYeeMobileStore.setState({ syncQueue: [queuedSubmission("place-a3")] });
        const deferred = useYeeMobileStore.getState().syncPendingQueue(session, { throttle: true });
        await Promise.race([deferred, new Promise((resolve) => setTimeout(resolve, 50))]);

        expect(submitAuditMock).toHaveBeenCalledTimes(1);
    });
});

describe("hydration failure", () => {
    it("does NOT claim an account is loaded when storage could not be read", async () => {
        // Reporting "loaded" here is how an audit taken offline went missing: the
        // store holds the empty default, and the drain reads that as an empty
        // outbox. An unreadable queue is unknown, not empty.
        failStorageReads = true;

        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        expect(useYeeMobileStore.getState().status).toBe("error");
        expect(useYeeMobileStore.getState().hydratedAccountId).toBeNull();
    });

    it("refuses to drain after a failed hydration", async () => {
        await seedQueueFor(AUDITOR_A, "place-a");
        failStorageReads = true;
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));

        expect(submitAuditMock).not.toHaveBeenCalled();
    });

    it("recovers on a later attempt, so a transient failure is not permanent", async () => {
        // The foreground handler retries; without this the queue would be both
        // invisible and undrainable until the app restarted.
        await seedQueueFor(AUDITOR_A, "place-a");
        failStorageReads = true;
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        expect(useYeeMobileStore.getState().hydratedAccountId).toBeNull();

        failStorageReads = false;
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);

        expect(useYeeMobileStore.getState().hydratedAccountId).toBe(AUDITOR_A);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(1);
    });
});
