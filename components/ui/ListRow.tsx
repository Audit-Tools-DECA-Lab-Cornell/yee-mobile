import type { ReactNode } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";

export interface ListRowProps {
    readonly title: string;
    /** Optional secondary line rendered below the title. */
    readonly subtitle?: string;
    /** Optional leading element (e.g. an icon avatar). */
    readonly leading?: ReactNode;
    /** Optional trailing element (e.g. a badge or chevron). */
    readonly trailing?: ReactNode;
    /** Press handler; when provided the row becomes an accessible button. */
    readonly onPress?: () => void;
}

/**
 * Tappable list row with leading/trailing slots, tuned for dense field lists.
 *
 * Replaces the inline place/report row layouts repeated across the places and
 * reports screens.
 *
 * @param props Row props including `title`, `subtitle`, slots, and `onPress`.
 * @returns A list row surface.
 */
export function ListRow({ title, subtitle, leading, trailing, onPress }: ListRowProps) {
    const isInteractive = onPress !== undefined;

    return (
        <XStack
            items="center"
            gap="$3"
            px="$4"
            py="$3.5"
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            onPress={onPress}
            {...(isInteractive
                ? {
                      pressStyle: { opacity: 0.92, scale: 0.99 },
                      accessibilityRole: "button" as const,
                      accessibilityLabel: title,
                  }
                : null)}
        >
            {leading}
            <YStack flex={1} gap="$1">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={15}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {subtitle === undefined ? null : (
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                        fontSize={13}
                        numberOfLines={1}
                    >
                        {subtitle}
                    </Paragraph>
                )}
            </YStack>
            {trailing}
        </XStack>
    );
}
