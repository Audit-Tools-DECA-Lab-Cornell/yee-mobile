import { describe, expect, it } from "vitest";
import {
    buildMobileAuditProjection,
    type MobileAuditProjectionInput,
} from "lib/yee-mobile-selectors";
import type {
    YeeAssignedPlace,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSyncQueueItem,
} from "lib/yee-types";

function place(id: string): YeeAssignedPlace {
    return {
        id,
        name: id,
        project: "YEE Demo",
        address: `${id} address`,
        audits: 0,
    };
}

function draft(placeId: string, syncState: YeeLocalDraft["syncState"]): YeeLocalDraft {
    return {
        id: placeId,
        schemaVersion: 1,
        version: 1,
        placeId,
        updatedAt: "2026-07-04T10:00:00.000Z",
        lastUpdatedIso: "2026-07-04T10:00:00.000Z",
        participantInfo: { place_id: placeId, place_name: placeId },
        responses: {},
        lastKnownBackendStatus: "DRAFT",
        lastKnownSubmissionId: null,
        scorePreview: null,
        syncState,
    };
}

function audit(
    id: string,
    placeId: string,
    syncState: YeeMyAuditItem["syncState"] = "synced",
    totalScore = 88,
    totalRawMaximum: number | null = 122,
): YeeMyAuditItem {
    return {
        id,
        place_id: placeId,
        place_name: placeId,
        submitted_at: id.startsWith("local")
            ? "2026-07-04T12:00:00.000Z"
            : "2026-07-04T09:00:00.000Z",
        total_score: totalScore,
        total_raw_maximum: totalRawMaximum,
        total_weighted_maximum: null,
        syncState,
    };
}

function queueItem(
    id: string,
    placeId: string,
    kind: YeeSyncQueueItem["kind"],
    failureReason: YeeSyncQueueItem["failureReason"] = null,
): YeeSyncQueueItem {
    return {
        id,
        placeId,
        createdAt: "2026-07-04T11:00:00.000Z",
        updatedAt: "2026-07-04T11:00:00.000Z",
        kind,
        payload: { participant_info: {}, responses: {}, place_id: placeId },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: 8,
        failureReason,
    };
}

function build(input: Partial<MobileAuditProjectionInput> = {}) {
    return buildMobileAuditProjection({
        assignedPlaces: [
            place("hub"),
            place("plaza"),
            place("eastside"),
            place("riverside"),
            place("market"),
        ],
        draftsByPlace: {},
        submittedAudits: [],
        syncQueue: [],
        ...input,
    });
}

describe("buildMobileAuditProjection", () => {
    it("matches the seeded auditor baseline: five assigned, one draft, three submitted, none pending", () => {
        const projection = build({
            draftsByPlace: {
                plaza: draft("plaza", "synced"),
            },
            submittedAudits: [
                audit("server-hub", "hub"),
                audit("server-riverside", "riverside"),
                audit("server-market", "market"),
            ],
        });

        expect(projection.summary).toMatchObject({
            assignedCount: 5,
            draftCount: 1,
            submittedCount: 3,
            pendingSyncCount: 0,
        });
        expect(projection.placeViews.map((view) => [view.place.id, view.status])).toEqual([
            ["hub", "submitted"],
            ["plaza", "draft"],
            ["eastside", "not_started"],
            ["riverside", "submitted"],
            ["market", "submitted"],
        ]);
    });

    it("counts duplicate draft-save and final-submission queue artifacts as one pending audit for the place", () => {
        const projection = build({
            draftsByPlace: {
                eastside: draft("eastside", "pending_upload"),
            },
            submittedAudits: [
                audit("server-hub", "hub"),
                audit("server-riverside", "riverside"),
                audit("server-market", "market"),
                audit("local-eastside", "eastside", "pending_upload"),
            ],
            syncQueue: [
                queueItem("draft-eastside", "eastside", "draft_save"),
                queueItem("submission-eastside", "eastside", "submission"),
            ],
        });

        const eastside = projection.placeViews.find((view) => view.place.id === "eastside");
        expect(eastside?.status).toBe("submitted");
        expect(eastside?.pendingSyncCount).toBe(1);
        expect(eastside?.pendingSubmission?.id).toBe("submission-eastside");
        expect(projection.summary.submittedCount).toBe(4);
        expect(projection.summary.pendingSyncCount).toBe(1);
    });

    it("keeps sync failures visible as one pending item needing attention", () => {
        const projection = build({
            draftsByPlace: {
                eastside: draft("eastside", "sync_failed"),
            },
            syncQueue: [queueItem("submission-eastside", "eastside", "submission", "terminal")],
        });

        const eastside = projection.placeViews.find((view) => view.place.id === "eastside");
        expect(eastside?.pendingSyncCount).toBe(1);
        expect(eastside?.syncLabel).toBe("Sync needs attention");
        expect(projection.summary.pendingSyncCount).toBe(1);
    });

    it("returns selected place and selected report from the same projection", () => {
        const projection = build({
            selectedPlaceId: "riverside",
            selectedSubmissionId: "server-riverside",
            submittedAudits: [audit("server-hub", "hub"), audit("server-riverside", "riverside")],
        });

        expect(projection.selectedPlaceView?.place.id).toBe("riverside");
        expect(projection.focusedSubmission?.id).toBe("server-riverside");
        expect(projection.sortedReports.map((entry) => entry.id)).toEqual([
            "server-hub",
            "server-riverside",
        ]);
    });

    it("switches to synced state after upload by removing pending queue and pending local report", () => {
        const projection = build({
            submittedAudits: [
                audit("server-eastside", "eastside", "synced"),
                audit("server-hub", "hub"),
            ],
            syncQueue: [],
        });

        const eastside = projection.placeViews.find((view) => view.place.id === "eastside");
        expect(eastside?.status).toBe("submitted");
        expect(eastside?.pendingSyncCount).toBe(0);
        expect(eastside?.syncLabel).toBe("Saved on Cloud");
        expect(projection.summary.pendingSyncCount).toBe(0);
    });

    it("averages and ranks canonical percentages instead of raw totals", () => {
        const projection = build({
            submittedAudits: [
                audit("high-raw", "hub", "synced", 80, 200),
                audit("high-percent", "market", "synced", 61, 122),
                audit("unavailable", "riverside", "synced", 100, null),
            ],
        });

        expect(projection.averageScore).toBe(45);
        expect(projection.topSubmission?.id).toBe("high-percent");
    });

    it("returns unavailable summaries when no synced audit has a valid maximum", () => {
        const projection = build({
            submittedAudits: [
                audit("missing-max", "hub", "synced", 80, null),
                audit("zero-max", "market", "synced", 0, 0),
                audit("pending", "riverside", "pending_upload", 61, 122),
            ],
        });

        expect(projection.averageScore).toBeNull();
        expect(projection.topSubmission).toBeNull();
    });
});
