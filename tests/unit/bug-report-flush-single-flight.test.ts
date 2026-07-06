/**
 * Unit tests for `flushPendingBugReports` (lib/bug-report/flush.ts).
 *
 * The goal is to verify the single-flight guarantee: two concurrent callers
 * share one in-flight execution and every queued report is POSTed exactly once
 * - no duplicate submissions regardless of how many callers overlap.
 *
 * Strategy: mock the queue, api, and screenshot layers so the test controls
 * what reports are "pending" and can count exact `createBugReport` call counts.
 * The `createSingleFlightRunner` wrapper inside `flush.ts` is the real
 * production code under test - it runs unmocked so its semantics are exercised.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSession } from "lib/auth/types";
import type { PendingBugReport } from "lib/bug-report/queue";
import type { BugReport } from "lib/bug-report/types";

import { flushPendingBugReports } from "lib/bug-report/flush";

// ---------------------------------------------------------------------------
// Hoisted mocks - must be established before any module is imported.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
    const pendingQueue: PendingBugReport[] = [];

    const fakeBugReport: BugReport = {
        id: "backend-report-id",
        account_id: null,
        reporter_user_id: null,
        reporter_email: null,
        reporter_role: null,
        surface: "mobile",
        title: "Test report",
        description: "A queued report.",
        severity: "minor",
        status: "new",
        linked_known_issue_id: null,
        project_id: null,
        place_id: null,
        yee_submission_id: null,
        context: {},
        screenshot_url: null,
        screenshot_public_id: null,
        created_at: "2026-06-21T00:00:00.000Z",
        updated_at: "2026-06-21T00:00:00.000Z",
    };

    return {
        pendingQueue,
        /** Reset shared queue state between tests. */
        resetQueue: (): void => {
            pendingQueue.length = 0;
        },
        readPendingBugReports: vi.fn((): PendingBugReport[] => [...pendingQueue]),
        removePendingBugReport: vi.fn((_id: string): void => undefined),
        createBugReport: vi.fn(async (): Promise<BugReport> => fakeBugReport),
        uploadCapturedScreenshot: vi.fn(async () => ({
            url: "https://example.com/img.png",
            publicId: "img-id",
        })),
    };
});

vi.mock("lib/bug-report/queue", () => ({
    readPendingBugReports: mocks.readPendingBugReports,
    removePendingBugReport: mocks.removePendingBugReport,
    enqueueBugReport: vi.fn(),
    countPendingBugReports: vi.fn(() => 0),
}));

vi.mock("lib/bug-report/api", () => ({
    createBugReport: mocks.createBugReport,
    matchKnownIssues: vi.fn(async () => []),
}));

vi.mock("lib/bug-report/screenshot", () => ({
    uploadCapturedScreenshot: mocks.uploadCapturedScreenshot,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeSession: AuthSession = {
    accessToken: "token-abc",
    tokenType: "bearer",
    expiresAt: "2099-01-01T00:00:00.000Z",
    user: {
        id: "user-1",
        email: "auditor@example.com",
        name: "Test Auditor",
        accountType: "AUDITOR",
        hasAuditorProfile: true,
    },
};

function makePendingReport(id: string, withScreenshot = false): PendingBugReport {
    return {
        id,
        createdAt: "2026-06-21T00:00:00.000Z",
        title: `Report ${id}`,
        description: "A test report.",
        severity: "minor",
        context: {},
        ...(withScreenshot ? { screenshotLocalUri: `file:///tmp/${id}.png` } : {}),
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("flushPendingBugReports - single-flight guard", () => {
    beforeEach(() => {
        mocks.resetQueue();
        vi.clearAllMocks();
    });

    it("POSTs each queued report exactly once when called serially", async () => {
        mocks.pendingQueue.push(makePendingReport("r1"), makePendingReport("r2"));

        const result = await flushPendingBugReports(fakeSession);

        expect(result.submitted).toBe(2);
        expect(result.failed).toBe(0);
        expect(mocks.createBugReport).toHaveBeenCalledTimes(2);
        expect(mocks.removePendingBugReport).toHaveBeenCalledTimes(2);
        expect(mocks.removePendingBugReport).toHaveBeenCalledWith("r1");
        expect(mocks.removePendingBugReport).toHaveBeenCalledWith("r2");
    });

    it("two concurrent callers share one in-flight execution - each report POSTed exactly once", async () => {
        mocks.pendingQueue.push(makePendingReport("r1"), makePendingReport("r2"));

        const [result1, result2] = await Promise.all([
            flushPendingBugReports(fakeSession),
            flushPendingBugReports(fakeSession),
        ]);

        // Both callers resolve to the same result (the single shared execution).
        expect(result1).toEqual(result2);
        // Exactly 2 POSTs - not 4 (single-flight guarantee).
        expect(mocks.createBugReport).toHaveBeenCalledTimes(2);
        expect(mocks.removePendingBugReport).toHaveBeenCalledTimes(2);
    });

    it("three concurrent callers still result in each report POSTed exactly once", async () => {
        mocks.pendingQueue.push(
            makePendingReport("rA"),
            makePendingReport("rB"),
            makePendingReport("rC"),
        );

        await Promise.all([
            flushPendingBugReports(fakeSession),
            flushPendingBugReports(fakeSession),
            flushPendingBugReports(fakeSession),
        ]);

        // 3 reports, 1 execution - 3 POSTs total (not 9).
        expect(mocks.createBugReport).toHaveBeenCalledTimes(3);
        expect(mocks.removePendingBugReport).toHaveBeenCalledTimes(3);
    });

    it("a second sequential call after the first settles starts a fresh execution", async () => {
        mocks.pendingQueue.push(makePendingReport("r1"));
        await flushPendingBugReports(fakeSession);
        expect(mocks.createBugReport).toHaveBeenCalledTimes(1);

        vi.clearAllMocks();

        mocks.resetQueue();
        mocks.pendingQueue.push(makePendingReport("r2"));

        // The in-flight guard must have reset on settle, so a second call is a
        // new execution that processes the freshly seeded report.
        await flushPendingBugReports(fakeSession);
        expect(mocks.createBugReport).toHaveBeenCalledTimes(1);
    });

    it("returns submitted=0 and failed=0 when the queue is empty", async () => {
        const result = await flushPendingBugReports(fakeSession);

        expect(result.submitted).toBe(0);
        expect(result.failed).toBe(0);
        expect(mocks.createBugReport).not.toHaveBeenCalled();
    });

    it("counts failed reports when createBugReport throws and does not call remove", async () => {
        mocks.pendingQueue.push(makePendingReport("r-fail"));
        mocks.createBugReport.mockRejectedValueOnce(new Error("network error"));

        const result = await flushPendingBugReports(fakeSession);

        expect(result.submitted).toBe(0);
        expect(result.failed).toBe(1);
        // A failed report must NOT be removed from the queue.
        expect(mocks.removePendingBugReport).not.toHaveBeenCalled();
    });

    it("uploads screenshots before posting and continues without them if upload fails", async () => {
        const reportWithScreenshot = makePendingReport("r-img", true);
        mocks.pendingQueue.push(reportWithScreenshot);
        // Screenshot upload fails - the report should still be submitted.
        mocks.uploadCapturedScreenshot.mockRejectedValueOnce(new Error("upload failed"));

        const result = await flushPendingBugReports(fakeSession);

        expect(result.submitted).toBe(1);
        expect(result.failed).toBe(0);
        // createBugReport called once, without screenshot fields (upload failed).
        expect(mocks.createBugReport).toHaveBeenCalledTimes(1);
        const callArgs = mocks.createBugReport.mock.calls[0] as unknown as unknown[] | undefined;
        const callArg = callArgs?.[1] as Record<string, unknown> | undefined;
        expect(callArg?.screenshot_url).toBeUndefined();
        expect(mocks.removePendingBugReport).toHaveBeenCalledWith("r-img");
    });
});
