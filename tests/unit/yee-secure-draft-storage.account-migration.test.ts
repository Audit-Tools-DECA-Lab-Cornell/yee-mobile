import { beforeEach, describe, expect, it } from "vitest";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    YeeStorageError,
    readDraftMapFromMmkv,
    readSyncQueueFromMmkv,
    setActiveAccount,
} from "lib/yee-secure-draft-storage";
import { prepareLegacyMigrationOwner } from "lib/yee-legacy-draft-migration";
import type { YeeLocalDraft, YeeSyncQueueItem } from "lib/yee-types";

const LEGACY_DRAFTS_KEY = "yee.mobile.local-drafts.v1";
const LEGACY_SYNC_QUEUE_KEY = "yee.mobile.sync-queue.v1";

function draft(placeId: string): YeeLocalDraft {
    return {
        id: placeId,
        schemaVersion: 1,
        version: 1,
        placeId,
        updatedAt: "2026-09-01T00:00:00.000Z",
        lastUpdatedIso: "2026-09-01T00:00:00.000Z",
        participantInfo: {},
        responses: {},
        lastKnownBackendStatus: "DRAFT",
        lastKnownSubmissionId: null,
        scorePreview: null,
        syncState: "pending_upload",
    };
}

function queueItem(placeId: string): YeeSyncQueueItem {
    return {
        id: `submission-${placeId}`,
        placeId,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        kind: "submission",
        payload: { participant_info: {}, responses: {}, place_id: placeId },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: 8,
        failureReason: null,
    };
}

beforeEach(async () => {
    await AsyncStorage.clear();
    setActiveAccount(null);
});

describe("legacy account ownership", () => {
    it("imports legacy drafts and queue into only the first account", async () => {
        await AsyncStorage.setItem(LEGACY_DRAFTS_KEY, JSON.stringify({ p1: draft("p1") }));
        await AsyncStorage.setItem(LEGACY_SYNC_QUEUE_KEY, JSON.stringify([queueItem("p1")]));

        await prepareLegacyMigrationOwner("legacy-owner-a");
        setActiveAccount("legacy-owner-a");
        expect(await readDraftMapFromMmkv()).toEqual({ p1: draft("p1") });
        expect(await readSyncQueueFromMmkv()).toEqual([queueItem("p1")]);

        setActiveAccount("legacy-non-owner-b");
        expect(await readDraftMapFromMmkv()).toEqual({});
        expect(await readSyncQueueFromMmkv()).toEqual([]);
    });

    it("keeps ownerless legacy work unresolved instead of assigning it to the next login", async () => {
        const rawDrafts = JSON.stringify({ p1: draft("p1") });
        await AsyncStorage.setItem(LEGACY_DRAFTS_KEY, rawDrafts);
        await prepareLegacyMigrationOwner(null);
        setActiveAccount("later-login");

        await expect(readDraftMapFromMmkv()).rejects.toBeInstanceOf(YeeStorageError);
        expect(await AsyncStorage.getItem(LEGACY_DRAFTS_KEY)).toBe(rawDrafts);
    });
});
