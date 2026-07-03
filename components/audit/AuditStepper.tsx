import { memo, useMemo } from "react";
import { ScrollView } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { Check } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { mobileYeeSteps, type MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import { getCompletedSteps } from "lib/yee-submit-guard";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { getStepTone, type StepStatus } from "./survey-theme";

/**
 * Persistent, horizontally-scrollable step rail. Replaces the old wrap-around
 * pills: every step advertises its state — done ✓ / current / has-unanswered /
 * not-yet-reached — and tapping one jumps in place (no route change). Surfaces
 * incomplete steps up front rather than only via the Next alert.
 */
export const AuditStepper = memo(function AuditStepper({
    activeStep,
    onSelect,
}: {
    activeStep: MobileYeeStepNumber;
    onSelect: (step: MobileYeeStepNumber) => void;
}) {
    const draft = useAuditSessionStore((state) => state.draft);
    const instrument = useAuditSessionStore((state) => state.instrument);
    const completed = useMemo(
        () =>
            draft === null ? new Set<MobileYeeStepNumber>() : getCompletedSteps(draft, instrument),
        [draft, instrument],
    );

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 2 }}
        >
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
        </ScrollView>
    );
});

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
                style={{ color: tone.text }}
            >
                {title}
            </Text>
        </XStack>
    );
});
