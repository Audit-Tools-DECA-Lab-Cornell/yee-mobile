import type { YeeScoreResult, YeeSubmissionResponse } from "lib/yee-types";
import { mobileYeeDomainLabels, type MobileYeeDomainKey } from "lib/yee-mobile-audit-config";

export const rawDomainScoreMaximums: Record<MobileYeeDomainKey, number> = {
    access: 14,
    activitySpaces: 26,
    amenities: 23,
    experienceOfSpace: 20,
    aestheticsAndCare: 24,
    useAndUsability: 18,
};

export const totalRawScoreMaximum = Object.values(rawDomainScoreMaximums).reduce(
    (sum, value) => sum + value,
    0,
);
export const totalYouthWeightedScoreMaximum = totalRawScoreMaximum * 3;

export interface MobileSubmissionScorePreview {
    readonly rawDomainScores: Record<MobileYeeDomainKey, number>;
    readonly weightedDomainScores: Record<MobileYeeDomainKey, number>;
    readonly selectedWeights: Record<MobileYeeDomainKey, number>;
    readonly totalRawScore: number;
    readonly totalWeightedScore: number;
}

export interface MobileDomainScoreRow {
    readonly domain: MobileYeeDomainKey;
    readonly label: string;
    readonly rawScore: number;
    readonly rawMax: number;
    readonly rawPercentage: number;
    readonly weightedScore: number;
    readonly weightedMax: number;
    readonly weightedPercentage: number;
    readonly weightValue: number;
}

export function buildMobileSubmissionScorePreview(
    score: YeeScoreResult,
    participantInfo: Record<string, unknown>,
): MobileSubmissionScorePreview {
    const rawDomainScores = {
        access: 0,
        activitySpaces: 0,
        amenities: 0,
        experienceOfSpace: 0,
        aestheticsAndCare: 0,
        useAndUsability: 0,
    } satisfies Record<MobileYeeDomainKey, number>;

    for (const [sectionName, value] of Object.entries(score.section_scores ?? {})) {
        const domain = sectionToDomain(sectionName);
        if (!domain) continue;
        rawDomainScores[domain] += typeof value === "number" ? value : Number(value) || 0;
    }

    const weights = normalizeWeights(participantInfo.domain_weights);
    const weightedDomainScores = Object.fromEntries(
        (Object.keys(rawDomainScores) as MobileYeeDomainKey[]).map((domain) => [
            domain,
            rawDomainScores[domain] * weights[domain],
        ]),
    ) as Record<MobileYeeDomainKey, number>;

    return {
        rawDomainScores,
        weightedDomainScores,
        selectedWeights: weights,
        totalRawScore: Object.values(rawDomainScores).reduce((sum, value) => sum + value, 0),
        totalWeightedScore: Object.values(weightedDomainScores).reduce(
            (sum, value) => sum + value,
            0,
        ),
    };
}

export function buildDomainScoreRows(
    preview: MobileSubmissionScorePreview,
): readonly MobileDomainScoreRow[] {
    return (Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => {
        const rawMax = rawDomainScoreMaximums[domain];
        const weightValue = preview.selectedWeights[domain];
        const weightedMax = rawMax * weightValue;
        const rawScore = preview.rawDomainScores[domain];
        const weightedScore = preview.weightedDomainScores[domain];

        return {
            domain,
            label: mobileYeeDomainLabels[domain],
            rawScore,
            rawMax,
            rawPercentage: rawMax === 0 ? 0 : clampPercentage((rawScore / rawMax) * 100),
            weightedScore,
            weightedMax,
            weightedPercentage:
                weightedMax === 0 ? 0 : clampPercentage((weightedScore / weightedMax) * 100),
            weightValue,
        };
    });
}

export function getYouthWeightedScoreMaximum(
    weights: Partial<Record<MobileYeeDomainKey, string | number>>,
): number {
    return (Object.keys(rawDomainScoreMaximums) as MobileYeeDomainKey[]).reduce((sum, domain) => {
        return sum + rawDomainScoreMaximums[domain] * normalizeWeightValue(weights[domain]);
    }, 0);
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

function sectionToDomain(sectionName: string): MobileYeeDomainKey | null {
    const normalized = sectionName.toLowerCase();
    if (normalized.includes("access")) return "access";
    if (normalized.includes("activity spaces")) return "activitySpaces";
    if (normalized.includes("amenities")) return "amenities";
    if (normalized.includes("experience")) return "experienceOfSpace";
    if (normalized.includes("aesthetics")) return "aestheticsAndCare";
    if (normalized.includes("use & usability")) return "useAndUsability";
    return null;
}

function normalizeWeights(raw: unknown): Record<MobileYeeDomainKey, number> {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
        access: normalizeWeightValue(source.access),
        activitySpaces: normalizeWeightValue(source.activitySpaces),
        amenities: normalizeWeightValue(source.amenities),
        experienceOfSpace: normalizeWeightValue(source.experienceOfSpace),
        aestheticsAndCare: normalizeWeightValue(source.aestheticsAndCare),
        useAndUsability: normalizeWeightValue(source.useAndUsability),
    };
}

function normalizeWeightValue(weight: unknown): number {
    const numeric = Number(weight);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 3) {
        return numeric;
    }
    return 1;
}

function readOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
}

function clampPercentage(value: number): number {
    return Math.max(0, Math.min(100, value));
}
