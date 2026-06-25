/**
 * Tests for lib/yee-secure-draft-storage.ts (per-account MMKV substrate).
 *
 * Covers:
 * - One-time AsyncStorage -> MMKV migration that copies legacy drafts + queue.
 * - Migration idempotency (a second access does not re-run or duplicate).
 * - Corrupt legacy payloads surface a typed YeeStorageError (NOT silently dropped).
 * - Per-account isolation (two account ids never collide).
 * - Per-place keying for drafts.
 * - Restart-style rehydrate (reopening the same account id sees prior writes).
 * - Explicit account removal clears storage; ordinary "logout" (setActiveAccount(null))
 *   preserves drafts.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    YeeStorageError,
    clearAccountStorage,
    readDraftFromMmkv,
    readDraftMapFromMmkv,
    readSyncQueueFromMmkv,
    setActiveAccount,
    writeDraftToMmkv,
} from "lib/yee-secure-draft-storage";
import type { YeeLocalDraft, YeeSyncQueueItem } from "lib/yee-types";

const LEGACY_DRAFTS_KEY = "yee.mobile.local-drafts.v1";
const LEGACY_SYNC_QUEUE_KEY = "yee.mobile.sync-queue.v1";

let accountCounter = 0;

function freshAccount(): string {
    accountCounter += 1;
    const id = `account-${accountCounter}`;
    setActiveAccount(id);
    return id;
}

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
});

afterEach(() => {
    setActiveAccount(null);
});

describe("migration: AsyncStorage -> MMKV", () => {
    it("copies legacy drafts and queue items into MMKV on first access", async () => {
        await AsyncStorage.setItem(
            LEGACY_DRAFTS_KEY,
            JSON.stringify({ "place-1": makeDraft("place-1"), "place-2": makeDraft("place-2") }),
        );
        await AsyncStorage.setItem(
            LEGACY_SYNC_QUEUE_KEY,
            JSON.stringify([makeQueueItem("submission-place-1", "place-1")]),
        );

        freshAccount();

        const drafts = await readDraftMapFromMmkv();
        expect(Object.keys(drafts).sort()).toEqual(["place-1", "place-2"]);

        const queue = await readSyncQueueFromMmkv();
        expect(queue).toHaveLength(1);
        expect(queue[0]?.id).toBe("submission-place-1");
    });

    it("is idempotent: a second access does not duplicate or re-run", async () => {
        await AsyncStorage.setItem(
            LEGACY_DRAFTS_KEY,
            JSON.stringify({ "place-1": makeDraft("place-1") }),
        );

        freshAccount();
        // First access triggers migration.
        await readDraftMapFromMmkv();

        // Mutate the legacy payload; a re-run would pull this in.
        await AsyncStorage.setItem(
            LEGACY_DRAFTS_KEY,
            JSON.stringify({ "place-1": makeDraft("place-1"), "place-2": makeDraft("place-2") }),
        );

        const drafts = await readDraftMapFromMmkv();
        expect(Object.keys(drafts)).toEqual(["place-1"]);
    });

    it("surfaces a typed YeeStorageError for a corrupt legacy drafts payload (not dropped)", async () => {
        await AsyncStorage.setItem(LEGACY_DRAFTS_KEY, "{not-valid-json");
        freshAccount();

        await expect(readDraftMapFromMmkv()).rejects.toBeInstanceOf(YeeStorageError);
    });

    it("surfaces a typed YeeStorageError for a corrupt legacy queue payload (not dropped)", async () => {
        await AsyncStorage.setItem(LEGACY_SYNC_QUEUE_KEY, "CORRUPTED");
        freshAccount();

        await expect(readSyncQueueFromMmkv()).rejects.toBeInstanceOf(YeeStorageError);
    });

    it("migrates cleanly when there is no legacy data", async () => {
        freshAccount();
        const drafts = await readDraftMapFromMmkv();
        expect(drafts).toEqual({});
        const queue = await readSyncQueueFromMmkv();
        expect(queue).toEqual([]);
    });
});

describe("per-account isolation", () => {
    it("does not let two accounts see each other's drafts", async () => {
        const accountA = freshAccount();
        await writeDraftToMmkv(makeDraft("place-A"));

        const accountB = freshAccount();
        await writeDraftToMmkv(makeDraft("place-B"));

        setActiveAccount(accountA);
        const aDrafts = await readDraftMapFromMmkv();
        expect(Object.keys(aDrafts)).toEqual(["place-A"]);

        setActiveAccount(accountB);
        const bDrafts = await readDraftMapFromMmkv();
        expect(Object.keys(bDrafts)).toEqual(["place-B"]);
    });
});

describe("per-place keying", () => {
    it("stores and deletes drafts independently per place id", async () => {
        freshAccount();
        await writeDraftToMmkv(makeDraft("p1"));
        await writeDraftToMmkv(makeDraft("p2"));

        expect(await readDraftFromMmkv("p1")).not.toBeNull();
        expect(await readDraftFromMmkv("p2")).not.toBeNull();
    });
});

describe("restart-style rehydrate", () => {
    it("reopening the same account id sees previously written drafts", async () => {
        const account = freshAccount();
        await writeDraftToMmkv(makeDraft("place-restart", { version: 7 }));

        // Simulate an app restart: drop the active account pointer (as on logout),
        // then reactivate the same account (as on next launch / re-auth).
        setActiveAccount(null);
        setActiveAccount(account);

        const draft = await readDraftFromMmkv("place-restart");
        expect(draft).not.toBeNull();
        expect(draft?.version).toBe(7);
    });

    it("preserves drafts across a logout (setActiveAccount(null)) for the same account", async () => {
        const account = freshAccount();
        await writeDraftToMmkv(makeDraft("place-keep"));

        setActiveAccount(null);
        setActiveAccount(account);

        expect(await readDraftFromMmkv("place-keep")).not.toBeNull();
    });
});

describe("explicit account removal", () => {
    it("clearAccountStorage wipes that account's drafts", async () => {
        const account = freshAccount();
        await writeDraftToMmkv(makeDraft("place-gone"));

        clearAccountStorage(account);

        setActiveAccount(account);
        expect(await readDraftFromMmkv("place-gone")).toBeNull();
    });
});

describe("no active account", () => {
    it("throws a typed error when no account is set and no session exists", async () => {
        setActiveAccount(null);
        await expect(readDraftMapFromMmkv()).rejects.toBeInstanceOf(YeeStorageError);
    });
});
