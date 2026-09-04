import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(__dirname, "../..");

const SYNC_VISIBLE_SURFACES = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/places.tsx",
    "app/(tabs)/execute.tsx",
    "app/(tabs)/reports.tsx",
    "app/audit/[placeId]/review.tsx",
    "app/audit/[placeId]/submitted.tsx",
    "app/reports/[submissionId].tsx",
] as const;

function readSurface(relativePath: string): string {
    return readFileSync(path.join(APP_ROOT, relativePath), "utf8");
}

describe("sync-visible mobile surfaces", () => {
    it.each(SYNC_VISIBLE_SURFACES)("%s consumes the shared mobile audit projection", (surface) => {
        expect(readSurface(surface)).toContain("buildMobileAuditProjection");
    });

    it("does not make tab display counts from raw syncQueue.length", () => {
        for (const surface of [
            "app/(tabs)/index.tsx",
            "app/(tabs)/places.tsx",
            "app/(tabs)/execute.tsx",
        ]) {
            expect(readSurface(surface)).not.toContain("syncQueue.length");
        }
    });

    it("keeps Settings out of audit sync state", () => {
        expect(readSurface("app/settings.tsx")).not.toContain("useYeeMobileStore");
    });

    it("keeps submitted audits out of the editable execute flow", () => {
        const executeSurface = readSurface("app/(tabs)/execute.tsx");
        const auditSurface = readSurface("app/audit/[placeId]/index.tsx");

        // The "To do" segment only lists non-submitted audits for editing…
        expect(executeSurface).toContain('view.status !== "submitted"');
        // …and submitted audits open the read-only walkthrough, never the editor.
        expect(executeSurface).toContain("/view?submissionId=");
        expect(auditSurface).toContain("getLatestSubmissionForPlace");
        expect(auditSurface).toContain("Audit already submitted");
    });

    it("keeps persisted score surfaces backend-maxima authoritative", () => {
        const executeSurface = readSurface("app/(tabs)/execute.tsx");
        const reportsSurface = readSurface("app/(tabs)/reports.tsx");
        const reportDetailSurface = readSurface("app/reports/[submissionId].tsx");
        const reviewSurface = readSurface("app/audit/[placeId]/review.tsx");
        const reportingLogic = readSurface("lib/yee-mobile-reporting.ts");

        for (const surface of [
            executeSurface,
            reportsSurface,
            reportDetailSurface,
            reviewSurface,
        ]) {
            expect(surface).toContain("scorePercent");
            expect(surface).toContain("SCORE_UNAVAILABLE");
            expect(surface).not.toContain("toScorePercentage");
        }

        expect(executeSurface).toContain("audit.total_raw_maximum");
        expect(reportsSurface).toContain("audit.total_raw_maximum");
        expect(reportsSurface).toContain("percentage === null ? null");
        expect(reportDetailSurface).toContain("submission.score.total_raw_maximum");
        expect(reportingLogic).not.toContain("totalRawScoreMaximum");
        expect(reportingLogic).not.toContain("rawDomainScoreMaximums");
        expect(reportingLogic).not.toContain("normalizeWeights");
    });
});
