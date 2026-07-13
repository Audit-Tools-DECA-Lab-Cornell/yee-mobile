import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { AppButton } from "./Button";
import { Card } from "./Card";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface ErrorStateProps {
    /** Short, human sentence — what failed, in the user's terms. */
    readonly title?: string;
    /** A likely cause plus reassurance and a next step. */
    readonly description?: string;
    /** The caught error — its message is shown only in development builds. */
    readonly error?: Error | null;
    /** Retry handler; renders a "Try again" button when provided. */
    readonly onRetry?: () => void;
    /** Optional decorative icon rendered above the title. */
    readonly icon?: ReactNode;
    /** Optional extra recovery action (e.g. a "Go back" {@link AppButton}). */
    readonly action?: ReactNode;
}

/**
 * The humane, branded error surface for recoverable failures (failed sync or
 * load), mirroring the web's `ErrorState`. Never shows a raw stack trace to
 * end users — the technical message is revealed only in development builds.
 *
 * @param props Error-state props including `title`, `description`, `onRetry`.
 * @returns A danger-tinted error card with an alert status region.
 */
export function ErrorState({
    title = "Something didn't load",
    description = "Something went wrong on our end. Try again, and if it keeps happening, reach out to your YEE contact.",
    error,
    onRetry,
    icon,
    action,
}: ErrorStateProps) {
    const designSystem = useDesignSystem();
    const showTechnical = __DEV__ && typeof error?.message === "string" && error.message.length > 0;
    return (
        <Card
            variant="flat"
            gap="$3"
            items="center"
            borderColor={designSystem.colors.danger}
            bg={designSystem.colors.dangerSoft}
            accessibilityRole="alert"
            aria-live="assertive"
        >
            {icon}
            <Text
                color={designSystem.colors.dangerText}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                style={{ textAlign: "center" }}
            >
                {title}
            </Text>
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                style={{ textAlign: "center" }}
            >
                {description}
            </Paragraph>
            {onRetry !== undefined || action !== undefined ? (
                <XStack gap="$3" flexWrap="wrap" justify="center">
                    {onRetry === undefined ? null : (
                        <AppButton label="Try again" onPress={onRetry} />
                    )}
                    {action}
                </XStack>
            ) : null}
            {showTechnical ? (
                <YStack
                    rounded={designSystem.radii.sm}
                    px="$3"
                    py="$2"
                    style={{ backgroundColor: designSystem.colors.surfaceMuted }}
                >
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.monoMedium}
                        fontSize={12}
                    >
                        Technical details (dev only): {error?.message}
                    </Paragraph>
                </YStack>
            ) : null}
        </Card>
    );
}
