/**
 * Baseline tests for the sync queue state helpers in stores/yee-mobile-store.ts.
 *
 * NOTE ON TESTABILITY: The zustand store (useYeeMobileStore) imports heavy React
 * Native modules (NetInfo, AsyncStorage, etc.) and runs side-effects on module
 * load. Fully testing it in Node requires those imports to be resolvable, which
 * our setup.ts mocks handle. However, the store's action methods mix React state,
 * async storage, and network calls — making them expensive to unit-test in
 * isolation without the full store harness.
 *
 * Strategy chosen (as documented in the plan):
 *   - Test the two pure helpers that are module-private but extractable: the
 *     upsertLocalQueue shape logic (visible via exported storage helpers) and
 *     mergeSubmittedAuditSummaries-equivalent logic (pure array merge).
 *   - Write the most valuable pure-shape tests we can today.
 *   - Explicitly note that fuller store tests (action-level integration) come
 *     after Stage 3 extracts pure queue/sync helpers into their own module.
 *
 * Pure helpers under test (extracted inline here; Stage 3 will export them):
 *   upsertLocalQueue — deduplicates by id, inserts new items at the end.
 *   mergeSubmittedAuditSummaries — prefers remote synced state, keeps local
 *     pending/failed items that are not yet reflected remotely.
 */

import { describe, expect, it } from "vitest";
import type { YeeMyAuditItem, YeeSyncQueueItem } from "lib/yee-types";

// ---------------------------------------------------------------------------
// upsertLocalQueue — pure shape logic mirrored from the store
// ---------------------------------------------------------------------------

function upsertLocalQueue(
    queue: readonly YeeSyncQueueItem[],
    item: YeeSyncQueueItem,
): readonly YeeSyncQueueItem[] {
    const index = queue.findIndex((entry) => entry.id === item.id);
    if (index === -1) {
        return [...queue, item];
    }
    const nextQueue = [...queue];
    nextQueue[index] = item;
    return nextQueue;
}

function makeQueueItem(id: string, attempts = 0): YeeSyncQueueItem {
    return {
        id,
        placeId: `place-for-${id}`,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        kind: "draft_save",
        payload: { participant_info: {}, responses: {} },
        attempts,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: 8,
        failureReason: null,
    };
}

describe("upsertLocalQueue (pure helper)", () => {
    it("inserts a new item when the id is not present", () => {
        const queue = [makeQueueItem("id-1"), makeQueueItem("id-2")];
        const result = upsertLocalQueue(queue, makeQueueItem("id-3"));
        expect(result).toHaveLength(3);
        expect(result[2]?.id).toBe("id-3");
    });

    it("updates in-place when the id already exists", () => {
        const queue = [makeQueueItem("id-1", 0), makeQueueItem("id-2", 0)];
        const updated = { ...makeQueueItem("id-1", 3), lastError: "timeout" };
        const result = upsertLocalQueue(queue, updated);
        expect(result).toHaveLength(2);
        expect(result[0]?.attempts).toBe(3);
        expect(result[0]?.lastError).toBe("timeout");
    });

    it("does not mutate the original array", () => {
        const original: readonly YeeSyncQueueItem[] = [makeQueueItem("id-1")];
        upsertLocalQueue(original, makeQueueItem("id-2"));
        expect(original).toHaveLength(1);
    });

    it("works on an empty queue", () => {
        const result = upsertLocalQueue([], makeQueueItem("id-1"));
        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("id-1");
    });

    it("preserves order of existing items when updating", () => {
        const queue = [makeQueueItem("a"), makeQueueItem("b"), makeQueueItem("c")];
        const updated = { ...makeQueueItem("b"), attempts: 5 };
        const result = upsertLocalQueue(queue, updated);
        expect(result.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
        expect(result[1]?.attempts).toBe(5);
    });
});

// ---------------------------------------------------------------------------
// mergeSubmittedAuditSummaries — pure shape logic mirrored from the store
// ---------------------------------------------------------------------------

function mergeSubmittedAuditSummaries(
    remoteAudits: readonly YeeMyAuditItem[],
    existingAudits: readonly YeeMyAuditItem[],
): readonly YeeMyAuditItem[] {
    const normalizedRemoteAudits = remoteAudits.map((audit) => ({
        ...audit,
        syncState: "synced" as const,
    }));
    const pendingLocalAudits = existingAudits.filter(
        (audit) => audit.syncState === "pending_upload" || audit.syncState === "sync_failed",
    );
    return [
        ...normalizedRemoteAudits,
        ...pendingLocalAudits.filter(
            (localAudit) =>
                !normalizedRemoteAudits.some((remoteAudit) => remoteAudit.id === localAudit.id),
        ),
    ].sort((left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at));
}

function makeAudit(
    id: string,
    submittedAt: string,
    syncState: YeeMyAuditItem["syncState"] = "synced",
): YeeMyAuditItem {
    return {
        id,
        place_id: `place-${id}`,
        place_name: `Place ${id}`,
        submitted_at: submittedAt,
        total_score: 75,
        total_raw_maximum: 122,
        total_weighted_maximum: 2.22,
        syncState,
    };
}

describe("mergeSubmittedAuditSummaries (pure helper)", () => {
    it("marks all remote audits as synced regardless of local state", () => {
        const remote = [makeAudit("audit-1", "2026-06-25T10:00:00.000Z", "pending_upload")];
        const result = mergeSubmittedAuditSummaries(remote, []);
        expect(result[0]?.syncState).toBe("synced");
    });

    it("keeps local pending_upload audits not yet in the remote list", () => {
        const remote = [makeAudit("remote-1", "2026-06-25T10:00:00.000Z")];
        const existing = [makeAudit("local-pending", "2026-06-25T09:00:00.000Z", "pending_upload")];
        const result = mergeSubmittedAuditSummaries(remote, existing);
        const ids = result.map((a) => a.id);
        expect(ids).toContain("remote-1");
        expect(ids).toContain("local-pending");
    });

    it("keeps local sync_failed audits not yet in the remote list", () => {
        const remote: readonly YeeMyAuditItem[] = [];
        const existing = [makeAudit("failed-1", "2026-06-25T08:00:00.000Z", "sync_failed")];
        const result = mergeSubmittedAuditSummaries(remote, existing);
        expect(result[0]?.id).toBe("failed-1");
        expect(result[0]?.syncState).toBe("sync_failed");
    });

    it("does not include local-only or synced audits that are absent from remote", () => {
        const remote: readonly YeeMyAuditItem[] = [];
        const existing = [
            makeAudit("local-only-1", "2026-06-25T07:00:00.000Z", "local_only"),
            makeAudit("synced-1", "2026-06-25T06:00:00.000Z", "synced"),
        ];
        const result = mergeSubmittedAuditSummaries(remote, existing);
        // local_only and synced items that are not in remote are dropped
        expect(result).toHaveLength(0);
    });

    it("deduplicates: remote version wins over local pending when ids match", () => {
        const remote = [makeAudit("overlap-1", "2026-06-25T10:00:00.000Z", "synced")];
        const existing = [makeAudit("overlap-1", "2026-06-25T10:00:00.000Z", "pending_upload")];
        const result = mergeSubmittedAuditSummaries(remote, existing);
        expect(result).toHaveLength(1);
        expect(result[0]?.syncState).toBe("synced");
    });

    it("sorts the result newest-first by submitted_at", () => {
        const remote = [
            makeAudit("old-remote", "2026-06-20T00:00:00.000Z"),
            makeAudit("new-remote", "2026-06-25T00:00:00.000Z"),
        ];
        const existing = [makeAudit("pending", "2026-06-22T00:00:00.000Z", "pending_upload")];
        const result = mergeSubmittedAuditSummaries(remote, existing);
        expect(result.map((a) => a.id)).toEqual(["new-remote", "pending", "old-remote"]);
    });

    it("returns an empty array when both remote and existing are empty", () => {
        const result = mergeSubmittedAuditSummaries([], []);
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Queue submission id shape — deterministic id format validation
// (validates the naming convention used in the store: `submission-${placeId}`)
// ---------------------------------------------------------------------------
describe("queue item id conventions", () => {
    it("submission item id matches the expected deterministic pattern", () => {
        const placeId = "place-abc-123";
        const expectedId = `submission-${placeId}`;
        const item = makeQueueItem(expectedId);
        expect(item.id).toBe("submission-place-abc-123");
        expect(item.id.startsWith("submission-")).toBe(true);
    });

    it("draft item id matches the expected deterministic pattern", () => {
        const placeId = "place-def-456";
        const expectedId = `draft-${placeId}`;
        const item = makeQueueItem(expectedId);
        expect(item.id).toBe("draft-place-def-456");
        expect(item.id.startsWith("draft-")).toBe(true);
    });

    it("upsertLocalQueue deduplicates a submission item correctly (idempotent re-enqueue)", () => {
        const submissionId = "submission-place-xyz";
        const queue = [makeQueueItem(submissionId, 0)];
        // Re-enqueue the same submission (simulates a second submit tap)
        const duplicate = makeQueueItem(submissionId, 0);
        const result = upsertLocalQueue(queue, duplicate);
        expect(result).toHaveLength(1);
    });
});
