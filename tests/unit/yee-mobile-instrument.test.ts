import { describe, expect, it } from "vitest";

import fixture from "../fixtures/yee-instrument.snapshot.json";

import {
    normalizeInstrument,
    type InstrumentLogicalQuestion,
    type InstrumentSectionDefinition,
} from "lib/yee-mobile-instrument";
import type { YeeInstrumentResponse } from "lib/yee-types";

const SNAPSHOT_SOURCE =
    "/Users/praty/Desktop/StudentJob.nosync/audit-tools-backend/app/products/yee/instruments/yee.active.instrument.json";

type BindingTriple = readonly [
    presenceItemId: string,
    choiceId: string,
    conditionItemId: string | null,
];

const EXPECTED_BINDINGS = {
    // prettier-ignore
    access: [["QID1#1", "1", "QID1#2"], ["QID1#1", "2", "QID1#2"], ["QID11#1", "1", null], ["QID11#1", "2", null], ["QID11#1", "3", null], ["QID11#1", "4", null]],
    // prettier-ignore
    activitySpaces: [["QID4#1", "1", "QID4#2"], ["QID4#1", "2", "QID4#2"], ["QID4#1", "3", "QID4#2"], ["QID4#1", "4", "QID4#2"], ["QID4#1", "5", "QID4#2"], ["QID4#1", "6", "QID4#2"], ["QID7#1", "1", null], ["QID7#1", "2", null], ["QID7#1", "3", null], ["QID7#1", "4", null]],
    // prettier-ignore
    amenities: [["QID12#1", "1", "QID12#2"], ["QID12#1", "2", "QID12#2"], ["QID12#1", "3", "QID12#2"], ["QID13#1", "1", null], ["QID13#1", "2", null], ["QID13#1", "3", null], ["QID13#1", "4", null], ["QID13#1", "5", null], ["QID13#1", "6", null], ["QID13#1", "7", null]],
    // prettier-ignore
    experienceOfSpace: [["QID15#1", "1", null], ["QID15#1", "2", null], ["QID15#1", "3", null], ["QID15#1", "4", null], ["QID15#1", "5", null], ["QID15#1", "6", null], ["QID15#1", "7", null], ["QID15#1", "8", null], ["QID15#1", "9", null], ["QID15#1", "10", null]],
    // prettier-ignore
    aestheticsAndCare: [["QID16#2", "1", "QID16#1"], ["QID16#2", "2", "QID16#1"], ["QID16#2", "3", "QID16#1"], ["QID16#2", "4", "QID16#1"], ["QID17#1", "1", null], ["QID17#1", "2", null], ["QID17#1", "3", null], ["QID17#1", "4", null], ["QID17#1", "5", null], ["QID17#1", "6", null]],
    // prettier-ignore
    useAndUsability: [["QID19#1", "1", "QID19#2"], ["QID19#1", "2", "QID19#2"], ["QID20#1", "1", null], ["QID20#1", "2", null], ["QID20#1", "3", null], ["QID21#1", "1", null], ["QID21#1", "2", null], ["QID21#1", "3", null]],
} as const satisfies Readonly<Record<string, readonly BindingTriple[]>>;

function sectionQuestions(
    sections: readonly InstrumentSectionDefinition[],
    domain: InstrumentSectionDefinition["domain"],
): readonly InstrumentLogicalQuestion[] {
    return sections.flatMap((section) => (section.domain === domain ? section.questions : []));
}

function syntheticInstrument(scoringItems: unknown[]): YeeInstrumentResponse {
    return {
        sections: [
            {
                block: "Access: Presence, Condition, Provision",
                title: "Access",
                intro_text: "Access intro",
                comment_prompt: "Access comments",
            },
        ],
        scoring_items: scoringItems,
    };
}

describe(`normalizeInstrument fixture from ${SNAPSHOT_SOURCE}`, () => {
    it("emits the complete ordered backend binding contract", () => {
        const normalized = normalizeInstrument(fixture);

        expect(
            normalized.sections.map((section) => ({
                domain: section.domain,
                bindings: section.questions.map(
                    (question) =>
                        [
                            question.presenceItemId,
                            question.choiceId,
                            question.conditionItemId,
                        ] satisfies BindingTriple,
                ),
            })),
        ).toEqual(
            Object.entries(EXPECTED_BINDINGS).map(([domain, bindings]) => ({ domain, bindings })),
        );
    });

    it("emits exactly 54 logical questions with the expected section totals", () => {
        const normalized = normalizeInstrument(fixture);

        expect(
            normalized.sections.map((section) => [section.domain, section.questions.length]),
        ).toEqual([
            ["access", 6],
            ["activitySpaces", 10],
            ["amenities", 10],
            ["experienceOfSpace", 10],
            ["aestheticsAndCare", 10],
            ["useAndUsability", 8],
        ]);
        expect(normalized.sections.flatMap((section) => section.questions)).toHaveLength(54);
    });

    it("pins the first Access question's key, prompt, options, and bindings", () => {
        const normalized = normalizeInstrument(fixture);
        const firstAccessQuestion = sectionQuestions(normalized.sections, "access")[0];

        expect(firstAccessQuestion).toEqual({
            key: "QID1#1:1",
            prompt: "Is there at least 1 public transportation stop (Ex: bus or metro/subway stop) nearby?",
            choiceId: "1",
            presenceItemId: "QID1#1",
            presenceAnswers: [
                { id: "1", label: "Yes" },
                { id: "2", label: "No" },
            ],
            conditionItemId: "QID1#2",
            conditionAnswers: [
                { id: "1", label: "Poor" },
                { id: "2", label: "Acceptable" },
                { id: "3", label: "Great" },
            ],
        });
        for (const question of normalized.sections.flatMap((section) => section.questions)) {
            expect(question.key).toBe(`${question.presenceItemId}:${question.choiceId}`);
        }
    });

    it("pairs QID16 presence item #2 with condition item #1", () => {
        const normalized = normalizeInstrument(fixture);
        const qid16Questions = sectionQuestions(normalized.sections, "aestheticsAndCare").filter(
            (question) => question.presenceItemId === "QID16#2",
        );

        expect(qid16Questions).toHaveLength(4);
        expect(qid16Questions.map((question) => question.conditionItemId)).toEqual([
            "QID16#1",
            "QID16#1",
            "QID16#1",
            "QID16#1",
        ]);
    });

    it("emits no condition binding for experience-of-space questions", () => {
        const normalized = normalizeInstrument(fixture);
        const questions = sectionQuestions(normalized.sections, "experienceOfSpace");

        expect(
            questions.map((question) => ({
                conditionItemId: question.conditionItemId,
                conditionAnswers: question.conditionAnswers,
            })),
        ).toEqual(
            Array.from({ length: 10 }, () => ({ conditionItemId: null, conditionAnswers: [] })),
        );
    });
});

describe("normalizeInstrument malformed legacy groups", () => {
    it("drops a base question when it has no explicit presence item", () => {
        const normalized = normalizeInstrument(
            syntheticInstrument([
                {
                    item_id: "QID-condition#2",
                    base_question_id: "QID-condition",
                    block: "Access: Presence, Condition, Provision",
                    item_kind: "condition",
                    choices: { "1": { Display: "Condition-only prompt" } },
                    answers: { "1": { Display: "Poor" } },
                },
            ]),
        );

        expect(normalized.sections[0]?.questions).toEqual([]);
    });

    it("removes the condition binding when the condition item has no answers", () => {
        const normalized = normalizeInstrument(
            syntheticInstrument([
                {
                    item_id: "QID-empty#1",
                    base_question_id: "QID-empty",
                    block: "Access: Presence, Condition, Provision",
                    item_kind: "presence",
                    choices: { "1": { Display: "Presence prompt" } },
                    answers: { "1": { Display: "Yes" }, "2": { Display: "No" } },
                },
                {
                    item_id: "QID-empty#2",
                    base_question_id: "QID-empty",
                    block: "Access: Presence, Condition, Provision",
                    item_kind: "condition",
                    choices: { "1": { Display: "Ignored condition prompt" } },
                    answers: {},
                },
            ]),
        );

        expect(normalized.sections[0]?.questions[0]).toMatchObject({
            conditionItemId: null,
            conditionAnswers: [],
        });
    });

    it("normalizes integer-like presence choice keys in numeric order", () => {
        const normalized = normalizeInstrument(
            syntheticInstrument([
                {
                    item_id: "QID-order#1",
                    base_question_id: "QID-order",
                    block: "Access: Presence, Condition, Provision",
                    item_kind: "presence",
                    choices: {
                        "1": { Display: "First" },
                        "3": { Display: "Third" },
                        "2": { Display: "Second" },
                    },
                    answers: { "1": { Display: "Yes" }, "2": { Display: "No" } },
                },
            ]),
        );

        expect(normalized.sections[0]?.questions.map((question) => question.choiceId)).toEqual([
            "1",
            "2",
            "3",
        ]);
    });

    it("fails closed when raw section and scoring containers are not arrays", () => {
        const malformed: YeeInstrumentResponse = {};
        Object.defineProperties(malformed, {
            sections: { value: { unexpected: "object" } },
            scoring_items: { value: "unexpected string" },
        });

        expect(normalizeInstrument(malformed).sections).toEqual([]);
    });

    it("ignores primitive entries without creating phantom questions", () => {
        const normalized = normalizeInstrument({
            sections: [
                null,
                false,
                42,
                "unexpected section",
                {
                    block: "Access: Presence, Condition, Provision",
                    title: "Access",
                },
            ],
            scoring_items: [null, false, 42, "unexpected scoring item"],
        });

        expect(normalized.sections.map((section) => section.domain)).toEqual(["access"]);
        expect(normalized.sections[0]?.questions).toEqual([]);
    });

    it("drops choice and answer entries whose Display value is not a string", () => {
        const normalized = normalizeInstrument(
            syntheticInstrument([
                {
                    item_id: "QID-display#1",
                    base_question_id: "QID-display",
                    block: "Access: Presence, Condition, Provision",
                    item_kind: "presence",
                    choices: {
                        "1": { Display: 42 },
                        "2": { Display: "Valid prompt" },
                        "3": null,
                    },
                    answers: {
                        "1": { Display: false },
                        "2": { Display: "Yes" },
                        "3": "unexpected answer",
                    },
                },
            ]),
        );

        expect(
            normalized.sections[0]?.questions.map((question) => ({
                choiceId: question.choiceId,
                prompt: question.prompt,
                presenceAnswers: question.presenceAnswers,
            })),
        ).toEqual([
            {
                choiceId: "2",
                prompt: "Valid prompt?",
                presenceAnswers: [{ id: "2", label: "Yes" }],
            },
        ]);
    });
});
