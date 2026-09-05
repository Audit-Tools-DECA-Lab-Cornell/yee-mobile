/**
 * What to do with a queued submission just before it would be POSTed.
 *
 * The review-screen submit guard already refuses to enqueue an incomplete
 * audit, so anything incomplete in the queue was serialized by an older build.
 * Those are exactly the items that need a correction path rather than a POST
 * the backend will reject.
 *
 * Pure and free of React Native imports so the whole decision is unit-tested in
 * the Node environment. The drain loop supplies the resolved instrument; this
 * module never fetches.
 */

import type { MobileYeeStepNumber } from "./yee-mobile-audit-config";
import { isQuestionComplete } from "./yee-audit-question-view";
import type { NormalizedInstrument } from "./yee-mobile-instrument";

type AuditResponses = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Where an auditor has to go to make a rejected submission acceptable. */
export interface IncompleteQueuedSubmission {
    /** `auditRowKey` of every question still missing a required answer. */
    readonly missingQuestionKeys: readonly string[];
    /** Step to open first, so recovery lands on the earliest gap. */
    readonly firstMissingStep: MobileYeeStepNumber | null;
}

/**
 * The three things that can happen to a queued submission at drain time.
 *
 * `retain_unresolved_instrument` is deliberately NOT a failure: the item keeps
 * its payload and stays queued. Falling back to the active instrument here would
 * judge an audit against a contract it was never taken under.
 */
export type QueuedSubmissionGate =
    | { readonly outcome: "submit"; readonly reason: "complete" | "unstamped_legacy" }
    | { readonly outcome: "park_incomplete"; readonly incomplete: IncompleteQueuedSubmission }
    | { readonly outcome: "retain_unresolved_instrument" };

function isBlank(value: string | null | undefined): boolean {
    return typeof value !== "string" || value.trim().length === 0;
}

/**
 * Read a persisted queue payload's responses as the answer map.
 *
 * Queue payloads are stored as JSON and typed `Record<string, unknown>`, so a
 * value here can be anything an older build (or a corrupt entry) left behind.
 * Non-object items and non-string answers are dropped rather than trusted: a
 * dropped answer reads as unanswered, which parks the submission for a human to
 * look at instead of sending something unverifiable.
 */
export function toAuditResponses(responses: Record<string, unknown>): AuditResponses {
    const normalized: Record<string, Record<string, string>> = {};
    for (const [itemId, value] of Object.entries(responses)) {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
            continue;
        }
        const answers: Record<string, string> = {};
        for (const [choiceId, answer] of Object.entries(value as Record<string, unknown>)) {
            if (typeof answer === "string") {
                answers[choiceId] = answer;
            }
        }
        normalized[itemId] = answers;
    }
    return normalized;
}

/** Questions still missing a required answer, in instrument order. */
export function findIncompleteQuestions(
    instrument: NormalizedInstrument,
    responses: AuditResponses,
): IncompleteQueuedSubmission {
    const missingQuestionKeys: string[] = [];
    let firstMissingStep: MobileYeeStepNumber | null = null;

    for (const section of instrument.sections) {
        for (const question of section.questions) {
            if (isQuestionComplete(question, responses)) {
                continue;
            }
            missingQuestionKeys.push(question.key);
            if (firstMissingStep === null) {
                firstMissingStep = section.step;
            }
        }
    }

    return { missingQuestionKeys, firstMissingStep };
}

/**
 * Decide whether a queued submission may be sent.
 *
 * Stamp handling distinguishes two cases that look alike and are not:
 *
 * - **Absent stamp** - a payload queued before stamping existed carries neither
 *   field. That is the documented unstamped-legacy path, not an unknown version,
 *   so it submits and the backend resolves it against the frozen schema-v1
 *   contract. Treating it as unresolvable would strand every pre-stamp item
 *   forever.
 * - **Unresolvable stamp** - a stamp is present but its instrument is not on
 *   this device. The item is retained untouched until that exact version can be
 *   fetched.
 */
export function gateQueuedSubmission(input: {
    readonly stampKey: string | null | undefined;
    readonly stampVersion: string | null | undefined;
    /** Instrument resolved for the item's EXACT stamp, or `null` if unavailable. */
    readonly instrument: NormalizedInstrument | null;
    readonly responses: AuditResponses;
}): QueuedSubmissionGate {
    const { stampKey, stampVersion, instrument, responses } = input;
    const isUnstamped = isBlank(stampKey) && isBlank(stampVersion);

    if (instrument === null) {
        // Nothing to validate against. An unstamped legacy item still goes: the
        // backend owns that fallback. A stamped one waits for its version.
        return isUnstamped
            ? { outcome: "submit", reason: "unstamped_legacy" }
            : { outcome: "retain_unresolved_instrument" };
    }

    if (!isUnstamped && (isBlank(stampKey) || isBlank(stampVersion))) {
        // Half a stamp cannot identify a version; never guess the other half.
        return { outcome: "retain_unresolved_instrument" };
    }

    const incomplete = findIncompleteQuestions(instrument, responses);
    if (incomplete.missingQuestionKeys.length > 0) {
        return { outcome: "park_incomplete", incomplete };
    }
    return { outcome: "submit", reason: isUnstamped ? "unstamped_legacy" : "complete" };
}
