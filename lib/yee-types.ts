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

export interface YeeLocalDraft {
    readonly placeId: string;
    readonly updatedAt: string;
    readonly participantInfo: YeeDraftParticipantInfo;
    readonly responses: Record<string, unknown>;
    readonly lastKnownBackendStatus: YeeAuditWorkflowStatus;
    readonly lastKnownSubmissionId: string | null;
    readonly scorePreview: YeeScoreResult | null;
    readonly syncState: YeeSyncState;
}

export type YeeSyncState = "local_only" | "pending_upload" | "synced" | "sync_failed";

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
    };
    readonly attempts: number;
    readonly lastError: string | null;
}

export interface YeeInstrumentResponse {
    readonly SurveyEntry?: Record<string, unknown>;
    readonly SurveyElements?: unknown[];
    readonly scoring_items?: unknown[];
    readonly section_metadata?: unknown[];
}
