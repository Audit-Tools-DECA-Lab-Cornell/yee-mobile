import { memo } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { ChevronLeft, LayoutDashboard } from "components/icons";
import { useDesignSystem } from "lib/design-system";
import { getStepTitle, type MobileYeeStepNumber } from "lib/yee-mobile-audit-config";
import { getCompletedSteps } from "lib/yee-submit-guard";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { SaveStatusPill } from "./SaveStatusPill";

/** Required steps for the overall progress denominator (step 9 is optional). */
const REQUIRED_STEP_COUNT = 8;

/**
 * Compact sticky header: place name, current step title, live save status, and
 * an overall progress bar. Replaces the old double "Step X of 9" blocks with a
 * single, minimal status surface.
 */
export const AuditHeader = memo(function AuditHeader({
    step,
    onBack,
    onHome,
}: {
    step: MobileYeeStepNumber;
    onBack: () => void;
    onHome: () => void;
}) {
    const designSystem = useDesignSystem();
    const placeName = useAuditSessionStore((state) => state.draft?.placeName ?? "");

    return (
        <YStack
            gap="$2.5"
            px="$4"
            pt="$3"
            pb="$2.5"
            style={{
                backgroundColor: designSystem.colors.background,
                borderBottomWidth: 1,
                borderBottomColor: designSystem.colors.border,
            }}
        >
            <XStack items="center" gap="$3">
                <Button
                    width={40}
                    height={40}
                    p={0}
                    rounded={designSystem.radii.button}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surfaceMuted}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onBack}
                    accessibilityLabel="Back"
                >
                    <ChevronLeft size={18} color={designSystem.colors.foreground} />
                </Button>
                <YStack flex={1} gap="$0.5">
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={10}
                        textTransform="uppercase"
                        letterSpacing={1.4}
                        numberOfLines={1}
                    >
                        {placeName || "Assigned place"}
                    </Paragraph>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={19}
                        numberOfLines={1}
                    >
                        {getStepTitle(step)}
                    </Text>
                </YStack>
                <Button
                    width={40}
                    height={40}
                    p={0}
                    rounded={designSystem.radii.button}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surfaceMuted}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onHome}
                    accessibilityLabel="Home"
                >
                    <LayoutDashboard size={18} color={designSystem.colors.foreground} />
                </Button>
            </XStack>
            <XStack items="center" justify="space-between" gap="$3">
                <SaveStatusPill />
                <AuditProgressMeter />
            </XStack>
        </YStack>
    );
});

const AuditProgressMeter = memo(function AuditProgressMeter() {
    const designSystem = useDesignSystem();
    // Subscribe to the DERIVED count, not the whole draft: the meter then
    // re-renders only when a step flips complete/incomplete, instead of on every
    // keystroke or answer tap. (Selector still runs per update, but the render —
    // the expensive part — is gated by Object.is on the number.)
    const completedCount = useAuditSessionStore((state) =>
        state.draft === null ? 0 : getCompletedSteps(state.draft, state.instrument).size,
    );
    const percentage = Math.round((completedCount / REQUIRED_STEP_COUNT) * 100);

    return (
        <XStack items="center" gap="$2" flex={1} justify="flex-end">
            <YStack
                flex={1}
                height={6}
                rounded={designSystem.radii.full}
                overflow="hidden"
                style={{ backgroundColor: designSystem.colors.mutedSurface, maxWidth: 140 }}
            >
                <YStack
                    height={6}
                    rounded={designSystem.radii.full}
                    style={{
                        backgroundColor: designSystem.colors.primary,
                        width: `${Math.max(0, Math.min(percentage, 100))}%`,
                    }}
                />
            </YStack>
            <Text
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
            >
                {completedCount}/{REQUIRED_STEP_COUNT}
            </Text>
        </XStack>
    );
});
