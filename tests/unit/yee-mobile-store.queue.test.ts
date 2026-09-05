/**
 * Action-level integration tests for the idempotent, crash-safe sync queue in
 * stores/yee-mobile-store.ts (Plan 3).
 *
 * The store imports heavy RN modules; tests/setup.ts mocks all of them. Here we
 * additionally mock lib/yee-api so we can drive submit/draft outcomes
 * deterministically, and lib/yee-id so the idempotency key is stable and
 * assertable. Each test uses a distinct account id to isolate the per-account
 * MMKV substrate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";
import { YeeMobileApiError } from "lib/yee-api";
import { normalizeInstrument } from "lib/yee-mobile-instrument";
import {
    readDraft,
    readSyncQueue,
    upsertSyncQueueItem,
    writeInstrumentCache,
} from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import instrumentFixture from "../fixtures/yee-instrument.snapshot.json";
import type {
    YeeAssignedPlace,
    YeeInstrumentResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSubmissionResponse,
} from "lib/yee-types";
import { useYeeMobileStore } from "stores/yee-mobile-store";

// --- Mock the API layer -----------------------------------------------------
// vi.mock is hoisted above the imports above by vitest, so the mocks are in
// place before the store module under test resolves lib/yee-api.
const submitAuditMock = vi.fn<(...args: unknown[]) => Promise<YeeSubmissionResponse>>();
const saveAuditDraftMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const fetchMyAuditsMock = vi.fn<(...args: unknown[]) => Promise<readonly YeeMyAuditItem[]>>();
const fetchAssignedPlacesMock =
    vi.fn<(...args: unknown[]) => Promise<readonly YeeAssignedPlace[]>>();
const fetchYeeInstrumentMock = vi.fn<(...args: unknown[]) => Promise<YeeInstrumentResponse>>();

// Re-export the real YeeMobileApiError so classification (instanceof) works.
vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        submitAudit: (...args: unknown[]) => submitAuditMock(...args),
        saveAuditDraft: (...args: unknown[]) => saveAuditDraftMock(...args),
        fetchMyAudits: (...args: unknown[]) => fetchMyAuditsMock(...args),
        fetchAssignedPlaces: (...args: unknown[]) => fetchAssignedPlacesMock(...args),
        fetchYeeInstrument: (...args: unknown[]) => fetchYeeInstrumentMock(...args),
    };
});

// Stable idempotency key for assertions.
let idemCounter = 0;
vi.mock("lib/yee-id", () => ({
    buildIdempotencyKey: (placeId: string) => {
        idemCounter += 1;
        return `yee-${placeId}-fixed-${idemCounter}`;
    },
}));

let currentAccountId = "auditor-1";

function makeSession(): AuthSession {
    return {
        accessToken: "token-123",
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
            id: currentAccountId,
            email: "a@b.com",
            name: "A",
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
    };
}

function makeDraft(placeId: string, version = 1): YeeLocalDraft {
    const iso = "2026-06-25T00:00:00.000Z";
    return {
        id: placeId,
        schemaVersion: 1,
        version,
        placeId,
        updatedAt: iso,
        lastUpdatedIso: iso,
        participantInfo: { place_id: placeId },
        responses: { item1: { c1: "a1" } },
        lastKnownBackendStatus: "DRAFT",
        lastKnownSubmissionId: null,
        scorePreview: null,
        syncState: "local_only",
    };
}

function makeSubmissionResponse(placeId: string, id = "server-sub-1"): YeeSubmissionResponse {
    return {
        id,
        place_id: placeId,
        place_name: "Place",
        auditor_id: "auditor-1",
        auditor_generated_id: null,
        submitted_at: "2026-06-25T01:00:00.000Z",
        participant_info: {},
        responses: {},
        score: {
            total_score: 88,
            section_scores: {},
            category_scores: {},
            matched_scored_answers: 0,
        },
    };
}

let accountSeq = 0;
function freshAccount(): void {
    accountSeq += 1;
    // Distinct account id per test -> isolated MMKV instance.
    currentAccountId = `acct-${accountSeq}`;
    setActiveAccount(currentAccountId);
}

function resetStore(): void {
    useYeeMobileStore.setState({
        status: "ready",
        // A drain now requires the signed-in account's own queue to be loaded, so
        // these mechanics tests must declare that precondition. `makeSession()`
        // signs in as "auditor-1".
        hydratedAccountId: currentAccountId,
        isOnline: true,
        assignedPlaces: [],
        submittedAudits: [],
        draftsByPlace: {},
        syncQueue: [],
        errorMessage: null,
    });
}

beforeEach(() => {
    submitAuditMock.mockReset();
    saveAuditDraftMock.mockReset();
    fetchMyAuditsMock.mockReset();
    fetchAssignedPlacesMock.mockReset();
    fetchYeeInstrumentMock.mockReset();
    fetchMyAuditsMock.mockResolvedValue([]);
    fetchAssignedPlacesMock.mockResolvedValue([]);
    fetchYeeInstrumentMock.mockResolvedValue({});
    freshAccount();
    resetStore();
});

describe("queueSubmissionSync - idempotency", () => {
    it("generates an idempotency_key once and persists it", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.id).toBe("submission-place-1");
        expect(queue[0]?.payload.idempotency_key).toMatch(/^yee-place-1-fixed-/);
        expect(queue[0]?.payload.draft_version).toBe(1);
    });

    it("re-enqueue (second submit tap) is idempotent: same id, SAME idempotency_key", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);
        const firstKey = (await readSyncQueue())[0]?.payload.idempotency_key;

        // Second enqueue for the same place (e.g. user taps submit again).
        await useYeeMobileStore.getState().queueSubmissionSync(makeDraft("place-1", 2), null);
        const queue = await readSyncQueue();

        expect(queue).toHaveLength(1); // deduped by id
        expect(queue[0]?.payload.idempotency_key).toBe(firstKey); // NEVER regenerated
    });
});

describe("syncPendingQueue - successful submit cleanup", () => {
    it("submits with the persisted idempotency_key, removes the item, deletes the draft", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);
        const key = (await readSyncQueue())[0]?.payload.idempotency_key;

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1"));
        // After a submission, the store refreshes the audit list from the AP server;
        // the new submission is part of that response in the real world.
        fetchMyAuditsMock.mockResolvedValue([
            {
                id: "server-sub-1",
                place_id: "place-1",
                place_name: "Place",
                submitted_at: "2026-06-25T01:00:00.000Z",
                total_score: 88,
                total_raw_maximum: 122,
                total_weighted_maximum: 2.22,
            },
        ]);

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(submitAuditMock).toHaveBeenCalledTimes(1);
        const sentPayload = submitAuditMock.mock.calls[0]?.[1] as { idempotency_key?: string };
        expect(sentPayload.idempotency_key).toBe(key);

        // Queue drained, draft deleted.
        expect(await readSyncQueue()).toHaveLength(0);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(0);
        expect(useYeeMobileStore.getState().draftsByPlace["place-1"]).toBeUndefined();
        const summaries = useYeeMobileStore.getState().submittedAudits;
        expect(summaries.some((s) => s.id === "server-sub-1" && s.syncState === "synced")).toBe(
            true,
        );
    });

    it("clears the provisional pending summary immediately when submit succeeds", async () => {
        const draft = makeDraft("place-1");
        const provisionalSubmission = makeSubmissionResponse("place-1", "local-sub-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, provisionalSubmission);

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1", "server-sub-1"));
        fetchMyAuditsMock.mockRejectedValue(new Error("refresh unavailable"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(useYeeMobileStore.getState().submittedAudits.map((audit) => audit.id)).toEqual([
            "server-sub-1",
        ]);
        expect(useYeeMobileStore.getState().submittedAudits[0]?.syncState).toBe("synced");
    });
});

describe("syncPendingQueue - network failure backoff", () => {
    it("retries at the persisted deadline without waiting for another app event", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-25T12:00:00.000Z"));
        try {
            const draft = makeDraft("place-1");
            await useYeeMobileStore.getState().saveDraftLocally(draft);
            await useYeeMobileStore.getState().queueSubmissionSync(draft, null);
            submitAuditMock
                .mockRejectedValueOnce(new YeeMobileApiError("offline", 0, "no net"))
                .mockResolvedValueOnce(makeSubmissionResponse("place-1"));

            await useYeeMobileStore.getState().syncPendingQueue(makeSession());
            expect(submitAuditMock).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(4_999);
            expect(submitAuditMock).toHaveBeenCalledTimes(1);
            await vi.advanceTimersByTimeAsync(1);

            expect(submitAuditMock).toHaveBeenCalledTimes(2);
            expect(await readSyncQueue()).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it("a transport failure bumps attempts and schedules backoff (item retained)", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockRejectedValue(new YeeMobileApiError("offline", 0, "no net"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.attempts).toBe(1);
        expect(queue[0]?.failureReason).toBe("network");
        expect(queue[0]?.nextAttemptAtIso).not.toBeNull();
        // Backoff = base 5000ms after attempt 1.
        const delay =
            Date.parse(queue[0]?.nextAttemptAtIso ?? "") - Date.parse(queue[0]?.updatedAt ?? "");
        expect(delay).toBeGreaterThanOrEqual(4000);
        expect(delay).toBeLessThanOrEqual(6000);
    });

    it("a 503 server failure bumps attempts with failureReason 'server'", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockRejectedValue(new YeeMobileApiError("down", 503, "maintenance"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        const queue = await readSyncQueue();
        expect(queue[0]?.attempts).toBe(1);
        expect(queue[0]?.failureReason).toBe("server");
    });
});

describe("syncPendingQueue - 401 auth pause", () => {
    it("does NOT burn an attempt and pauses (failureReason auth, no backoff timer)", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockRejectedValue(new YeeMobileApiError("expired", 401, "token expired"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.attempts).toBe(0); // NOT burned
        expect(queue[0]?.failureReason).toBe("auth");
        expect(queue[0]?.nextAttemptAtIso).toBeNull(); // waits for session, not timer
    });

    it("a 401 stops the drain so remaining items are not attempted this pass", async () => {
        await useYeeMobileStore.getState().queueSubmissionSync(makeDraft("place-1"), null);
        await useYeeMobileStore.getState().queueSubmissionSync(makeDraft("place-2"), null);

        submitAuditMock.mockRejectedValue(new YeeMobileApiError("expired", 401, "token expired"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        // Only the first item was attempted before the auth pause broke the loop.
        expect(submitAuditMock).toHaveBeenCalledTimes(1);
    });
});

describe("syncPendingQueue - maxAttempts exhaustion", () => {
    it("parks the item as terminal sync_failed once attempts reach maxAttempts", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        // Force the persisted item near exhaustion (maxAttempts default 8).
        const persisted = (await readSyncQueue())[0];
        if (persisted === undefined) {
            throw new Error("expected a queued item");
        }
        const nearExhaust = {
            ...persisted,
            attempts: persisted.maxAttempts - 1,
            nextAttemptAtIso: null,
        };
        // Persist and reflect into store state.
        await upsertSyncQueueItem(nearExhaust);
        useYeeMobileStore.setState({ syncQueue: [nearExhaust] });

        submitAuditMock.mockRejectedValue(new YeeMobileApiError("down", 500, "boom"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1); // retained but parked
        expect(queue[0]?.attempts).toBe(persisted.maxAttempts);
        expect(queue[0]?.failureReason).toBe("terminal");

        // A subsequent drain must NOT re-attempt a terminal item.
        submitAuditMock.mockClear();
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        expect(submitAuditMock).not.toHaveBeenCalled();
    });
});

describe("syncPendingQueue - deletion-race protection", () => {
    it("does NOT delete the local draft if it was edited (version bumped) after enqueue", async () => {
        // Enqueue a submission capturing draft_version = 1.
        const draft = makeDraft("place-1", 1);
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        // User edits the draft AFTER enqueue -> version 2 persisted locally.
        const edited = makeDraft("place-1", 2);
        await useYeeMobileStore.getState().saveDraftLocally(edited);

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1"));
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        // Submission succeeded and queue drained, but the newer draft survives.
        const survivor = await readDraft("place-1");
        expect(survivor).not.toBeNull();
        expect(survivor?.version).toBe(2);
        expect(await readSyncQueue()).toHaveLength(0);
    });

    it("DOES delete the local draft when its version matches the enqueued version", async () => {
        const draft = makeDraft("place-1", 1);
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1"));
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        expect(await readDraft("place-1")).toBeNull();
    });
});

describe("syncPendingQueue - backoff window respected", () => {
    it("skips an item whose nextAttemptAtIso is still in the future", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);
        const persisted = (await readSyncQueue())[0];
        if (persisted === undefined) {
            throw new Error("expected a queued item");
        }
        const future = new Date(Date.now() + 60_000).toISOString();
        const backedOff = { ...persisted, attempts: 1, nextAttemptAtIso: future };
        await upsertSyncQueueItem(backedOff);
        useYeeMobileStore.setState({ syncQueue: [backedOff] });

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        expect(submitAuditMock).not.toHaveBeenCalled();
    });
});

describe("queueDraftSync - remote mirror (best-effort, durable retry)", () => {
    it("stamps the local draft_version on the queued payload", async () => {
        await useYeeMobileStore.getState().queueDraftSync(makeDraft("place-1", 3));
        const queue = await readSyncQueue();
        expect(queue[0]?.kind).toBe("draft_save");
        expect(queue[0]?.payload.draft_version).toBe(3);
    });

    it("preserves attempt/backoff bookkeeping and refreshes draft_version on re-enqueue", async () => {
        await useYeeMobileStore.getState().queueDraftSync(makeDraft("place-1", 1));
        const seeded = (await readSyncQueue())[0];
        if (seeded === undefined) {
            throw new Error("expected a queued item");
        }
        // Simulate a prior failed attempt with a live backoff window.
        const backedOff = {
            ...seeded,
            attempts: 2,
            failureReason: "network" as const,
            nextAttemptAtIso: new Date(Date.now() + 60_000).toISOString(),
        };
        await upsertSyncQueueItem(backedOff);
        useYeeMobileStore.setState({ syncQueue: [backedOff] });

        // A fresh edit re-enqueues the SAME item with newer content + version.
        await useYeeMobileStore.getState().queueDraftSync(makeDraft("place-1", 2));

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.attempts).toBe(2); // backoff bookkeeping preserved
        expect(queue[0]?.nextAttemptAtIso).toBe(backedOff.nextAttemptAtIso);
        expect(queue[0]?.payload.draft_version).toBe(2); // content refreshed
    });

    it("retains the draft_save item with backoff when the remote mirror fails (local intact)", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueDraftSync(draft);

        saveAuditDraftMock.mockRejectedValue(new YeeMobileApiError("down", 500, "boom"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        // New policy: the mirror is retryable like any queue item - retained with
        // backoff so "Queued / Sync issue" stays truthful. Local draft untouched.
        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.attempts).toBe(1);
        expect(queue[0]?.failureReason).toBe("server");
        expect(queue[0]?.nextAttemptAtIso).not.toBeNull();
        expect(await readDraft("place-1")).not.toBeNull();
    });

    it("parks a terminal 4xx draft_save as sync_failed without touching local data", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueDraftSync(draft);

        saveAuditDraftMock.mockRejectedValue(new YeeMobileApiError("bad", 422, "invalid"));

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.failureReason).toBe("validation");
        expect(useYeeMobileStore.getState().draftsByPlace["place-1"]?.syncState).toBe(
            "sync_failed",
        );
        // The on-device draft (source of truth) is never lost on a mirror failure.
        expect(await readDraft("place-1")).not.toBeNull();
    });

    it("does NOT mark a newer local draft synced off a stale queued payload (version guard)", async () => {
        // Enqueue a mirror carrying draft_version 1.
        await useYeeMobileStore.getState().saveDraftLocally(makeDraft("place-1", 1));
        await useYeeMobileStore.getState().queueDraftSync(makeDraft("place-1", 1));

        // A newer local edit lands (version 2) BEFORE the mirror drains.
        await useYeeMobileStore.getState().saveDraftLocally(makeDraft("place-1", 2));

        saveAuditDraftMock.mockResolvedValue({ status: "DRAFT", submission_id: null, score: null });
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        // The PUT landed (item removed), but the newer local draft is NOT stamped
        // synced - the backend only has the older content.
        expect(await readSyncQueue()).toHaveLength(0);
        const draft = useYeeMobileStore.getState().draftsByPlace["place-1"];
        expect(draft?.version).toBe(2);
        expect(draft?.syncState).not.toBe("synced");
    });

    it("updates in-memory draft syncState after a matching-version draft_save drain", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueDraftSync(draft);

        saveAuditDraftMock.mockResolvedValue({
            status: "DRAFT",
            submission_id: null,
            score: null,
        });

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(await readSyncQueue()).toHaveLength(0);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(0);
        expect(useYeeMobileStore.getState().draftsByPlace["place-1"]?.syncState).toBe("synced");
        expect((await readDraft("place-1"))?.syncState).toBe("synced");
    });
});

describe("queueSubmissionSync - drops the pending draft mirror", () => {
    it("removes any draft-${placeId} item when a submission is enqueued for that place", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        // A draft mirror is pending...
        await useYeeMobileStore.getState().queueDraftSync(draft);
        expect((await readSyncQueue()).some((item) => item.id === "draft-place-1")).toBe(true);

        // ...then the auditor submits: the optional mirror must be dropped so it
        // can never run after or compete with the final submit.
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        const queue = await readSyncQueue();
        expect(queue.some((item) => item.id === "draft-place-1")).toBe(false);
        expect(queue.some((item) => item.id === "submission-place-1")).toBe(true);
        expect(useYeeMobileStore.getState().syncQueue.some((i) => i.id === "draft-place-1")).toBe(
            false,
        );
    });
});

describe("refreshRemoteState - same-place submission reconciliation", () => {
    it("drops stale local pending summaries when refresh returns the remote submission for the same place", async () => {
        useYeeMobileStore.setState({
            submittedAudits: [
                {
                    id: "local-submission-place-1",
                    place_id: "place-1",
                    place_name: "Place",
                    submitted_at: "2026-06-25T00:30:00.000Z",
                    total_score: 0,
                    total_raw_maximum: null,
                    total_weighted_maximum: null,
                    syncState: "pending_upload",
                },
            ],
        });
        fetchMyAuditsMock.mockResolvedValue([
            {
                id: "server-sub-1",
                place_id: "place-1",
                place_name: "Place",
                submitted_at: "2026-06-25T01:00:00.000Z",
                total_score: 88,
                total_raw_maximum: 122,
                total_weighted_maximum: 2.22,
            },
        ]);

        await useYeeMobileStore.getState().refreshRemoteState(makeSession());

        expect(useYeeMobileStore.getState().submittedAudits.map((audit) => audit.id)).toEqual([
            "server-sub-1",
        ]);
    });
});

// ---------------------------------------------------------------------------
// Drain-time completeness gate
// ---------------------------------------------------------------------------

/** The real 54-question schema-v1 instrument, stamped so it can be cached. */
const STAMPED_INSTRUMENT: YeeInstrumentResponse = {
    ...instrumentFixture,
    instrument_key: "yee",
    instrument_version: "2.0",
};

/** Every logical question of {@link STAMPED_INSTRUMENT} answered affirmatively. */
function completeResponses(): Record<string, Record<string, string>> {
    const responses: Record<string, Record<string, string>> = {};
    for (const section of normalizeInstrument(STAMPED_INSTRUMENT).sections) {
        for (const question of section.questions) {
            const presence = (responses[question.presenceItemId] ??= {});
            presence[question.choiceId] = question.presenceAnswers[0]?.id ?? "1";
            if (question.conditionItemId === null) {
                continue;
            }
            const condition = (responses[question.conditionItemId] ??= {});
            condition[question.choiceId] = question.conditionAnswers[0]?.id ?? "1";
        }
    }
    return responses;
}

function stampedDraft(
    placeId: string,
    responses: Record<string, Record<string, string>>,
): YeeLocalDraft {
    return {
        ...makeDraft(placeId),
        responses,
        instrumentKey: "yee",
        instrumentVersion: "2.0",
    };
}

describe("syncPendingQueue - drain-time completeness gate", () => {
    it("parks an incomplete stamped submission WITHOUT calling the API", async () => {
        await writeInstrumentCache(STAMPED_INSTRUMENT);
        const draft = stampedDraft("place-1", { "QID1#1": { "1": "1" } });
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        // The whole point: a payload the backend would reject never leaves.
        expect(submitAuditMock).not.toHaveBeenCalled();

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.failureReason).toBe("incomplete");
        expect(queue[0]?.isTerminal).toBe(true);
        // No request was made, so no attempt may be spent.
        expect(queue[0]?.attempts).toBe(0);
        // The follow-up to the one answered question is the earliest gap.
        expect(queue[0]?.incompleteQuestionKeys?.missingQuestionKeys).toContain("QID1#1:1");
        expect(queue[0]?.incompleteQuestionKeys?.firstMissingStep).toBe(
            normalizeInstrument(STAMPED_INSTRUMENT).sections[0]?.step,
        );
    });

    it("does not re-drain a parked incomplete item on the next sync", async () => {
        await writeInstrumentCache(STAMPED_INSTRUMENT);
        const draft = stampedDraft("place-1", {});
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(submitAuditMock).not.toHaveBeenCalled();
        expect((await readSyncQueue())[0]?.attempts).toBe(0);
    });

    it("submits a stamped submission once every required answer is present", async () => {
        await writeInstrumentCache(STAMPED_INSTRUMENT);
        const draft = stampedDraft("place-1", completeResponses());
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1"));
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(submitAuditMock).toHaveBeenCalledTimes(1);
        expect(await readSyncQueue()).toHaveLength(0);
    });

    it("retains a stamped submission whose exact version is not cached, without POSTing", async () => {
        // A different version is cached, and it must not stand in for the one
        // this audit was taken under.
        await writeInstrumentCache({ ...STAMPED_INSTRUMENT, instrument_version: "3.0" });
        const draft = stampedDraft("place-1", completeResponses());
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(submitAuditMock).not.toHaveBeenCalled();
        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        // Retained, not failed: nothing went wrong and nothing was lost.
        expect(queue[0]?.failureReason).toBeNull();
        expect(queue[0]?.isTerminal).toBeUndefined();
        expect(queue[0]?.attempts).toBe(0);
        expect(useYeeMobileStore.getState().errorMessage).toContain("Reconnect");
    });

    it("submits an unstamped legacy payload even with no instrument cached", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        submitAuditMock.mockResolvedValue(makeSubmissionResponse("place-1"));
        await useYeeMobileStore.getState().syncPendingQueue(makeSession());

        expect(submitAuditMock).toHaveBeenCalledTimes(1);
        expect(await readSyncQueue()).toHaveLength(0);
    });
});
