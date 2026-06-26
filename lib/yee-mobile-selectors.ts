import type { YeeAssignedPlace, YeeLocalDraft, YeeMyAuditItem } from "./yee-types";

export type MobilePlaceWorkflowStatus = "not_started" | "draft" | "submitted";

export interface MobilePlaceView {
    readonly place: YeeAssignedPlace;
    readonly status: MobilePlaceWorkflowStatus;
    readonly draft: YeeLocalDraft | null;
    readonly submission: YeeMyAuditItem | null;
    readonly latestActivityLabel: string;
    readonly syncLabel: string;
}

export interface MobileAuditSummary {
    readonly assignedCount: number;
    readonly draftCount: number;
    readonly submittedCount: number;
    readonly pendingSyncCount: number;
}

export function getSubmissionSyncLabel(audit: YeeMyAuditItem): string {
    if (audit.syncState === "pending_upload") {
        return "Saved on device and waiting to upload";
    }

    if (audit.syncState === "sync_failed") {
        return "Upload needs attention";
    }

    return "uploaded";
}

export function getSubmissionTimestampLabel(audit: YeeMyAuditItem): string {
    if (audit.syncState === "pending_upload") {
        return formatTimestamp(audit.submitted_at, "Saved");
    }

    return formatTimestamp(audit.submitted_at, "Submitted");
}

export function buildPlaceViews(
    places: readonly YeeAssignedPlace[],
    draftsByPlace: Record<string, YeeLocalDraft>,
    submittedAudits: readonly YeeMyAuditItem[],
): readonly MobilePlaceView[] {
    return places.map((place) => {
        const draft = draftsByPlace[place.id] ?? null;
        const submission = getLatestSubmissionForPlace(submittedAudits, place.id);

        if (submission !== null) {
            return {
                place,
                status: "submitted",
                draft,
                submission,
                latestActivityLabel: formatTimestamp(submission.submitted_at, "Submitted"),
                syncLabel:
                    submission.syncState === "pending_upload"
                        ? "Queued for sync"
                        : "Saved on Cloud",
            } satisfies MobilePlaceView;
        }

        if (draft !== null) {
            return {
                place,
                status: "draft",
                draft,
                submission: null,
                latestActivityLabel: formatTimestamp(draft.updatedAt, "Draft saved"),
                syncLabel: getDraftSyncLabel(draft.syncState),
            } satisfies MobilePlaceView;
        }

        return {
            place,
            status: "not_started",
            draft: null,
            submission: null,
            latestActivityLabel: "Not started yet",
            syncLabel: "Ready for offline capture",
        } satisfies MobilePlaceView;
    });
}

export function summarizeMobileAudits(placeViews: readonly MobilePlaceView[]): MobileAuditSummary {
    return placeViews.reduce<MobileAuditSummary>(
        (summary, view) => {
            return {
                assignedCount: summary.assignedCount + 1,
                draftCount: summary.draftCount + (view.status === "draft" ? 1 : 0),
                submittedCount: summary.submittedCount + (view.status === "submitted" ? 1 : 0),
                pendingSyncCount:
                    summary.pendingSyncCount +
                    (view.submission?.syncState === "pending_upload" ||
                    view.submission?.syncState === "sync_failed" ||
                    view.draft?.syncState === "pending_upload" ||
                    view.draft?.syncState === "sync_failed"
                        ? 1
                        : 0),
            };
        },
        {
            assignedCount: 0,
            draftCount: 0,
            submittedCount: 0,
            pendingSyncCount: 0,
        },
    );
}

export function averageSubmittedScore(audits: readonly YeeMyAuditItem[]): number {
    const syncedAudits = audits.filter(isBackendSyncedAudit);
    if (syncedAudits.length === 0) {
        return 0;
    }

    const total = syncedAudits.reduce((sum, audit) => {
        return sum + audit.total_score;
    }, 0);

    return Math.round(total / syncedAudits.length);
}

export function getTopSubmission(audits: readonly YeeMyAuditItem[]): YeeMyAuditItem | null {
    const syncedAudits = audits.filter(isBackendSyncedAudit);
    const [firstAudit, ...remaining] = syncedAudits;
    if (firstAudit === undefined) {
        return null;
    }

    return remaining.reduce((highest, current) => {
        if (current.total_score > highest.total_score) {
            return current;
        }

        return highest;
    }, firstAudit);
}

export function sortAuditsNewestFirst(
    audits: readonly YeeMyAuditItem[],
): readonly YeeMyAuditItem[] {
    return [...audits].sort((left, right) => {
        return Date.parse(right.submitted_at) - Date.parse(left.submitted_at);
    });
}

export function getLatestSubmissionForPlace(
    audits: readonly YeeMyAuditItem[],
    placeId: string,
): YeeMyAuditItem | null {
    const matchingAudits = audits.filter((audit) => audit.place_id === placeId);
    const [firstAudit, ...remaining] = matchingAudits;
    if (firstAudit === undefined) {
        return null;
    }

    return remaining.reduce((latest, current) => {
        const latestTime = Date.parse(latest.submitted_at);
        const currentTime = Date.parse(current.submitted_at);
        if (Number.isNaN(latestTime)) {
            return current;
        }
        if (Number.isNaN(currentTime)) {
            return latest;
        }
        return currentTime > latestTime ? current : latest;
    }, firstAudit);
}

export function getStatusLabel(status: MobilePlaceWorkflowStatus): string {
    if (status === "submitted") {
        return "Submitted";
    }

    if (status === "draft") {
        return "Draft in progress";
    }

    return "Not started";
}

function getDraftSyncLabel(syncState: YeeLocalDraft["syncState"]): string {
    if (syncState === "pending_upload") {
        return "Waiting to sync";
    }

    if (syncState === "sync_failed") {
        return "Sync needs retry";
    }

    if (syncState === "local_only") {
        return "Saved on device";
    }

    return "Saved on Cloud";
}

function formatTimestamp(value: string, prefix: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        return prefix;
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    return `${prefix} ${formatter.format(new Date(parsed))}`;
}

function isBackendSyncedAudit(audit: YeeMyAuditItem): boolean {
    return audit.syncState !== "pending_upload" && audit.syncState !== "sync_failed";
}
