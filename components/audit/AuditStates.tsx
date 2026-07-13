import { memo } from "react";
import { Button, Paragraph, Text, YStack } from "tamagui";
import { Skeleton } from "components/ui";
import { useDesignSystem } from "lib/design-system";

/**
 * First-paint skeleton shown briefly while the cached instrument + draft load.
 * Replaces the old blocking full-screen spinner; subsequent step switches are
 * instant and never show this.
 */
export const AuditSkeleton = memo(function AuditSkeleton() {
    const designSystem = useDesignSystem();
    return (
        <YStack flex={1} bg={designSystem.colors.background} px="$4" pt="$5" gap="$4">
            <Skeleton height={44} />
            <Skeleton height={56} />
            <YStack
                gap="$3"
                p="$4"
                rounded={designSystem.radii.lg}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                style={{ backgroundColor: designSystem.colors.surface }}
            >
                <Skeleton height={20} width="60%" />
                <Skeleton height={14} width="90%" />
                <Skeleton height={72} />
                <Skeleton height={72} />
                <Skeleton height={72} />
            </YStack>
        </YStack>
    );
});

/**
 * Full-screen blocked state (place missing, or survey not cached offline). Offers
 * a retry when one is provided and a way back to the places list.
 */
export const AuditBlockedScreen = memo(function AuditBlockedScreen({
    title,
    body,
    onBack,
    onRetry,
}: {
    title: string;
    body: string;
    onBack: () => void;
    onRetry?: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack flex={1} bg={designSystem.colors.background} px="$4" py="$6" justify="center">
            <YStack
                rounded={designSystem.radii.lg}
                borderWidth={1}
                borderColor={designSystem.colors.warning}
                bg={designSystem.colors.surface}
                p="$5"
                gap="$4"
                style={{ boxShadow: designSystem.shadows.card }}
            >
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={26}
                >
                    {title}
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {body}
                </Paragraph>
                {onRetry ? (
                    <Button
                        rounded={designSystem.radii.button}
                        bg={designSystem.colors.primary}
                        borderWidth={1}
                        borderColor={designSystem.colors.primary}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                        onPress={onRetry}
                    >
                        <Button.Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            Try again
                        </Button.Text>
                    </Button>
                ) : null}
                <Button
                    rounded={designSystem.radii.button}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onBack}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back to places
                    </Button.Text>
                </Button>
            </YStack>
        </YStack>
    );
});
