import { createContext, useContext, useMemo } from "react";
import { useDesignSystem, type ColorTokens, type DomainPalette } from "lib/design-system";
import type { MobileYeeDomainKey } from "lib/yee-mobile-audit-config";

/**
 * Scale a color's opacity, mirroring the web's `/40`-style Tailwind alpha
 * modifiers. Hex colors gain the alpha; rgba colors have their existing alpha
 * multiplied so pre-tinted dark-theme values stay proportional.
 *
 * @param color `#RRGGBB` or `rgba()` color string.
 * @param alpha Opacity multiplier between 0 and 1.
 * @returns The rgba() color string.
 */
export function withAlpha(color: string, alpha: number): string {
    const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgbaMatch !== null) {
        const [, r, g, b, existing] = rgbaMatch;
        return `rgba(${r}, ${g}, ${b}, ${Number(existing) * alpha})`;
    }
    const r = Number.parseInt(color.slice(1, 3), 16);
    const g = Number.parseInt(color.slice(3, 5), 16);
    const b = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Survey palette shared by every audit step. Domain steps (3–8) express their
 * identity through the web's domain hues (`designSystem.domains`, mirroring
 * `--domain-*` in `yee-frontend/globals.css`): tinted section cards, a
 * domain-tinted selected option, and domain intro/progress surfaces. Non-domain
 * steps (context, weighting, final comments) keep the calm brand-green base.
 */
export interface SurveyPalette {
    readonly card: string;
    readonly cardBorder: string;
    readonly inner: string;
    readonly innerBorder: string;
    /**
     * Surface for a single question inside a section card. Deliberately NOT
     * `card`: a question that shares its parent's fill has no boundary, which is
     * why a domain step used to read as one undifferentiated tint. The question
     * card steps to a neutral surface so the domain wash keeps saying "where am
     * I" while the question says "what am I answering".
     */
    readonly questionCard: string;
    readonly questionCardBorder: string;
    /**
     * Left rail on a question card - the spine that binds a prompt to its
     * answers, mirroring the provision rail in the Playspace app. Solid once the
     * question is complete.
     */
    readonly rail: string;
    /**
     * Rail tone while the question is still incomplete - the neutral border tone,
     * so pending/done reads as empty-track vs filled rather than as two strengths
     * of the same hue (which, at these tints, is a distinction of about 1.5:1).
     * Redundant with the radio state inside the card, so color is never the sole
     * carrier of "unanswered" (WCAG 1.4.1).
     */
    readonly railPending: string;
    /**
     * Idle answer chip. Neutral by design: inside a question card the only
     * accent-colored surface should be the answer the auditor actually chose.
     */
    readonly option: string;
    readonly optionBorder: string;
    /** Selected option surface - a tint, not a solid fill (web parity). */
    readonly selected: string;
    readonly selectedBorder: string;
    /** Label color on a selected option. */
    readonly selectedText: string;
    /** Radio/checkbox fill on a selected option. */
    readonly selectedControl: string;
    /** Label color on an idle (unselected) option. */
    readonly optionText: string;
    readonly intro: string;
    readonly introBorder: string;
    /**
     * Solid surface for buttons, dots and rules that may carry light text on top.
     * This is the domain's `strong` step, not `fill`: `fill` is tuned to 3:1 as a
     * chart mark, which is below the 4.5:1 a button label needs.
     */
    readonly accent: string;
    /** Chart/progress fill - a bar nothing is written on, so `fill` is right here. */
    readonly accentFill: string;
    readonly accentText: string;
    readonly mutedAccent: string;
    readonly mutedAccentText: string;
    /** Condition follow-up surface nested under an affirmative answer. */
    /**
     * Rail on the nested follow-up. It has no fill to pair with: every tint
     * available here lands within 1.1:1 of the card it would sit on, and a tinted
     * follow-up panel also swallows the selected chip inside it, which is the
     * same hue. So the follow-up is a rail plus an indent, and this is it - which
     * is why the alpha is tuned to clear 3:1 (WCAG 1.4.11) on the question card
     * in both themes for every domain, rather than left at a decorative weight.
     */
    readonly conditionRail: string;
    readonly progress: string;
    readonly progressTrack: string;
    readonly stepFill: string;
    readonly stepSurface: string;
    readonly stepBorder: string;
    readonly stepText: string;
}

export function getSurveyPalette(colors: ColorTokens, domain?: DomainPalette): SurveyPalette {
    if (domain !== undefined) {
        return {
            // Web section wrapper: `border-domain-strong/20 bg-domain-light/40`.
            card: withAlpha(domain.light, 0.4),
            cardBorder: withAlpha(domain.strong, 0.2),
            inner: colors.input,
            innerBorder: colors.border,
            // A question sits on a neutral card so the tinted section wrapper above
            // it stays readable as a container instead of blending into it. Tint on
            // tint is what made the prompt and its answers read as one green mass.
            questionCard: colors.surface,
            questionCardBorder: withAlpha(domain.strong, 0.18),
            rail: domain.strong,
            railPending: colors.border,
            // Neutral chips on the neutral question card: the domain hue is then
            // free to mean "chosen" rather than "background".
            option: colors.surfaceMuted,
            optionBorder: colors.border,
            // Web selected option: domain-strong border + domain-light tint + domain text.
            selected: domain.light,
            selectedBorder: domain.strong,
            selectedText: domain.text,
            selectedControl: domain.strong,
            optionText: colors.foreground,
            // Web instruction/callout: domain-strong border + domain-light surface.
            intro: domain.light,
            introBorder: domain.strong,
            accent: domain.strong,
            accentFill: domain.fill,
            accentText: domain.text,
            mutedAccent: colors.secondaryForeground,
            mutedAccentText: colors.secondaryForeground,
            conditionRail: withAlpha(domain.strong, 0.75),
            progress: withAlpha(domain.light, 0.5),
            progressTrack: colors.mutedSurface,
            stepFill: colors.primary,
            stepSurface: colors.primarySoft,
            stepBorder: colors.border,
            stepText: colors.primaryText,
        };
    }

    return {
        card: colors.surface,
        cardBorder: colors.border,
        inner: colors.input,
        innerBorder: colors.border,
        // Non-domain sections use the plain `surface` card, so the question steps
        // the other way - down to the muted surface - to keep the same alternation.
        questionCard: colors.surfaceMuted,
        questionCardBorder: colors.border,
        rail: colors.primary,
        railPending: colors.border,
        // Already one step off `surfaceMuted`; non-domain option chips are unchanged.
        option: colors.input,
        optionBorder: colors.border,
        // Web non-domain fallback: `border-yee-green-600 bg-yee-green-50 text-yee-green-900`.
        selected: colors.primarySoft,
        selectedBorder: colors.ring,
        selectedText: colors.primaryText,
        selectedControl: colors.ring,
        optionText: colors.foreground,
        intro: colors.successSoft,
        introBorder: colors.border,
        accent: colors.primary,
        accentFill: colors.primary,
        accentText: colors.primaryText,
        mutedAccent: colors.secondaryForeground,
        mutedAccentText: colors.secondaryForeground,
        conditionRail: withAlpha(colors.primary, 0.75),
        progress: colors.surfaceMuted,
        progressTrack: colors.mutedSurface,
        stepFill: colors.primary,
        stepSurface: colors.primarySoft,
        stepBorder: colors.border,
        stepText: colors.primaryText,
    };
}

/**
 * Active survey domain, provided by the domain step shell so shared primitives
 * (option rows, question cards, progress) pick up the domain hue without prop
 * drilling. `null` on non-domain steps.
 */
export const SurveyDomainContext = createContext<MobileYeeDomainKey | null>(null);

/**
 * Subscribe to the survey palette for the active step. Domain steps resolve
 * their hue from {@link SurveyDomainContext}; everything else gets the brand
 * base. Memoized on the active tokens so a palette object is only recreated
 * when the theme or domain actually changes.
 */
export function useSurveyPalette(): SurveyPalette {
    const designSystem = useDesignSystem();
    const domainKey = useContext(SurveyDomainContext);
    const domain = domainKey === null ? undefined : designSystem.domains[domainKey];
    return useMemo(
        () => getSurveyPalette(designSystem.colors, domain),
        [designSystem.colors, domain],
    );
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
