import {
    isAffirmativeAnswer,
    type InstrumentLogicalQuestion,
    type InstrumentSectionDefinition,
} from "./yee-mobile-instrument";

type AuditResponses = Readonly<Record<string, Readonly<Record<string, string>>>>;

export function isQuestionAnswered(
    question: InstrumentLogicalQuestion,
    responses: AuditResponses,
): boolean {
    const answerId = responses[question.presenceItemId]?.[question.choiceId];
    return typeof answerId === "string" && answerId.length > 0;
}

export function countAnsweredQuestions(
    section: InstrumentSectionDefinition,
    responses: AuditResponses,
): number {
    return section.questions.filter((question) => isQuestionAnswered(question, responses)).length;
}

export function countTotalQuestions(section: InstrumentSectionDefinition): number {
    return section.questions.length;
}

export function firstUnansweredQuestion(
    section: InstrumentSectionDefinition,
    responses: AuditResponses,
): InstrumentLogicalQuestion | null {
    return section.questions.find((question) => !isQuestionAnswered(question, responses)) ?? null;
}

export function shouldShowFollowUp(
    question: InstrumentLogicalQuestion,
    responses: AuditResponses,
): boolean {
    if (question.conditionItemId === null) {
        return false;
    }
    const answerId = responses[question.presenceItemId]?.[question.choiceId];
    return isAffirmativeAnswer(question.presenceAnswers, answerId);
}

export function questionPositionLabel(index: number, total: number): string {
    return `Question ${index + 1} of ${total}`;
}
