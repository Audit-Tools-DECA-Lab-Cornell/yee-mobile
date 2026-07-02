import type { ReactNode } from "react";
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface ScreenHeaderProps {
    readonly title: string;
    /** Optional uppercase eyebrow rendered above the title. */
    readonly eyebrow?: string;
    /** Optional supporting copy rendered below the title. */
    readonly subtitle?: string;
    /** Optional trailing element (e.g. a status badge or icon button). */
    readonly trailing?: ReactNode;
}

/**
 * Standard screen title block with an optional eyebrow, subtitle, and trailing slot.
 *
 * @param props Header props including `title`, `eyebrow`, `subtitle`, and `trailing`.
 * @returns A screen header layout.
 */
export function ScreenHeader({ title, eyebrow, subtitle, trailing }: ScreenHeaderProps) {
    const designSystem = useDesignSystem();
    return (
        <XStack justify="space-between" items="flex-start" gap="$3">
            <YStack flex={1} gap="$1.5">
                {eyebrow === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.monoBold}
                        fontSize={12}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {eyebrow}
                    </Paragraph>
                )}
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={30}
                    lineHeight={34}
                    letterSpacing={-0.6}
                    accessibilityRole="header"
                >
                    {title}
                </Text>
                {subtitle === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {subtitle}
                    </Paragraph>
                )}
            </YStack>
            {trailing}
        </XStack>
    );
}
