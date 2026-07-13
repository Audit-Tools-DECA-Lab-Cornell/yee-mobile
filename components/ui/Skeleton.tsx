import { useEffect } from "react";
import type { DimensionValue } from "react-native";
import Animated, {
    cancelAnimation,
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { useDesignSystem } from "lib/design-system";

export interface SkeletonProps {
    readonly height: number;
    /** Width; defaults to filling the container. */
    readonly width?: DimensionValue;
    /** Corner radius; defaults to the `md` card radius. */
    readonly radius?: number;
}

/**
 * Content-shaped loading placeholder, mirroring the web's pulsing `Skeleton`.
 * Prefer a skeleton over a spinner wherever the loaded content has a known
 * shape; the pulse pauses when the system requests reduced motion.
 */
export function Skeleton({ height, width = "100%", radius }: SkeletonProps) {
    const designSystem = useDesignSystem();
    const reducedMotion = useReducedMotion();
    const pulse = useSharedValue(0);

    useEffect(() => {
        if (reducedMotion) {
            pulse.value = 0;
            return;
        }
        // Mirrors CSS `animate-pulse`: opacity 1 -> 0.5 -> 1 over 2s.
        pulse.value = withRepeat(
            withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
        );
        return () => cancelAnimation(pulse);
    }, [reducedMotion, pulse]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - pulse.value * 0.5,
    }));

    return (
        <Animated.View
            aria-busy
            style={[
                {
                    height,
                    width,
                    borderRadius: radius ?? designSystem.radii.md,
                    backgroundColor: designSystem.colors.surfaceMuted,
                },
                animatedStyle,
            ]}
        />
    );
}
