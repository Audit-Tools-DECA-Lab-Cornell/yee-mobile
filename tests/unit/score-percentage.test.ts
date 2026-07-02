/**
 * Guards the raw-score → percentage conversion used by every summary surface
 * (reports list, metric cards, Execute score, progress bars). `total_score` is
 * a RAW total out of `totalRawScoreMaximum` (125), NOT a percentage — appending
 * `%` to the raw value produced impossible figures like "121%". These tests pin
 * the conversion so that regression cannot come back.
 */

import { describe, expect, it } from "vitest";
import { toScorePercentage, totalRawScoreMaximum } from "lib/yee-mobile-reporting";

describe("totalRawScoreMaximum", () => {
    it("is the summed domain raw maximums (125)", () => {
        expect(totalRawScoreMaximum).toBe(125);
    });
});

describe("toScorePercentage", () => {
    it("converts a raw score to a whole-number percentage of the maximum", () => {
        // 121 / 125 = 96.8 -> 97, never "121%".
        expect(toScorePercentage(121)).toBe(97);
        // 56 / 125 = 44.8 -> 45 (matches the report detail breakdown).
        expect(toScorePercentage(56)).toBe(45);
    });

    it("maps the full raw score to 100 and zero to 0", () => {
        expect(toScorePercentage(totalRawScoreMaximum)).toBe(100);
        expect(toScorePercentage(0)).toBe(0);
    });

    it("never exceeds 100 or drops below 0", () => {
        expect(toScorePercentage(totalRawScoreMaximum + 50)).toBe(100);
        expect(toScorePercentage(-10)).toBe(0);
    });

    it("returns 0 for non-finite input", () => {
        expect(toScorePercentage(Number.NaN)).toBe(0);
        expect(toScorePercentage(Number.POSITIVE_INFINITY)).toBe(0);
    });
});
