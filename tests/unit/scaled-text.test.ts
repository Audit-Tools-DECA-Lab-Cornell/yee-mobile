import { describe, expect, it, vi } from "vitest";
import { getEffectiveFontScale, TABLET_TYPOGRAPHY_BASE_SCALE } from "lib/responsive-layout";

vi.mock("react-native", () => ({
    useWindowDimensions: () => ({ width: 390, height: 844 }),
}));

describe("getEffectiveFontScale", () => {
    it("keeps the stored preference untouched on phones", () => {
        // Given: a phone viewport with the default text-size preference.
        // When/Then: the effective scale is the bare preference.
        expect(getEffectiveFontScale(1, false)).toBe(1);
    });

    it("applies the tablet baseline scale at the default preference", () => {
        // Given: a tablet viewport with the default text-size preference.
        // When/Then: the effective scale is the tablet baseline.
        expect(getEffectiveFontScale(1, true)).toBe(1.3);
        expect(getEffectiveFontScale(1, true)).toBe(TABLET_TYPOGRAPHY_BASE_SCALE);
    });

    it("renders a 16px size at 21px on tablets after rounding", () => {
        // Given: ScaledText rounds numeric sizes after scaling.
        // When/Then: a 16px heading resolves to 21px on tablets.
        expect(Math.round(16 * getEffectiveFontScale(1, true))).toBe(21);
    });

    it("composes the tablet baseline with a raised preference", () => {
        // Given: an auditor-raised text-size preference on a tablet.
        // When/Then: both multipliers compound.
        expect(getEffectiveFontScale(1.6, true)).toBe(1.6 * 1.3);
    });
});
