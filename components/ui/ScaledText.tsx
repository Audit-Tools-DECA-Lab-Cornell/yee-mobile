import { Paragraph, Text, type ParagraphProps, type TextProps } from "tamagui";
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
 * Heading/inline text that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Text` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference.
 */
export function ScaledText({ fontSize, lineHeight, ...rest }: TextProps) {
    const fontScale = usePreferencesStore((state) => state.fontScale);
    return (
        <Text
            fontSize={scaleSize(fontSize, fontScale)}
            lineHeight={scaleSize(lineHeight, fontScale)}
            {...rest}
        />
    );
}

/**
 * Body copy that respects the auditor's text-size preference.
 *
 * Drop-in replacement for Tamagui's `Paragraph` that scales explicit numeric
 * `fontSize` and `lineHeight` by the active preference.
 */
export function ScaledParagraph({ fontSize, lineHeight, ...rest }: ParagraphProps) {
    const fontScale = usePreferencesStore((state) => state.fontScale);
    return (
        <Paragraph
            fontSize={scaleSize(fontSize, fontScale)}
            lineHeight={scaleSize(lineHeight, fontScale)}
            {...rest}
        />
    );
}
