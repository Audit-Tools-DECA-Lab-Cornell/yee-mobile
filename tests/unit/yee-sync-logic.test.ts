/**
 * Tests for the pure sync-decision logic in lib/yee-sync-logic.ts.
 *
 * These functions carry every retry/backoff/auth-pause decision the queue makes,
 * so they are tested exhaustively here in plain Node (no RN imports needed).
 */
import { describe, expect, it } from "vitest";
import {
    YEE_BACKOFF_BASE_MS,
    YEE_BACKOFF_CAP_MS,
    classifyError,
    computeBackoffMs,
    decideNextQueueState,
    isInBackoff,
    isTerminallyFailed,
    parseIncompleteAuditResponses,
    selectDrainableItems,
} from "lib/yee-sync-logic";
import { YEE_SYNC_MAX_ATTEMPTS, type YeeSyncQueueItem } from "lib/yee-types";

function makeItem(overrides: Partial<YeeSyncQueueItem> = {}): YeeSyncQueueItem {
    return {
        id: "submission-place-1",
        placeId: "place-1",
        createdAt: "2026-06-25T00:00:00.000Z",
        updatedAt: "2026-06-25T00:00:00.000Z",
        kind: "submission",
        payload: {
            participant_info: {},
            responses: {},
            place_id: "place-1",
            idempotency_key: "yee-place-1-abc",
            draft_version: 1,
        },
        attempts: 0,
        lastError: null,
        nextAttemptAtIso: null,
        maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
        failureReason: null,
        ...overrides,
    };
}

describe("computeBackoffMs", () => {
    it("returns 0 for attempt 0 (eligible immediately)", () => {
        expect(computeBackoffMs(0)).toBe(0);
    });

    it("returns 0 for negative attempts (defensive)", () => {
        expect(computeBackoffMs(-3)).toBe(0);
    });

    it("follows base * 2^(attempts-1) before the cap", () => {
        expect(computeBackoffMs(1)).toBe(YEE_BACKOFF_BASE_MS); // 5000
        expect(computeBackoffMs(2)).toBe(YEE_BACKOFF_BASE_MS * 2); // 10000
        expect(computeBackoffMs(3)).toBe(YEE_BACKOFF_BASE_MS * 4); // 20000
        expect(computeBackoffMs(4)).toBe(YEE_BACKOFF_BASE_MS * 8); // 40000
    });

    it("caps at YEE_BACKOFF_CAP_MS for large attempt counts", () => {
        expect(computeBackoffMs(7)).toBe(YEE_BACKOFF_CAP_MS); // 5000*64=320000 -> capped 300000
        expect(computeBackoffMs(20)).toBe(YEE_BACKOFF_CAP_MS);
    });

    it("never exceeds the cap and is monotonically non-decreasing", () => {
        let previous = 0;
        for (let attempts = 1; attempts <= 15; attempts += 1) {
            const value = computeBackoffMs(attempts);
            expect(value).toBeLessThanOrEqual(YEE_BACKOFF_CAP_MS);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
    });
});

describe("classifyError", () => {
    it("classifies transport failure (0) as retryable", () => {
        expect(classifyError(0)).toBe("retryable");
    });

    it("classifies 408 and 429 as retryable", () => {
        expect(classifyError(408)).toBe("retryable");
        expect(classifyError(429)).toBe("retryable");
    });

    it("classifies all 5xx as retryable", () => {
        for (const code of [500, 502, 503, 504, 599]) {
            expect(classifyError(code)).toBe("retryable");
        }
    });

    it("classifies 401 as auth", () => {
        expect(classifyError(401)).toBe("auth");
    });

    it("classifies 400/404/409/422 as terminal", () => {
        for (const code of [400, 404, 409, 422]) {
            expect(classifyError(code)).toBe("terminal");
        }
    });

    it("has NO 403 branch - 403 is never emitted, defaults to terminal", () => {
        // Backend never returns 403; if it somehow did we must not retry forever.
        expect(classifyError(403)).toBe("terminal");
    });

    it("defaults unknown non-success codes to terminal", () => {
        expect(classifyError(418)).toBe("terminal");
        expect(classifyError(301)).toBe("terminal");
    });
});

describe("decideNextQueueState", () => {
    const nowIso = "2026-06-25T12:00:00.000Z";

    it("auth: PAUSES without burning an attempt", () => {
        const item = makeItem({ attempts: 2 });
        const next = decideNextQueueState(
            item,
            { classification: "auth", statusCode: 401, message: "expired" },
            nowIso,
        );
        expect(next.attempts).toBe(2); // unchanged - no burn
        expect(next.isAuthPaused).toBe(true);
        expect(next.isTerminal).toBe(false);
        expect(next.nextAttemptAtIso).toBeNull();
        expect(next.failureReason).toBe("auth");
        expect(next.syncState).toBe("pending_upload");
    });

    it("terminal (validation): parks as sync_failed immediately", () => {
        const item = makeItem({ attempts: 0 });
        const next = decideNextQueueState(
            item,
            { classification: "terminal", statusCode: 422, message: "bad payload" },
            nowIso,
        );
        expect(next.isTerminal).toBe(true);
        expect(next.failureReason).toBe("validation");
        expect(next.syncState).toBe("sync_failed");
        expect(next.nextAttemptAtIso).toBeNull();
    });

    it("retryable (network, status 0): schedules backoff and bumps attempts", () => {
        const item = makeItem({ attempts: 0 });
        const next = decideNextQueueState(
            item,
            { classification: "retryable", statusCode: 0, message: "offline" },
            nowIso,
        );
        expect(next.attempts).toBe(1);
        expect(next.failureReason).toBe("network");
        expect(next.syncState).toBe("pending_upload");
        expect(next.isTerminal).toBe(false);
        // nextAttemptAtIso = now + computeBackoffMs(1) = now + 5000ms
        const expected = new Date(Date.parse(nowIso) + 5000).toISOString();
        expect(next.nextAttemptAtIso).toBe(expected);
    });

    it("retryable (server, 5xx): failureReason is 'server'", () => {
        const item = makeItem({ attempts: 1 });
        const next = decideNextQueueState(
            item,
            { classification: "retryable", statusCode: 503, message: "down" },
            nowIso,
        );
        expect(next.attempts).toBe(2);
        expect(next.failureReason).toBe("server");
        const expected = new Date(Date.parse(nowIso) + computeBackoffMs(2)).toISOString();
        expect(next.nextAttemptAtIso).toBe(expected);
    });

    it("retryable but reaching maxAttempts -> terminal sync_failed", () => {
        const item = makeItem({
            attempts: YEE_SYNC_MAX_ATTEMPTS - 1,
            maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
        });
        const next = decideNextQueueState(
            item,
            { classification: "retryable", statusCode: 500, message: "boom" },
            nowIso,
        );
        expect(next.attempts).toBe(YEE_SYNC_MAX_ATTEMPTS);
        expect(next.isTerminal).toBe(true);
        expect(next.failureReason).toBe("terminal");
        expect(next.syncState).toBe("sync_failed");
        expect(next.nextAttemptAtIso).toBeNull();
    });

    it("the full retryable backoff schedule increases then exhausts", () => {
        let item = makeItem({ attempts: 0, maxAttempts: 4 });
        const delays: (number | null)[] = [];
        for (let pass = 0; pass < 4; pass += 1) {
            const next = decideNextQueueState(
                item,
                { classification: "retryable", statusCode: 0, message: "net" },
                nowIso,
            );
            delays.push(
                next.nextAttemptAtIso === null
                    ? null
                    : Date.parse(next.nextAttemptAtIso) - Date.parse(nowIso),
            );
            item = { ...item, attempts: next.attempts, nextAttemptAtIso: next.nextAttemptAtIso };
        }
        // attempts 1,2,3 produce 5000,10000,20000; attempt 4 hits maxAttempts -> null (terminal)
        expect(delays).toEqual([5000, 10000, 20000, null]);
    });

    it("respects a custom per-item maxAttempts of 1 (single shot then terminal)", () => {
        const item = makeItem({ attempts: 0, maxAttempts: 1 });
        const next = decideNextQueueState(
            item,
            { classification: "retryable", statusCode: 0, message: "net" },
            nowIso,
        );
        expect(next.isTerminal).toBe(true);
        expect(next.attempts).toBe(1);
    });
});

describe("isInBackoff", () => {
    it("returns false when nextAttemptAtIso is null", () => {
        expect(isInBackoff(makeItem({ nextAttemptAtIso: null }), "2026-06-25T12:00:00.000Z")).toBe(
            false,
        );
    });

    it("returns true when now is before the scheduled retry", () => {
        const item = makeItem({ nextAttemptAtIso: "2026-06-25T12:00:10.000Z" });
        expect(isInBackoff(item, "2026-06-25T12:00:00.000Z")).toBe(true);
    });

    it("returns false when now is at or after the scheduled retry", () => {
        const item = makeItem({ nextAttemptAtIso: "2026-06-25T12:00:00.000Z" });
        expect(isInBackoff(item, "2026-06-25T12:00:00.000Z")).toBe(false);
        expect(isInBackoff(item, "2026-06-25T12:00:01.000Z")).toBe(false);
    });
});

describe("selectDrainableItems", () => {
    const nowIso = "2026-06-25T12:00:00.000Z";

    it("excludes terminally-failed items", () => {
        const terminal = makeItem({ id: "a", failureReason: "terminal" });
        const ready = makeItem({ id: "b" });
        const result = selectDrainableItems([terminal, ready], nowIso);
        expect(result.map((i) => i.id)).toEqual(["b"]);
    });

    it("excludes items still inside their backoff window", () => {
        const backedOff = makeItem({ id: "a", nextAttemptAtIso: "2026-06-25T12:05:00.000Z" });
        const ready = makeItem({ id: "b", nextAttemptAtIso: null });
        const dueNow = makeItem({ id: "c", nextAttemptAtIso: "2026-06-25T11:59:00.000Z" });
        const result = selectDrainableItems([backedOff, ready, dueNow], nowIso);
        expect(result.map((i) => i.id)).toEqual(["b", "c"]);
    });

    it("includes auth-paused items (null nextAttemptAtIso) so a fresh session re-drives them", () => {
        const authPaused = makeItem({ id: "a", failureReason: "auth", nextAttemptAtIso: null });
        const result = selectDrainableItems([authPaused], nowIso);
        expect(result.map((i) => i.id)).toEqual(["a"]);
    });

    it("preserves queue order", () => {
        const items = [makeItem({ id: "x" }), makeItem({ id: "y" }), makeItem({ id: "z" })];
        expect(selectDrainableItems(items, nowIso).map((i) => i.id)).toEqual(["x", "y", "z"]);
    });
});

describe("terminal items never drain again", () => {
    const NOW = "2026-01-01T00:00:00.000Z";

    function queued(overrides: Partial<YeeSyncQueueItem> = {}): YeeSyncQueueItem {
        return {
            id: "submission-1",
            placeId: "place-1",
            createdAt: NOW,
            updatedAt: NOW,
            kind: "submission",
            payload: { participant_info: {}, responses: {} },
            attempts: 1,
            lastError: null,
            nextAttemptAtIso: null,
            maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
            failureReason: null,
            ...overrides,
        };
    }

    it("parks a rejected payload instead of re-POSTing it forever", () => {
        // A 400/404/409/422 is recorded as "validation". Filtering only on the
        // literal "terminal" left these drainable on every tick.
        const rejected = queued({ failureReason: "validation", isTerminal: true });
        expect(isTerminallyFailed(rejected)).toBe(true);
        expect(selectDrainableItems([rejected], NOW)).toEqual([]);
    });

    it("parks an item serialized before the isTerminal flag existed", () => {
        // Queue items persist in MMKV across app updates, so an item written by
        // an older build has no isTerminal key at all.
        const legacyRejected = queued({ failureReason: "validation" });
        const legacyExhausted = queued({ failureReason: "terminal" });
        expect("isTerminal" in legacyRejected).toBe(false);
        expect(isTerminallyFailed(legacyRejected)).toBe(true);
        expect(isTerminallyFailed(legacyExhausted)).toBe(true);
        expect(selectDrainableItems([legacyRejected, legacyExhausted], NOW)).toEqual([]);
    });

    it("keeps retryable and auth-paused work drainable", () => {
        const networkFailure = queued({ failureReason: "network" });
        const authPaused = queued({ failureReason: "auth" });
        const fresh = queued();
        expect(selectDrainableItems([networkFailure, authPaused, fresh], NOW)).toHaveLength(3);
    });

    it("honors an explicit non-terminal flag over the reason string", () => {
        const recoverable = queued({ failureReason: "validation", isTerminal: false });
        expect(isTerminallyFailed(recoverable)).toBe(false);
        expect(selectDrainableItems([recoverable], NOW)).toHaveLength(1);
    });

    it("carries the decision from decideNextQueueState onto the item", () => {
        const next = decideNextQueueState(
            queued(),
            { classification: "terminal", statusCode: 422, message: "rejected" },
            NOW,
        );
        expect(next.isTerminal).toBe(true);
        const parked = queued({ failureReason: next.failureReason, isTerminal: next.isTerminal });
        expect(selectDrainableItems([parked], NOW)).toEqual([]);
    });
});

describe("incomplete_audit_responses is recoverable, not opaque", () => {
    const NOW = "2026-01-01T00:00:00.000Z";
    const DETAIL = {
        code: "incomplete_audit_responses",
        message: "This audit is missing required answers.",
        missing_primary_question_ids: ["access.q3"],
        missing_follow_up_question_ids: ["access.q1"],
    };

    function queued(overrides: Partial<YeeSyncQueueItem> = {}): YeeSyncQueueItem {
        return {
            id: "submission-1",
            placeId: "place-1",
            createdAt: NOW,
            updatedAt: NOW,
            kind: "submission",
            payload: { participant_info: {}, responses: {} },
            attempts: 0,
            lastError: null,
            nextAttemptAtIso: null,
            maxAttempts: YEE_SYNC_MAX_ATTEMPTS,
            failureReason: null,
            ...overrides,
        };
    }

    it("reads the framework-wrapped body the backend actually sends", () => {
        expect(parseIncompleteAuditResponses({ detail: DETAIL })).toEqual({
            missingPrimaryQuestionIds: ["access.q3"],
            missingFollowUpQuestionIds: ["access.q1"],
        });
    });

    it("reads a bare body too", () => {
        expect(parseIncompleteAuditResponses(DETAIL)).toEqual({
            missingPrimaryQuestionIds: ["access.q3"],
            missingFollowUpQuestionIds: ["access.q1"],
        });
    });

    it("refuses anything that is not this exact rejection", () => {
        // An unrecognized failure must not be dressed up as something the
        // auditor can fix by answering a question.
        expect(parseIncompleteAuditResponses(null)).toBeNull();
        expect(parseIncompleteAuditResponses("Not Found")).toBeNull();
        expect(parseIncompleteAuditResponses({ detail: "plain string detail" })).toBeNull();
        expect(parseIncompleteAuditResponses({ detail: { code: "something_else" } })).toBeNull();
        // The code with no question to fix leaves the auditor nowhere to go.
        expect(
            parseIncompleteAuditResponses({
                detail: { code: "incomplete_audit_responses", missing_primary_question_ids: [] },
            }),
        ).toBeNull();
    });

    it("drops non-string ids rather than trusting the payload", () => {
        expect(
            parseIncompleteAuditResponses({
                detail: {
                    code: "incomplete_audit_responses",
                    missing_primary_question_ids: ["access.q3", 42, null],
                    missing_follow_up_question_ids: "not-a-list",
                },
            }),
        ).toEqual({ missingPrimaryQuestionIds: ["access.q3"], missingFollowUpQuestionIds: [] });
    });

    it("parks as incomplete, distinct from an opaque rejection", () => {
        const incomplete = decideNextQueueState(
            queued(),
            {
                classification: "terminal",
                statusCode: 422,
                message: "missing answers",
                incomplete: parseIncompleteAuditResponses({ detail: DETAIL }),
            },
            NOW,
        );
        expect(incomplete.failureReason).toBe("incomplete");
        expect(incomplete.isTerminal).toBe(true);

        const opaque = decideNextQueueState(
            queued(),
            { classification: "terminal", statusCode: 409, message: "conflict", incomplete: null },
            NOW,
        );
        expect(opaque.failureReason).toBe("validation");
    });

    it("never re-POSTs an incomplete submission", () => {
        const parked = queued({ failureReason: "incomplete", isTerminal: true });
        expect(isTerminallyFailed(parked)).toBe(true);
        expect(selectDrainableItems([parked], NOW)).toEqual([]);
    });
});
