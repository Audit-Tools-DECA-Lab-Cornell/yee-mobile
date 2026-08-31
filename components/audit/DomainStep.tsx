import { memo, useCallback } from "react";
import { View } from "react-native";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ArrowRight } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import {
    countAnsweredQuestions,
    countRequiredFollowUpsRemaining,
    countTotalQuestions,
    firstUnansweredQuestion,
    questionPositionLabel,
    shouldShowFollowUp,
} from "lib/yee-audit-question-view";
import {
    getDomainForStep,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
    getSectionForStep,
    type InstrumentLogicalQuestion,
    type InstrumentSectionDefinition,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { auditRowKey, useAuditRowScroll } from "./audit-scroll";
import { SurveyDomainContext, useSurveyPalette } from "./survey-theme";
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

export const DomainStep = memo(function DomainStep({ step }: { step: MobileYeeStepNumber }) {
    const section = useAuditSessionStore((state) => selectSection(state.instrument, step));
    const conditionPrompt = useAuditSessionStore(
        (state) => state.instrument?.conditionPrompt ?? "",
    );
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

    const totalCount = countTotalQuestions(section);
    return (
        <SurveyDomainContext.Provider value={domain}>
            <YStack gap="$4">
                <SectionIntroCard
                    title={section.blockLabel}
                    description={section.introText || `Complete the ${section.title} section.`}
                />
                <SectionQuickActions section={section} />
                <SurveyCard
                    title={section.title}
                    description="Answer each question below. If the feature is present, a short follow-up appears inside the same card."
                >
                    {section.questions.map((question, index) => (
                        <DomainQuestionCard
                            key={question.key}
                            question={question}
                            positionLabel={questionPositionLabel(index, totalCount)}
                            conditionPrompt={conditionPrompt}
                        />
                    ))}
                    <DomainSectionComment
                        domain={domain}
                        sectionTitle={section.title}
                        commentPrompt={section.commentPrompt}
                    />
                    <DomainProgress section={section} />
                </SurveyCard>
            </YStack>
        </SurveyDomainContext.Provider>
    );
});

const QuickActionButton = memo(function QuickActionButton({
    label,
    onPress,
}: {
    label: string;
    onPress: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <XStack
            items="center"
            gap="$2"
            rounded={designSystem.radii.button}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surfaceMuted}
            px="$3"
            py="$2"
            cursor="pointer"
            accessibilityRole="button"
            accessibilityLabel={label}
            hoverStyle={{ opacity: 0.98 }}
            pressStyle={{ opacity: 0.92, scale: 0.99 }}
            onPress={onPress}
            style={{ alignSelf: "flex-start", minHeight: 48 }}
        >
            <ArrowRight size={14} color={designSystem.colors.primary} />
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={13}
                style={{ color: designSystem.colors.foreground, flexShrink: 1 }}
            >
                {label}
            </Text>
        </XStack>
    );
});

const SectionQuickActions = memo(function SectionQuickActions({
    section,
}: {
    section: InstrumentSectionDefinition;
}) {
    const designSystem = useDesignSystem();
    const { scrollToRow } = useAuditRowScroll();
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const unansweredCount = useAuditSessionStore((state) =>
        state.draft === null
            ? 0
            : countTotalQuestions(section) - countAnsweredQuestions(section, state.draft.responses),
    );
    const requiredFollowUps = useAuditSessionStore((state) =>
        state.draft === null ? 0 : countRequiredFollowUpsRemaining(section, state.draft.responses),
    );

    const onJump = useCallback(() => {
        const draft = useAuditSessionStore.getState().draft;
        if (draft === null) {
            return;
        }
        const question = firstUnansweredQuestion(section, draft.responses);
        if (question !== null) {
            scrollToRow(auditRowKey(question.presenceItemId, question.choiceId));
        }
    }, [section, scrollToRow]);

    if (readOnly || (unansweredCount === 0 && requiredFollowUps === 0)) {
        return null;
    }

    return (
        <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={13}
            >
                {unansweredCount > 0
                    ? `${unansweredCount} ${unansweredCount === 1 ? "question" : "questions"} still unanswered`
                    : `${requiredFollowUps} required ${requiredFollowUps === 1 ? "follow-up" : "follow-ups"} still needed`}
            </Paragraph>
            <QuickActionButton label="Jump to next unanswered" onPress={onJump} />
        </XStack>
    );
});

const DomainQuestionCard = memo(function DomainQuestionCard({
    question,
    positionLabel,
    conditionPrompt,
}: {
    question: InstrumentLogicalQuestion;
    positionLabel: string;
    conditionPrompt: string;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    const presenceValue = useAuditSessionStore(
        (state) => state.draft?.responses[question.presenceItemId]?.[question.choiceId],
    );
    const conditionValue = useAuditSessionStore((state) =>
        question.conditionItemId === null
            ? undefined
            : state.draft?.responses[question.conditionItemId]?.[question.choiceId],
    );
    const showFollowUp = useAuditSessionStore((state) =>
        shouldShowFollowUp(question, state.draft?.responses ?? {}),
    );
    const setPresenceAnswer = useAuditSessionStore((state) => state.setPresenceAnswer);
    const setConditionAnswer = useAuditSessionStore((state) => state.setConditionAnswer);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const { registerRow } = useAuditRowScroll();
    const questionTestID = `domain-question-${question.key}`;
    const rowKey = auditRowKey(question.presenceItemId, question.choiceId);
    const setRowRef = useCallback(
        (node: View | null) => registerRow(rowKey, node),
        [registerRow, rowKey],
    );
    const onPresence = useCallback(
        (answerId: string) => setPresenceAnswer(question, answerId),
        [setPresenceAnswer, question],
    );
    const onCondition = useCallback(
        (answerId: string) => setConditionAnswer(question, answerId),
        [setConditionAnswer, question],
    );

    return (
        <View ref={setRowRef} collapsable={false}>
            <QuestionCard label={question.prompt} eyebrow={positionLabel} testID={questionTestID}>
                <OptionGrid
                    value={presenceValue}
                    options={question.presenceAnswers}
                    onChange={onPresence}
                    disabled={readOnly}
                    testID={`${questionTestID}-primary-options`}
                />
                {showFollowUp ? (
                    <YStack
                        testID={`${questionTestID}-follow-up`}
                        gap="$2.5"
                        rounded={designSystem.radii.sm}
                        p="$3"
                        borderWidth={1}
                        style={{
                            backgroundColor: palette.condition,
                            borderColor: palette.conditionBorder,
                        }}
                    >
                        <Paragraph
                            style={{ color: palette.accentText, flexShrink: 1 }}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            {question.followUpPrompt || conditionPrompt}
                        </Paragraph>
                        {question.conditionRequiredWhenShown ? (
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={12}
                            >
                                This follow-up is required before the section is complete.
                            </Paragraph>
                        ) : null}
                        <OptionGrid
                            value={conditionValue}
                            options={question.conditionAnswers}
                            onChange={onCondition}
                            disabled={readOnly}
                            testID={`${questionTestID}-follow-up-options`}
                        />
                    </YStack>
                ) : null}
            </QuestionCard>
        </View>
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
    const readOnly = useAuditSessionStore((state) => state.readOnly);
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
            disabled={readOnly}
        />
    );
});

const DomainProgress = memo(function DomainProgress({
    section,
}: {
    section: InstrumentSectionDefinition;
}) {
    const completedCount = useAuditSessionStore((state) =>
        state.draft === null ? 0 : countAnsweredQuestions(section, state.draft.responses),
    );
    const requiredFollowUps = useAuditSessionStore((state) =>
        state.draft === null ? 0 : countRequiredFollowUpsRemaining(section, state.draft.responses),
    );
    return (
        <SectionProgressCard
            title={`${section.title} progress`}
            helperText={
                requiredFollowUps > 0
                    ? `${requiredFollowUps} required ${requiredFollowUps === 1 ? "follow-up is" : "follow-ups are"} still needed.`
                    : "Updates as you answer each question."
            }
            completedCount={completedCount}
            totalCount={countTotalQuestions(section)}
        />
    );
});
