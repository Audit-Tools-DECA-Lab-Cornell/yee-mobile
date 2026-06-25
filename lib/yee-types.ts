export type YeeAuditWorkflowStatus = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

export type YeeDomainKey =
    | "access"
    | "activitySpaces"
    | "amenities"
    | "experienceOfSpace"
    | "aestheticsAndCare"
    | "useAndUsability";

export interface YeeScoreResult {
    readonly total_score: number;
    readonly section_scores: Record<string, number>;
    readonly category_scores: Record<string, number>;
    readonly matched_scored_answers: number;
}

export interface YeeAuditStateResponse {
    readonly audit_id: string | null;
    readonly submission_id: string | null;
    readonly place_id: string;
    readonly place_name: string;
    readonly auditor_generated_id: string;
    readonly status: YeeAuditWorkflowStatus;
    readonly submitted_at: string | null;
    readonly participant_info: Record<string, unknown>;
    readonly responses: Record<string, unknown>;
    readonly score: YeeScoreResult | null;
}

export interface YeeSubmissionResponse {
    readonly id: string;
    readonly place_id: string;
    readonly place_name: string | null;
    readonly auditor_id: string;
    readonly auditor_generated_id: string | null;
    readonly submitted_at: string;
    readonly participant_info: Record<string, unknown>;
    readonly responses: Record<string, unknown>;
    readonly score: YeeScoreResult;
    readonly syncState?: YeeSyncState;
}

export interface YeeAssignedPlace {
    readonly id: string;
    readonly name: string;
    readonly project: string;
    readonly address: string;
    readonly audits: number;
}

export interface YeeMyAuditItem {
    readonly id: string;
    readonly place_id: string;
    readonly place_name: string;
    readonly submitted_at: string;
    readonly total_score: number;
    readonly syncState?: YeeSyncState;
}

export interface YeeDraftParticipantInfo extends Record<string, unknown> {
    readonly auditor_id?: string;
    readonly auditor_name?: string;
    readonly place_id?: string;
    readonly place_name?: string;
    readonly audit_date?: string;
    readonly start_time?: string;
    readonly finish_time?: string;
    readonly total_minutes?: number;
    readonly visit_frequency?: string;
    readonly season?: string;
    readonly weather?: string;
    readonly domain_weights?: Partial<Record<YeeDomainKey, string | number>>;
    readonly weighting_comments?: string;
    readonly comments?: string;
    readonly section_comments?: Partial<Record<YeeDomainKey, string>>;
}

/**
 * Current schema version for persisted {@link YeeLocalDraft} records.
 *
 * Bump this when the draft shape changes in a way that requires migration or
 * defaulting of older persisted payloads.
 */
export const YEE_DRAFT_SCHEMA_VERSION = 1;

export interface YeeLocalDraft {
    /** Stable draft identity. Currently mirrors the place id (one draft per place). */
    readonly id: string;
    /** Persisted schema version, used to migrate/default older payloads. */
    readonly schemaVersion: number;
    /** Monotonic local revision counter, incremented on every local write. */
    readonly version: number;
    readonly placeId: string;
    /**
     * ISO timestamp of the last local update.
     *
     * @deprecated Prefer {@link YeeLocalDraft.lastUpdatedIso}. Retained for UI
     * compatibility with existing consumers that read `updatedAt`.
     */
    readonly updatedAt: string;
    /** ISO timestamp of the last local update (canonical metadata field). */
    readonly lastUpdatedIso: string;
    readonly participantInfo: YeeDraftParticipantInfo;
    readonly responses: Record<string, unknown>;
    readonly lastKnownBackendStatus: YeeAuditWorkflowStatus;
    readonly lastKnownSubmissionId: string | null;
    readonly scorePreview: YeeScoreResult | null;
    readonly syncState: YeeSyncState;
}

export type YeeSyncState = "local_only" | "pending_upload" | "synced" | "sync_failed";

/**
 * Default maximum number of submit attempts before a queue item is parked as a
 * terminal {@link YeeSyncState} `sync_failed`. Exported so the store and tests
 * agree on the exhaustion boundary.
 */
export const YEE_SYNC_MAX_ATTEMPTS = 8;

/**
 * Typed reason a queue item last failed to sync.
 *
 * `null` means "no failure yet" (freshly enqueued or succeeded). The non-null
 * values mirror the buckets produced by the pure error classifier:
 * - `network`  — transport/timeout/rate-limit (retryable; backed off).
 * - `auth`     — 401 token expiry (PAUSED; does not burn an attempt).
 * - `validation` — 400/409/422/404 (terminal; backend rejected the payload).
 * - `server`   — 5xx (retryable; backed off).
 * - `terminal` — attempts exhausted or an otherwise non-recoverable failure.
 */
export type YeeSyncFailureReason = "network" | "auth" | "validation" | "server" | "terminal" | null;

export interface YeeSyncQueueItem {
    readonly id: string;
    readonly placeId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly kind: "draft_save" | "submission";
    readonly payload: {
        readonly participant_info: Record<string, unknown>;
        readonly responses: Record<string, unknown>;
        readonly place_id?: string;
        readonly provisional_submission_id?: string;
        /**
         * Stable idempotency key generated ONCE when a submission is first
         * enqueued (format: `yee-${placeId}-${uuid}`) and persisted with the
         * item. NEVER regenerated on retry — it is the primary duplicate-submit
         * guard that the backend de-dupes on. Only meaningful for `submission`
         * items; absent on `draft_save`.
         */
        readonly idempotency_key?: string;
        /**
         * Local draft `version` (see {@link YeeLocalDraft.version}) captured when
         * a submission was enqueued. Used after a successful submit to guard
         * draft deletion: a newer local edit must not be deleted by an older
         * queued submission. Only meaningful for `submission` items.
         */
        readonly draft_version?: number;
    };
    readonly attempts: number;
    readonly lastError: string | null;
    /**
     * ISO timestamp before which the item must NOT be retried (backoff window),
     * or `null` when the item is eligible to drain immediately. An auth-paused
     * item also uses `null` (it waits for a fresh session, not a timer).
     */
    readonly nextAttemptAtIso: string | null;
    /** Maximum attempts before the item is parked as terminal `sync_failed`. */
    readonly maxAttempts: number;
    /** Typed classification of the last failure, or `null` if none yet. */
    readonly failureReason: YeeSyncFailureReason;
}

export interface YeeInstrumentResponse {
    readonly SurveyEntry?: Record<string, unknown>;
    readonly SurveyElements?: unknown[];
    readonly scoring_items?: unknown[];
    readonly section_metadata?: unknown[];
}
