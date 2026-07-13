import { describe, expect, it } from "vitest";
import { OPTION_GRID_TWO_UP_LABEL_MAX, shouldRenderOptionsTwoUp } from "lib/audit-option-grid";

// Representative option sets from the instrument: short presence answers and
// seasons vs. sentence-length visit-frequency descriptions.
const SHORT_SINGLE_SELECT = [{ label: "Yes" }, { label: "No" }, { label: "I'm not sure" }] as const;
const SEASONS = [
    { label: "Spring" },
    { label: "Summer" },
    { label: "Fall" },
    { label: "Winter" },
] as const;
const LONG_ANSWERS = [
    { label: "Only a few times (less than once a month)" },
    { label: "I have not been here in the last 6 months" },
] as const;

describe("shouldRenderOptionsTwoUp", () => {
    it("keeps phones single-column no matter how short the labels are", () => {
        // Given: the phone tier. When/Then: never 2-up (phone column is narrow).
        expect(shouldRenderOptionsTwoUp(SHORT_SINGLE_SELECT, false)).toBe(false);
        expect(shouldRenderOptionsTwoUp(SEASONS, false)).toBe(false);
    });

    it("renders short single-select and multi-select answers 2-up on tablet", () => {
        expect(shouldRenderOptionsTwoUp(SHORT_SINGLE_SELECT, true)).toBe(true);
        expect(shouldRenderOptionsTwoUp(SEASONS, true)).toBe(true);
    });

    it("stays single-column on tablet when every label is sentence-length", () => {
        expect(shouldRenderOptionsTwoUp(LONG_ANSWERS, true)).toBe(false);
    });

    it("collapses a mixed short + long set to a single column on tablet", () => {
        // A single long option would wrap awkwardly in a half-width cell, so the
        // whole set keeps full-width rows.
        expect(shouldRenderOptionsTwoUp([{ label: "Yes" }, LONG_ANSWERS[0]], true)).toBe(false);
    });

    it("never 2-ups a lone option", () => {
        expect(shouldRenderOptionsTwoUp([{ label: "Yes" }], true)).toBe(false);
    });

    it("treats a label exactly at the threshold as short (inclusive)", () => {
        const atMax = "x".repeat(OPTION_GRID_TWO_UP_LABEL_MAX);
        expect(atMax.length).toBe(OPTION_GRID_TWO_UP_LABEL_MAX);
        expect(shouldRenderOptionsTwoUp([{ label: atMax }, { label: "No" }], true)).toBe(true);
    });

    it("treats one character over the threshold as long", () => {
        const overMax = "x".repeat(OPTION_GRID_TWO_UP_LABEL_MAX + 1);
        expect(shouldRenderOptionsTwoUp([{ label: overMax }, { label: "No" }], true)).toBe(false);
    });

    it("measures the trimmed label so padding whitespace does not force one column", () => {
        const padded = `  ${"x".repeat(OPTION_GRID_TWO_UP_LABEL_MAX)}  `;
        expect(shouldRenderOptionsTwoUp([{ label: padded }, { label: "No" }], true)).toBe(true);
    });
});
