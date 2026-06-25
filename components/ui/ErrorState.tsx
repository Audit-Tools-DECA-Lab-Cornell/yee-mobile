import type { ReactNode } from "react";
import { Paragraph, Text } from "tamagui";
import { designSystem } from "lib/design-system";
import { Card } from "./Card";

export interface ErrorStateProps {
    readonly title: string;
    readonly description?: string;
    /** Optional decorative icon rendered above the title. */
    readonly icon?: ReactNode;
    /** Optional recovery action (e.g. a retry {@link AppButton}). */
    readonly action?: ReactNode;
}

/**
 * Inline error surface for recoverable failures (e.g. failed sync or load).
 *
 * @param props Error-state props including `title`, `description`, and `action`.
 * @returns A danger-tinted error card with an alert status region.
 */
export function ErrorState({ title, description, icon, action }: ErrorStateProps) {
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
                color={designSystem.colors.danger}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                style={{ textAlign: "center" }}
            >
                {title}
            </Text>
            {description === undefined ? null : (
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
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
