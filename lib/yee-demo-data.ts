/**
 * Role options for the auth-free UI demo.
 */
export type DemoRole = "manager" | "auditor";

/**
 * Audit progress states shown in place cards.
 */
export type PlaceStatus = "not_started" | "in_progress" | "ready_for_review" | "submitted";

/**
 * Pre-audit weighting progress for the YEE tool.
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
    readonly assignedAuditorCount: number;
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
    readonly weightLabel: string;
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
 * Demo-friendly labels for role chips and headings.
 */
export const ROLE_LABELS: Record<DemoRole, string> = {
    manager: "Manager Mode",
    auditor: "Auditor Mode",
};

/**
 * KPI cards vary slightly by role to mirror role-based workflows.
 */
export const DASHBOARD_METRICS_BY_ROLE: Record<DemoRole, readonly DashboardMetric[]> = {
    manager: [
        {
            id: "completed",
            title: "Submitted Audits",
            value: "37",
            helperText: "+4 in the last 7 days",
            tone: "green",
        },
        {
            id: "review",
            title: "Ready for Review",
            value: "9",
            helperText: "Across 6 active places",
            tone: "blue",
        },
        {
            id: "weighted",
            title: "Avg Weighted Score",
            value: "79.6%",
            helperText: "Pre-audit weighted",
            tone: "purple",
        },
        {
            id: "base",
            title: "Avg Base Score",
            value: "74.8%",
            helperText: "Without weighting",
            tone: "orange",
        },
    ],
    auditor: [
        {
            id: "assigned",
            title: "Assigned Places",
            value: "6",
            helperText: "2 due this week",
            tone: "blue",
        },
        {
            id: "drafts",
            title: "Saved Drafts",
            value: "3",
            helperText: "Stored offline",
            tone: "purple",
        },
        {
            id: "submitted",
            title: "Submitted This Month",
            value: "11",
            helperText: "1 pending sync",
            tone: "green",
        },
        {
            id: "mandatory",
            title: "Mandatory Completion",
            value: "84%",
            helperText: "Across active audits",
            tone: "orange",
        },
    ],
};

/**
 * Place data used across dashboard, places, execute, and report tabs.
 */
export const YEE_PLACES: readonly PlaceSummary[] = [
    {
        id: "place-001",
        projectName: "Urban Youth Activity Initiative",
        placeName: "Riverside Youth Hub",
        locality: "Auckland, New Zealand",
        status: "in_progress",
        baseScore: 73,
        weightedScore: 81,
        preAuditStatus: "completed",
        mandatoryCompletionPercent: 86,
        updatedAtLabel: "Updated 9m ago",
        assignedAuditorCount: 4,
    },
    {
        id: "place-002",
        projectName: "Urban Youth Activity Initiative",
        placeName: "Kepler Community Grounds",
        locality: "Auckland, New Zealand",
        status: "ready_for_review",
        baseScore: 78,
        weightedScore: 84,
        preAuditStatus: "completed",
        mandatoryCompletionPercent: 100,
        updatedAtLabel: "Updated 58m ago",
        assignedAuditorCount: 3,
    },
    {
        id: "place-003",
        projectName: "South Region Youth Program",
        placeName: "Hillcrest Shared Park",
        locality: "Christchurch, New Zealand",
        status: "not_started",
        baseScore: 0,
        weightedScore: 0,
        preAuditStatus: "pending",
        mandatoryCompletionPercent: 0,
        updatedAtLabel: "Not started",
        assignedAuditorCount: 2,
    },
    {
        id: "place-004",
        projectName: "South Region Youth Program",
        placeName: "Matai Recreation Strip",
        locality: "Christchurch, New Zealand",
        status: "submitted",
        baseScore: 87,
        weightedScore: 90,
        preAuditStatus: "completed",
        mandatoryCompletionPercent: 100,
        updatedAtLabel: "Submitted yesterday",
        assignedAuditorCount: 5,
    },
    {
        id: "place-005",
        projectName: "Coastal Access Pilot",
        placeName: "Harborline Community Space",
        locality: "Wellington, New Zealand",
        status: "in_progress",
        baseScore: 68,
        weightedScore: 76,
        preAuditStatus: "in_progress",
        mandatoryCompletionPercent: 61,
        updatedAtLabel: "Updated 2h ago",
        assignedAuditorCount: 3,
    },
];

/**
 * Pre-filled section completion overview for an in-progress audit.
 */
export const AUDIT_SECTION_PREVIEW: readonly AuditSectionPreview[] = [
    {
        id: "section-participation",
        sectionName: "Participation and Inclusion",
        answeredItems: 8,
        totalItems: 10,
        mandatory: true,
        weightLabel: "x1.4",
    },
    {
        id: "section-voice",
        sectionName: "Youth Voice and Agency",
        answeredItems: 6,
        totalItems: 8,
        mandatory: true,
        weightLabel: "x1.2",
    },
    {
        id: "section-safety",
        sectionName: "Safety and Wellbeing",
        answeredItems: 7,
        totalItems: 9,
        mandatory: true,
        weightLabel: "x1.5",
    },
    {
        id: "section-support",
        sectionName: "Environmental Support",
        answeredItems: 4,
        totalItems: 7,
        mandatory: false,
        weightLabel: "x1.0",
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
        weightedScore: 81,
    },
    {
        id: "report-2",
        placeName: "Kepler Community Grounds",
        baseScore: 78,
        weightedScore: 84,
    },
    {
        id: "report-3",
        placeName: "Matai Recreation Strip",
        baseScore: 87,
        weightedScore: 90,
    },
    {
        id: "report-4",
        placeName: "Harborline Community Space",
        baseScore: 68,
        weightedScore: 76,
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
        value: "1",
    },
    {
        id: "priority-3",
        title: "Offline media uploads",
        value: "4",
    },
];

/**
 * Return completion progress as an integer percentage.
 *
 * @param answeredItems Number of answered questions.
 * @param totalItems Number of total questions.
 * @returns Whole-number completion percentage in the 0-100 range.
 */
export function toCompletionPercent(answeredItems: number, totalItems: number): number {
    if (totalItems <= 0) {
        return 0;
    }

    const safeAnsweredItems = Math.max(answeredItems, 0);
    const rawPercent = Math.round((safeAnsweredItems / totalItems) * 100);

    if (rawPercent < 0) {
        return 0;
    }
    if (rawPercent > 100) {
        return 100;
    }
    return rawPercent;
}
