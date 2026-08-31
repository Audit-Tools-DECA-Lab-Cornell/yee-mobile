import type { MobileYeeStepNumber } from "./yee-mobile-audit-config";
import { isQuestionComplete } from "./yee-audit-question-view";
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
    if (!isContextComplete(draft)) {
        return { step: 1, label: "Context" };
    }

    if (!isWeightingComplete(draft)) {
        return { step: 2, label: "Weighting" };
    }

    if (instrument !== null) {
        for (const step of DOMAIN_STEPS) {
            const section = getSectionForStep(instrument, step);
            if (section === null) {
                continue;
            }

            if (!isDomainSectionComplete(draft, section)) {
                return { step, label: section.title };
            }
        }
    }

    return null;
}

const DOMAIN_STEPS: readonly MobileYeeStepNumber[] = [3, 4, 5, 6, 7, 8];

function isContextComplete(draft: SubmitGuardDraft): boolean {
    return (
        draft.visitFrequency.length > 0 &&
        draft.publicAccess.length > 0 &&
        draft.openHoursAccess.length > 0 &&
        draft.season.length > 0 &&
        draft.weather.length > 0
    );
}

function isWeightingComplete(draft: SubmitGuardDraft): boolean {
    return Object.values(draft.weights).every((value) => value.length > 0);
}

function isDomainSectionComplete(
    draft: SubmitGuardDraft,
    section: NonNullable<ReturnType<typeof getSectionForStep>>,
): boolean {
    return section.questions.every((question) => isQuestionComplete(question, draft.responses));
}

/**
 * Steps whose required fields are fully answered, for progress display (the
 * tablet step rail). Uses the same per-step rules as
 * {@link findFirstIncompleteStep}. Step 9 (final comments) is optional and is
 * never included; domain steps are only evaluated when the instrument is
 * hydrated.
 */
export function getCompletedSteps(
    draft: SubmitGuardDraft,
    instrument: NormalizedInstrument | null,
): ReadonlySet<MobileYeeStepNumber> {
    const completed = new Set<MobileYeeStepNumber>();
    if (isContextComplete(draft)) {
        completed.add(1);
    }

    if (isWeightingComplete(draft)) {
        completed.add(2);
    }

    if (instrument !== null) {
        for (const step of DOMAIN_STEPS) {
            const section = getSectionForStep(instrument, step);
            if (section !== null && isDomainSectionComplete(draft, section)) {
                completed.add(step);
            }
        }
    }

    return completed;
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
