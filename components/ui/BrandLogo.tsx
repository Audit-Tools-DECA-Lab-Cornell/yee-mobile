import { Image } from "react-native";
import { useDesignSystem } from "lib/design-system";

// Metro asset resolution requires static require() calls.
const LOGO_MARK_LIGHT = require("../../assets/images/brand/logo-mark.png") as number;
const LOGO_MARK_WHITE = require("../../assets/images/brand/logo-mark-white.png") as number;

export interface BrandLogoProps {
    /** Rendered square size in points. Defaults to 64 (the loader mark size). */
    readonly size?: number;
    /** Accessibility label; pass `null` to mark the image decorative. */
    readonly accessibilityLabel?: string | null;
}

/**
 * The YEE logo mark, theme-aware (dark surfaces get the white mark). Mirrors
 * the web's `BrandLogo variant="mark"` - the source PNGs are the same brand
 * assets as `yee-frontend/public/brand/logo-mark*.png`.
 */
export function BrandLogo({ size = 64, accessibilityLabel = "YEE logo" }: BrandLogoProps) {
    const designSystem = useDesignSystem();
    return (
        <Image
            source={designSystem.theme === "dark" ? LOGO_MARK_WHITE : LOGO_MARK_LIGHT}
            style={{ width: size, height: size }}
            resizeMode="contain"
            accessibilityRole="image"
            {...(accessibilityLabel === null
                ? { accessibilityElementsHidden: true, importantForAccessibility: "no" as const }
                : { accessibilityLabel })}
        />
    );
}
