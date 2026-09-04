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
    readonly total_raw_score?: number;
    readonly total_raw_maximum?: number;
    readonly raw_domain_scores?: Record<YeeDomainKey, number>;
    readonly raw_domain_maximums?: Record<YeeDomainKey, number>;
    readonly total_weighted_score?: number;
    readonly total_weighted_maximum?: number;
    readonly weighted_domain_scores?: Record<YeeDomainKey, number>;
    readonly weighted_domain_maximums?: Record<YeeDomainKey, number>;
    readonly selected_weights?: Record<YeeDomainKey, number>;
    readonly normalized_weights?: Record<YeeDomainKey, number>;
    readonly priority_gaps?: Record<YeeDomainKey, number>;
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
    readonly instrument_key?: string | null;
    readonly instrument_version?: string | null;
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
    readonly instrument_key?: string | null;
    readonly instrument_version?: string | null;
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
    /**
     * Canonical snapshot-derived maxima for this persisted audit.
     *
     * The backend returns `null` when a legacy/corrupt snapshot cannot be
     * resolved. Consumers must then show the score as unavailable instead of
     * substituting the current instrument's denominator.
     */
    readonly total_raw_maximum: number | null;
    readonly total_weighted_maximum: number | null;
    readonly syncState?: YeeSyncState;
    readonly instrument_key?: string | null;
    readonly instrument_version?: string | null;
}

export interface YeeDraftParticipantInfo extends Record<string, unknown> {
    readonly auditor_id?: string;
    readonly auditor_name?: string;
    /** Optional study/workshop participant ID linking this audit to a person. */
    readonly participant_id?: string;
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
    readonly instrumentKey?: string | null;
    readonly instrumentVersion?: string | null;
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
 * - `validation` — 400/404/409/422 the client cannot interpret (terminal).
 * - `incomplete` — a 422 naming logical questions that are still unanswered.
 * - `server`   — 5xx (retryable; backed off).
 * - `terminal` — attempts exhausted or an otherwise non-recoverable failure.
 *
 * `incomplete` is deliberately separate from `validation`. Both are terminal for
 * the payload as sent, so neither may be re-POSTed — but only `incomplete` names
 * questions the auditor can answer to make the same submission succeed, so the
 * UI offers a correction instead of a dead "Retry upload".
 */
export type YeeSyncFailureReason =
    "network" | "auth" | "validation" | "incomplete" | "server" | "terminal" | null;

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
        readonly instrument_key?: string;
        readonly instrument_version?: string;
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
    /**
     * Whether this item is parked for good and must never be re-POSTed.
     *
     * Optional because the queue is persisted: items serialized before this
     * field existed simply lack it, and {@link isTerminallyFailed} falls back to
     * the failure reason for those. Never write `undefined` here — omit the key
     * or write a real boolean (`exactOptionalPropertyTypes` is on).
     */
    readonly isTerminal?: boolean;
    /**
     * Logical question ids the backend said are still unanswered, when the
     * rejection was `incomplete`.
     *
     * Persisted with the item so a correction survives an app restart: the
     * auditor may be offline and hours from the place when they reopen it.
     * Optional for the same reason as {@link isTerminal} — items serialized
     * before this existed simply lack it.
     */
    readonly incompleteQuestionIds?: {
        readonly missingPrimaryQuestionIds: readonly string[];
        readonly missingFollowUpQuestionIds: readonly string[];
    };
    /**
     * The same gap expressed in keys this app can navigate to, when the drain
     * gate found it locally rather than being told by the backend.
     *
     * Separate from {@link incompleteQuestionIds} because the two use different
     * vocabularies: the backend reports logical authoring ids (`access.q3`),
     * while the audit UI is keyed by `auditRowKey` (`presenceItemId:choiceId`).
     * Only these keys can open the control an auditor has to fill in.
     */
    readonly incompleteQuestionKeys?: {
        readonly missingQuestionKeys: readonly string[];
        /** Wizard step holding the earliest gap, or `null` if none was located. */
        readonly firstMissingStep: number | null;
    };
}

export interface YeeInstrumentOptionData {
    readonly value: string;
    readonly label: string;
}

export interface YeeInstrumentPreAuditQuestionData {
    readonly id: string;
    readonly title?: string;
    readonly prompt: string;
    readonly description?: string;
    readonly options?: readonly YeeInstrumentOptionData[];
    readonly multi_select?: boolean;
    readonly required?: boolean;
    readonly auto_generated?: boolean;
}

export interface YeeInstrumentWeightingDomainData {
    readonly key: string;
    readonly label: string;
    readonly prompt: string;
}

export interface YeeInstrumentWeightingData {
    readonly title?: string;
    readonly description?: string;
    readonly options?: readonly YeeInstrumentOptionData[];
    readonly domains?: readonly YeeInstrumentWeightingDomainData[];
}

export interface YeeAuthoringOptionData {
    readonly id: string;
    readonly label: string;
    readonly score: number;
}

export interface YeeAuthoringQuestionData {
    readonly id: string;
    readonly prompt: string;
    readonly primary: {
        readonly type: "single_select";
        readonly options: readonly YeeAuthoringOptionData[];
    };
    readonly followUp: {
        readonly triggerOptionIds: readonly string[];
        readonly requiredWhenShown?: boolean;
        readonly prompt: string;
        readonly options: readonly YeeAuthoringOptionData[];
    } | null;
    readonly scoring: {
        readonly method: "option_score" | "presence_condition_product";
        readonly domain: string;
    };
    readonly responseBinding: {
        readonly presenceItemId: string;
        readonly choiceId: string;
        readonly conditionItemId: string | null;
    } | null;
}

export interface YeeAuthoringInstrumentData {
    readonly schemaVersion: 2;
    readonly sections: readonly {
        readonly id: string;
        readonly title: string;
        readonly instructions: string;
        readonly commentPrompt: string;
        readonly questions: readonly YeeAuthoringQuestionData[];
    }[];
}

export interface YeeInstrumentResponse {
    readonly instrument_key?: string;
    readonly instrument_version?: string;
    readonly SurveyEntry?: Record<string, unknown>;
    readonly SurveyElements?: unknown[];
    readonly scoring_items?: unknown[];
    readonly section_metadata?: unknown[];
    readonly sections?: unknown[];
    /** Visit-context questions (auditor_id/audit_date are auto-generated). */
    readonly pre_audit_questions?: readonly YeeInstrumentPreAuditQuestionData[];
    /** Per-domain youth-weighting prompts + scale for the weighting step. */
    readonly weighting?: YeeInstrumentWeightingData | null;
    /** Shared "If yes, please rate the condition…" follow-up prompt. */
    readonly condition_prompt?: string;
    /** Prompt for the overall/final comments field before review & submit. */
    readonly final_comments_prompt?: string;
    readonly authoring?: YeeAuthoringInstrumentData | null;
}
