import { Text, XStack, type XStackProps } from "tamagui";
import { designSystem } from "lib/design-system";
import type { DesignTone } from "lib/design-system";

export interface BadgeProps extends XStackProps {
    /** Label rendered inside the badge. */
    readonly label: string;
    /** Tone providing accent/surface/text colors. Defaults to the primary tone. */
    readonly tone?: DesignTone;
    /** Render as a small uppercase eyebrow pill. Defaults to `false`. */
    readonly uppercase?: boolean;
}

const PRIMARY_TONE: DesignTone = {
    accent: designSystem.colors.primary,
    surface: designSystem.colors.primarySoft,
    text: designSystem.colors.primary,
};

/**
 * Pill-shaped status indicator backed by a {@link DesignTone}.
 *
 * Consolidates the inline status/eyebrow pills that were re-declared across the
 * execute, places, dashboard, and report screens.
 *
 * @param props Badge props including `label`, `tone`, and `uppercase`.
 * @returns A themed pill element.
 */
export function Badge({ label, tone = PRIMARY_TONE, uppercase = true, ...rest }: BadgeProps) {
    return (
        <XStack
            rounded={designSystem.radii.full}
            px="$3"
            py="$1"
            style={{ backgroundColor: tone.surface, alignSelf: "flex-start" }}
            {...rest}
        >
            <Text
                style={{ color: tone.text }}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={uppercase ? 10 : 12}
                {...(uppercase ? { textTransform: "uppercase", letterSpacing: 1.2 } : null)}
            >
                {label}
            </Text>
        </XStack>
    );
}
