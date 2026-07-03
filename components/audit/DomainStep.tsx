import { memo, useCallback } from "react";
import { Paragraph, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import {
    getDomainForStep,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
    getSectionForStep,
    isAffirmativeAnswer,
    type InstrumentPromptRow,
    type InstrumentSectionDefinition,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import type { MobileAuditFormState } from "lib/yee-mobile-draft";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { useSurveyPalette } from "./survey-theme";
import {
    CommentField,
    NoticeCard,
    OptionGrid,
    QuestionCard,
    SectionIntroCard,
    SectionProgressCard,
    SurveyCard,
} from "./primitives";

function selectSection(
    instrument: NormalizedInstrument | null,
    step: MobileYeeStepNumber,
): InstrumentSectionDefinition | null {
    return instrument === null ? null : getSectionForStep(instrument, step);
}

/**
 * Steps 3–8 — a scored domain section. The section definition comes from the
 * (stable) normalized instrument, so every question row below is a memoized unit
 * that subscribes to only its own answer slices. Answering one row re-renders
 * that row and the progress meter — never the other ~50 rows.
 */
export const DomainStep = memo(function DomainStep({ step }: { step: MobileYeeStepNumber }) {
    const section = useAuditSessionStore((state) => selectSection(state.instrument, step));
    const domain = getDomainForStep(step);

    if (section === null || domain === null) {
        return (
            <NoticeCard
                tone="warning"
                title="Section unavailable"
                body="This domain could not be loaded from the cached YEE instrument yet."
            />
        );
    }

    return (
        <YStack gap="$4">
            <SectionIntroCard
                title={section.blockLabel}
                description={section.introText || `Complete the ${section.title} section.`}
            />
            <SurveyCard
                title={section.title}
                description="Answer each item below. If the feature is present, the condition follow-up appears right underneath it."
            >
                {section.groups.map((group) => (
                    <YStack key={group.id} gap="$3.5">
                        {group.instruction === null ? null : (
                            <GroupInstruction text={group.instruction} />
                        )}
                        {group.rows.map((row) => (
                            <DomainQuestionRow key={`${group.id}-${row.choiceId}`} row={row} />
                        ))}
                    </YStack>
                ))}
                <DomainSectionComment
                    domain={domain}
                    sectionTitle={section.title}
                    commentPrompt={section.commentPrompt}
                />
                <DomainProgress section={section} />
            </SurveyCard>
        </YStack>
    );
});

const GroupInstruction = memo(function GroupInstruction({ text }: { text: string }) {
    const designSystem = useDesignSystem();
    return (
        <Paragraph
            color={designSystem.colors.secondaryForeground}
            fontFamily={designSystem.fonts.bodyBold}
        >
            {text}
        </Paragraph>
    );
});

/**
 * The self-subscribing memoized unit. Subscribes to just this row's presence and
 * (optional) condition answer; the memo + slice selectors keep untouched rows
 * from re-rendering when a sibling answer changes.
 */
const DomainQuestionRow = memo(function DomainQuestionRow({ row }: { row: InstrumentPromptRow }) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();

    const presenceValue = useAuditSessionStore(
        (state) => state.draft?.responses[row.presenceItemId]?.[row.choiceId],
    );
    const conditionValue = useAuditSessionStore((state) =>
        row.conditionItemId === null
            ? undefined
            : state.draft?.responses[row.conditionItemId]?.[row.choiceId],
    );
    const setPresenceAnswer = useAuditSessionStore((state) => state.setPresenceAnswer);
    const setConditionAnswer = useAuditSessionStore((state) => state.setConditionAnswer);

    const onPresence = useCallback(
        (answerId: string) => setPresenceAnswer(row, answerId),
        [setPresenceAnswer, row],
    );
    const onCondition = useCallback(
        (answerId: string) => setConditionAnswer(row, answerId),
        [setConditionAnswer, row],
    );

    const showCondition =
        row.conditionItemId !== null && isAffirmativeAnswer(row.presenceAnswers, presenceValue);

    return (
        <QuestionCard label={row.label}>
            <OptionGrid value={presenceValue} options={row.presenceAnswers} onChange={onPresence} />
            {showCondition ? (
                <YStack
                    gap="$2.5"
                    rounded={designSystem.radii.sm}
                    p="$3"
                    borderWidth={1}
                    style={{ backgroundColor: palette.inner, borderColor: palette.innerBorder }}
                >
                    <Paragraph
                        style={{ color: palette.accentText }}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        If yes, please rate the condition.
                    </Paragraph>
                    <OptionGrid
                        value={conditionValue}
                        options={row.conditionAnswers}
                        onChange={onCondition}
                    />
                </YStack>
            ) : null}
        </QuestionCard>
    );
});

const DomainSectionComment = memo(function DomainSectionComment({
    domain,
    sectionTitle,
    commentPrompt,
}: {
    domain: MobileYeeDomainKey;
    sectionTitle: string;
    commentPrompt: string;
}) {
    const value = useAuditSessionStore((state) => state.draft?.sectionComments[domain] ?? "");
    const setSectionComment = useAuditSessionStore((state) => state.setSectionComment);
    const palette = useSurveyPalette();
    const onCommit = useCallback(
        (next: string) => setSectionComment(domain, next),
        [setSectionComment, domain],
    );
    return (
        <CommentField
            label={commentPrompt || `Optional comments for ${sectionTitle}`}
            value={value}
            onCommit={onCommit}
            palette={palette}
        />
    );
});

const DomainProgress = memo(function DomainProgress({
    section,
}: {
    section: InstrumentSectionDefinition;
}) {
    const completedCount = useAuditSessionStore((state) =>
        state.draft === null ? 0 : countAnsweredRows(section, state.draft),
    );
    return (
        <SectionProgressCard
            title={`${section.title} progress`}
            helperText="Updates as each question row is answered. Presence questions drive the condition follow-up."
            completedCount={completedCount}
            totalCount={countTotalRows(section)}
        />
    );
});

export function countTotalRows(section: InstrumentSectionDefinition): number {
    return section.groups.reduce((sum, group) => sum + group.rows.length, 0);
}

export function countAnsweredRows(
    section: InstrumentSectionDefinition,
    draft: MobileAuditFormState,
): number {
    return section.groups.reduce((sum, group) => {
        return (
            sum +
            group.rows.filter((row) => {
                const presenceValue = draft.responses[row.presenceItemId]?.[row.choiceId];
                return typeof presenceValue === "string" && presenceValue.length > 0;
            }).length
        );
    }, 0);
}
