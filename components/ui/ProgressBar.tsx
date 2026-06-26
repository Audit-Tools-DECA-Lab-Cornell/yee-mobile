import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";

export interface ProgressBarProps {
    /** Completed fraction in the inclusive range [0, 1]. */
    readonly value: number;
    /** Optional accent color for the filled track. Defaults to the primary token. */
    readonly color?: string;
    /** Accessible label describing what the progress represents. */
    readonly accessibilityLabel?: string;
}

/**
 * Clamp a fraction into the inclusive [0, 1] range.
 *
 * @param value Raw fraction that may fall outside the valid range.
 * @returns A safe fraction between 0 and 1.
 */
function clampFraction(value: number): number {
    if (Number.isNaN(value) || value < 0) {
        return 0;
    }

    return value > 1 ? 1 : value;
}

/**
 * Slim progress track used for wizard completion and score previews.
 *
 * @param props Progress props including `value` (0-1) and an optional `color`.
 * @returns A progress track with an accessible status role.
 */
export function ProgressBar({ value, color, accessibilityLabel }: ProgressBarProps) {
    const designSystem = useDesignSystem();
    const fraction = clampFraction(value);
    const percent = Math.round(fraction * 100);

    return (
        <YStack
            height={8}
            rounded={designSystem.radii.full}
            bg={designSystem.colors.mutedSurface}
            overflow="hidden"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            {...(accessibilityLabel === undefined ? null : { accessibilityLabel })}
        >
            <XStack
                width={`${percent}%`}
                height="100%"
                rounded={designSystem.radii.full}
                style={{ backgroundColor: color ?? designSystem.colors.primary }}
            />
        </YStack>
    );
}
