import { describe, expect, it, vi } from "vitest";
import { designSystem, getDesignSystem, getScoreBandTone, scoreBandKey } from "lib/design-system";
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
        // Light bands are the web-exact hex conversions of the OKLCH tokens.
        expect(getScoreBandTone(80, light.scoreBands).accent).toBe("#2B7351");
        expect(getScoreBandTone(50, light.scoreBands).accent).toBe("#B18C39");
        expect(getScoreBandTone(10, light.scoreBands).accent).toBe("#B1604C");
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

    it("anchors the access domain to the brand-green hue family", () => {
        // Web: --domain-access-* at hue 158 (matches the brand green).
        expect(designSystem.domains.access.light).toBe("#E1F4E8");
        expect(designSystem.domains.access.strong).toBe("#2B7A52");
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
    });

    it("derives the web option/intro/progress treatment from a domain palette", () => {
        const domain = designSystem.domains.amenities;
        const palette = getSurveyPalette(designSystem.colors, domain);
        expect(palette.selected).toBe(domain.light);
        expect(palette.selectedBorder).toBe(domain.strong);
        expect(palette.selectedText).toBe(domain.text);
        expect(palette.accent).toBe(domain.fill);
        expect(palette.intro).toBe(domain.light);
        // `/40`-style alpha tints, mirroring web's bg-domain-light/40 wrapper.
        expect(palette.card).toBe(withAlpha(domain.light, 0.4));
        expect(palette.cardBorder).toBe(withAlpha(domain.strong, 0.2));
    });

    it("scales alpha correctly for hex and pre-tinted rgba colors", () => {
        expect(withAlpha("#FF0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
        // Dark-theme domain tints are already rgba; alpha compounds.
        expect(withAlpha("rgba(10, 20, 30, 0.16)", 0.5)).toBe("rgba(10, 20, 30, 0.08)");
    });
});
