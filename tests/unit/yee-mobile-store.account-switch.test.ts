import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "lib/auth/types";
import {
    readAssignedPlacesCache,
    readDraft,
    readSyncQueue,
    readSubmittedAuditsCache,
    upsertSyncQueueItem,
    writeDraft,
} from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import {
    YEE_SYNC_MAX_ATTEMPTS,
    type YeeAssignedPlace,
    type YeeMyAuditItem,
    type YeeSubmissionResponse,
    type YeeSyncQueueItem,
} from "lib/yee-types";
import { useYeeMobileStore } from "stores/yee-mobile-store";

interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
    let resolvePromise: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

const readSyncQueueMock = vi.hoisted(() => vi.fn());
vi.mock("lib/yee-offline-storage", async () => {
    const actual =
        await vi.importActual<typeof import("lib/yee-offline-storage")>("lib/yee-offline-storage");
    return {
        ...actual,
        readSyncQueue: (...args: unknown[]) => {
            const implementation = readSyncQueueMock.getMockImplementation();
            return implementation === undefined
                ? actual.readSyncQueue(...(args as [string?]))
                : readSyncQueueMock(...args);
        },
    };
});

const apiMocks = vi.hoisted(() => ({
    fetchAssignedPlaces: vi.fn(),
    fetchAuditState: vi.fn(),
    fetchMyAudits: vi.fn(),
    submitAudit: vi.fn(),
}));
vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        fetchAssignedPlaces: (...args: unknown[]) => apiMocks.fetchAssignedPlaces(...args),
        fetchAuditState: (...args: unknown[]) => apiMocks.fetchAuditState(...args),
        fetchMyAudits: (...args: unknown[]) => apiMocks.fetchMyAudits(...args),
        fetchYeeInstrument: () => Promise.resolve({}),
        saveAuditDraft: () => Promise.resolve({}),
        submitAudit: (...args: unknown[]) => apiMocks.submitAudit(...args),
    };
});

const AUDITOR_A = "switch-a";
const AUDITOR_B = "switch-b";

function activate(accountId: string | null): void {
    setActiveAccount(accountId);
}

function sessionFor(accountId: string): AuthSession {
    return {
        accessToken: `token-${accountId}`,
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
            id: accountId,
            email: `${accountId}@example.org`,
            name: accountId,
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
    };
}

function queueItem(accountId: string, placeId = "shared-place"): YeeSyncQueueItem {
    return {
        id: `submission-${placeId}`,
        placeId,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        kind: "submission",
        payload: {
            participant_info: { owner: accountId },
            responses: {},
            place_id: placeId,
            idempotency_key: `key-${accountId}`,
        },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
        failureReason: null,
    };
}

function submission(accountId: string): YeeSubmissionResponse {
    return {
        id: `server-${accountId}`,
        place_id: "shared-place",
        place_name: "Shared Place",
        auditor_id: accountId,
        auditor_generated_id: null,
        submitted_at: "2026-09-01T01:00:00.000Z",
        participant_info: {},
        responses: {},
        score: {
            total_score: 1,
            section_scores: {},
            category_scores: {},
            matched_scored_answers: 0,
        },
    };
}

function placeFor(accountId: string): YeeAssignedPlace {
    return { id: `place-${accountId}`, name: accountId, project: "YEE", address: "", audits: 0 };
}

function auditFor(accountId: string): YeeMyAuditItem {
    return {
        id: `audit-${accountId}`,
        place_id: `place-${accountId}`,
        place_name: accountId,
        submitted_at: "2026-09-01T01:00:00.000Z",
        total_score: 1,
        total_raw_maximum: 122,
        total_weighted_maximum: 2.22,
    };
}

beforeEach(() => {
    readSyncQueueMock.mockReset();
    apiMocks.fetchAssignedPlaces.mockReset();
    apiMocks.fetchAssignedPlaces.mockResolvedValue([]);
    apiMocks.fetchAuditState.mockReset();
    apiMocks.fetchMyAudits.mockReset();
    apiMocks.fetchMyAudits.mockResolvedValue([]);
    apiMocks.submitAudit.mockReset();
    apiMocks.submitAudit.mockResolvedValue(submission(AUDITOR_A));
    activate(null);
    useYeeMobileStore.getState().clearOfflineSnapshot();
    useYeeMobileStore.setState({ isOnline: true });
});

afterEach(async () => {
    if (vi.isFakeTimers()) {
        await vi.runOnlyPendingTimersAsync();
        vi.useRealTimers();
    }
    activate(null);
});

describe("account-switch lifecycle", () => {
    it("keeps B installed when A hydration resolves last", async () => {
        const aRead = deferred<readonly YeeSyncQueueItem[]>();
        const bRead = deferred<readonly YeeSyncQueueItem[]>();
        readSyncQueueMock.mockImplementationOnce(() => aRead.promise);
        readSyncQueueMock.mockImplementationOnce(() => bRead.promise);

        activate(AUDITOR_A);
        const hydrateA = useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        activate(AUDITOR_B);
        const hydrateB = useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_B);

        bRead.resolve([queueItem(AUDITOR_B)]);
        await hydrateB;
        aRead.resolve([queueItem(AUDITOR_A)]);
        await hydrateA;

        expect(useYeeMobileStore.getState().hydratedAccountId).toBe(AUDITOR_B);
        expect(useYeeMobileStore.getState().syncQueue).toEqual([queueItem(AUDITOR_B)]);
    });

    it("ignores an A refresh that resolves after B becomes active", async () => {
        const aPlaces = deferred<readonly YeeAssignedPlace[]>();
        const aAudits = deferred<readonly YeeMyAuditItem[]>();
        apiMocks.fetchAssignedPlaces.mockImplementation((session: AuthSession) =>
            session.user.id === AUDITOR_A
                ? aPlaces.promise
                : Promise.resolve([placeFor(AUDITOR_B)]),
        );
        apiMocks.fetchMyAudits.mockImplementation((session: AuthSession) =>
            session.user.id === AUDITOR_A
                ? aAudits.promise
                : Promise.resolve([auditFor(AUDITOR_B)]),
        );

        activate(AUDITOR_A);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_A });
        const refreshA = useYeeMobileStore.getState().refreshRemoteState(sessionFor(AUDITOR_A));
        activate(AUDITOR_B);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_B });
        await useYeeMobileStore.getState().refreshRemoteState(sessionFor(AUDITOR_B));

        aPlaces.resolve([placeFor(AUDITOR_A)]);
        aAudits.resolve([auditFor(AUDITOR_A)]);
        await refreshA;

        expect(useYeeMobileStore.getState().assignedPlaces).toEqual([placeFor(AUDITOR_B)]);
        expect(useYeeMobileStore.getState().submittedAudits).toMatchObject([auditFor(AUDITOR_B)]);
        expect(await readAssignedPlacesCache()).toEqual([placeFor(AUDITOR_B)]);
        expect(await readSubmittedAuditsCache()).toMatchObject([auditFor(AUDITOR_B)]);
    });

    it("drains B's same-id item under B after A switches mid-request", async () => {
        const aResponse = deferred<YeeSubmissionResponse>();
        const aStarted = deferred<void>();
        const calls: string[][] = [];
        apiMocks.submitAudit.mockImplementation(
            (
                session: AuthSession,
                payload: { readonly participant_info: { readonly owner: string } },
            ) => {
                calls.push([session.user.id, payload.participant_info.owner]);
                if (session.user.id === AUDITOR_A) {
                    aStarted.resolve();
                    return aResponse.promise;
                }
                return Promise.resolve(submission(AUDITOR_B));
            },
        );

        activate(AUDITOR_A);
        await upsertSyncQueueItem(queueItem(AUDITOR_A));
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        const drainA = useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));
        await aStarted.promise;

        activate(AUDITOR_B);
        await upsertSyncQueueItem(queueItem(AUDITOR_B));
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_B);
        const drainB = useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_B));
        aResponse.resolve(submission(AUDITOR_A));
        await Promise.all([drainA, drainB]);

        expect(calls).toEqual([
            [AUDITOR_A, AUDITOR_A],
            [AUDITOR_B, AUDITOR_B],
        ]);
    });

    it("cancels and settles an automatic drain when the account signs out", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2090-01-01T00:00:00.000Z"));
        activate(AUDITOR_A);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_A, syncQueue: [] });
        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));

        const pending = useYeeMobileStore
            .getState()
            .syncPendingQueue(sessionFor(AUDITOR_A), { throttle: true });
        activate(null);
        useYeeMobileStore.getState().clearOfflineSnapshot();

        expect(vi.getTimerCount()).toBe(0);
        await expect(pending).resolves.toBeUndefined();
        expect(apiMocks.submitAudit).not.toHaveBeenCalled();
    });

    it("replaces A's deferred automatic drain with B's own work", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2090-01-01T00:00:00.000Z"));
        activate(AUDITOR_A);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_A, syncQueue: [] });
        await useYeeMobileStore.getState().syncPendingQueue(sessionFor(AUDITOR_A));
        const pendingA = useYeeMobileStore
            .getState()
            .syncPendingQueue(sessionFor(AUDITOR_A), { throttle: true });

        activate(AUDITOR_B);
        await upsertSyncQueueItem(queueItem(AUDITOR_B), AUDITOR_B);
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_B);
        const pendingB = useYeeMobileStore
            .getState()
            .syncPendingQueue(sessionFor(AUDITOR_B), { throttle: true });

        await expect(pendingA).resolves.toBeUndefined();
        await vi.advanceTimersByTimeAsync(5_000);
        await pendingB;
        expect(apiMocks.submitAudit).toHaveBeenCalledTimes(1);
        expect(apiMocks.submitAudit.mock.calls[0]?.[0]).toMatchObject({
            user: { id: AUDITOR_B },
        });
    });

    it("does not let a late A audit-state load write into B", async () => {
        const aState = deferred<Awaited<ReturnType<typeof apiMocks.fetchAuditState>>>();
        apiMocks.fetchAuditState.mockReturnValue(aState.promise);
        activate(AUDITOR_A);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_A });

        const loadA = useYeeMobileStore
            .getState()
            .loadPlaceAuditState("shared-place", sessionFor(AUDITOR_A));
        activate(AUDITOR_B);
        useYeeMobileStore.setState({ hydratedAccountId: AUDITOR_B, draftsByPlace: {} });
        aState.resolve({
            audit_id: "audit-a",
            submission_id: null,
            place_id: "shared-place",
            place_name: "Shared Place",
            auditor_generated_id: "A",
            status: "DRAFT",
            submitted_at: null,
            participant_info: { owner: AUDITOR_A },
            responses: {},
            score: null,
        });
        await loadA;

        expect(await readDraft("shared-place", AUDITOR_B)).toBeNull();
        expect(useYeeMobileStore.getState().draftsByPlace).toEqual({});
    });

    it("reconciles A storage without deleting B's same-place work", async () => {
        const aState = deferred<Awaited<ReturnType<typeof apiMocks.fetchAuditState>>>();
        apiMocks.fetchAuditState.mockReturnValue(aState.promise);
        activate(AUDITOR_A);
        await writeDraft(
            {
                id: "shared-place",
                schemaVersion: 1,
                version: 1,
                placeId: "shared-place",
                updatedAt: "2026-09-01T00:00:00.000Z",
                lastUpdatedIso: "2026-09-01T00:00:00.000Z",
                participantInfo: { owner: AUDITOR_A },
                responses: {},
                lastKnownBackendStatus: "DRAFT",
                lastKnownSubmissionId: null,
                scorePreview: null,
                syncState: "pending_upload",
            },
            AUDITOR_A,
        );
        await upsertSyncQueueItem(queueItem(AUDITOR_A), AUDITOR_A);
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_A);
        const reconcileA = useYeeMobileStore
            .getState()
            .reconcilePlaceSubmission("shared-place", sessionFor(AUDITOR_A));

        activate(AUDITOR_B);
        const draftA = await readDraft("shared-place", AUDITOR_A);
        if (draftA === null) {
            throw new Error("Expected A's seeded draft to exist.");
        }
        await writeDraft({ ...draftA, participantInfo: { owner: AUDITOR_B } }, AUDITOR_B);
        await upsertSyncQueueItem(queueItem(AUDITOR_B), AUDITOR_B);
        await useYeeMobileStore.getState().hydrateOfflineState(AUDITOR_B);
        aState.resolve({
            audit_id: "audit-a",
            submission_id: "submission-a",
            place_id: "shared-place",
            place_name: "Shared Place",
            auditor_generated_id: "A",
            status: "SUBMITTED",
            submitted_at: "2026-09-01T01:00:00.000Z",
            participant_info: {},
            responses: {},
            score: null,
        });
        await reconcileA;

        expect(await readDraft("shared-place", AUDITOR_A)).toBeNull();
        expect(await readSyncQueue(AUDITOR_A)).toHaveLength(0);
        expect(await readDraft("shared-place", AUDITOR_B)).not.toBeNull();
        expect(await readSyncQueue(AUDITOR_B)).toHaveLength(1);
    });
});
