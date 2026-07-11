/**
 * Tests for the participant ID flowing through the audit metadata pipeline.
 *
 * Covers:
 * - buildParticipantInfo stamping participant_id alongside the existing keys.
 * - buildFormStateFromSources restoring participant_id from a stored draft.
 */
import { describe, expect, it } from "vitest";
import {
    buildFormStateFromSources,
    buildParticipantInfo,
    createEmptyFormState,
} from "lib/yee-mobile-draft";
import { YEE_DRAFT_SCHEMA_VERSION, type YeeLocalDraft } from "lib/yee-types";

describe("buildParticipantInfo participant stamping", () => {
    it("stamps participant_id without disturbing existing keys", () => {
        const state = {
            ...createEmptyFormState("place-1", "Test Place", "AUD-1"),
            participantId: "P-042",
        };
        const info = buildParticipantInfo(state);

        expect(info.participant_id).toBe("P-042");
        expect(info.auditor_id).toBe("AUD-1");
        expect(info.place_id).toBe("place-1");
    });

    it("stamps an empty string when no participant ID was entered", () => {
        const info = buildParticipantInfo(createEmptyFormState("place-1", "Test Place", "AUD-1"));
        expect(info.participant_id).toBe("");
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
