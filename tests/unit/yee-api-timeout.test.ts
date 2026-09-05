/**
 * Timeout / error-classification tests for the abortable fetch layer in
 * lib/yee-api.ts (Mobile performance plan - "Network hardening").
 *
 * A "false online" device (associated to Wi-Fi with no real internet) leaves a
 * bare `fetch` hanging forever, which - before the AbortController guard - could
 * stall a blocking draft PUT and freeze navigation. These tests drive the real
 * requestJson pipeline through the public API functions, using a fake-timer
 * clock plus a fetch stub that only rejects when the abort signal fires, so we
 * can prove:
 *   - each per-request timeout tier aborts and surfaces status 0 (retryable),
 *   - a genuine transport error is also status 0 but with a distinct message,
 *   - real HTTP errors still preserve their status code + parsed details,
 *   - a successful response is parsed and returned unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    DEFAULT_REQUEST_TIMEOUT_MS,
    DRAFT_MIRROR_TIMEOUT_MS,
    SUBMIT_TIMEOUT_MS,
    YeeMobileApiError,
    fetchMyAudits,
    fetchYeeInstrument,
    parseMyAuditsResponse,
    saveAuditDraft,
    submitAudit,
} from "lib/yee-api";
import type { AuthSession } from "lib/auth/types";

function makeSession(): AuthSession {
    return {
        accessToken: "token-123",
        tokenType: "bearer",
        expiresAt: "2099-01-01T00:00:00.000Z",
        user: {
            id: "auditor-1",
            email: "a@b.com",
            name: "A",
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
    };
}

/** A minimal Response-shaped stub for the success / HTTP-error paths. */
function fakeResponse(init: {
    ok: boolean;
    status: number;
    statusText?: string;
    body?: string;
}): Response {
    return {
        ok: init.ok,
        status: init.status,
        statusText: init.statusText ?? "",
        text: async () => init.body ?? "",
    } as unknown as Response;
}

/**
 * A fetch that never resolves on its own and only rejects when the caller's
 * AbortController fires - mimicking a real socket hanging on a false-online link.
 */
function hangingFetch(): typeof fetch {
    return vi.fn((_input: unknown, init?: { signal?: AbortSignal }) => {
        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
                const abortError = new Error("The operation was aborted.");
                abortError.name = "AbortError";
                reject(abortError);
            });
        });
    }) as unknown as typeof fetch;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
});

describe("requestJson - abort on timeout throws status 0", () => {
    it("aborts a GET at the default tier and throws a status-0 timeout error", async () => {
        globalThis.fetch = hangingFetch();

        const pending = fetchYeeInstrument();
        // Attach a settled tracker so we can assert the request is still in flight
        // before the timeout, without leaking an unhandled rejection.
        let settled = false;
        void pending.then(
            () => (settled = true),
            () => (settled = true),
        );

        // One tick short of the tier: still hanging.
        await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS - 1);
        expect(settled).toBe(false);

        // Crossing the tier fires the abort, which the fetch stub turns into a
        // rejection classified as a transport failure (status 0 -> retryable).
        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).rejects.toBeInstanceOf(YeeMobileApiError);
        await expect(pending).rejects.toMatchObject({ statusCode: 0 });
    });

    it("uses the SHORT draft-mirror tier for saveAuditDraft (aborts at 4s, not 12s)", async () => {
        globalThis.fetch = hangingFetch();

        const pending = saveAuditDraft("place-1", makeSession(), {
            participant_info: {},
            responses: {},
        });
        let settled = false;
        void pending.then(
            () => (settled = true),
            () => (settled = true),
        );

        await vi.advanceTimersByTimeAsync(DRAFT_MIRROR_TIMEOUT_MS - 1);
        expect(settled).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await expect(pending).rejects.toMatchObject({ statusCode: 0 });
        // The tier really is shorter than the default read tier.
        expect(DRAFT_MIRROR_TIMEOUT_MS).toBeLessThan(DEFAULT_REQUEST_TIMEOUT_MS);
    });

    it("uses the LONG submit tier for submitAudit (still pending at the default tier)", async () => {
        globalThis.fetch = hangingFetch();

        const pending = submitAudit(makeSession(), {
            place_id: "place-1",
            participant_info: {},
            responses: {},
            idempotency_key: "k-1",
        });
        let settled = false;
        void pending.then(
            () => (settled = true),
            () => (settled = true),
        );

        // At the default read tier the submit is deliberately still in flight -
        // the user-critical write gets the longest budget.
        await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS);
        expect(settled).toBe(false);

        await vi.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS - DEFAULT_REQUEST_TIMEOUT_MS);
        await expect(pending).rejects.toMatchObject({ statusCode: 0 });
        expect(SUBMIT_TIMEOUT_MS).toBeGreaterThan(DEFAULT_REQUEST_TIMEOUT_MS);
    });
});

describe("requestJson - transport vs HTTP errors", () => {
    it("classifies a non-abort transport rejection as status 0 with a reach message", async () => {
        globalThis.fetch = vi.fn(async () => {
            throw new Error("ECONNREFUSED");
        }) as unknown as typeof fetch;

        const pending = fetchYeeInstrument();
        await expect(pending).rejects.toMatchObject({
            statusCode: 0,
            message: "Unable to reach YEE service.",
            details: "ECONNREFUSED",
        });
    });

    it("preserves the HTTP status code and parsed error details on a 4xx", async () => {
        globalThis.fetch = vi.fn(async () =>
            fakeResponse({
                ok: false,
                status: 422,
                statusText: "Unprocessable Entity",
                body: JSON.stringify({ detail: "Weather is required" }),
            }),
        ) as unknown as typeof fetch;

        const pending = saveAuditDraft("place-1", makeSession(), {
            participant_info: {},
            responses: {},
        });
        await expect(pending).rejects.toMatchObject({
            statusCode: 422,
            details: "Weather is required",
        });
    });

    it("falls back to statusText when the error body has no detail field", async () => {
        globalThis.fetch = vi.fn(async () =>
            fakeResponse({ ok: false, status: 500, statusText: "Internal Server Error", body: "" }),
        ) as unknown as typeof fetch;

        await expect(fetchYeeInstrument()).rejects.toMatchObject({
            statusCode: 500,
            details: "Internal Server Error",
        });
    });

    it("parses and returns a successful JSON body unchanged", async () => {
        globalThis.fetch = vi.fn(async () =>
            fakeResponse({
                ok: true,
                status: 200,
                statusText: "OK",
                body: JSON.stringify({ sections: [] }),
            }),
        ) as unknown as typeof fetch;

        await expect(fetchYeeInstrument()).resolves.toEqual({ sections: [] });
    });
});

describe("/yee/my-audits response contract", () => {
    it("parses canonical maxima and preserves nullable legacy rows", async () => {
        globalThis.fetch = vi.fn(async () =>
            fakeResponse({
                ok: true,
                status: 200,
                body: JSON.stringify([
                    {
                        id: "audit-current",
                        place_id: "place-1",
                        place_name: "Youth Hub",
                        submitted_at: "2026-09-04T12:00:00.000Z",
                        total_score: 61,
                        total_raw_maximum: 122,
                        total_weighted_maximum: 2.22,
                        instrument_key: "yee",
                        instrument_version: "2026-09",
                    },
                    {
                        id: "audit-legacy",
                        place_id: "place-2",
                        place_name: "Legacy Park",
                        submitted_at: "2025-01-01T12:00:00.000Z",
                        total_score: 10,
                        total_raw_maximum: null,
                        total_weighted_maximum: null,
                    },
                ]),
            }),
        ) as unknown as typeof fetch;

        await expect(fetchMyAudits(makeSession())).resolves.toMatchObject([
            {
                id: "audit-current",
                total_raw_maximum: 122,
                total_weighted_maximum: 2.22,
            },
            {
                id: "audit-legacy",
                total_raw_maximum: null,
                total_weighted_maximum: null,
            },
        ]);
    });

    it("normalizes omitted and non-finite maxima to unavailable", () => {
        const [audit] = parseMyAuditsResponse([
            {
                id: "audit-corrupt",
                place_id: "place-1",
                place_name: "Youth Hub",
                submitted_at: "2026-09-04T12:00:00.000Z",
                total_score: 10,
                total_raw_maximum: Number.POSITIVE_INFINITY,
            },
        ]);

        expect(audit?.total_raw_maximum).toBeNull();
        expect(audit?.total_weighted_maximum).toBeNull();
    });

    it("rejects maxima with the wrong JSON type", () => {
        expect(() =>
            parseMyAuditsResponse([
                {
                    id: "audit-invalid",
                    place_id: "place-1",
                    place_name: "Youth Hub",
                    submitted_at: "2026-09-04T12:00:00.000Z",
                    total_score: 10,
                    total_raw_maximum: "122",
                    total_weighted_maximum: null,
                },
            ]),
        ).toThrow("maxima must be numbers or null");
    });
});
