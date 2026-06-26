import { YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import type { DesignTone } from "lib/design-system";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "./ScaledText";

export interface MetricCardProps {
    readonly label: string;
    readonly value: string;
    /** Optional supporting caption rendered below the value. */
    readonly caption?: string;
    /** Optional tone used to accent the value text. */
    readonly tone?: DesignTone;
}

/**
 * Compact metric tile for dashboard grids and report summaries.
 *
 * Consolidates the inline `MetricCard`/`InfoCard`/`SummaryTile` declarations
 * previously duplicated across the dashboard, execute, and report screens.
 *
 * @param props Metric props including `label`, `value`, `caption`, and `tone`.
 * @returns A metric tile surface.
 */
export function MetricCard({ label, value, caption, tone }: MetricCardProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$1.5"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.2}
            >
                {label}
            </Paragraph>
            <Text
                style={{ color: tone?.text ?? designSystem.colors.foreground }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={24}
                lineHeight={28}
            >
                {value}
            </Text>
            {caption === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    fontSize={12}
                >
                    {caption}
                </Paragraph>
            )}
        </YStack>
    );
}
