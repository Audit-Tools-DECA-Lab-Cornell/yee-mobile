import { z } from "zod";

/**
 * Bug-report value sets and payload schemas.
 *
 * These mirror the YEE backend (`app/models.py` and
 * `app/products/yee/schemas/bug_report.py`). Keep all surfaces in sync. The
 * audit reference is `yee_submission_id` (a `yee_audit_submissions` row).
 */

export const bugReportSurfaceSchema = z.enum(["web", "mobile", "desktop"]);
export const bugReportSeveritySchema = z.enum(["blocking", "major", "minor"]);
export const bugReportStatusSchema = z.enum([
    "new",
    "triaged",
    "in_progress",
    "resolved",
    "wont_fix",
    "duplicate",
]);
export const knownIssueStatusSchema = z.enum(["open", "monitoring", "fixed"]);

// Privacy-filtered diagnostic allow-list: only these fields are ever sent.
// Never audit answers, notes, tokens, or PII.
export const bugReportContextSchema = z
    .object({
        app_version: z.string().optional(),
        build: z.string().optional(),
        route: z.string().optional(),
        screen: z.string().optional(),
        route_params: z.record(z.string(), z.string()).optional(),
        platform: z.string().optional(),
        os_version: z.string().optional(),
        device_model: z.string().optional(),
        locale: z.string().optional(),
        network_online: z.boolean().optional(),
        network_type: z.string().optional(),
        sync_phase: z.string().optional(),
        project_id: z.string().optional(),
        place_id: z.string().optional(),
        yee_submission_id: z.string().optional(),
        section_id: z.string().optional(),
        question_id: z.string().optional(),
        client_timestamp: z.string().optional(),
    })
    .strict();

export const bugReportCreateRequestSchema = z.object({
    surface: bugReportSurfaceSchema,
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    severity: bugReportSeveritySchema,
    project_id: z.uuid().optional(),
    place_id: z.uuid().optional(),
    yee_submission_id: z.uuid().optional(),
    context: bugReportContextSchema.optional(),
    screenshot_url: z.string().max(2000).optional(),
    screenshot_public_id: z.string().max(255).optional(),
});

export const bugReportSchema = z.object({
    id: z.string(),
    account_id: z.string().nullable(),
    reporter_user_id: z.string().nullable(),
    reporter_email: z.string().nullable(),
    reporter_role: z.string().nullable(),
    surface: bugReportSurfaceSchema,
    title: z.string(),
    description: z.string(),
    severity: bugReportSeveritySchema,
    status: bugReportStatusSchema,
    linked_known_issue_id: z.string().nullable(),
    project_id: z.string().nullable(),
    place_id: z.string().nullable(),
    yee_submission_id: z.string().nullable(),
    context: z.record(z.string(), z.unknown()),
    screenshot_url: z.string().nullable(),
    screenshot_public_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
});

export const knownIssueMatchSchema = z.object({
    id: z.string(),
    title: z.string(),
    symptoms: z.string(),
    workaround: z.string().nullable(),
    status: knownIssueStatusSchema,
    tags: z.array(z.string()),
    surfaces: z.array(z.string()),
});

export type BugReportSurface = z.infer<typeof bugReportSurfaceSchema>;
export type BugReportSeverity = z.infer<typeof bugReportSeveritySchema>;
export type BugReportStatus = z.infer<typeof bugReportStatusSchema>;
export type BugReportContext = z.infer<typeof bugReportContextSchema>;
export type BugReportCreateRequest = z.infer<typeof bugReportCreateRequestSchema>;
export type BugReport = z.infer<typeof bugReportSchema>;
export type KnownIssueMatch = z.infer<typeof knownIssueMatchSchema>;
