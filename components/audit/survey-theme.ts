import { useMemo } from "react";
import { useDesignSystem, type ColorTokens } from "lib/design-system";

/**
 * Single brand survey palette shared by every audit step. Domain identity is
 * expressed through structure (cards, the active step, progress) rather than a
 * unique hue per section, keeping the survey calm and on-brand (green on cream).
 */
export interface SurveyPalette {
    readonly card: string;
    readonly cardBorder: string;
    readonly inner: string;
    readonly innerBorder: string;
    readonly selected: string;
    readonly selectedBorder: string;
    readonly intro: string;
    readonly introBorder: string;
    readonly accent: string;
    readonly accentText: string;
    readonly mutedAccent: string;
    readonly mutedAccentText: string;
    readonly progress: string;
    readonly progressTrack: string;
    readonly stepFill: string;
    readonly stepSurface: string;
    readonly stepBorder: string;
    readonly stepText: string;
}

export function getSurveyPalette(colors: ColorTokens): SurveyPalette {
    return {
        card: colors.surface,
        cardBorder: colors.border,
        inner: colors.input,
        innerBorder: colors.border,
        selected: colors.primary,
        selectedBorder: colors.primary,
        intro: colors.successSoft,
        introBorder: colors.border,
        accent: colors.primary,
        accentText: colors.primaryText,
        mutedAccent: colors.secondaryForeground,
        mutedAccentText: colors.secondaryForeground,
        progress: colors.surfaceMuted,
        progressTrack: colors.mutedSurface,
        stepFill: colors.primary,
        stepSurface: colors.primarySoft,
        stepBorder: colors.border,
        stepText: colors.primaryText,
    };
}

/**
 * Subscribe to the shared survey palette. Memoized on the active color tokens so
 * a palette object is only recreated when the theme actually changes.
 */
export function useSurveyPalette(): SurveyPalette {
    const designSystem = useDesignSystem();
    return useMemo(() => getSurveyPalette(designSystem.colors), [designSystem.colors]);
}

/** Per-step completion state used by the persistent stepper rail. */
export type StepStatus = "current" | "done" | "incomplete" | "empty";

export interface StepTone {
    readonly surface: string;
    readonly border: string;
    readonly text: string;
    /** Dot/indicator color; null when no indicator should render. */
    readonly indicator: string | null;
}

/**
 * Resolve the stepper pill treatment for a step's status. `current` is the solid
 * brand chip; `done` reads as a soft success chip with a check; `incomplete`
 * carries a warning dot so unfinished visited steps are discoverable up front;
 * `empty` stays neutral.
 */
export function getStepTone(status: StepStatus, colors: ColorTokens): StepTone {
    switch (status) {
        case "current":
            return {
                surface: colors.primary,
                border: colors.primary,
                text: colors.primaryForeground,
                indicator: null,
            };
        case "done":
            return {
                surface: colors.successSoft,
                border: colors.border,
                text: colors.successText,
                indicator: colors.success,
            };
        case "incomplete":
            return {
                surface: colors.surfaceMuted,
                border: colors.warning,
                text: colors.secondaryForeground,
                indicator: colors.warning,
            };
        default:
            return {
                surface: colors.surfaceMuted,
                border: colors.border,
                text: colors.mutedForeground,
                indicator: null,
            };
    }
}
