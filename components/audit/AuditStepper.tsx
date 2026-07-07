import { memo, useMemo } from "react";
import { Text, XStack, YStack } from "tamagui";
import { Check, ClipboardCheck } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { mobileYeeSteps, type MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import { findFirstIncompleteStep, getCompletedSteps } from "lib/yee-submit-guard";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { getStepTone, type StepStatus } from "./survey-theme";

/**
 * Persistent step rail. Every step wraps onto the grid at an equal width so the
 * whole audit is visible up front with no horizontal scrolling. Each button
 * advertises its state — done ✓ / current / has-unanswered / not-yet-reached —
 * and tapping one jumps in place (no route change). A trailing Review button
 * (the 10th control) unlocks only once every section is complete, routing to the
 * review-and-submit screen.
 */
export const AuditStepper = memo(function AuditStepper({
    activeStep,
    onSelect,
    onReview,
}: {
    activeStep: MobileYeeStepNumber;
    onSelect: (step: MobileYeeStepNumber) => void;
    /** Omitted in the read-only submitted-audit view, where review does not apply. */
    onReview?: () => void;
}) {
    const draft = useAuditSessionStore((state) => state.draft);
    const instrument = useAuditSessionStore((state) => state.instrument);
    const completed = useMemo(
        () =>
            draft === null ? new Set<MobileYeeStepNumber>() : getCompletedSteps(draft, instrument),
        [draft, instrument],
    );
    // Review unlocks on the same rule that gates submission: every required
    // section answered (final comments are optional and never block).
    const canReview = useMemo(
        () => draft !== null && findFirstIncompleteStep(draft, instrument) === null,
        [draft, instrument],
    );

    return (
        <XStack flexWrap="wrap" style={{ paddingHorizontal: 16, paddingVertical: 2, gap: 8 }}>
            {mobileYeeSteps.map((entry) => {
                const status: StepStatus =
                    entry.step === activeStep
                        ? "current"
                        : completed.has(entry.step)
                          ? "done"
                          : entry.step < activeStep
                            ? "incomplete"
                            : "empty";
                return (
                    <StepPill
                        key={entry.step}
                        step={entry.step}
                        title={entry.title}
                        status={status}
                        onSelect={onSelect}
                    />
                );
            })}
            {onReview === undefined ? null : <ReviewPill enabled={canReview} onReview={onReview} />}
        </XStack>
    );
});

/** Shared equal-width sizing so every rail button lines up in a 2-column grid. */
const PILL_SIZING = { flexBasis: "48%", flexGrow: 1, minWidth: 0 } as const;

const StepPill = memo(function StepPill({
    step,
    title,
    status,
    onSelect,
}: {
    step: MobileYeeStepNumber;
    title: string;
    status: StepStatus;
    onSelect: (step: MobileYeeStepNumber) => void;
}) {
    const designSystem = useDesignSystem();
    const tone = getStepTone(status, designSystem.colors);
    const isDone = status === "done";
    return (
        <XStack
            {...PILL_SIZING}
            items="center"
            gap="$2"
            rounded={designSystem.radii.button}
            borderWidth={1}
            px="$3"
            py="$2"
            cursor="pointer"
            accessibilityRole="button"
            accessibilityState={{ selected: status === "current" }}
            accessibilityLabel={`Step ${step}: ${title}${isDone ? ", complete" : ""}`}
            pressStyle={{ opacity: 0.92, scale: 0.98 }}
            onPress={() => onSelect(step)}
            style={{ minHeight: 40, backgroundColor: tone.surface, borderColor: tone.border }}
        >
            <YStack
                width={20}
                height={20}
                items="center"
                justify="center"
                rounded={designSystem.radii.full}
                style={{
                    backgroundColor:
                        status === "current"
                            ? designSystem.colors.primaryForeground
                            : isDone
                              ? designSystem.colors.success
                              : "transparent",
                    borderWidth: status === "current" || isDone ? 0 : 1,
                    borderColor: tone.indicator ?? designSystem.colors.border,
                }}
            >
                {isDone ? (
                    <Check size={12} color={designSystem.colors.primaryForeground} />
                ) : (
                    <Text
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                        style={{
                            color: status === "current" ? designSystem.colors.primary : tone.text,
                        }}
                    >
                        {step}
                    </Text>
                )}
            </YStack>
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={12}
                numberOfLines={1}
                style={{ color: tone.text, flexShrink: 1 }}
            >
                {title}
            </Text>
        </XStack>
    );
});

/**
 * The 10th rail control. Reads as the primary chip once every section is
 * complete; before that it stays muted and non-interactive so the auditor sees
 * that review is the final, still-locked step.
 */
const ReviewPill = memo(function ReviewPill({
    enabled,
    onReview,
}: {
    enabled: boolean;
    onReview: () => void;
}) {
    const designSystem = useDesignSystem();
    const surface = enabled ? designSystem.colors.primary : designSystem.colors.surfaceMuted;
    const border = enabled ? designSystem.colors.primary : designSystem.colors.border;
    const foreground = enabled
        ? designSystem.colors.primaryForeground
        : designSystem.colors.mutedForeground;
    return (
        <XStack
            {...PILL_SIZING}
            items="center"
            gap="$2"
            rounded={designSystem.radii.button}
            borderWidth={1}
            px="$3"
            py="$2"
            cursor={enabled ? "pointer" : "default"}
            accessibilityRole="button"
            accessibilityState={{ disabled: !enabled }}
            accessibilityLabel={
                enabled ? "Review and submit" : "Review unlocks after every section is complete"
            }
            pressStyle={enabled ? { opacity: 0.92, scale: 0.98 } : null}
            onPress={enabled ? onReview : undefined}
            style={{
                minHeight: 40,
                backgroundColor: surface,
                borderColor: border,
                opacity: enabled ? 1 : 0.6,
            }}
        >
            <YStack
                width={20}
                height={20}
                items="center"
                justify="center"
                rounded={designSystem.radii.full}
                style={{
                    backgroundColor: "transparent",
                    borderWidth: 1,
                    borderColor: enabled
                        ? designSystem.colors.primaryForeground
                        : designSystem.colors.border,
                }}
            >
                <ClipboardCheck size={12} color={foreground} />
            </YStack>
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={12}
                numberOfLines={1}
                style={{ color: foreground, flexShrink: 1 }}
            >
                Review
            </Text>
        </XStack>
    );
});
