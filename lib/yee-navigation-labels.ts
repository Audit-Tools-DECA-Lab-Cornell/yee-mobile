export interface YeeHeaderLabels {
    readonly primary: string;
    readonly secondary: string;
}

function resolveLabel(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : fallback;
}

export function buildAuditStepHeaderLabels({
    placeName,
    stepTitle,
}: {
    readonly placeName: string | null | undefined;
    readonly stepTitle: string;
}): YeeHeaderLabels {
    return {
        primary: resolveLabel(placeName, "Assigned place"),
        secondary: resolveLabel(stepTitle, "Audit step"),
    };
}

export function buildAuditReviewHeaderLabels({
    placeName,
}: {
    readonly placeName: string | null | undefined;
}): YeeHeaderLabels {
    return {
        primary: resolveLabel(placeName, "Assigned place"),
        secondary: "Review and submit",
    };
}

export function buildAuditSubmittedHeaderLabels({
    placeName,
    queued,
}: {
    readonly placeName: string | null | undefined;
    readonly queued: boolean;
}): YeeHeaderLabels {
    return {
        primary: resolveLabel(placeName, "Submitted audit"),
        secondary: queued ? "Queued for upload" : "Submitted",
    };
}

export function buildReportHeaderLabels({
    placeName,
    isPendingUpload,
}: {
    readonly placeName: string | null | undefined;
    readonly isPendingUpload: boolean;
}): YeeHeaderLabels {
    return {
        primary: resolveLabel(placeName, "Submitted audit"),
        secondary: isPendingUpload ? "Queued report" : "Audit report",
    };
}
