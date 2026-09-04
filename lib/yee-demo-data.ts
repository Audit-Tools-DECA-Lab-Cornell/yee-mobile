/**
 * Audit progress states shown in place cards.
 */
export type PlaceStatus = "not_started" | "in_progress" | "ready_for_review" | "submitted";

/**
 * Progress for pre-audit setup steps.
 */
export type PreAuditStatus = "pending" | "in_progress" | "completed";

/**
 * Supported color tones for dashboard KPI cards.
 */
export type MetricTone = "blue" | "green" | "purple" | "orange";

/**
 * Small KPI card model used by the dashboard.
 */
export interface DashboardMetric {
    readonly id: string;
    readonly title: string;
    readonly value: string;
    readonly helperText: string;
    readonly tone: MetricTone;
}

/**
 * Place-level summary model shown in list and report screens.
 */
export interface PlaceSummary {
    readonly id: string;
    readonly projectName: string;
    readonly placeName: string;
    readonly locality: string;
    readonly status: PlaceStatus;
    readonly baseScore: number;
    readonly weightedScore: number;
    readonly preAuditStatus: PreAuditStatus;
    readonly mandatoryCompletionPercent: number;
    readonly updatedAtLabel: string;
}

/**
 * Preview model for section completion in the audit execution screen.
 */
export interface AuditSectionPreview {
    readonly id: string;
    readonly sectionName: string;
    readonly answeredItems: number;
    readonly totalItems: number;
    readonly mandatory: boolean;
    readonly sectionScorePercent: number;
}

/**
 * Simple chart row model for report bars.
 */
export interface ReportComparisonRow {
    readonly id: string;
    readonly placeName: string;
    readonly baseScore: number;
    readonly weightedScore: number;
}

/**
 * Checklist rows for the dashboard field-day card.
 */
export interface FieldPriorityItem {
    readonly id: string;
    readonly title: string;
    readonly value: string;
}

/**
 * Auditor-only KPI cards for the mobile field workflow.
 */
export const AUDITOR_DASHBOARD_METRICS: readonly DashboardMetric[] = [
    {
        id: "assigned",
        title: "Assigned Places",
        value: "4",
        helperText: "Only your assigned places are shown",
        tone: "blue",
    },
    {
        id: "drafts",
        title: "Saved Drafts",
        value: "2",
        helperText: "Captured offline on this device",
        tone: "purple",
    },
    {
        id: "submitted",
        title: "Submitted This Week",
        value: "1",
        helperText: "Synced when connection was available",
        tone: "green",
    },
    {
        id: "mandatory",
        title: "Mandatory Completion",
        value: "82%",
        helperText: "Across active assigned audits",
        tone: "orange",
    },
];

/**
 * Place data used across dashboard, places, execute, and report tabs.
 */
export const YEE_PLACES: readonly PlaceSummary[] = [
    {
        id: "place-001",
        projectName: "YEE Urban Inclusion 2026",
        placeName: "Riverside Youth Hub",
        locality: "Auckland, New Zealand",
        status: "in_progress",
        baseScore: 73,
        weightedScore: 73,
        preAuditStatus: "pending",
        mandatoryCompletionPercent: 86,
        updatedAtLabel: "Updated 9m ago",
    },
    {
        id: "place-002",
        projectName: "YEE Urban Inclusion 2026",
        placeName: "Kepler Community Grounds",
        locality: "Auckland, New Zealand",
        status: "ready_for_review",
        baseScore: 78,
        weightedScore: 78,
        preAuditStatus: "pending",
        mandatoryCompletionPercent: 100,
        updatedAtLabel: "Updated 58m ago",
    },
    {
        id: "place-003",
        projectName: "YEE South Region Pilot",
        placeName: "Hillcrest Shared Park",
        locality: "Christchurch, New Zealand",
        status: "not_started",
        baseScore: 0,
        weightedScore: 0,
        preAuditStatus: "pending",
        mandatoryCompletionPercent: 0,
        updatedAtLabel: "Not started",
    },
    {
        id: "place-004",
        projectName: "YEE South Region Pilot",
        placeName: "Matai Recreation Strip",
        locality: "Christchurch, New Zealand",
        status: "submitted",
        baseScore: 87,
        weightedScore: 87,
        preAuditStatus: "pending",
        mandatoryCompletionPercent: 100,
        updatedAtLabel: "Submitted yesterday",
    },
];

/**
 * Section overview aligned with the current YEE tool form blocks.
 */
export const AUDIT_SECTION_PREVIEW: readonly AuditSectionPreview[] = [
    {
        id: "section-access",
        sectionName: "Access",
        answeredItems: 12,
        totalItems: 14,
        mandatory: true,
        sectionScorePercent: 76,
    },
    {
        id: "section-activity-spaces",
        sectionName: "Activity Spaces",
        answeredItems: 10,
        totalItems: 13,
        mandatory: true,
        sectionScorePercent: 74,
    },
    {
        id: "section-amenities",
        sectionName: "Amenities",
        answeredItems: 9,
        totalItems: 12,
        mandatory: true,
        sectionScorePercent: 71,
    },
    {
        id: "section-experience",
        sectionName: "Experience of Space",
        answeredItems: 6,
        totalItems: 8,
        mandatory: true,
        sectionScorePercent: 79,
    },
    {
        id: "section-aesthetics",
        sectionName: "Aesthetics and Care",
        answeredItems: 7,
        totalItems: 9,
        mandatory: true,
        sectionScorePercent: 82,
    },
    {
        id: "section-usability",
        sectionName: "Use and Usability",
        answeredItems: 14,
        totalItems: 18,
        mandatory: true,
        sectionScorePercent: 77,
    },
    {
        id: "section-participant-info",
        sectionName: "Youth Participant Info",
        answeredItems: 5,
        totalItems: 6,
        mandatory: false,
        sectionScorePercent: 0,
    },
];

/**
 * Report comparison rows used to mock chart visuals.
 */
export const REPORT_COMPARISON_ROWS: readonly ReportComparisonRow[] = [
    {
        id: "report-1",
        placeName: "Riverside Youth Hub",
        baseScore: 73,
        weightedScore: 73,
    },
    {
        id: "report-2",
        placeName: "Kepler Community Grounds",
        baseScore: 78,
        weightedScore: 78,
    },
    {
        id: "report-3",
        placeName: "Matai Recreation Strip",
        baseScore: 87,
        weightedScore: 87,
    },
];

/**
 * Field priorities shown on the dashboard.
 */
export const FIELD_PRIORITY_ITEMS: readonly FieldPriorityItem[] = [
    {
        id: "priority-1",
        title: "Places due today",
        value: "2",
    },
    {
        id: "priority-2",
        title: "Drafts pending sync",
        value: "2",
    },
    {
        id: "priority-3",
        title: "Unsynced responses",
        value: "11",
    },
];
