import type {
    YeeAssignedPlace,
    YeeLocalDraft,
    YeeMyAuditItem,
    YeeSyncQueueItem,
} from "./yee-types";
import { scorePercentage } from "./yee-mobile-reporting";

export type MobilePlaceWorkflowStatus = "not_started" | "draft" | "submitted";

export interface MobilePlaceView {
    readonly place: YeeAssignedPlace;
    readonly status: MobilePlaceWorkflowStatus;
    readonly draft: YeeLocalDraft | null;
    readonly submission: YeeMyAuditItem | null;
    readonly pendingQueueItems: readonly YeeSyncQueueItem[];
    readonly pendingSubmission: YeeSyncQueueItem | null;
    readonly pendingSyncCount: number;
    readonly isPendingSync: boolean;
    readonly hasSyncFailure: boolean;
    readonly latestActivityLabel: string;
    readonly syncLabel: string;
}

export interface MobileAuditSummary {
    readonly assignedCount: number;
    readonly draftCount: number;
    readonly submittedCount: number;
    readonly pendingSyncCount: number;
}

export interface MobileAuditProjectionInput {
    readonly assignedPlaces: readonly YeeAssignedPlace[];
    readonly draftsByPlace: Record<string, YeeLocalDraft>;
    readonly submittedAudits: readonly YeeMyAuditItem[];
    readonly syncQueue: readonly YeeSyncQueueItem[];
    readonly selectedPlaceId?: string | null;
    readonly selectedSubmissionId?: string | null;
}

export interface MobileAuditProjection {
    readonly placeViews: readonly MobilePlaceView[];
    readonly summary: MobileAuditSummary;
    readonly sortedReports: readonly YeeMyAuditItem[];
    /** Mean of valid backend-derived audit percentages, or null when unavailable. */
    readonly averageScore: number | null;
    readonly topSubmission: YeeMyAuditItem | null;
    readonly selectedPlaceView: MobilePlaceView | null;
    readonly focusedSubmission: YeeMyAuditItem | null;
}

export function getSubmissionSyncLabel(audit: YeeMyAuditItem): string {
    if (audit.syncState === "pending_upload") {
        return "Queued for sync";
    }

    if (audit.syncState === "sync_failed") {
        return "Sync needs attention";
    }

    return "Saved on Cloud";
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
    syncQueue: readonly YeeSyncQueueItem[] = [],
): readonly MobilePlaceView[] {
    return places.map((place) => {
        const draft = draftsByPlace[place.id] ?? null;
        const submission = getLatestSubmissionForPlace(submittedAudits, place.id);
        const pendingQueueItems = syncQueue.filter((item) => item.placeId === place.id);
        const pendingSubmission =
            pendingQueueItems.find((item) => item.kind === "submission") ?? null;
        const hasSyncFailure =
            pendingQueueItems.some(queueItemNeedsAttention) ||
            submission?.syncState === "sync_failed" ||
            draft?.syncState === "sync_failed";
        const isPendingSync =
            pendingQueueItems.length > 0 ||
            submission?.syncState === "pending_upload" ||
            submission?.syncState === "sync_failed" ||
            draft?.syncState === "pending_upload" ||
            draft?.syncState === "sync_failed";
        const pendingSyncCount = isPendingSync ? 1 : 0;

        if (submission !== null) {
            return {
                place,
                status: "submitted",
                draft,
                submission,
                pendingQueueItems,
                pendingSubmission,
                pendingSyncCount,
                isPendingSync,
                hasSyncFailure,
                latestActivityLabel: getSubmissionTimestampLabel(submission),
                syncLabel: getPlaceSubmissionSyncLabel(
                    submission,
                    pendingSubmission,
                    hasSyncFailure,
                ),
            } satisfies MobilePlaceView;
        }

        if (draft !== null) {
            return {
                place,
                status: "draft",
                draft,
                submission: null,
                pendingQueueItems,
                pendingSubmission,
                pendingSyncCount,
                isPendingSync,
                hasSyncFailure,
                latestActivityLabel: formatTimestamp(draft.updatedAt, "Draft saved"),
                syncLabel: hasSyncFailure ? "Sync needs attention" : getDraftSyncLabel(draft),
            } satisfies MobilePlaceView;
        }

        return {
            place,
            status: "not_started",
            draft: null,
            submission: null,
            pendingQueueItems,
            pendingSubmission,
            pendingSyncCount,
            isPendingSync,
            hasSyncFailure,
            latestActivityLabel: "Not started yet",
            syncLabel: hasSyncFailure
                ? "Sync needs attention"
                : isPendingSync
                  ? "Queued for sync"
                  : "Ready for offline capture",
        } satisfies MobilePlaceView;
    });
}

export function buildMobileAuditProjection(
    input: MobileAuditProjectionInput,
): MobileAuditProjection {
    const placeViews = buildPlaceViews(
        input.assignedPlaces,
        input.draftsByPlace,
        input.submittedAudits,
        input.syncQueue,
    );
    const summary = summarizeMobileAudits(placeViews);
    const sortedReports = sortAuditsNewestFirst(input.submittedAudits);
    const averageScore = averageSubmittedScore(input.submittedAudits);
    const topSubmission = getTopSubmission(input.submittedAudits);
    const selectedPlaceView =
        input.selectedPlaceId === undefined || input.selectedPlaceId === null
            ? null
            : (placeViews.find((view) => view.place.id === input.selectedPlaceId) ?? null);
    const selectedReport =
        input.selectedSubmissionId === undefined || input.selectedSubmissionId === null
            ? null
            : (sortedReports.find((audit) => audit.id === input.selectedSubmissionId) ?? null);
    const placeReport =
        input.selectedPlaceId === undefined || input.selectedPlaceId === null
            ? null
            : getLatestSubmissionForPlace(sortedReports, input.selectedPlaceId);

    return {
        placeViews,
        summary,
        sortedReports,
        averageScore,
        topSubmission,
        selectedPlaceView,
        focusedSubmission:
            selectedReport ?? placeReport ?? topSubmission ?? sortedReports[0] ?? null,
    };
}

export function summarizeMobileAudits(placeViews: readonly MobilePlaceView[]): MobileAuditSummary {
    return placeViews.reduce<MobileAuditSummary>(
        (summary, view) => {
            return {
                assignedCount: summary.assignedCount + 1,
                draftCount: summary.draftCount + (view.status === "draft" ? 1 : 0),
                submittedCount: summary.submittedCount + (view.status === "submitted" ? 1 : 0),
                pendingSyncCount: summary.pendingSyncCount + view.pendingSyncCount,
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

export function averageSubmittedScore(audits: readonly YeeMyAuditItem[]): number | null {
    const percentages = audits
        .filter(isBackendSyncedAudit)
        .map((audit) => scorePercentage(audit.total_score, audit.total_raw_maximum))
        .filter((percentage): percentage is number => percentage !== null);
    if (percentages.length === 0) {
        return null;
    }

    return Math.round(
        percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length,
    );
}

export function getTopSubmission(audits: readonly YeeMyAuditItem[]): YeeMyAuditItem | null {
    const scoredAudits = audits
        .filter(isBackendSyncedAudit)
        .map((audit) => ({
            audit,
            percentage: scorePercentage(audit.total_score, audit.total_raw_maximum),
        }))
        .filter(
            (
                entry,
            ): entry is {
                readonly audit: YeeMyAuditItem;
                readonly percentage: number;
            } => entry.percentage !== null,
        );
    const [firstAudit, ...remaining] = scoredAudits;
    if (firstAudit === undefined) {
        return null;
    }

    return remaining.reduce((highest, current) => {
        if (current.percentage > highest.percentage) {
            return current;
        }

        return highest;
    }, firstAudit).audit;
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

function getPlaceSubmissionSyncLabel(
    submission: YeeMyAuditItem,
    pendingSubmission: YeeSyncQueueItem | null,
    hasSyncFailure: boolean,
): string {
    if (hasSyncFailure) {
        return "Sync needs attention";
    }

    if (pendingSubmission !== null || submission.syncState === "pending_upload") {
        return "Queued for sync";
    }

    return "Saved on Cloud";
}

function getDraftSyncLabel(draft: YeeLocalDraft): string {
    if (draft.syncState === "pending_upload") {
        return "Waiting to sync";
    }

    if (draft.syncState === "sync_failed") {
        return "Sync needs attention";
    }

    if (draft.syncState === "local_only") {
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

function queueItemNeedsAttention(item: YeeSyncQueueItem): boolean {
    return (
        item.failureReason === "auth" ||
        item.failureReason === "terminal" ||
        item.failureReason === "validation"
    );
}
