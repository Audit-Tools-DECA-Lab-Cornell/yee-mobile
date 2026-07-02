import { useMemo } from "react";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import type { MetricTone, PlaceStatus, PreAuditStatus } from "./yee-demo-data";

/**
 * Cool near-white light palette used as the product's default appearance.
 * Derived from the web app's brand tokens (`yee-frontend/globals.css`); see
 * `review/DESIGN_SYNC.md` §1. Semantic accents (`success`/`warning`/…) are
 * fills only — text uses the AA-verified `*Text` tokens.
 */
export const lightColors = {
    background: "#F5F7F9",
    backgroundAccent: "#F0F7F2",
    foreground: "#07090B",
    primary: "#001F10",
    primaryForeground: "#F8F8F8",
    surface: "#FFFFFF",
    surfaceMuted: "#F1F4F6",
    mutedSurface: "#EDF1F4",
    input: "#FBFCFE",
    border: "#D4D8DB",
    mutedForeground: "#636A6F",
    secondaryForeground: "#4D5966",
    ring: "#224C37",
    success: "#5E9C83",
    warning: "#C89A57",
    danger: "#B5483D",
    info: "#7B9ED9",
    mint: "#9DDCCF",
    sky: "#DFE9FB",
    amber: "#F8E6BE",
    rose: "#F6DADF",
    violet: "#C6B6EE",
    successText: "#35735C",
    warningText: "#8A5F16",
    dangerText: "#B2453A",
    infoText: "#4969A0",
    violetText: "#726395",
    primaryText: "#001F10",
    overlay: "rgba(245, 247, 249, 0.92)",
    primarySoft: "rgba(0, 31, 16, 0.06)",
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
    ring: "#558F6E",
    success: "#7FBFA3",
    warning: "#E0B873",
    danger: "#E08379",
    info: "#9DB8E6",
    mint: "#9DDCCF",
    sky: "#9DB8E6",
    amber: "#E0B873",
    rose: "#E08379",
    violet: "#C6B6EE",
    successText: "#7FBFA3",
    warningText: "#E0B873",
    dangerText: "#E08379",
    infoText: "#9DB8E6",
    violetText: "#C6B6EE",
    primaryText: "#7FBFA3",
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

/** Default typeface tokens (Geist body and headings). */
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

/**
 * Web-synced radius scale (`review/DESIGN_SYNC.md` §4). Cards cap at `lg`;
 * `full` is reserved for pill badges and status dots only.
 */
const radii = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
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
    screenPaddingHorizontal: 16,
    screenPaddingVertical: 16,
} as const;

/**
 * Web-synced three-tier elevation scale (`review/DESIGN_SYNC.md` §5):
 * `card` for resting cards, `elevated` for dropdowns/toasts/CTA emphasis,
 * `panel` for sheets and modals.
 */
const lightShadows = {
    card: "0 1px 3px rgba(7, 9, 11, 0.08), 0 1px 2px rgba(7, 9, 11, 0.06)",
    elevated: "0 4px 12px rgba(7, 9, 11, 0.10), 0 2px 6px rgba(7, 9, 11, 0.06)",
    panel: "0 8px 24px rgba(7, 9, 11, 0.12), 0 4px 10px rgba(7, 9, 11, 0.08)",
    /** @deprecated Use elevated. */
    accent: "0 4px 12px rgba(7, 9, 11, 0.10), 0 2px 6px rgba(7, 9, 11, 0.06)",
} as const;

/** Shadow tier names shared by every theme. */
export type ShadowTokens = Record<keyof typeof lightShadows, string>;

const darkShadows = {
    card: "0 1px 3px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.40)",
    elevated: "0 4px 12px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.35)",
    panel: "0 8px 24px rgba(0, 0, 0, 0.50), 0 4px 10px rgba(0, 0, 0, 0.40)",
    /** @deprecated Use elevated. */
    accent: "0 4px 12px rgba(0, 0, 0, 0.40), 0 2px 6px rgba(0, 0, 0, 0.35)",
} as const satisfies ShadowTokens;

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
 *
 * `accent` is a fill/border color and `surface` its soft backdrop; `text` is
 * the AA-verified `*Text` token and is the only member safe to use as type.
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
        return { accent: colors.success, surface: colors.successSoft, text: colors.successText };
    }

    if (tone === "purple") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violetText };
    }

    if (tone === "orange") {
        return { accent: colors.warning, surface: colors.warningSoft, text: colors.warningText };
    }

    return { accent: colors.primary, surface: colors.primarySoft, text: colors.primaryText };
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
        return { accent: colors.success, surface: colors.successSoft, text: colors.successText };
    }

    if (status === "ready_for_review") {
        return { accent: colors.violet, surface: colors.violetSoft, text: colors.violetText };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primaryText };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warningText };
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
        return { accent: colors.success, surface: colors.successSoft, text: colors.successText };
    }

    if (status === "in_progress") {
        return { accent: colors.primary, surface: colors.primarySoft, text: colors.primaryText };
    }

    return { accent: colors.warning, surface: colors.warningSoft, text: colors.warningText };
}
