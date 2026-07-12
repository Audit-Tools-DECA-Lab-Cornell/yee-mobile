import { describe, expect, it } from "vitest";
import { createResponsiveLayoutTokens } from "lib/responsive-layout-tokens";

// Pure token derivation — no react-native dependency, so it needs no window mock.
describe("createResponsiveLayoutTokens — Samsung Tab S5e narrow-tablet band (~800dp)", () => {
    const tab = createResponsiveLayoutTokens(800);

    it("classifies 800dp as a narrow tablet", () => {
        expect(tab.isTablet).toBe(true);
        expect(tab.isNarrowTablet).toBe(true);
        expect(tab.isWideTablet).toBe(false);
    });

    it("uses the recalibrated denser narrow-tablet spacing (not a waypoint to 960)", () => {
        // MIN band lowered to 24/20 padding + 24 sectionGap; at 800dp (≈56% up the
        // 600→960 curve) that lands denser than the previous 32/26/30.
        expect(tab.screenPaddingHorizontal).toBe(31);
        expect(tab.screenPaddingVertical).toBe(24);
        expect(tab.sectionGap).toBe(28);
    });

    it("caps the survey form at 600 and the readable column at 760", () => {
        expect(tab.formMaxWidth).toBe(600);
        expect(tab.readableMaxWidth).toBe(760);
    });

    it("grows form control heights with the tier at 800dp", () => {
        expect(tab.buttonHeight).toBe(58);
        expect(tab.controlHeight).toBe(59);
        expect(tab.formOptionHeight).toBe(50);
    });
});

describe("createResponsiveLayoutTokens — phone tier stays pixel-stable", () => {
    const phone = createResponsiveLayoutTokens(390);

    it("keeps phone control heights and spacing unchanged", () => {
        expect(phone.isTablet).toBe(false);
        expect(phone.buttonHeight).toBe(52);
        expect(phone.controlHeight).toBe(56);
        expect(phone.formOptionHeight).toBe(42);
        expect(phone.screenPaddingHorizontal).toBe(16);
        expect(phone.screenPaddingVertical).toBe(16);
        expect(phone.sectionGap).toBe(20);
    });
});

describe('createResponsiveLayoutTokens — iPad Pro 13" wide tablet (1024dp) not regressed', () => {
    const wide = createResponsiveLayoutTokens(1024);

    it("keeps the 960 MAX spacing and control heights on wide tablets", () => {
        expect(wide.isWideTablet).toBe(true);
        expect(wide.screenPaddingHorizontal).toBe(36);
        expect(wide.sectionGap).toBe(32);
        expect(wide.buttonHeight).toBe(60);
        expect(wide.controlHeight).toBe(62);
    });
});
