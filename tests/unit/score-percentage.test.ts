/**
 * Guards the raw-score → percentage conversion used by every summary surface
 * (reports list, metric cards, Execute score, progress bars). `total_score` is
 * a RAW total out of `totalRawScoreMaximum` (125), NOT a percentage — appending
 * `%` to the raw value produced impossible figures like "121%". These tests pin
 * the conversion so that regression cannot come back.
 */

import { describe, expect, it } from "vitest";
import {
    buildDomainScoreRows,
    buildMobileSubmissionScorePreview,
    toScorePercentage,
    totalRawScoreMaximum,
} from "lib/yee-mobile-reporting";
import type { YeeScoreResult } from "lib/yee-types";

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

describe("buildMobileSubmissionScorePreview", () => {
    it("uses backend canonical weighted scores instead of multiplying raw score by selected weight", () => {
        const score: YeeScoreResult = {
            total_score: 35,
            section_scores: {
                "Access: Presence, Condition, Provision": 10,
                "Activity Spaces: Presence, Condition, Provision": 25,
            },
            category_scores: { Score: 35 },
            matched_scored_answers: 12,
            total_raw_score: 35,
            total_raw_maximum: 125,
            raw_domain_scores: {
                access: 10,
                activitySpaces: 25,
                amenities: 0,
                experienceOfSpace: 0,
                aestheticsAndCare: 0,
                useAndUsability: 0,
            },
            raw_domain_maximums: {
                access: 14,
                activitySpaces: 26,
                amenities: 23,
                experienceOfSpace: 20,
                aestheticsAndCare: 24,
                useAndUsability: 18,
            },
            total_weighted_score: 0.7,
            total_weighted_maximum: 1.76,
            weighted_domain_scores: {
                access: 0.3,
                activitySpaces: 0.4,
                amenities: 0,
                experienceOfSpace: 0,
                aestheticsAndCare: 0,
                useAndUsability: 0,
            },
            weighted_domain_maximums: {
                access: 0.54,
                activitySpaces: 0.42,
                amenities: 0.31,
                experienceOfSpace: 0.22,
                aestheticsAndCare: 0.18,
                useAndUsability: 0.09,
            },
            selected_weights: {
                access: 3,
                activitySpaces: 3,
                amenities: 2,
                experienceOfSpace: 1,
                aestheticsAndCare: 1,
                useAndUsability: 1,
            },
        };

        const preview = buildMobileSubmissionScorePreview(score, {
            domain_weights: score.selected_weights,
        });
        const rows = buildDomainScoreRows(preview);

        expect(preview.totalRawScore).toBe(35);
        expect(preview.totalRawMax).toBe(125);
        expect(preview.totalWeightedScore).toBe(0.7);
        expect(preview.totalWeightedMax).toBe(1.76);
        expect(Math.round((preview.totalWeightedScore / preview.totalWeightedMax) * 100)).toBe(40);
        expect(rows.find((row) => row.domain === "access")?.weightedMax).toBe(0.54);
    });
});
