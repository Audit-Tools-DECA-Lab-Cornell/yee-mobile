import { Spinner, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { ScaledParagraph as Paragraph } from "./ScaledText";

export interface LoadingStateProps {
    /** Optional caption rendered beneath the spinner. */
    readonly label?: string;
    /** Fill the available space and center vertically. Defaults to `true`. */
    readonly fullScreen?: boolean;
}

/**
 * Centered loading indicator used while async screen data resolves.
 *
 * @param props Loading-state props including an optional `label`.
 * @returns A centered spinner with an accessible status region.
 */
export function LoadingState({ label, fullScreen = true }: LoadingStateProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            {...(fullScreen ? { flex: 1 } : { py: "$6" })}
            items="center"
            justify="center"
            gap="$3"
            bg={designSystem.colors.background}
            accessibilityRole="progressbar"
            accessibilityLabel={label ?? "Loading"}
            aria-busy
        >
            <Spinner size="large" color={designSystem.colors.primary} />
            {label === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {label}
                </Paragraph>
            )}
        </YStack>
    );
}
