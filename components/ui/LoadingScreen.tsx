import { useEffect } from "react";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { BrandLogo } from "./BrandLogo";
import { BrandSpinner } from "./BrandSpinner";
import { ScaledParagraph as Paragraph } from "./ScaledText";

/**
 * Convert a `#RRGGBB` hex color to an rgba string.
 *
 * @param hex Hex color (6-digit, leading `#`).
 * @param alpha Opacity between 0 and 1.
 * @returns The rgba() color string.
 */
function hexToRgba(hex: string, alpha: number): string {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PING_RING_SIZE = 96;
const STATIC_RING_SIZE = 80;
const MARK_SIZE = 64;

export interface LoadingScreenProps {
    /** Status message (an ellipsis is appended automatically). */
    readonly message?: string;
}

/**
 * Full-screen branded loader - the YEE mark inside a soft pulsing brand ring
 * (one integrated visual unit) with a caption below, ported from the web's
 * `LoadingScreen`. Use on route gates and heavy first loads instead of a bare
 * spinner. The pulse pauses when the system requests reduced motion.
 */
export function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
    const designSystem = useDesignSystem();
    const reducedMotion = useReducedMotion();
    const pulse = useSharedValue(0);

    useEffect(() => {
        if (reducedMotion) {
            pulse.value = 0;
            return;
        }
        // Mirrors CSS `animate-ping`: scale 1 -> 2 while fading out, once per second.
        pulse.value = withRepeat(
            withTiming(1, { duration: 1000, easing: Easing.bezier(0, 0, 0.2, 1) }),
            -1,
        );
        return () => cancelAnimation(pulse);
    }, [reducedMotion, pulse]);

    const pingStyle = useAnimatedStyle(() => ({
        transform: [{ scale: 1 + pulse.value }],
        opacity: 1 - pulse.value,
    }));

    return (
        <YStack
            flex={1}
            items="center"
            justify="center"
            gap="$6"
            px="$6"
            bg={designSystem.colors.background}
            accessibilityRole="progressbar"
            accessibilityLabel={`${message}…`}
            aria-busy
        >
            <YStack width={PING_RING_SIZE} height={PING_RING_SIZE} items="center" justify="center">
                <Animated.View
                    pointerEvents="none"
                    style={[
                        {
                            position: "absolute",
                            width: PING_RING_SIZE,
                            height: PING_RING_SIZE,
                            borderRadius: PING_RING_SIZE / 2,
                            backgroundColor: hexToRgba(designSystem.colors.primary, 0.1),
                        },
                        pingStyle,
                    ]}
                />
                <YStack
                    position="absolute"
                    width={STATIC_RING_SIZE}
                    height={STATIC_RING_SIZE}
                    rounded={designSystem.radii.full}
                    style={{ backgroundColor: hexToRgba(designSystem.colors.primary, 0.05) }}
                />
                <BrandLogo size={MARK_SIZE} accessibilityLabel={null} />
            </YStack>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={14}
            >
                {message}…
            </Paragraph>
        </YStack>
    );
}

export interface InlineLoaderProps {
    /** Status message (an ellipsis is appended automatically). */
    readonly message?: string;
}

/**
 * Inline branded loader for use inside cards/panels - a small brand spinner
 * with a message, ported from the web's `InlineLoader`. Reserve for small
 * inline async; full screens use {@link LoadingScreen} or a skeleton.
 */
export function InlineLoader({ message = "Loading" }: InlineLoaderProps) {
    const designSystem = useDesignSystem();
    return (
        <XStack items="center" justify="center" gap="$3" py="$5" aria-busy>
            <BrandSpinner size="sm" label={message} />
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={14}
            >
                {message}…
            </Paragraph>
        </XStack>
    );
}
