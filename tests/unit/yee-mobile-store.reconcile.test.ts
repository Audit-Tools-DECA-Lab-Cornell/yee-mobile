/**
 * Action-level tests for the ambiguous-success reconciliation in
 * stores/yee-mobile-store.ts (Plan 4).
 *
 * Scenario: a final submission is queued but the idempotency-key drain is
 * inconclusive (e.g. timeout / lost response) so the queue item is still
 * present. reconcilePlaceSubmission is the SECONDARY fallback: it asks the
 * backend GET /yee/places/{placeId}/audit-state and, on SUBMITTED, resolves the
 * local provisional record (drops the queued item + draft, refreshes summaries)
 * so the device converges with no duplicate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";
import { readDraft, readSyncQueue } from "lib/yee-offline-storage";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import type {
    YeeAuditStateResponse,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSubmissionResponse,
} from "lib/yee-types";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const fetchAuditStateMock = vi.fn<(...args: unknown[]) => Promise<YeeAuditStateResponse>>();
const fetchMyAuditsMock = vi.fn<(...args: unknown[]) => Promise<readonly YeeMyAuditItem[]>>();
const submitAuditMock = vi.fn<(...args: unknown[]) => Promise<YeeSubmissionResponse>>();

vi.mock("lib/yee-api", async () => {
    const actual = await vi.importActual<typeof import("lib/yee-api")>("lib/yee-api");
    return {
        ...actual,
        fetchAuditState: (...args: unknown[]) => fetchAuditStateMock(...args),
        fetchMyAudits: (...args: unknown[]) => fetchMyAuditsMock(...args),
        submitAudit: (...args: unknown[]) => submitAuditMock(...args),
    };
});

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

function makeAuditState(
    placeId: string,
    status: YeeAuditStateResponse["status"],
): YeeAuditStateResponse {
    return {
        audit_id: status === "SUBMITTED" ? "audit-1" : null,
        submission_id: status === "SUBMITTED" ? "server-sub-1" : null,
        place_id: placeId,
        place_name: "Place",
        auditor_generated_id: "AUD",
        status,
        submitted_at: status === "SUBMITTED" ? "2026-06-25T01:00:00.000Z" : null,
        participant_info: {},
        responses: {},
        score: null,
    };
}

let accountSeq = 0;
function freshAccount(): void {
    accountSeq += 1;
    currentAccountId = `acct-reconcile-${accountSeq}`;
    setActiveAccount(currentAccountId);
}

function resetStore(): void {
    useYeeMobileStore.setState({
        status: "ready",
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
    fetchAuditStateMock.mockReset();
    fetchMyAuditsMock.mockReset();
    fetchMyAuditsMock.mockResolvedValue([]);
    submitAuditMock.mockReset();
    freshAccount();
    resetStore();
});

describe("reconcilePlaceSubmission — SUBMITTED convergence", () => {
    it("drops the queued item and draft when audit-state reports SUBMITTED", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);
        expect(await readSyncQueue()).toHaveLength(1);

        fetchAuditStateMock.mockResolvedValue(makeAuditState("place-1", "SUBMITTED"));
        fetchMyAuditsMock.mockResolvedValue([
            {
                id: "server-sub-1",
                place_id: "place-1",
                place_name: "Place",
                submitted_at: "2026-06-25T01:00:00.000Z",
                total_score: 91,
                total_raw_maximum: 122,
                total_weighted_maximum: 2.22,
            },
        ]);

        const result = await useYeeMobileStore
            .getState()
            .reconcilePlaceSubmission("place-1", makeSession());

        expect(result).toBe("SUBMITTED");
        // No duplicate POST was issued by the fallback itself.
        expect(submitAuditMock).not.toHaveBeenCalled();
        // Queued submission item resolved, draft removed.
        expect(await readSyncQueue()).toHaveLength(0);
        expect(useYeeMobileStore.getState().syncQueue).toHaveLength(0);
        expect(await readDraft("place-1")).toBeNull();
        expect(useYeeMobileStore.getState().draftsByPlace["place-1"]).toBeUndefined();
        // Authoritative synced summary now present.
        const summaries = useYeeMobileStore.getState().submittedAudits;
        expect(summaries.some((s) => s.id === "server-sub-1" && s.syncState === "synced")).toBe(
            true,
        );
    });
});

describe("reconcilePlaceSubmission — not yet submitted", () => {
    it("keeps the queued item when audit-state reports DRAFT", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        fetchAuditStateMock.mockResolvedValue(makeAuditState("place-1", "DRAFT"));

        const result = await useYeeMobileStore
            .getState()
            .reconcilePlaceSubmission("place-1", makeSession());

        expect(result).toBe("DRAFT");
        // Item retained for a later drain (idempotency key still drives convergence).
        expect(await readSyncQueue()).toHaveLength(1);
        expect(await readDraft("place-1")).not.toBeNull();
    });

    it("returns null and retains the item when audit-state cannot be reached", async () => {
        const draft = makeDraft("place-1");
        await useYeeMobileStore.getState().saveDraftLocally(draft);
        await useYeeMobileStore.getState().queueSubmissionSync(draft, null);

        fetchAuditStateMock.mockRejectedValue(new Error("network down"));

        const result = await useYeeMobileStore
            .getState()
            .reconcilePlaceSubmission("place-1", makeSession());

        expect(result).toBeNull();
        expect(await readSyncQueue()).toHaveLength(1);
    });
});
