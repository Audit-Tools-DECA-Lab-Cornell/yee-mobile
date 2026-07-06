import { bugReportStorage } from "lib/bug-report/storage";
import type { BugReportSeverity } from "lib/bug-report/types";

/**
 * The in-progress report a user has typed but not yet submitted. Persisted
 * device-locally so an offline reporter does not lose their text before they
 * are back online. Only the user-typed fields are stored - never captured
 * context, screenshots, or anything sensitive. There is deliberately NO
 * background sync: the draft is cleared the moment a submit succeeds.
 */
export interface BugReportDraft {
    title: string;
    description: string;
    severity: BugReportSeverity;
}

const DRAFT_STORAGE_KEY = "yee.bugReport.draft.v1";

export function readBugReportDraft(): BugReportDraft | null {
    try {
        const raw = bugReportStorage.getString(DRAFT_STORAGE_KEY);
        if (raw === undefined) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<BugReportDraft>;
        if (typeof parsed.title !== "string" || typeof parsed.description !== "string") {
            return null;
        }
        const severity: BugReportSeverity =
            parsed.severity === "blocking" ||
            parsed.severity === "major" ||
            parsed.severity === "minor"
                ? parsed.severity
                : "major";
        return { title: parsed.title, description: parsed.description, severity };
    } catch {
        return null;
    }
}

export function saveBugReportDraft(draft: BugReportDraft): void {
    try {
        bugReportStorage.set(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
        /* non-critical: the in-memory form state is the source of truth */
    }
}

export function clearBugReportDraft(): void {
    try {
        bugReportStorage.remove(DRAFT_STORAGE_KEY);
    } catch {
        /* non-critical */
    }
}
