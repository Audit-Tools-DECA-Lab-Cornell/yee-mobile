/**
 * Drain-time gate for queued submissions.
 *
 * The dangerous cases are the two that look identical from a distance: a legacy
 * payload with NO stamp (must still go - the backend resolves it) and a stamped
 * payload whose instrument is missing (must never go, and must never silently
 * borrow the active version).
 */
import { describe, expect, it } from "vitest";
import { findIncompleteQuestions, gateQueuedSubmission } from "lib/yee-queued-submission-gate";
import type {
    InstrumentLogicalQuestion,
    InstrumentSectionDefinition,
    NormalizedInstrument,
} from "lib/yee-mobile-instrument";

function question(overrides: Partial<InstrumentLogicalQuestion> = {}): InstrumentLogicalQuestion {
    return {
        key: "QID1#1:1",
        choiceId: "1",
        prompt: "Is there a bench?",
        presenceItemId: "QID1#1",
        presenceAnswers: [
            { id: "1", label: "Yes" },
            { id: "2", label: "No" },
        ],
        conditionItemId: "QID1#2",
        conditionAnswers: [
            { id: "1", label: "Poor" },
            { id: "2", label: "Great" },
        ],
        conditionTriggerAnswerIds: ["1"],
        conditionRequiredWhenShown: true,
        ...overrides,
    };
}

function instrumentOf(questions: readonly InstrumentLogicalQuestion[]): NormalizedInstrument {
    const section: InstrumentSectionDefinition = {
        domain: "access",
        step: 3,
        title: "Access",
        blockLabel: "Access",
        introText: "",
        commentPrompt: "",
        questions,
    };
    return {
        sections: [section],
        contextQuestions: [],
        weighting: { title: "", description: "", options: [], domains: [] },
        conditionPrompt: "",
        finalCommentsPrompt: "",
    };
}

const ANSWERED = { "QID1#1": { "1": "1" }, "QID1#2": { "1": "2" } };

describe("findIncompleteQuestions", () => {
    it("reports nothing when every required answer is present", () => {
        const result = findIncompleteQuestions(instrumentOf([question()]), ANSWERED);
        expect(result.missingQuestionKeys).toEqual([]);
        expect(result.firstMissingStep).toBeNull();
    });

    it("reports a missing primary answer and where to go", () => {
        const result = findIncompleteQuestions(instrumentOf([question()]), {});
        expect(result.missingQuestionKeys).toEqual(["QID1#1:1"]);
        expect(result.firstMissingStep).toBe(3);
    });

    it("reports a triggered follow-up that was never answered", () => {
        const result = findIncompleteQuestions(instrumentOf([question()]), {
            "QID1#1": { "1": "1" },
        });
        expect(result.missingQuestionKeys).toEqual(["QID1#1:1"]);
    });

    it("does not demand a follow-up the answer never triggered", () => {
        // "No" hides the condition scale; requiring it would send the auditor to
        // a control that is not on screen.
        const result = findIncompleteQuestions(instrumentOf([question()]), {
            "QID1#1": { "1": "2" },
        });
        expect(result.missingQuestionKeys).toEqual([]);
    });

    it("does not demand a follow-up the instrument marks optional", () => {
        const optional = question({ conditionRequiredWhenShown: false });
        const result = findIncompleteQuestions(instrumentOf([optional]), {
            "QID1#1": { "1": "1" },
        });
        expect(result.missingQuestionKeys).toEqual([]);
    });
});

describe("gateQueuedSubmission", () => {
    const instrument = instrumentOf([question()]);

    it("submits a complete stamped payload", () => {
        expect(
            gateQueuedSubmission({
                stampKey: "yee",
                stampVersion: "2.0",
                instrument,
                responses: ANSWERED,
            }),
        ).toEqual({ outcome: "submit", reason: "complete" });
    });

    it("parks an incomplete stamped payload instead of POSTing it", () => {
        const gate = gateQueuedSubmission({
            stampKey: "yee",
            stampVersion: "2.0",
            instrument,
            responses: {},
        });
        expect(gate.outcome).toBe("park_incomplete");
        if (gate.outcome === "park_incomplete") {
            expect(gate.incomplete.missingQuestionKeys).toEqual(["QID1#1:1"]);
            expect(gate.incomplete.firstMissingStep).toBe(3);
        }
    });

    it("submits an UNSTAMPED legacy payload even with no instrument to check", () => {
        // Pre-stamp queue items carry neither field. Treating that as an unknown
        // version would strand every one of them permanently.
        expect(
            gateQueuedSubmission({
                stampKey: null,
                stampVersion: undefined,
                instrument: null,
                responses: {},
            }),
        ).toEqual({ outcome: "submit", reason: "unstamped_legacy" });
    });

    it("retains a STAMPED payload whose instrument is unavailable", () => {
        // Never fall back to the active version: that would judge an audit
        // against a contract it was never taken under.
        expect(
            gateQueuedSubmission({
                stampKey: "yee",
                stampVersion: "1",
                instrument: null,
                responses: ANSWERED,
            }),
        ).toEqual({ outcome: "retain_unresolved_instrument" });
    });

    it("retains a half-stamped payload rather than guessing the other half", () => {
        expect(
            gateQueuedSubmission({
                stampKey: "yee",
                stampVersion: "  ",
                instrument,
                responses: ANSWERED,
            }),
        ).toEqual({ outcome: "retain_unresolved_instrument" });
    });

    it("still validates an unstamped payload when an instrument is available", () => {
        const gate = gateQueuedSubmission({
            stampKey: null,
            stampVersion: null,
            instrument,
            responses: {},
        });
        expect(gate.outcome).toBe("park_incomplete");
    });
});
