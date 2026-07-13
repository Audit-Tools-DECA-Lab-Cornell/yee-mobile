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
import Svg, { Circle, Path } from "react-native-svg";
import { useDesignSystem } from "lib/design-system";

/** Rendered sizes matching the web spinner's `size-3.5/4/6/9` scale. */
const SPINNER_SIZES = {
    xs: 14,
    sm: 16,
    md: 24,
    lg: 36,
} as const;

export type BrandSpinnerSize = keyof typeof SPINNER_SIZES;

export interface BrandSpinnerProps {
    readonly size?: BrandSpinnerSize;
    /** Stroke color; defaults to the brand primary. */
    readonly color?: string;
    /** Accessible status label. */
    readonly label?: string;
}

/**
 * Brand spinner — a two-part arc (faint track + solid brand sweep) instead of
 * a generic ring, ported from the web's `Spinner` (`components/ui/spinner.tsx`:
 * same 24-unit viewBox, r=9 track at 15% opacity, quarter-arc sweep). Freezes
 * when the system requests reduced motion.
 */
export function BrandSpinner({ size = "md", color, label = "Loading" }: BrandSpinnerProps) {
    const designSystem = useDesignSystem();
    const reducedMotion = useReducedMotion();
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (reducedMotion) {
            rotation.value = 0;
            return;
        }
        rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
        return () => cancelAnimation(rotation);
    }, [reducedMotion, rotation]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }],
    }));

    const dimension = SPINNER_SIZES[size];
    const stroke = color ?? designSystem.colors.primary;

    return (
        <Animated.View
            style={[{ width: dimension, height: dimension }, animatedStyle]}
            accessibilityRole="progressbar"
            accessibilityLabel={label}
            aria-busy
        >
            <Svg width={dimension} height={dimension} viewBox="0 0 24 24" fill="none">
                <Circle
                    cx={12}
                    cy={12}
                    r={9}
                    stroke={stroke}
                    strokeOpacity={0.15}
                    strokeWidth={3}
                />
                <Path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke={stroke}
                    strokeWidth={3}
                    strokeLinecap="round"
                />
            </Svg>
        </Animated.View>
    );
}
