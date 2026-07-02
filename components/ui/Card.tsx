import type { ReactNode } from "react";
import { YStack, type YStackProps } from "tamagui";
import { useDesignSystem } from "lib/design-system";

/**
 * Visual emphasis applied to a card surface.
 *
 * - `raised`: elevated surface with the standard card shadow.
 * - `flat`: bordered surface without a shadow, for nested groupings.
 * - `muted`: tinted inset surface used inside a raised card.
 * - `panel`: stronger framed panel for tablet rails and dense support regions.
 */
export type CardVariant = "raised" | "flat" | "muted" | "panel";

export interface CardProps extends YStackProps {
    /** Visual emphasis for the surface. Defaults to `raised`. */
    readonly variant?: CardVariant;
    readonly children?: ReactNode;
}

/**
 * Standard bordered surface used to group related content across screens.
 *
 * Replaces the inline `YStack` card declarations that were duplicated across
 * the dashboard, execute, places, and report screens.
 *
 * @param props Card props including the visual `variant` and standard layout props.
 * @returns A themed surface container.
 */
export function Card({ variant = "raised", children, ...rest }: CardProps) {
    const designSystem = useDesignSystem();
    const backgroundColor =
        variant === "muted" ? designSystem.colors.input : designSystem.colors.surface;
    const shadow =
        variant === "panel"
            ? designSystem.shadows.panel
            : variant === "raised"
              ? designSystem.shadows.card
              : undefined;

    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={backgroundColor}
            p="$4"
            gap="$3"
            {...(shadow === undefined ? null : { style: { boxShadow: shadow } })}
            {...rest}
        >
            {children}
        </YStack>
    );
}

/**
 * Card preset for full-width content sections with a heading and body.
 *
 * @param props Standard {@link CardProps}.
 * @returns A raised section surface.
 */
export function SectionCard(props: CardProps) {
    return <Card {...props} />;
}
