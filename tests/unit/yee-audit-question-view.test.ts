import { describe, expect, it } from "vitest";
import {
    countAnsweredQuestions,
    countTotalQuestions,
    firstUnansweredQuestion,
    isQuestionAnswered,
    isQuestionComplete,
    questionPositionLabel,
    shouldShowFollowUp,
} from "lib/yee-audit-question-view";
import type {
    InstrumentLogicalQuestion,
    InstrumentSectionDefinition,
} from "lib/yee-mobile-instrument";

const PRESENCE_ANSWERS = [
    { id: "1", label: "Yes" },
    { id: "2", label: "Yes, a lot" },
    { id: "3", label: "Yes, a little" },
    { id: "4", label: "No" },
] as const;

function makeQuestion(
    key: string,
    overrides: Partial<InstrumentLogicalQuestion> = {},
): InstrumentLogicalQuestion {
    return {
        key,
        choiceId: key,
        prompt: `Question ${key}?`,
        presenceItemId: "presence-item",
        presenceAnswers: PRESENCE_ANSWERS,
        conditionItemId: "condition-item",
        conditionAnswers: [{ id: "good", label: "Good" }],
        conditionTriggerAnswerIds: ["1", "2", "3"],
        conditionRequiredWhenShown: true,
        ...overrides,
    };
}

function makeSection(questions: readonly InstrumentLogicalQuestion[]): InstrumentSectionDefinition {
    return {
        domain: "access",
        step: 3,
        title: "Access",
        blockLabel: "Access",
        introText: "",
        commentPrompt: "",
        questions,
    };
}

describe("isQuestionAnswered", () => {
    it("returns true when the primary binding contains a non-empty answer", () => {
        const question = makeQuestion("q1");
        const responses = { "presence-item": { q1: "4" } };

        expect(isQuestionAnswered(question, responses)).toBe(true);
    });

    it("returns false when only the condition binding is answered", () => {
        const question = makeQuestion("q1");
        const responses = { "condition-item": { q1: "good" } };

        expect(isQuestionAnswered(question, responses)).toBe(false);
    });

    it("treats an empty primary answer as unanswered", () => {
        const question = makeQuestion("q1");
        const responses = { "presence-item": { q1: "" } };

        expect(isQuestionAnswered(question, responses)).toBe(false);
    });

    it("does not require a condition answer after an affirmative primary answer", () => {
        const question = makeQuestion("q1");
        const responses = {
            "presence-item": { q1: "1" },
            "condition-item": { q1: "" },
        };

        expect(isQuestionAnswered(question, responses)).toBe(true);
    });
});

describe("question collection helpers", () => {
    it("counts total and primary-answered questions", () => {
        const section = makeSection([makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")]);
        const responses = { "presence-item": { q1: "1", q2: "", q3: "4" } };

        expect(countTotalQuestions(section)).toBe(3);
        expect(countAnsweredQuestions(section, responses)).toBe(2);
    });

    it("returns an answered question whose required follow-up is missing", () => {
        const first = makeQuestion("q1");
        const second = makeQuestion("q2");
        const third = makeQuestion("q3");
        const section = makeSection([first, second, third]);
        const responses = { "presence-item": { q1: "1", q2: "", q3: "4" } };

        expect(firstUnansweredQuestion(section, responses)).toBe(first);
        expect(
            firstUnansweredQuestion(section, {
                ...responses,
                "condition-item": { q1: "good" },
            }),
        ).toBe(second);
    });

    it("returns null when every primary question is answered", () => {
        const section = makeSection([makeQuestion("q1"), makeQuestion("q2")]);
        const responses = { "presence-item": { q1: "4", q2: "4" } };

        expect(firstUnansweredQuestion(section, responses)).toBeNull();
    });
});

describe("isQuestionComplete", () => {
    it("requires a visible required follow-up but preserves primary-only answered state", () => {
        const question = makeQuestion("q1");
        const responses = { "presence-item": { q1: "1" } };

        expect(isQuestionAnswered(question, responses)).toBe(true);
        expect(isQuestionComplete(question, responses)).toBe(false);
        expect(
            isQuestionComplete(question, {
                ...responses,
                "condition-item": { q1: "good" },
            }),
        ).toBe(true);
        expect(
            isQuestionComplete({ ...question, conditionRequiredWhenShown: false }, responses),
        ).toBe(true);
    });
});

describe("shouldShowFollowUp", () => {
    it.each([
        ["Yes", "1", true],
        ["Yes, a lot", "2", true],
        ["Yes, a little", "3", true],
        ["No", "4", false],
        ["missing answer", undefined, false],
    ])("classifies %s through the answer-id keyed option label", (_label, answerId, expected) => {
        const question = makeQuestion("q1");
        const responses = answerId === undefined ? {} : { "presence-item": { q1: answerId } };

        expect(shouldShowFollowUp(question, responses)).toBe(expected);
    });

    it("returns false when the question has no condition binding", () => {
        const question = makeQuestion("q1", { conditionItemId: null, conditionAnswers: [] });
        const responses = { "presence-item": { q1: "1" } };

        expect(shouldShowFollowUp(question, responses)).toBe(false);
    });

    it("does not depend on a missing or empty condition answer", () => {
        const question = makeQuestion("q1");
        const missingCondition = { "presence-item": { q1: "1" } };
        const emptyCondition = {
            "presence-item": { q1: "1" },
            "condition-item": { q1: "" },
        };

        expect(shouldShowFollowUp(question, missingCondition)).toBe(true);
        expect(shouldShowFollowUp(question, emptyCondition)).toBe(true);
    });
});

describe("questionPositionLabel", () => {
    it("formats a one-based position from a zero-based question index", () => {
        expect(questionPositionLabel(0, 7)).toBe("Question 1 of 7");
        expect(questionPositionLabel(6, 7)).toBe("Question 7 of 7");
    });
});
