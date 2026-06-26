import { useMemo } from "react";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import type { MetricTone, PlaceStatus, PreAuditStatus } from "./yee-demo-data";

/**
 * Calm, warm light palette used as the product's default appearance.
 */
export const lightColors = {
    background: "#FBFAF6",
    backgroundAccent: "#F6F3EC",
    foreground: "#0F1720",
    primary: "#10231F",
    primaryForeground: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F8F4EE",
    mutedSurface: "#F0EBE2",
    input: "#FBFCFE",
    border: "#DDD6CB",
    mutedForeground: "#6B706F",
    secondaryForeground: "#4D5966",
    success: "#5E9C83",
    warning: "#C89A57",
    danger: "#B5483D",
    info: "#7B9ED9",
    mint: "#9DDCCF",
    sky: "#DFE9FB",
    amber: "#F8E6BE",
    rose: "#F6DADF",
    violet: "#C6B6EE",
    overlay: "rgba(251, 250, 246, 0.92)",
    primarySoft: "rgba(16, 35, 31, 0.06)",
    successSoft: "rgba(94, 156, 131, 0.14)",
    warningSoft: "rgba(200, 154, 87, 0.18)",
    dangerSoft: "rgba(181, 72, 61, 0.10)",
    infoSoft: "rgba(123, 158, 217, 0.16)",
    mintSoft: "rgba(157, 220, 207, 0.24)",
    skySoft: "rgba(223, 233, 251, 0.92)",
    amberSoft: "rgba(248, 230, 190, 0.88)",
    roseSoft: "rgba(246, 218, 223, 0.85)",
    violetSoft: "rgba(198, 182, 238, 0.18)",
} as const;

/** Color token names shared by every theme. */
export type ColorTokens = Record<keyof typeof lightColors, string>;

/**
 * Warm dark palette tuned for low-light field use. Foreground/background pairs
 * keep AA contrast, and accent tints are softened so they read on dark surfaces.
 *
 * Declared `as const` so each value keeps its literal type and remains a valid
 * Tamagui color; `satisfies` enforces shape parity with the light palette.
 */
export const darkColors = {
    background: "#141513",
    backgroundAccent: "#1B1C18",
    foreground: "#F3F1EC",
    primary: "#7FBFA3",
    primaryForeground: "#0E1A16",
    surface: "#1E201C",
    surfaceMuted: "#24261F",
    mutedSurface: "#2B2D26",
    input: "#1B1D19",
    border: "#34362E",
    mutedForeground: "#A7A99F",
    secondaryForeground: "#C9C8BF",
    success: "#7FBFA3",
    warning: "#E0B873",
    danger: "#E08379",
    info: "#9DB8E6",
    mint: "#9DDCCF",
    sky: "#9DB8E6",
    amber: "#E0B873",
    rose: "#E08379",
    violet: "#C6B6EE",
    overlay: "rgba(20, 21, 19, 0.92)",
    primarySoft: "rgba(127, 191, 163, 0.16)",
    successSoft: "rgba(127, 191, 163, 0.16)",
    warningSoft: "rgba(224, 184, 115, 0.16)",
    dangerSoft: "rgba(224, 131, 121, 0.16)",
    infoSoft: "rgba(157, 184, 230, 0.16)",
    mintSoft: "rgba(157, 220, 207, 0.18)",
    skySoft: "rgba(157, 184, 230, 0.14)",
    amberSoft: "rgba(224, 184, 115, 0.16)",
    roseSoft: "rgba(224, 131, 121, 0.16)",
    violetSoft: "rgba(198, 182, 238, 0.16)",
} as const satisfies ColorTokens;

/** Default typeface tokens (Geist body, Space Grotesk headings). */
const defaultFonts = {
    bodyRegular: "$body",
    bodyMedium: "$bodyMedium",
    bodySemiBold: "$bodySemiBold",
    bodyBold: "$bodyBold",
    headingMedium: "$headingMedium",
    headingBold: "$headingBold",
    monoMedium: "$monoMedium",
    monoBold: "$monoBold",
} as const;

/** Font token names shared by every typeface set. */
export type FontTokens = Record<keyof typeof defaultFonts, string>;

/**
 * Dyslexia-friendly typeface set. OpenDyslexic ships Regular and Bold only, so
 * medium/semibold map to the nearest available weight; data figures stay
 * monospaced for column alignment.
 */
const dyslexicFonts = {
    bodyRegular: "$dyslexic",
    bodyMedium: "$dyslexic",
    bodySemiBold: "$dyslexicBold",
    bodyBold: "$dyslexicBold",
    headingMedium: "$dyslexicBold",
    headingBold: "$dyslexicBold",
    monoMedium: "$monoMedium",
    monoBold: "$monoBold",
} as const satisfies FontTokens;

const fontWeights = {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
} as const;

const radii = {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    /**
     * Shared corner radius for interactive buttons (option rows, primary/secondary
     * actions, nav pills). Kept deliberately tight so buttons read as a polished,
     * professional app rather than fully-rounded "toy" pills. Tune this single knob
     * to adjust button roundness everywhere; badges/progress tracks/avatars keep
     * their own `full` pill radius.
     */
    button: 10,
    full: 999,
} as const;

const spacing = {
    screenPaddingHorizontal: 15,
    screenPaddingVertical: 16,
} as const;

const lightShadows = {
    card: "0 12px 34px rgba(46, 56, 52, 0.08)",
    accent: "0 10px 24px rgba(86, 108, 98, 0.12)",
} as const;

const darkShadows = {
    card: "0 14px 34px rgba(0, 0, 0, 0.45)",
    accent: "0 10px 24px rgba(0, 0, 0, 0.4)",
} as const;

/**
 * Static light token set.
 *
 * Used by module-level style constants (which cannot call hooks) and remains the
 * default for any surface that has not adopted {@link useDesignSystem}. Screens
 * that need live theme switching should read the hook instead.
 */
export const designSystem = {
    colors: lightColors,
    fonts: defaultFonts,
    fontWeights,
    radii,
    spacing,
    shadows: lightShadows,
} as const;

interface GetDesignSystemOptions {
    readonly fontScale?: number;
    readonly dyslexicFont?: boolean;
}

/**
 * Build a resolved design system for a given theme and accessibility options.
 *
 * The return type is inferred so color and font values keep their literal types
 * and stay assignable to Tamagui's token-constrained props.
 *
 * @param theme Active light or dark theme.
 * @param options Text scale and dyslexia-friendly font selection.
 * @returns Theme-aware tokens.
 */
export function getDesignSystem(theme: ResolvedTheme, options: GetDesignSystemOptions = {}) {
    return {
        colors: theme === "dark" ? darkColors : lightColors,
        fonts: options.dyslexicFont ? dyslexicFonts : defaultFonts,
        fontWeights,
        radii,
        spacing,
        shadows: theme === "dark" ? darkShadows : lightShadows,
        fontScale: options.fontScale ?? 1,
        theme,
    };
}

/** Resolved, theme-aware design tokens consumed across the app. */
export type DesignSystem = ReturnType<typeof getDesignSystem>;

/**
 * Subscribe to the resolved, theme-aware design system.
 *
 * Re-renders the caller whenever the auditor changes theme, text size, or the
 * dyslexia-friendly font preference.
 *
 * @returns Live design tokens for the current preferences.
 */
export function useDesignSystem(): DesignSystem {
    const theme = usePreferencesStore((state) => state.resolvedTheme);
    const fontScale = usePreferencesStore((state) => state.fontScale);
    const dyslexicFont = usePreferencesStore((state) => state.dyslexicFont);

    return useMemo(
        () => getDesignSystem(theme, { fontScale, dyslexicFont }),
        [theme, fontScale, dyslexicFont],
    );
}

/**
 * Shared tone model for chips, badges, and accent surfaces.
 */
export interface DesignTone {
    readonly accent: string;
    readonly surface: string;
    readonly text: string;
}

/**
 * Resolve metric colors into the active palette.
 *
 * @param tone Dashboard metric tone.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the metric.
 */
export function getMetricTone(tone: MetricTone, colors: ColorTokens = lightColors): DesignTone {
    if (tone === "green") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (tone === "purple") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violet };
    }

    if (tone === "orange") {
        return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
    }

    return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
}

/**
 * Resolve place status colors into a consistent badge treatment.
 *
 * @param status Place workflow status.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the status.
 */
export function getPlaceStatusTone(
    status: PlaceStatus,
    colors: ColorTokens = lightColors,
): DesignTone {
    if (status === "submitted") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (status === "ready_for_review") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violet };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
}

/**
 * Resolve pre-audit readiness colors into the active palette.
 *
 * @param status Pre-audit setup status.
 * @param colors Active color tokens (defaults to the light palette).
 * @returns Accent, surface, and text colors for the status.
 */
export function getPreAuditTone(
    status: PreAuditStatus,
    colors: ColorTokens = lightColors,
): DesignTone {
    if (status === "completed") {
        return { accent: colors.success, surface: colors.successSoft, text: colors.success };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primary };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warning };
}
