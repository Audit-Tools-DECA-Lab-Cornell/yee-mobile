import type { YeeScoreResult, YeeSubmissionResponse } from "lib/yee-types";
import { mobileYeeDomainLabels, type MobileYeeDomainKey } from "lib/yee-mobile-audit-config";

/** Em dash rendered wherever a score or its denominator is unavailable. */
export const SCORE_UNAVAILABLE = "—";

/**
 * Precise percent of `value` against `max`, clamped to 0–100.
 *
 * The caller must supply the backend's canonical per-audit maximum; this
 * module never substitutes the current instrument's constants. Aggregate and
 * ranking calculations must use this unrounded value to avoid introducing
 * per-audit rounding errors.
 *
 * Returns `null` when either side is missing/non-finite or `max` is
 * non-positive, matching the web client's `scorePercentage` contract.
 */
export function scorePercentage(value?: number | null, max?: number | null): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) return null;
    return Math.max(0, Math.min(100, (value / max) * 100));
}

/**
 * Whole-number display percentage using {@link scorePercentage}.
 *
 * Returns `null` when the precise percentage is unavailable, so callers can
 * render {@link SCORE_UNAVAILABLE} instead of a fabricated 0%.
 */
export function scorePercent(value?: number | null, max?: number | null): number | null {
    const percentage = scorePercentage(value, max);
    return percentage === null ? null : Math.round(percentage);
}

/**
 * Format a canonical numerator and positive maximum as a secondary fraction.
 * Returns `null` when either side is unusable, so an unavailable percentage is
 * never paired with a misleading `0 / 0` or non-finite denominator.
 */
export function formatScoreFraction(
    value?: number | null,
    max?: number | null,
    fractionDigits = 0,
): string | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) return null;
    if (fractionDigits > 0)
        return `${value.toFixed(fractionDigits)} / ${max.toFixed(fractionDigits)}`;
    return `${value} / ${max}`;
}

export interface MobileSubmissionScorePreview {
    readonly rawDomainScores: Record<MobileYeeDomainKey, number | null>;
    readonly rawDomainMaximums: Record<MobileYeeDomainKey, number | null>;
    readonly weightedDomainScores: Record<MobileYeeDomainKey, number | null>;
    readonly weightedDomainMaximums: Record<MobileYeeDomainKey, number | null>;
    readonly selectedWeights: Record<MobileYeeDomainKey, number | null>;
    readonly totalRawScore: number | null;
    readonly totalRawMax: number | null;
    readonly totalWeightedScore: number | null;
    readonly totalWeightedMax: number | null;
}

export interface MobileDomainScoreRow {
    readonly domain: MobileYeeDomainKey;
    readonly label: string;
    readonly rawScore: number | null;
    readonly rawMax: number | null;
    readonly rawPercentage: number | null;
    readonly weightedScore: number | null;
    readonly weightedMax: number | null;
    readonly weightedPercentage: number | null;
    readonly weightValue: number | null;
}

/**
 * Project a persisted backend score without recreating any scoring data.
 *
 * Missing canonical fields remain `null`. In particular, this must never infer
 * maxima from the bundled instrument or multiply raw scores by current domain
 * weights because historical audits belong to their stored scoring snapshot.
 */
export function buildMobileSubmissionScorePreview(
    score: YeeScoreResult,
): MobileSubmissionScorePreview {
    return {
        rawDomainScores: readDomainNumbers(score.raw_domain_scores),
        rawDomainMaximums: readDomainNumbers(score.raw_domain_maximums),
        weightedDomainScores: readDomainNumbers(score.weighted_domain_scores),
        weightedDomainMaximums: readDomainNumbers(score.weighted_domain_maximums),
        selectedWeights: readDomainNumbers(score.selected_weights),
        totalRawScore:
            readFiniteNumber(score.total_raw_score) ?? readFiniteNumber(score.total_score),
        totalRawMax: readFiniteNumber(score.total_raw_maximum),
        totalWeightedScore: readFiniteNumber(score.total_weighted_score),
        totalWeightedMax: readFiniteNumber(score.total_weighted_maximum),
    };
}

export function buildDomainScoreRows(
    preview: MobileSubmissionScorePreview,
): readonly MobileDomainScoreRow[] {
    return (Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => {
        const rawMax = preview.rawDomainMaximums[domain];
        const weightValue = preview.selectedWeights[domain];
        const weightedMax = preview.weightedDomainMaximums[domain];
        const rawScore = preview.rawDomainScores[domain];
        const weightedScore = preview.weightedDomainScores[domain];

        return {
            domain,
            label: mobileYeeDomainLabels[domain],
            rawScore,
            rawMax,
            rawPercentage: scorePercent(rawScore, rawMax),
            weightedScore,
            weightedMax,
            weightedPercentage: scorePercent(weightedScore, weightedMax),
            weightValue,
        };
    });
}

function readDomainNumbers(
    source: Partial<Record<MobileYeeDomainKey, number>> | undefined,
): Record<MobileYeeDomainKey, number | null> {
    return {
        access: readFiniteNumber(source?.access),
        activitySpaces: readFiniteNumber(source?.activitySpaces),
        amenities: readFiniteNumber(source?.amenities),
        experienceOfSpace: readFiniteNumber(source?.experienceOfSpace),
        aestheticsAndCare: readFiniteNumber(source?.aestheticsAndCare),
        useAndUsability: readFiniteNumber(source?.useAndUsability),
    };
}

function readFiniteNumber(value: number | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getSectionComments(
    participantInfo: Record<string, unknown>,
): Record<MobileYeeDomainKey, string> {
    const raw = participantInfo.section_comments;
    if (!raw || typeof raw !== "object") {
        return {
            access: "",
            activitySpaces: "",
            amenities: "",
            experienceOfSpace: "",
            aestheticsAndCare: "",
            useAndUsability: "",
        };
    }

    return {
        access: readOptionalString((raw as Record<string, unknown>).access) ?? "",
        activitySpaces: readOptionalString((raw as Record<string, unknown>).activitySpaces) ?? "",
        amenities: readOptionalString((raw as Record<string, unknown>).amenities) ?? "",
        experienceOfSpace:
            readOptionalString((raw as Record<string, unknown>).experienceOfSpace) ?? "",
        aestheticsAndCare:
            readOptionalString((raw as Record<string, unknown>).aestheticsAndCare) ?? "",
        useAndUsability: readOptionalString((raw as Record<string, unknown>).useAndUsability) ?? "",
    };
}

export function getWeightingComments(participantInfo: Record<string, unknown>): string {
    return readOptionalString(participantInfo.weighting_comments) ?? "";
}

export function getOverallComments(participantInfo: Record<string, unknown>): string {
    return readOptionalString(participantInfo.comments) ?? "";
}

export function getReadableWeather(participantInfo: Record<string, unknown>): string {
    const value = participantInfo.weather;
    if (Array.isArray(value)) {
        return value.map((entry) => String(entry)).join(", ");
    }
    return readOptionalString(value) ?? "Not recorded";
}

export function formatAuditTimestamp(value: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        return value;
    }

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(parsed));
}

export function buildSubmissionCsv(submission: YeeSubmissionResponse): string {
    const row: Record<string, string | number> = {
        audit_id: submission.id,
        auditor_generated_id: submission.auditor_generated_id ?? submission.auditor_id,
        place_id: submission.place_id,
        place_name: submission.place_name ?? submission.place_id,
        submitted_at: submission.submitted_at,
        total_raw_score: submission.score.total_score,
    };

    for (const [key, value] of Object.entries(submission.participant_info)) {
        row[`participant_${key}`] =
            typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    }

    for (const [key, value] of Object.entries(submission.responses)) {
        row[key] = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    }

    const headers = Object.keys(row);
    return [
        headers.join(","),
        headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","),
    ].join("\n");
}

function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
}
