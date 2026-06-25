import type { ReactNode } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { Card } from "./Card";

export interface EmptyStateProps {
    readonly title: string;
    readonly description?: string;
    /** Optional decorative icon rendered above the title. */
    readonly icon?: ReactNode;
    /** Optional call-to-action element (e.g. an {@link AppButton}). */
    readonly action?: ReactNode;
}

/**
 * Consistent empty-state card for lists and detail screens with no content.
 *
 * Replaces the ad-hoc "select a place" / "no reports yet" inline blocks.
 *
 * @param props Empty-state props including `title`, `description`, `icon`, and `action`.
 * @returns A centered empty-state surface.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
    return (
        <Card gap="$3" items="center" accessibilityRole="summary">
            {icon === undefined ? null : (
                <YStack
                    width={48}
                    height={48}
                    items="center"
                    justify="center"
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surfaceMuted}
                >
                    {icon}
                </YStack>
            )}
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                style={{ textAlign: "center" }}
            >
                {title}
            </Text>
            {description === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    style={{ textAlign: "center" }}
                >
                    {description}
                </Paragraph>
            )}
            {action}
        </Card>
    );
}
