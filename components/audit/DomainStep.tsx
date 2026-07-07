import { memo, useCallback, useMemo } from "react";
import { View } from "react-native";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ArrowRight, CheckCircle2, LayoutList } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";
import {
    getDomainForStep,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
    getNegativePresenceOption,
    getSectionForStep,
    isAffirmativeAnswer,
    type InstrumentPromptGroup,
    type InstrumentPromptRow,
    type InstrumentSectionDefinition,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import type { MobileAuditFormState } from "lib/yee-mobile-draft";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { auditRowKey, useAuditRowScroll } from "./audit-scroll";
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

/** Rows still lacking a presence answer, in section order. */
function countUnansweredRows(
    section: InstrumentSectionDefinition,
    draft: MobileAuditFormState,
): number {
    return countTotalRows(section) - countAnsweredRows(section, draft);
}

/** True when a presence row has no non-empty answer yet. */
function isRowUnanswered(row: InstrumentPromptRow, draft: MobileAuditFormState): boolean {
    const value = draft.responses[row.presenceItemId]?.[row.choiceId];
    return !(typeof value === "string" && value.length > 0);
}

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
    const conditionPrompt = useAuditSessionStore(
        (state) => state.instrument?.conditionPrompt ?? "",
    );
    const domain = getDomainForStep(step);
    const layout = useResponsiveLayout();

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
            {/* Tablet-only group overview rail. Phones keep the plain card flow. */}
            {layout.isTablet ? <DomainReviewRail section={section} /> : null}
            <SectionQuickActions section={section} />
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
                            <DomainQuestionRow
                                key={`${group.id}-${row.choiceId}`}
                                row={row}
                                conditionPrompt={conditionPrompt}
                            />
                        ))}
                        <GroupNotPresentAction group={group} />
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

/**
 * Compact button used by the answer-speed helpers. A pressable row (not a
 * tamagui Button) so it matches the survey's option/row language and long labels
 * wrap cleanly.
 */
const QuickActionButton = memo(function QuickActionButton({
    label,
    icon: IconCmp,
    onPress,
}: {
    label: string;
    icon: (props: { size?: number; color?: string }) => React.ReactNode;
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
            style={{ alignSelf: "flex-start" }}
        >
            <IconCmp size={14} color={designSystem.colors.primary} />
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

/**
 * "Jump to next unanswered" — scrolls the first still-unanswered row of this
 * domain into view. Subscribes only to the section's unanswered COUNT (a number),
 * so it re-renders when the count changes, not on every keystroke; the target row
 * is resolved imperatively on press.
 */
const SectionQuickActions = memo(function SectionQuickActions({
    section,
}: {
    section: InstrumentSectionDefinition;
}) {
    const designSystem = useDesignSystem();
    const { scrollToRow } = useAuditRowScroll();
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const unanswered = useAuditSessionStore((state) =>
        state.draft === null ? 0 : countUnansweredRows(section, state.draft),
    );

    const onJump = useCallback(() => {
        const draft = useAuditSessionStore.getState().draft;
        if (draft === null) {
            return;
        }
        for (const group of section.groups) {
            for (const row of group.rows) {
                if (isRowUnanswered(row, draft)) {
                    scrollToRow(auditRowKey(row.presenceItemId, row.choiceId));
                    return;
                }
            }
        }
    }, [section, scrollToRow]);

    if (readOnly || unanswered === 0) {
        return null;
    }

    return (
        <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={13}
            >
                {unanswered} {unanswered === 1 ? "question" : "questions"} still unanswered
            </Paragraph>
            <QuickActionButton label="Jump to next unanswered" icon={ArrowRight} onPress={onJump} />
        </XStack>
    );
});

/**
 * Per-group "Mark remaining as Not present". Only rendered when the group has
 * unanswered rows AND a single unambiguous negative option to fill them with
 * (see {@link getNegativePresenceOption}); the fill happens in one state update.
 */
const GroupNotPresentAction = memo(function GroupNotPresentAction({
    group,
}: {
    group: InstrumentPromptGroup;
}) {
    const markRowsNotPresent = useAuditSessionStore((state) => state.markRowsNotPresent);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    // Rows that CAN be auto-marked negative — static per instrument.
    const fillableRows = useMemo(
        () => group.rows.filter((row) => getNegativePresenceOption(row.presenceAnswers) !== null),
        [group],
    );
    const unansweredFillable = useAuditSessionStore((state) => {
        const draft = state.draft;
        if (draft === null) {
            return 0;
        }
        return fillableRows.reduce((sum, row) => (isRowUnanswered(row, draft) ? sum + 1 : sum), 0);
    });
    const onPress = useCallback(() => markRowsNotPresent(group.rows), [markRowsNotPresent, group]);

    if (readOnly || fillableRows.length === 0 || unansweredFillable === 0) {
        return null;
    }

    return (
        <QuickActionButton
            label={`Mark remaining ${unansweredFillable} as Not present`}
            icon={CheckCircle2}
            onPress={onPress}
        />
    );
});

/**
 * Tablet-only overview rail: one tappable line per group with its answered/total
 * count, so an auditor on a larger screen can see section coverage at a glance and
 * jump straight to a group. Phones keep the linear card flow untouched.
 */
const DomainReviewRail = memo(function DomainReviewRail({
    section,
}: {
    section: InstrumentSectionDefinition;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    const { scrollToRow } = useAuditRowScroll();
    const draft = useAuditSessionStore((state) => state.draft);

    const groups = useMemo(
        () =>
            section.groups.map((group, index) => {
                const total = group.rows.length;
                const answered =
                    draft === null
                        ? 0
                        : group.rows.reduce(
                              (sum, row) => (isRowUnanswered(row, draft) ? sum : sum + 1),
                              0,
                          );
                const firstRow = group.rows[0];
                return {
                    id: group.id,
                    title: group.instruction ?? `Question group ${index + 1}`,
                    total,
                    answered,
                    anchorKey:
                        firstRow === undefined
                            ? null
                            : auditRowKey(firstRow.presenceItemId, firstRow.choiceId),
                };
            }),
        [section, draft],
    );

    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$4"
            gap="$2.5"
            style={{ backgroundColor: palette.progress, borderColor: palette.cardBorder }}
        >
            <XStack items="center" gap="$2">
                <LayoutList size={15} color={designSystem.colors.mutedForeground} />
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={14}
                >
                    Section overview
                </Text>
            </XStack>
            {groups.map((group) => {
                const complete = group.total > 0 && group.answered >= group.total;
                const anchorKey = group.anchorKey;
                return (
                    <XStack
                        key={group.id}
                        items="center"
                        justify="space-between"
                        gap="$3"
                        py="$1.5"
                        cursor={anchorKey === null ? "default" : "pointer"}
                        pressStyle={anchorKey === null ? null : { opacity: 0.9 }}
                        onPress={anchorKey === null ? undefined : () => scrollToRow(anchorKey)}
                    >
                        <Text
                            numberOfLines={1}
                            fontFamily={designSystem.fonts.bodyMedium}
                            style={{
                                color: designSystem.colors.secondaryForeground,
                                flexShrink: 1,
                            }}
                        >
                            {group.title}
                        </Text>
                        <Text
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={13}
                            style={{
                                color: complete
                                    ? designSystem.colors.successText
                                    : designSystem.colors.mutedForeground,
                            }}
                        >
                            {group.answered}/{group.total}
                        </Text>
                    </XStack>
                );
            })}
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
const DomainQuestionRow = memo(function DomainQuestionRow({
    row,
    conditionPrompt,
}: {
    row: InstrumentPromptRow;
    conditionPrompt: string;
}) {
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
    const readOnly = useAuditSessionStore((state) => state.readOnly);

    // Register this row's native node so "Jump to next unanswered" can scroll to
    // it. Stable callback (registerRow + rowKey are stable) → memo is preserved.
    const { registerRow } = useAuditRowScroll();
    const rowKey = auditRowKey(row.presenceItemId, row.choiceId);
    const setRowRef = useCallback(
        (node: View | null) => registerRow(rowKey, node),
        [registerRow, rowKey],
    );

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
        <View ref={setRowRef} collapsable={false}>
            <QuestionCard label={row.label}>
                <OptionGrid
                    value={presenceValue}
                    options={row.presenceAnswers}
                    onChange={onPresence}
                    disabled={readOnly}
                />
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
                            {conditionPrompt}
                        </Paragraph>
                        <OptionGrid
                            value={conditionValue}
                            options={row.conditionAnswers}
                            onChange={onCondition}
                            disabled={readOnly}
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
