/**
 * Tests for the extracted, pure submit-guard logic in lib/yee-submit-guard.ts.
 *
 * Stage 1 re-implemented findFirstIncompleteStep inline because it was buried in
 * the review.tsx component and not exported. Stage 4 extracted it into
 * lib/yee-submit-guard.ts, so these tests now import and exercise the REAL
 * function (no drift possible). They also cover the new pure helpers that drive
 * the persisted in-flight guard and the user-facing status mapping:
 *   - findPendingSubmission — locate a persisted submission queue item for a place
 *   - deriveSubmitStatus    — map queue state to a user-facing SubmitUiStatus
 */

import { describe, expect, it } from "vitest";
import {
    deriveSubmitStatus,
    findFirstIncompleteStep,
    findPendingSubmission,
    getCompletedSteps,
    type SubmitGuardDraft,
} from "lib/yee-submit-guard";
import {
    getDomainForStep,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import type {
    InstrumentLogicalQuestion,
    InstrumentSectionDefinition,
    NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { YEE_SYNC_MAX_ATTEMPTS, type YeeSyncQueueItem } from "lib/yee-types";

// ---------------------------------------------------------------------------
// Instrument builders (real NormalizedInstrument shape)
// ---------------------------------------------------------------------------
function makeQuestion(presenceItemId: string, choiceId: string): InstrumentLogicalQuestion {
    return {
        key: `${presenceItemId}:${choiceId}`,
        choiceId,
        prompt: `Question for ${presenceItemId}`,
        presenceItemId,
        presenceAnswers: [{ id: "ans1", label: "Yes" }],
        conditionItemId: null,
        conditionAnswers: [],
        conditionTriggerAnswerIds: [],
        conditionRequiredWhenShown: false,
    };
}

function makeSection(
    step: MobileYeeStepNumber,
    title: string,
    questions: readonly InstrumentLogicalQuestion[],
): InstrumentSectionDefinition {
    const domain = getDomainForStep(step);
    if (domain === null) {
        throw new Error(`step ${step} has no domain`);
    }
    return {
        domain,
        step,
        title,
        blockLabel: title,
        introText: "",
        commentPrompt: "",
        questions,
    };
}

function makeInstrument(sections: readonly InstrumentSectionDefinition[]): NormalizedInstrument {
    return {
        sections,
        contextQuestions: [],
        weighting: { title: "", description: "", options: [], domains: [] },
        conditionPrompt: "",
        finalCommentsPrompt: "",
    };
}

// ---------------------------------------------------------------------------
// Draft builder
// ---------------------------------------------------------------------------
const FULL_WEIGHTS: Record<MobileYeeDomainKey, string> = {
    access: "3",
    activitySpaces: "2",
    amenities: "1",
    experienceOfSpace: "3",
    aestheticsAndCare: "2",
    useAndUsability: "1",
};

function makeDraft(overrides: Partial<SubmitGuardDraft> = {}): SubmitGuardDraft {
    return {
        visitFrequency: "once-or-twice-a-week",
        publicAccess: "yes",
        openHoursAccess: "yes",
        season: "summer",
        weather: ["sunny-mostly-sunny"],
        weights: { ...FULL_WEIGHTS },
        responses: {},
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Queue item builder
// ---------------------------------------------------------------------------
function makeSubmissionItem(
    placeId: string,
    overrides: Partial<YeeSyncQueueItem> = {},
): YeeSyncQueueItem {
    return {
        id: `submission-${placeId}`,
        placeId,
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        kind: "submission",
        payload: {
            participant_info: {},
            responses: {},
            place_id: placeId,
            idempotency_key: `yee-${placeId}-abc`,
            draft_version: 1,
        },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
        failureReason: null,
        ...overrides,
    };
}

// ===========================================================================
// findFirstIncompleteStep — Step 1 (Context)
// ===========================================================================
describe("findFirstIncompleteStep — Step 1 (Context)", () => {
    it("flags step 1 when visitFrequency is empty", () => {
        expect(findFirstIncompleteStep(makeDraft({ visitFrequency: "" }), null)).toEqual({
            step: 1,
            label: "Context",
        });
    });

    it("flags step 1 when publicAccess is empty", () => {
        expect(findFirstIncompleteStep(makeDraft({ publicAccess: "" }), null)).toEqual({
            step: 1,
            label: "Context",
        });
    });

    it("flags step 1 when openHoursAccess is empty", () => {
        expect(findFirstIncompleteStep(makeDraft({ openHoursAccess: "" }), null)).toEqual({
            step: 1,
            label: "Context",
        });
    });

    it("flags step 1 when season is empty", () => {
        expect(findFirstIncompleteStep(makeDraft({ season: "" }), null)).toEqual({
            step: 1,
            label: "Context",
        });
    });

    it("flags step 1 when weather is an empty array", () => {
        expect(findFirstIncompleteStep(makeDraft({ weather: [] }), null)).toEqual({
            step: 1,
            label: "Context",
        });
    });
});

// ===========================================================================
// findFirstIncompleteStep — Step 2 (Weighting)
// ===========================================================================
describe("findFirstIncompleteStep — Step 2 (Weighting)", () => {
    it("flags step 2 when one domain weight is empty", () => {
        const weights: Record<MobileYeeDomainKey, string> = { ...FULL_WEIGHTS, access: "" };
        expect(findFirstIncompleteStep(makeDraft({ weights }), null)).toEqual({
            step: 2,
            label: "Weighting",
        });
    });

    it("passes step 2 when all six weights are non-empty and no instrument", () => {
        expect(findFirstIncompleteStep(makeDraft(), null)).toBeNull();
    });
});

// ===========================================================================
// findFirstIncompleteStep — Steps 3–8 (Domain sections)
// ===========================================================================
describe("findFirstIncompleteStep — Steps 3–8 (Domain sections)", () => {
    it("flags step 3 when the Access section has unanswered questions", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-1", "ch-1")]),
        ]);
        expect(findFirstIncompleteStep(makeDraft(), instrument)).toEqual({
            step: 3,
            label: "Access",
        });
    });

    it("passes step 3 when all rows in Access are answered", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-1", "ch-1")]),
        ]);
        const responses = { "item-1": { "ch-1": "ans1" } };
        expect(findFirstIncompleteStep(makeDraft({ responses }), instrument)).toBeNull();
    });

    it("flags the first incomplete step (4) when step 3 is complete but step 4 is not", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-a", "ch-a")]),
            makeSection(4, "Activity Spaces", [makeQuestion("item-b", "ch-b")]),
        ]);
        const responses = { "item-a": { "ch-a": "ans1" } };
        expect(findFirstIncompleteStep(makeDraft({ responses }), instrument)).toEqual({
            step: 4,
            label: "Activity Spaces",
        });
    });

    it("returns null when all six domain sections are fully answered", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-a", "ch-a")]),
            makeSection(4, "Activity Spaces", [makeQuestion("item-b", "ch-b")]),
            makeSection(5, "Amenities", [makeQuestion("item-c", "ch-c")]),
            makeSection(6, "Experience", [makeQuestion("item-d", "ch-d")]),
            makeSection(7, "Aesthetics", [makeQuestion("item-e", "ch-e")]),
            makeSection(8, "Use & Usability", [makeQuestion("item-f", "ch-f")]),
        ]);
        const responses: Record<string, Record<string, string>> = {
            "item-a": { "ch-a": "ans" },
            "item-b": { "ch-b": "ans" },
            "item-c": { "ch-c": "ans" },
            "item-d": { "ch-d": "ans" },
            "item-e": { "ch-e": "ans" },
            "item-f": { "ch-f": "ans" },
        };
        expect(findFirstIncompleteStep(makeDraft({ responses }), instrument)).toBeNull();
    });

    it("skips a step when the instrument has no section for that domain", () => {
        const instrument = makeInstrument([
            makeSection(5, "Amenities", [makeQuestion("item-c", "ch-c")]),
        ]);
        const responses = { "item-c": { "ch-c": "ans1" } };
        expect(findFirstIncompleteStep(makeDraft({ responses }), instrument)).toBeNull();
    });

    it("checks context before weighting before domain sections", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-1", "ch-1")]),
        ]);
        expect(findFirstIncompleteStep(makeDraft({ visitFrequency: "" }), instrument)).toEqual({
            step: 1,
            label: "Context",
        });
    });

    it("requires a shown condition answer unless the instrument marks it optional", () => {
        const question: InstrumentLogicalQuestion = {
            ...makeQuestion("item-1", "ch-1"),
            conditionItemId: "condition-1",
            conditionAnswers: [{ id: "good", label: "Good" }],
            conditionTriggerAnswerIds: ["ans1"],
            conditionRequiredWhenShown: true,
        };
        const instrument = makeInstrument([makeSection(3, "Access", [question])]);
        const responses = { "item-1": { "ch-1": "ans1" } };

        expect(findFirstIncompleteStep(makeDraft({ responses }), instrument)).toEqual({
            step: 3,
            label: "Access",
        });
        expect(
            findFirstIncompleteStep(
                makeDraft({ responses }),
                makeInstrument([
                    makeSection(3, "Access", [{ ...question, conditionRequiredWhenShown: false }]),
                ]),
            ),
        ).toBeNull();
    });
});

// ===========================================================================
// findFirstIncompleteStep — null instrument
// ===========================================================================
describe("findFirstIncompleteStep — null instrument", () => {
    it("skips domain-section checks when instrument is null", () => {
        expect(findFirstIncompleteStep(makeDraft(), null)).toBeNull();
    });
});

// ===========================================================================
// getCompletedSteps — per-step progress for the tablet step rail
// ===========================================================================
describe("getCompletedSteps", () => {
    it("marks steps 1 and 2 complete for a full context + weighting draft", () => {
        const completed = getCompletedSteps(makeDraft(), null);
        expect([...completed].sort()).toEqual([1, 2]);
    });

    it("omits step 1 when a context field is missing", () => {
        const completed = getCompletedSteps(makeDraft({ season: "" }), null);
        expect(completed.has(1)).toBe(false);
        expect(completed.has(2)).toBe(true);
    });

    it("omits step 2 when a weight is missing without hiding later progress", () => {
        const weights: Record<MobileYeeDomainKey, string> = { ...FULL_WEIGHTS, access: "" };
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-1", "ch-1")]),
        ]);
        const responses = { "item-1": { "ch-1": "ans1" } };
        const completed = getCompletedSteps(makeDraft({ weights, responses }), instrument);
        expect(completed.has(2)).toBe(false);
        expect(completed.has(3)).toBe(true);
    });

    it("marks only fully answered domain sections complete", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-a", "ch-a")]),
            makeSection(4, "Activity Spaces", [makeQuestion("item-b", "ch-b")]),
        ]);
        const responses = { "item-a": { "ch-a": "ans" } };
        const completed = getCompletedSteps(makeDraft({ responses }), instrument);
        expect(completed.has(3)).toBe(true);
        expect(completed.has(4)).toBe(false);
    });

    it("never includes optional step 9 and skips domain steps without an instrument", () => {
        const completed = getCompletedSteps(makeDraft(), null);
        expect(completed.has(9)).toBe(false);
        expect([3, 4, 5, 6, 7, 8].some((step) => completed.has(step as 3))).toBe(false);
    });

    it("agrees with findFirstIncompleteStep on a fully complete audit", () => {
        const instrument = makeInstrument([
            makeSection(3, "Access", [makeQuestion("item-a", "ch-a")]),
        ]);
        const responses = { "item-a": { "ch-a": "ans" } };
        const draft = makeDraft({ responses });
        expect(findFirstIncompleteStep(draft, instrument)).toBeNull();
        expect([...getCompletedSteps(draft, instrument)].sort()).toEqual([1, 2, 3]);
    });
});

// ===========================================================================
// findPendingSubmission — persisted in-flight guard
// ===========================================================================
describe("findPendingSubmission", () => {
    it("returns null when the queue is empty", () => {
        expect(findPendingSubmission([], "place-1")).toBeNull();
    });

    it("returns the submission item for the matching place", () => {
        const item = makeSubmissionItem("place-1");
        expect(findPendingSubmission([item], "place-1")).toBe(item);
    });

    it("ignores submission items for a different place", () => {
        const item = makeSubmissionItem("place-2");
        expect(findPendingSubmission([item], "place-1")).toBeNull();
    });

    it("ignores draft_save items for the same place", () => {
        const draftItem = makeSubmissionItem("place-1", {
            id: "draft-place-1",
            kind: "draft_save",
        });
        expect(findPendingSubmission([draftItem], "place-1")).toBeNull();
    });

    it("finds the submission even when a draft_save is also queued", () => {
        const draftItem = makeSubmissionItem("place-1", {
            id: "draft-place-1",
            kind: "draft_save",
        });
        const submissionItem = makeSubmissionItem("place-1");
        expect(findPendingSubmission([draftItem, submissionItem], "place-1")).toBe(submissionItem);
    });
});

// ===========================================================================
// deriveSubmitStatus — user-facing state mapping
// ===========================================================================
describe("deriveSubmitStatus", () => {
    it("is idle when nothing is queued or submitted", () => {
        expect(deriveSubmitStatus({ pendingSubmission: null, hasSyncedSubmission: false })).toBe(
            "idle",
        );
    });

    it("is submitted when no queued item but a synced submission exists", () => {
        expect(deriveSubmitStatus({ pendingSubmission: null, hasSyncedSubmission: true })).toBe(
            "submitted",
        );
    });

    it("is queued for a fresh pending item (no failure, no backoff)", () => {
        expect(
            deriveSubmitStatus({
                pendingSubmission: makeSubmissionItem("p"),
                hasSyncedSubmission: false,
            }),
        ).toBe("queued");
    });

    it("is auth_required when the item failed on auth", () => {
        expect(
            deriveSubmitStatus({
                pendingSubmission: makeSubmissionItem("p", { failureReason: "auth" }),
                hasSyncedSubmission: false,
            }),
        ).toBe("auth_required");
    });

    it("is sync_failed when the item is terminal", () => {
        expect(
            deriveSubmitStatus({
                pendingSubmission: makeSubmissionItem("p", { failureReason: "terminal" }),
                hasSyncedSubmission: false,
            }),
        ).toBe("sync_failed");
    });

    it("is sync_failed when the item failed validation", () => {
        expect(
            deriveSubmitStatus({
                pendingSubmission: makeSubmissionItem("p", { failureReason: "validation" }),
                hasSyncedSubmission: false,
            }),
        ).toBe("sync_failed");
    });

    it("is retry_scheduled when the item is backing off", () => {
        expect(
            deriveSubmitStatus({
                pendingSubmission: makeSubmissionItem("p", {
                    failureReason: "network",
                    nextAttemptAtIso: "2026-06-25T01:00:00.000Z",
                    attempts: 1,
                }),
                hasSyncedSubmission: false,
            }),
        ).toBe("retry_scheduled");
    });
});
