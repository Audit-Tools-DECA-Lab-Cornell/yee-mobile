import type { AuthSession } from "lib/auth/types";
import { getApiBaseUrl } from "lib/yee-api";
import { z } from "zod";

import {
    type BugReport,
    bugReportCreateRequestSchema,
    bugReportSchema,
    type BugReportCreateRequest,
    type KnownIssueMatch,
    knownIssueMatchSchema,
} from "lib/bug-report/types";

/** Default per-request timeout so a stalled link never hangs the report flow. */
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/** Per-call options forwarded to the underlying transport. */
export interface BugReportApiOptions {
    /** Override the request timeout. Defaults to `DEFAULT_REQUEST_TIMEOUT_MS`. */
    timeoutMs?: number;
}

function safeParseJson(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

/**
 * Authenticated JSON request against the YEE backend. Reuses the shared base URL
 * resolution and Bearer scheme from `lib/yee-api`, and adds an abort-based
 * timeout so bug-report calls cannot hang the UI.
 */
export async function authedBugReportRequest(
    session: AuthSession,
    path: string,
    init: RequestInit,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    let response: Response;
    try {
        response = await fetch(`${getApiBaseUrl()}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${session.accessToken}`,
                ...(init.headers ?? {}),
            },
        });
    } finally {
        clearTimeout(timer);
    }

    const text = await response.text();
    const payload = text.length > 0 ? safeParseJson(text) : null;
    if (!response.ok) {
        const detail =
            payload !== null &&
            typeof payload === "object" &&
            typeof (payload as { detail?: unknown }).detail === "string"
                ? (payload as { detail: string }).detail
                : `Request failed with status ${response.status}`;
        throw new Error(detail);
    }
    return payload;
}

/**
 * File a new bug report. Online-only: the caller must confirm connectivity
 * before invoking this (the offline path queues locally instead).
 */
export async function createBugReport(
    session: AuthSession,
    payload: BugReportCreateRequest,
    options?: BugReportApiOptions,
): Promise<BugReport> {
    const parsed = bugReportCreateRequestSchema.parse(payload);
    const response = await authedBugReportRequest(
        session,
        "/yee/bug-reports",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(parsed),
        },
        options?.timeoutMs,
    );
    return bugReportSchema.parse(response);
}

/**
 * Return published known issues matching the reporter's query (deflection).
 */
export async function matchKnownIssues(
    session: AuthSession,
    query: string,
    options?: BugReportApiOptions,
): Promise<KnownIssueMatch[]> {
    const params = new URLSearchParams({ q: query, surface: "mobile" });
    const response = await authedBugReportRequest(
        session,
        `/yee/known-issues/match?${params.toString()}`,
        { method: "GET" },
        options?.timeoutMs,
    );
    return z.array(knownIssueMatchSchema).parse(response);
}
