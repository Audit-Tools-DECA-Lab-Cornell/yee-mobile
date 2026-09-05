/**
 * Tests for lib/yee-offline-storage.ts draft + sync-queue wrappers.
 *
 * Drafts and the sync queue are now backed by per-account MMKV
 * (lib/yee-secure-draft-storage.ts), not AsyncStorage. These tests verify the
 * public wrapper signatures still behave correctly over the MMKV substrate:
 * per-place draft round-trips, deletes, and queue upsert/remove dedup semantics.
 *
 * Corrupt-payload, migration, and per-account isolation behavior is covered in
 * yee-secure-draft-storage.test.ts.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { setActiveAccount } from "lib/yee-secure-draft-storage";
import type { YeeLocalDraft, YeeSyncQueueItem } from "lib/yee-types";

import {
    deleteDraft,
    readDraft,
    readDraftMap,
    readSyncQueue,
    removeSyncQueueItem,
    upsertSyncQueueItem,
    writeDraft,
    writeSyncQueue,
} from "lib/yee-offline-storage";

// Each test gets a fresh account namespace so MMKV state is isolated.
let accountCounter = 0;

beforeEach(() => {
    accountCounter += 1;
    setActiveAccount(`acct-${accountCounter}`);
});

function makeDraft(placeId: string, overrides: Partial<YeeLocalDraft> = {}): YeeLocalDraft {
    return {
        id: placeId,
        schemaVersion: 1,
        version: 1,
        placeId,
        updatedAt: "2026-06-25T00:00:00.000Z",
        lastUpdatedIso: "2026-06-25T00:00:00.000Z",
        participantInfo: {},
        responses: {},
        lastKnownBackendStatus: "DRAFT",
        lastKnownSubmissionId: null,
        scorePreview: null,
        syncState: "local_only",
        ...overrides,
    };
}

function makeQueueItem(id: string, placeId: string): YeeSyncQueueItem {
    return {
        id,
        placeId,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        kind: "draft_save",
        payload: { participant_info: {}, responses: {} },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: 8,
        failureReason: null,
    };
}

describe("writeDraft / readDraft - round-trip over MMKV", () => {
    it("persists and retrieves a draft by placeId", async () => {
        await writeDraft(makeDraft("place-123", { syncState: "synced" }));
        const result = await readDraft("place-123");
        expect(result).not.toBeNull();
        expect(result?.placeId).toBe("place-123");
        expect(result?.syncState).toBe("synced");
    });

    it("returns null for a placeId that was never written", async () => {
        const result = await readDraft("nonexistent-place");
        expect(result).toBeNull();
    });

    it("deleteDraft removes the entry without affecting others (per-place keying)", async () => {
        await writeDraft(makeDraft("place-A"));
        await writeDraft(makeDraft("place-B"));
        await deleteDraft("place-A");

        expect(await readDraft("place-A")).toBeNull();
        expect(await readDraft("place-B")).not.toBeNull();
    });

    it("deleteDraft is a no-op for an id that does not exist", async () => {
        await expect(deleteDraft("does-not-exist")).resolves.toBeUndefined();
    });

    it("writeDraft overwrites an existing draft for the same placeId", async () => {
        await writeDraft(makeDraft("place-overwrite", { syncState: "local_only" }));
        await writeDraft(makeDraft("place-overwrite", { syncState: "synced" }));
        const result = await readDraft("place-overwrite");
        expect(result?.syncState).toBe("synced");
    });

    it("readDraftMap returns every draft keyed by placeId", async () => {
        await writeDraft(makeDraft("place-1"));
        await writeDraft(makeDraft("place-2"));
        const map = await readDraftMap();
        expect(Object.keys(map).sort()).toEqual(["place-1", "place-2"]);
    });
});

describe("upsertSyncQueueItem / removeSyncQueueItem over MMKV", () => {
    it("inserts an item when the id is not present", async () => {
        await upsertSyncQueueItem(makeQueueItem("draft-place-1", "place-1"));
        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.id).toBe("draft-place-1");
    });

    it("updates (deduplicates) when the same id is upserted twice", async () => {
        const original = makeQueueItem("draft-place-2", "place-2");
        await upsertSyncQueueItem(original);

        const updated: YeeSyncQueueItem = { ...original, attempts: 3, lastError: "network error" };
        await upsertSyncQueueItem(updated);

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.attempts).toBe(3);
        expect(queue[0]?.lastError).toBe("network error");
    });

    it("removeSyncQueueItem removes only the matching entry", async () => {
        await writeSyncQueue([
            makeQueueItem("draft-place-a", "place-a"),
            makeQueueItem("draft-place-b", "place-b"),
        ]);

        await removeSyncQueueItem("draft-place-a");

        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.id).toBe("draft-place-b");
    });

    it("removeSyncQueueItem is a no-op for an unknown id", async () => {
        await writeSyncQueue([makeQueueItem("draft-place-c", "place-c")]);
        await removeSyncQueueItem("does-not-exist");
        const queue = await readSyncQueue();
        expect(queue).toHaveLength(1);
    });

    it("writeSyncQueue replaces the entire persisted queue", async () => {
        await writeSyncQueue([makeQueueItem("q-1", "place-1"), makeQueueItem("q-2", "place-2")]);
        await writeSyncQueue([makeQueueItem("q-3", "place-3")]);
        const queue = await readSyncQueue();
        expect(queue.map((item) => item.id)).toEqual(["q-3"]);
    });
});
