/**
 * Tests for lib/device-identity.ts and its stamping into audit metadata.
 *
 * Covers:
 * - Tablet label persistence round-trip over the MMKV stub (trimmed, reopens),
 *   including the durable-write success signal.
 * - OS device id hydration falling back from Android ID (throws in the test
 *   mock, as on iOS) to the iOS vendor ID, and the persisted id being readable
 *   synchronously on a cold start (fresh module instance).
 * - buildParticipantInfo stamping participant_id + device identity keys.
 * - buildFormStateFromSources restoring participant_id from a stored draft.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    getDeviceIdentity,
    hydrateDeviceIdentity,
    readTabletId,
    saveTabletId,
    withDeviceIdentityFallback,
} from "lib/device-identity";
import {
    buildFormStateFromSources,
    buildParticipantInfo,
    createEmptyFormState,
} from "lib/yee-mobile-draft";
import { YEE_DRAFT_SCHEMA_VERSION, type YeeLocalDraft } from "lib/yee-types";

beforeEach(() => {
    saveTabletId("");
});

describe("tablet label persistence", () => {
    it("round-trips a saved label and trims whitespace", () => {
        expect(saveTabletId("  TAB-07  ")).toBe(true);
        expect(readTabletId()).toBe("TAB-07");
    });

    it("returns an empty string when nothing has been saved", () => {
        expect(readTabletId()).toBe("");
    });
});

describe("hydrateDeviceIdentity", () => {
    it("falls back to the iOS vendor id when the Android id is unavailable", async () => {
        await hydrateDeviceIdentity();
        expect(getDeviceIdentity().os_device_id).toBe("test-vendor-id");
    });

    it("reports the OS-provided model name", () => {
        expect(getDeviceIdentity().device_model).toBe("Test Tablet");
    });

    it("reads the persisted OS id synchronously on a cold start", async () => {
        await hydrateDeviceIdentity();

        // Fresh module instance = new process launch; the id must come from
        // MMKV without awaiting hydration, so an early save can't stamp "".
        vi.resetModules();
        const fresh = await import("lib/device-identity");
        expect(fresh.getDeviceIdentity().os_device_id).toBe("test-vendor-id");
    });
});

describe("buildParticipantInfo device + participant stamping", () => {
    it("stamps participant_id and the device identity keys", async () => {
        saveTabletId("TAB-07");
        await hydrateDeviceIdentity();

        const state = {
            ...createEmptyFormState("place-1", "Test Place", "AUD-1"),
            participantId: "P-042",
        };
        const info = buildParticipantInfo(state);

        expect(info.participant_id).toBe("P-042");
        expect(info.tablet_id).toBe("TAB-07");
        expect(info.os_device_id).toBe("test-vendor-id");
        expect(info.device_model).toBe("Test Tablet");
        // Existing keys are untouched.
        expect(info.auditor_id).toBe("AUD-1");
        expect(info.place_id).toBe("place-1");
    });

    it("stamps empty strings when no label is set", () => {
        const info = buildParticipantInfo(createEmptyFormState("place-1", "Test Place", "AUD-1"));
        expect(info.participant_id).toBe("");
        expect(info.tablet_id).toBe("");
    });
});

describe("withDeviceIdentityFallback send-time backfill", () => {
    it("fills blank device fields from the current identity", async () => {
        saveTabletId("TAB-07");
        await hydrateDeviceIdentity();

        // Payload frozen into the offline queue before hydration/labeling.
        const queued = { participant_id: "P-042", os_device_id: "", tablet_id: "" };
        const filled = await withDeviceIdentityFallback(queued);

        expect(filled.os_device_id).toBe("test-vendor-id");
        expect(filled.tablet_id).toBe("TAB-07");
        expect(filled.device_model).toBe("Test Tablet");
        expect(filled.participant_id).toBe("P-042");
        // The queued payload itself is not mutated.
        expect(queued.os_device_id).toBe("");
    });

    it("never overwrites a non-empty captured value", async () => {
        saveTabletId("TAB-99");
        await hydrateDeviceIdentity();

        const filled = await withDeviceIdentityFallback({
            tablet_id: "TAB-01",
            os_device_id: "captured-elsewhere",
        });
        expect(filled.tablet_id).toBe("TAB-01");
        expect(filled.os_device_id).toBe("captured-elsewhere");
    });

    it("awaits hydration itself, so even a first-launch send gets the OS id", async () => {
        // True first launch: fresh module state AND no persisted id in MMKV.
        vi.resetModules();
        const mmkv = (await import("react-native-mmkv")) as unknown as {
            __mmkvStoresById: Map<string, Map<string, string>>;
        };
        mmkv.__mmkvStoresById.get("yee.device-identity")?.clear();

        const fresh = await import("lib/device-identity");
        expect(fresh.getDeviceIdentity().os_device_id).toBe("");

        // No explicit hydrate call — the send-time helper must wait on its own.
        const filled = await fresh.withDeviceIdentityFallback({ os_device_id: "" });
        expect(filled.os_device_id).toBe("test-vendor-id");
    });
});

describe("buildFormStateFromSources participant_id restore", () => {
    it("restores participant_id from a stored draft", () => {
        const storedDraft: YeeLocalDraft = {
            id: "place-1",
            schemaVersion: YEE_DRAFT_SCHEMA_VERSION,
            version: 1,
            placeId: "place-1",
            updatedAt: new Date().toISOString(),
            lastUpdatedIso: new Date().toISOString(),
            participantInfo: { participant_id: "P-042" },
            responses: {},
            lastKnownBackendStatus: "DRAFT",
            lastKnownSubmissionId: null,
            scorePreview: null,
            syncState: "local_only",
        };

        const formState = buildFormStateFromSources({
            placeId: "place-1",
            placeName: "Test Place",
            auditorId: "AUD-1",
            storedDraft,
        });
        expect(formState.participantId).toBe("P-042");
    });

    it("defaults participant_id to empty when absent from the draft", () => {
        const formState = buildFormStateFromSources({
            placeId: "place-1",
            placeName: "Test Place",
            auditorId: "AUD-1",
        });
        expect(formState.participantId).toBe("");
    });
});
