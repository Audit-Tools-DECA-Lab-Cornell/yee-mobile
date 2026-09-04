import { describe, expect, it, vi } from "vitest";
import { designSystem, getDesignSystem, getScoreBandTone, scoreBandKey } from "lib/design-system";
import { domainPalette } from "lib/domain-palette";
import { getSurveyPalette, withAlpha } from "components/audit/survey-theme";
import { mobileYeeDomainLabels } from "lib/yee-mobile-audit-config";

vi.mock("react-native", () => ({
    Appearance: {
        getColorScheme: () => "light",
        addChangeListener: () => ({ remove: () => undefined }),
    },
}));

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const RGBA_COLOR = /^rgba\(\d+, \d+, \d+, [\d.]+\)$/;

describe("score bands — web-shared thresholds (yee-frontend/src/lib/score-band.ts)", () => {
    it("maps percentages to low below 34, mid below 67, high otherwise", () => {
        expect(scoreBandKey(0)).toBe("low");
        expect(scoreBandKey(33.9)).toBe("low");
        expect(scoreBandKey(34)).toBe("mid");
        expect(scoreBandKey(66.9)).toBe("mid");
        expect(scoreBandKey(67)).toBe("high");
        expect(scoreBandKey(100)).toBe("high");
    });

    it("resolves themed tones for both appearances", () => {
        const light = getDesignSystem("light");
        const dark = getDesignSystem("dark");
        // Light fills match the web and keep darker text colors for legibility.
        expect(getScoreBandTone(80, light.scoreBands).accent).toBe("#22C55E");
        expect(getScoreBandTone(50, light.scoreBands).accent).toBe("#FACC15");
        expect(getScoreBandTone(10, light.scoreBands).accent).toBe("#EF4444");
        expect(getScoreBandTone(80, light.scoreBands).text).toBe("#166534");
        expect(getScoreBandTone(50, light.scoreBands).text).toBe("#854D0E");
        expect(getScoreBandTone(10, light.scoreBands).text).toBe("#991B1B");
        // Dark bands brighten for dark surfaces and tint their backdrops.
        expect(getScoreBandTone(80, dark.scoreBands).accent).toMatch(HEX_COLOR);
        expect(getScoreBandTone(80, dark.scoreBands).surface).toMatch(RGBA_COLOR);
    });
});

describe("domain palettes — web --domain-* parity", () => {
    const domainKeys = Object.keys(mobileYeeDomainLabels) as (keyof typeof mobileYeeDomainLabels)[];

    it("defines all four roles for every survey domain in both themes", () => {
        for (const theme of ["light", "dark"] as const) {
            const { domains } = getDesignSystem(theme);
            for (const key of domainKeys) {
                const palette = domains[key];
                expect(palette.text).toBeTruthy();
                expect(palette.strong).toBeTruthy();
                expect(palette.fill).toBeTruthy();
                expect(palette.light).toBeTruthy();
            }
        }
    });

    it("serves every role straight from the shared spec, in both themes", () => {
        // Parity with the web is now structural rather than a copied literal: both
        // repos read the same `domain-palette.json`, and the checksum test in each
        // fails if the two copies drift. See tests/unit/domain-palette.test.ts.
        for (const theme of ["light", "dark"] as const) {
            const { domains } = getDesignSystem(theme);
            for (const key of domainKeys) {
                expect(domains[key]).toEqual(domainPalette[theme][key]);
            }
        }
    });
});

describe("chart tokens — web --chart-* parity", () => {
    it("provides five categorical series led by brand green, plus scaffold colors", () => {
        for (const theme of ["light", "dark"] as const) {
            const { charts } = getDesignSystem(theme);
            expect(charts.series).toHaveLength(5);
            expect(charts.grid).toMatch(HEX_COLOR);
            expect(charts.axis).toMatch(HEX_COLOR);
        }
        expect(designSystem.charts.series[0]).toBe("#1A6444");
    });
});

describe("control radius — web --radius-control parity", () => {
    it("keeps interactive controls at the 8px control radius and cards at md/lg", () => {
        expect(designSystem.radii.button).toBe(8);
        expect(designSystem.radii.md).toBe(10);
        expect(designSystem.radii.lg).toBe(14);
    });
});

describe("survey palette — domain-aware theming", () => {
    it("keeps the brand base for non-domain steps", () => {
        const base = getSurveyPalette(designSystem.colors);
        expect(base.selected).toBe(designSystem.colors.primarySoft);
        expect(base.selectedBorder).toBe(designSystem.colors.ring);
        expect(base.optionText).toBe(designSystem.colors.foreground);
        // Non-domain option chips are unchanged; only the question card steps down.
        expect(base.option).toBe(designSystem.colors.input);
        expect(base.questionCard).toBe(designSystem.colors.surfaceMuted);
        expect(base.rail).toBe(designSystem.colors.primary);
    });

    it("derives the web option/intro/progress treatment from a domain palette", () => {
        const domain = designSystem.domains.amenities;
        const palette = getSurveyPalette(designSystem.colors, domain);
        expect(palette.selected).toBe(domain.light);
        expect(palette.selectedBorder).toBe(domain.strong);
        expect(palette.selectedText).toBe(domain.text);
        // `accent` backs solid surfaces that carry light text, so it is the 4.5:1
        // `strong` step; the vivid `fill` is reserved for bars nothing sits on.
        expect(palette.accent).toBe(domain.strong);
        expect(palette.accentFill).toBe(domain.fill);
        expect(palette.intro).toBe(domain.light);
        // `/40`-style alpha tints, mirroring web's bg-domain-light/40 wrapper.
        expect(palette.card).toBe(withAlpha(domain.light, 0.4));
        expect(palette.cardBorder).toBe(withAlpha(domain.strong, 0.2));
    });

    it("never stacks a question card on the tint of the section that holds it", () => {
        const domain = designSystem.domains.amenities;
        const palette = getSurveyPalette(designSystem.colors, domain);
        // The bug this guards: `questionCard === card` gives a nested question no
        // boundary, so a prompt and its answers read as one undifferentiated tint.
        expect(palette.questionCard).not.toBe(palette.card);
        expect(palette.questionCard).toBe(designSystem.colors.surface);
        // Chips must also differ from the card they sit on, or they disappear.
        expect(palette.option).not.toBe(palette.questionCard);
        expect(palette.option).toBe(designSystem.colors.surfaceMuted);
    });

    it("gives every domain its own rail, straight from the domain palette", () => {
        // The rail is the one part of a question card that carries domain identity,
        // so it must come from `domain.strong` for each of the six domains rather
        // than any fixed colour. A duplicate here means a hard-coded rail slipped in.
        const keys = Object.keys(designSystem.domains) as (keyof typeof designSystem.domains)[];
        const rails = keys.map(
            (key) => getSurveyPalette(designSystem.colors, designSystem.domains[key]).rail,
        );
        expect(new Set(rails).size).toBe(keys.length);
        for (const key of keys) {
            const palette = getSurveyPalette(designSystem.colors, designSystem.domains[key]);
            expect(palette.rail).toBe(designSystem.domains[key].strong);
            expect(palette.conditionRail).toBe(withAlpha(designSystem.domains[key].strong, 0.75));
            // Pending is deliberately the shared neutral track: two strengths of one
            // domain hue differ by ~1.5:1, which does not read as a state change.
            expect(palette.railPending).toBe(designSystem.colors.border);
            expect(palette.railPending).not.toBe(palette.rail);
        }
    });

    it("orders the question and follow-up rails by weight, not just position", () => {
        const domain = designSystem.domains.amenities;
        const palette = getSurveyPalette(designSystem.colors, domain);
        expect(palette.rail).toBe(domain.strong);
        // Pending is the neutral track tone, not a weaker tint of the same hue:
        // two strengths of one tint differ by ~1.5:1 here, which does not read.
        expect(palette.railPending).toBe(designSystem.colors.border);
        // A nested follow-up rail stays the same hue but never as strong as the
        // question rail it hangs off.
        // 0.75 is the lowest alpha that clears 3:1 on the question card for every
        // domain in both themes; below it the rail is decoration, not structure.
        expect(palette.conditionRail).toBe(withAlpha(domain.strong, 0.75));
        expect(palette.conditionRail).not.toBe(palette.rail);
    });

    it("scales alpha correctly for hex and pre-tinted rgba colors", () => {
        expect(withAlpha("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
        // Dark-theme domain tints are already rgba; alpha compounds.
        expect(withAlpha("rgba(10, 20, 30, 0.16)", 0.5)).toBe("rgba(10, 20, 30, 0.08)");
    });
});
