import { useWindowDimensions } from "react-native";
import { Paragraph, Text, type ParagraphProps, type TextProps } from "tamagui";
import { createResponsiveLayout, getEffectiveFontScale } from "lib/responsive-layout";
import { usePreferencesStore } from "stores/preferences-store";

/**
 * Multiply an explicit numeric size by the active text scale.
 *
 * Token sizes and undefined values pass through untouched so Tamagui keeps
 * deriving them as usual.
 *
 * @param value Original size prop.
 * @param scale Active font scale multiplier.
 * @returns Scaled size, or the original value when not a number.
 */
function scaleSize<T>(value: T, scale: number): T | number {
    return typeof value === "number" ? Math.round(value * scale) : value;
}

/**
 * Resolve the effective text scale for the current viewport.
 *
 * Combines the auditor's stored text-size preference with the tablet baseline
 * type scale so tablet screens render legible type by default.
 *
 * @returns Effective multiplier for numeric font sizes and line heights.
 */
function useEffectiveFontScale(): number {
    const fontScale = usePreferencesStore((state) => state.fontScale);
    const { width } = useWindowDimensions();
    const { isTablet } = createResponsiveLayout(width);
    return getEffectiveFontScale(fontScale, isTablet);
}

/**
 * Heading/inline text that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Text` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference composed with the
 * tablet baseline type scale.
 */
export function ScaledText({ fontSize, lineHeight, ...rest }: TextProps) {
    const effectiveFontScale = useEffectiveFontScale();
    return (
        <Text
            fontSize={scaleSize(fontSize, effectiveFontScale)}
            lineHeight={scaleSize(lineHeight, effectiveFontScale)}
            {...rest}
        />
    );
}

/**
 * Body copy that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Paragraph` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference composed with the
 * tablet baseline type scale.
 */
export function ScaledParagraph({ fontSize, lineHeight, ...rest }: ParagraphProps) {
    const effectiveFontScale = useEffectiveFontScale();
    return (
        <Paragraph
            fontSize={scaleSize(fontSize, effectiveFontScale)}
            lineHeight={scaleSize(lineHeight, effectiveFontScale)}
            {...rest}
        />
    );
}
