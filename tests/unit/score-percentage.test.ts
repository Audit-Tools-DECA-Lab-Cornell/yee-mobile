/**
 * Guards the single canonical raw-score percentage conversion used by every
 * persisted-score surface. Each conversion must use the maximum returned for
 * that audit and must stay unavailable when the maximum cannot be trusted.
 */

import { describe, expect, it } from "vitest";
import {
    buildDomainScoreRows,
    buildMobileSubmissionScorePreview,
    formatScoreFraction,
    scorePercent,
} from "lib/yee-mobile-reporting";
import type { YeeScoreResult } from "lib/yee-types";

describe("buildMobileSubmissionScorePreview", () => {
    it("uses backend canonical score fields without recomputing them", () => {
        const score: YeeScoreResult = {
            total_score: 35,
            section_scores: {
                "Access: Presence, Condition, Provision": 10,
                "Activity Spaces: Presence, Condition, Provision": 25,
            },
            category_scores: { Score: 35 },
            matched_scored_answers: 12,
            total_raw_score: 35,
            total_raw_maximum: 122,
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
                useAndUsability: 15,
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

        const preview = buildMobileSubmissionScorePreview(score);
        const rows = buildDomainScoreRows(preview);

        expect(preview.totalRawScore).toBe(35);
        expect(preview.totalRawMax).toBe(122);
        expect(preview.totalWeightedScore).toBe(0.7);
        expect(preview.totalWeightedMax).toBe(1.76);
        expect(scorePercent(preview.totalWeightedScore, preview.totalWeightedMax)).toBe(40);
        expect(rows.find((row) => row.domain === "access")?.weightedMax).toBe(0.54);
    });

    it("leaves missing canonical maxima and domain data unavailable", () => {
        const preview = buildMobileSubmissionScorePreview({
            total_score: 35,
            section_scores: {
                "Access: Presence, Condition, Provision": 35,
            },
            category_scores: { Score: 35 },
            matched_scored_answers: 1,
        });
        const access = buildDomainScoreRows(preview).find((row) => row.domain === "access");

        expect(preview.totalRawScore).toBe(35);
        expect(preview.totalRawMax).toBeNull();
        expect(preview.totalWeightedScore).toBeNull();
        expect(access?.rawScore).toBeNull();
        expect(access?.rawMax).toBeNull();
        expect(access?.rawPercentage).toBeNull();
    });
});

/**
 * `scorePercent` divides by the maximum the audit was actually scored out of,
 * so a submission carrying its own `total_raw_maximum` is never measured
 * against a bundled constant. It must round exactly like the web
 * client's `scorePercent` (src/lib/score-format.ts) or the same audit reports
 * two different percentages on the two surfaces.
 */
describe("scorePercent", () => {
    it("divides by the supplied per-audit maximum", () => {
        expect(scorePercent(18, 122)).toBe(15);
        expect(scorePercent(61, 122)).toBe(50);
    });

    it("returns null rather than a fabricated 0% when either input is unusable", () => {
        expect(scorePercent(18, 0)).toBeNull();
        expect(scorePercent(18, -1)).toBeNull();
        expect(scorePercent(18, null)).toBeNull();
        expect(scorePercent(18, undefined)).toBeNull();
        expect(scorePercent(null, 122)).toBeNull();
        expect(scorePercent(Number.NaN, 122)).toBeNull();
        expect(scorePercent(Number.NEGATIVE_INFINITY, 122)).toBeNull();
        expect(scorePercent(18, Number.POSITIVE_INFINITY)).toBeNull();
    });

    it("clamps out-of-range scores to 0-100", () => {
        expect(scorePercent(200, 122)).toBe(100);
        expect(scorePercent(-5, 122)).toBe(0);
    });

    it("rounds half-up the same way the web client does", () => {
        // 0.28/2.22 = 12.6% -> 13, matching the web report card.
        expect(scorePercent(0.28, 2.22)).toBe(13);
        expect(scorePercent(64, 122)).toBe(52);
    });
});

describe("formatScoreFraction", () => {
    it("formats a raw fraction", () => {
        expect(formatScoreFraction(18, 122)).toBe("18 / 122");
    });

    it("formats a weighted fraction to two decimals", () => {
        expect(formatScoreFraction(0.28, 2.22, 2)).toBe("0.28 / 2.22");
    });

    it("returns null when either side is missing, so the caller omits the line", () => {
        expect(formatScoreFraction(18, null)).toBeNull();
        expect(formatScoreFraction(null, 122)).toBeNull();
        expect(formatScoreFraction(18, Number.NaN)).toBeNull();
    });

    it("omits fractions with non-positive maxima", () => {
        expect(formatScoreFraction(0, 0)).toBeNull();
        expect(formatScoreFraction(1, -1)).toBeNull();
        expect(scorePercent(0, 0)).toBeNull();
    });
});
