import type { MobileYeeStepNumber } from "./yee-mobile-audit-config";
import { getSectionForStep, type NormalizedInstrument } from "./yee-mobile-instrument";
import type { MobileAuditFormState } from "./yee-mobile-draft";
import type { YeeSyncQueueItem } from "./yee-types";

/**
 * The subset of {@link MobileAuditFormState} the completeness check actually
 * reads. Accepting the narrow shape keeps the guard pure and trivially testable
 * without constructing a full form state.
 */
export type SubmitGuardDraft = Pick<
    MobileAuditFormState,
    | "visitFrequency"
    | "publicAccess"
    | "openHoursAccess"
    | "season"
    | "weather"
    | "weights"
    | "responses"
>;

export interface IncompleteStep {
    readonly step: MobileYeeStepNumber;
    readonly label: string;
}

/**
 * Pure completeness check for a YEE audit. Returns the FIRST incomplete step
 * (so the UI can route the auditor straight to it) or `null` when every required
 * field is answered and the audit is safe to submit.
 *
 * Order of precedence (a lower step always wins): Context (1) → Weighting (2) →
 * domain sections (3–8, in instrument order). Domain sections are only checked
 * when a normalized instrument is available; when it is `null` (offline / not
 * yet hydrated) the domain checks are skipped and only the locally-known
 * context + weighting requirements gate submission.
 *
 * This is the single source of truth for "can this audit be submitted"; the
 * review screen calls it BEFORE enqueuing so an invalid audit never creates a
 * queue item.
 */
export function findFirstIncompleteStep(
    draft: SubmitGuardDraft,
    instrument: NormalizedInstrument | null,
): IncompleteStep | null {
    if (
        draft.visitFrequency.length === 0 ||
        draft.publicAccess.length === 0 ||
        draft.openHoursAccess.length === 0 ||
        draft.season.length === 0 ||
        draft.weather.length === 0
    ) {
        return { step: 1, label: "Context" };
    }

    if (Object.values(draft.weights).some((value) => value.length === 0)) {
        return { step: 2, label: "Weighting" };
    }

    if (instrument !== null) {
        const domainSteps: readonly MobileYeeStepNumber[] = [3, 4, 5, 6, 7, 8];
        for (const step of domainSteps) {
            const section = getSectionForStep(instrument, step);
            if (section === null) {
                continue;
            }

            const totalRows = section.groups.reduce((sum, group) => sum + group.rows.length, 0);
            const answeredRows = section.groups.reduce((sum, group) => {
                return (
                    sum +
                    group.rows.filter((row) => {
                        const presenceValue = draft.responses[row.presenceItemId]?.[row.choiceId];
                        return typeof presenceValue === "string" && presenceValue.length > 0;
                    }).length
                );
            }, 0);
            if (answeredRows < totalRows) {
                return { step, label: section.title };
            }
        }
    }

    return null;
}

/**
 * Find a persisted, in-flight submission queue item for a place, if one exists.
 *
 * Its presence means a final submission for this place is queued or mid-upload
 * (the item survives app restarts because the queue lives in MMKV and is
 * rehydrated on launch). The final-submit button must stay disabled while it
 * exists so a restart mid-submit cannot create a duplicate queue item.
 */
export function findPendingSubmission(
    queue: readonly YeeSyncQueueItem[],
    placeId: string,
): YeeSyncQueueItem | null {
    return queue.find((item) => item.kind === "submission" && item.placeId === placeId) ?? null;
}

/**
 * User-facing, mutually-exclusive states for the final-submit affordance. Mapped
 * from the persisted submission queue item (if any) plus the live in-flight flag.
 * Kept deliberately small so the review screen renders one clear status line.
 */
export type SubmitUiStatus =
    | "idle"
    | "saved_locally"
    | "queued"
    | "auth_required"
    | "retry_scheduled"
    | "sync_failed"
    | "submitted";

/**
 * Derive the user-facing submit status from the persisted queue item for a
 * place. Pure so it can be unit-tested and reused. The mapping:
 * - no item, with a synced submission present → `submitted`
 * - no item, nothing submitted               → `idle`
 * - item, failureReason "auth"               → `auth_required`
 * - item, failureReason "terminal"/"validation" → `sync_failed`
 * - item, backing off (nextAttemptAtIso set) → `retry_scheduled`
 * - item, otherwise                          → `queued`
 */
export function deriveSubmitStatus(input: {
    readonly pendingSubmission: YeeSyncQueueItem | null;
    readonly hasSyncedSubmission: boolean;
}): SubmitUiStatus {
    const { pendingSubmission, hasSyncedSubmission } = input;
    if (pendingSubmission === null) {
        return hasSyncedSubmission ? "submitted" : "idle";
    }

    switch (pendingSubmission.failureReason) {
        case "auth":
            return "auth_required";
        case "terminal":
        case "validation":
            return "sync_failed";
        default:
            return pendingSubmission.nextAttemptAtIso !== null ? "retry_scheduled" : "queued";
    }
}
