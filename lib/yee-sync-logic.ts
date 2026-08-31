/**
 * Pure decision logic for the YEE offline sync queue.
 *
 * This module is intentionally free of React Native imports and side effects so
 * it can be unit-tested in plain Node. It owns three concerns:
 *   1. {@link computeBackoffMs} — how long to wait before the next retry.
 *   2. {@link classifyError} — bucketing an HTTP status into retry semantics.
 *   3. {@link decideNextQueueState} — given an item, a classification, and the
 *      current time, compute the next persisted queue/sync state.
 *
 * The store ({@link stores/yee-mobile-store}) calls these to drive drains and
 * persist results; keeping the math/branching here makes every edge case
 * (auth-pause, backoff schedule, attempt exhaustion) directly testable.
 */
import {
    YEE_SYNC_MAX_ATTEMPTS,
    type YeeSyncFailureReason,
    type YeeSyncQueueItem,
    type YeeSyncState,
} from "lib/yee-types";

/** Base backoff delay (ms) — the wait after the first failed attempt. */
export const YEE_BACKOFF_BASE_MS = 5_000;

/** Maximum backoff delay (ms) — the wait never exceeds this cap. */
export const YEE_BACKOFF_CAP_MS = 300_000;

/**
 * How an HTTP status code (or transport failure) maps onto retry semantics.
 * - `retryable` — try again later behind exponential backoff.
 * - `auth`      — token expired; PAUSE and wait for a fresh session (no burn).
 * - `terminal`  — the backend rejected the payload; never retry.
 */
export type YeeErrorClassification = "retryable" | "auth" | "terminal";

/**
 * Exponential backoff with a hard cap.
 *
 * Schedule (base 5000ms, cap 300000ms):
 *   attempts 0 -> 0ms        (no prior failure; eligible immediately)
 *   attempts 1 -> 5000ms
 *   attempts 2 -> 10000ms
 *   attempts 3 -> 20000ms
 *   ...
 *   attempts n -> min(base * 2^(n-1), cap)
 *
 * @param attempts Number of attempts already made (>= 0).
 * @returns Milliseconds to wait before the next attempt.
 */
export function computeBackoffMs(attempts: number): number {
    if (attempts <= 0) {
        return 0;
    }
    const uncapped = YEE_BACKOFF_BASE_MS * 2 ** (attempts - 1);
    return Math.min(uncapped, YEE_BACKOFF_CAP_MS);
}

/**
 * Classify an HTTP status code into retry semantics.
 *
 * - `0` (transport failure / offline), `408`, `429`, and any `5xx` -> retryable.
 * - `400`, `404`, `409`, `422` -> terminal (the backend rejected the payload).
 * - `401` -> auth (token expired; pause). The backend NEVER emits `403`, so
 *   there is intentionally no `403` branch.
 * - Anything else defaults to terminal: we do not endlessly retry an unknown
 *   non-success status.
 *
 * @param statusCode HTTP status, or `0` for a transport-level failure.
 */
export function classifyError(statusCode: number): YeeErrorClassification {
    if (statusCode === 401) {
        return "auth";
    }
    if (
        statusCode === 0 ||
        statusCode === 408 ||
        statusCode === 429 ||
        (statusCode >= 500 && statusCode <= 599)
    ) {
        return "retryable";
    }
    if (statusCode === 400 || statusCode === 404 || statusCode === 409 || statusCode === 422) {
        return "terminal";
    }
    return "terminal";
}

/**
 * Map a non-auth, non-exhausted retryable classification to a typed failure
 * reason. A transport failure (status 0) is reported by the API layer with a
 * `statusCode` of 0; here we only know the bucket, so we lean on the status the
 * caller passes through {@link decideNextQueueState}.
 */
function retryableReason(statusCode: number): Extract<YeeSyncFailureReason, "network" | "server"> {
    return statusCode >= 500 && statusCode <= 599 ? "server" : "network";
}

/** Input describing the failure being applied to a queue item. */
export interface YeeQueueFailure {
    readonly classification: YeeErrorClassification;
    /**
     * The originating HTTP status (or 0 for transport). Used to distinguish
     * `network` from `server` for the typed {@link YeeSyncFailureReason} and is
     * otherwise informational.
     */
    readonly statusCode: number;
    /** Human-readable error message persisted on the item for diagnostics. */
    readonly message: string;
    /**
     * Parsed `incomplete_audit_responses` report, when the rejection carried
     * one. Present only for a terminal rejection the auditor can fix by
     * answering the named questions.
     */
    readonly incomplete?: IncompleteAuditResponses | null;
}

/** The next persisted shape of a queue item after a failed drain attempt. */
export interface YeeNextQueueState {
    readonly attempts: number;
    readonly nextAttemptAtIso: string | null;
    readonly failureReason: YeeSyncFailureReason;
    /** Sync state to stamp on the associated draft / summary. */
    readonly syncState: Extract<YeeSyncState, "pending_upload" | "sync_failed">;
    readonly lastError: string;
    /** True when the item is parked terminally and should stop draining. */
    readonly isTerminal: boolean;
    /**
     * True when the item is paused awaiting a fresh auth session (NOT a timer).
     * The drain loop should stop for this session without burning an attempt.
     */
    readonly isAuthPaused: boolean;
}

/**
 * Decide the next persisted state for a queue item after a failed attempt.
 *
 * Rules:
 * - `auth`: PAUSE without burning an attempt. `attempts` is preserved,
 *   `nextAttemptAtIso` is cleared (it waits for a new session, not a timer), and
 *   `syncState` stays `pending_upload`. `failureReason` is `auth`.
 * - `terminal`: park immediately as `sync_failed` with `failureReason` carrying
 *   the specific bucket (`validation`). The attempt counter is incremented so
 *   diagnostics reflect the work done, but no further retry is scheduled.
 * - `retryable`: increment attempts. If the new attempt count reaches
 *   `maxAttempts`, park as terminal `sync_failed` (`failureReason: "terminal"`).
 *   Otherwise schedule `nextAttemptAtIso = nowIso + computeBackoffMs(attempts)`
 *   and keep `syncState` `pending_upload`.
 *
 * @param item The current queue item.
 * @param failure The classified failure being applied.
 * @param nowIso Current time as an ISO string (injected for testability).
 */
export function decideNextQueueState(
    item: YeeSyncQueueItem,
    failure: YeeQueueFailure,
    nowIso: string,
): YeeNextQueueState {
    if (failure.classification === "auth") {
        // Do NOT burn an attempt: a 401 means the session expired, not that the
        // payload is bad. Pause until a fresh session re-drives the queue.
        return {
            attempts: item.attempts,
            nextAttemptAtIso: null,
            failureReason: "auth",
            syncState: "pending_upload",
            lastError: failure.message,
            isTerminal: false,
            isAuthPaused: true,
        };
    }

    if (failure.classification === "terminal") {
        return {
            attempts: item.attempts + 1,
            nextAttemptAtIso: null,
            // Both stop draining; only `incomplete` tells the auditor what to do
            // about it, so the distinction has to survive onto the item.
            failureReason: failure.incomplete ? "incomplete" : "validation",
            syncState: "sync_failed",
            lastError: failure.message,
            isTerminal: true,
            isAuthPaused: false,
        };
    }

    // retryable
    const nextAttempts = item.attempts + 1;
    const maxAttempts = item.maxAttempts > 0 ? item.maxAttempts : YEE_SYNC_MAX_ATTEMPTS;
    if (nextAttempts >= maxAttempts) {
        return {
            attempts: nextAttempts,
            nextAttemptAtIso: null,
            failureReason: "terminal",
            syncState: "sync_failed",
            lastError: failure.message,
            isTerminal: true,
            isAuthPaused: false,
        };
    }

    const delayMs = computeBackoffMs(nextAttempts);
    const nextAttemptAtIso = new Date(Date.parse(nowIso) + delayMs).toISOString();
    return {
        attempts: nextAttempts,
        nextAttemptAtIso,
        failureReason: retryableReason(failure.statusCode),
        syncState: "pending_upload",
        lastError: failure.message,
        isTerminal: false,
        isAuthPaused: false,
    };
}

/**
 * Whether an item is still inside its backoff window and should be skipped by a
 * drain happening at `nowIso`.
 *
 * An item with `nextAttemptAtIso === null` is always eligible (fresh item, or an
 * auth-paused item that a fresh session is now re-driving). A `sync_failed`
 * terminal item is never eligible.
 */
export function isInBackoff(item: YeeSyncQueueItem, nowIso: string): boolean {
    if (item.nextAttemptAtIso === null) {
        return false;
    }
    return Date.parse(item.nextAttemptAtIso) > Date.parse(nowIso);
}

/** The backend's `incomplete_audit_responses` code, matched exactly. */
const INCOMPLETE_AUDIT_CODE = "incomplete_audit_responses";

/**
 * Which logical questions a rejected submission still needs answered.
 *
 * Ids only — the backend deliberately sends no question text, so the client
 * looks the wording up in its own cached instrument.
 */
export interface IncompleteAuditResponses {
    readonly missingPrimaryQuestionIds: readonly string[];
    readonly missingFollowUpQuestionIds: readonly string[];
}

function stringList(value: unknown): readonly string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string")
        : [];
}

/**
 * Read a rejection body as an incomplete-submission report, or `null`.
 *
 * Accepts both the framework-wrapped `{ detail: {...} }` shape and a bare
 * object, and returns `null` for anything that does not carry the exact code —
 * an unrecognized rejection must stay a plain terminal failure rather than be
 * presented to the auditor as something they can fix by answering a question.
 */
export function parseIncompleteAuditResponses(body: unknown): IncompleteAuditResponses | null {
    if (body === null || typeof body !== "object") {
        return null;
    }
    const envelope = body as Record<string, unknown>;
    const candidate =
        envelope.detail !== null && typeof envelope.detail === "object"
            ? (envelope.detail as Record<string, unknown>)
            : envelope;
    if (candidate.code !== INCOMPLETE_AUDIT_CODE) {
        return null;
    }
    const missingPrimaryQuestionIds = stringList(candidate.missing_primary_question_ids);
    const missingFollowUpQuestionIds = stringList(candidate.missing_follow_up_question_ids);
    if (missingPrimaryQuestionIds.length === 0 && missingFollowUpQuestionIds.length === 0) {
        // The code without any question to fix gives the auditor nowhere to go.
        return null;
    }
    return { missingPrimaryQuestionIds, missingFollowUpQuestionIds };
}

/**
 * Failure reasons that mean "the backend rejected this payload and always will".
 *
 * `decideNextQueueState` records a terminal HTTP rejection (400 / 404 / 409 /
 * 422) as `"validation"`, and exhausted retries as `"terminal"`. Both are dead
 * ends: re-POSTing either one produces the same rejection forever.
 */
const TERMINAL_FAILURE_REASONS: readonly YeeSyncFailureReason[] = [
    "terminal",
    "validation",
    // Recoverable by editing the audit, but never by re-POSTing the same
    // payload — so it must stop draining like any other terminal rejection.
    "incomplete",
];

/**
 * Whether an item is parked for good.
 *
 * Prefers the explicit {@link YeeSyncQueueItem.isTerminal} flag and falls back
 * to the failure reason for items serialized before that flag existed, so a
 * queue restored from MMKV after an app update is classified correctly rather
 * than silently becoming drainable again.
 */
export function isTerminallyFailed(item: YeeSyncQueueItem): boolean {
    if (typeof item.isTerminal === "boolean") {
        return item.isTerminal;
    }
    return TERMINAL_FAILURE_REASONS.includes(item.failureReason);
}

/**
 * Select the items eligible to drain at `nowIso`: not terminally failed and not
 * inside a backoff window. Order is preserved (oldest-first by queue order).
 *
 * A terminally-failed item is excluded on EVERY reason that means it, not just
 * the literal `"terminal"` string. Filtering on that one value let a rejected
 * payload (recorded as `"validation"`) stay drainable and re-POST on every tick
 * — an unbounded loop against a deterministic rejection, with the audit locked
 * behind a "Retry upload" affordance that could never succeed.
 */
export function selectDrainableItems(
    queue: readonly YeeSyncQueueItem[],
    nowIso: string,
): readonly YeeSyncQueueItem[] {
    return queue.filter((item) => !isTerminallyFailed(item) && !isInBackoff(item, nowIso));
}
