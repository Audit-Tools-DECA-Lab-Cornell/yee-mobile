import type { AuthSession } from "lib/auth/types";
import type {
    YeeAssignedPlace,
    YeeAuditStateResponse,
    YeeInstrumentResponse,
    YeeMyAuditItem,
    YeeSubmissionResponse,
} from "lib/yee-types";

const DEFAULT_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || "https://audit-tools-backend.onrender.com/";

export class YeeMobileApiError extends Error {
    readonly statusCode: number;
    readonly details: string | null;

    constructor(message: string, statusCode: number, details: string | null = null) {
        super(message);
        this.name = "YeeMobileApiError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

export function getApiBaseUrl(): string {
    const configuredValue = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (typeof configuredValue === "string" && configuredValue.trim().length > 0) {
        return configuredValue.trim();
    }

    return DEFAULT_API_BASE_URL;
}

/**
 * Per-request timeout tiers (ms). A "false online" device (connected to Wi-Fi
 * with no real internet) otherwise leaves a `fetch` hanging indefinitely, which
 * — before this guard — could block a blocking draft PUT and stall navigation.
 *
 * - {@link DEFAULT_REQUEST_TIMEOUT_MS}: normal reads/writes (places, audits, state).
 * - {@link DRAFT_MIRROR_TIMEOUT_MS}: OPTIONAL best-effort work (draft mirror,
 *   score preview) — kept short so a stalled mirror gives up fast and requeues.
 * - {@link SUBMIT_TIMEOUT_MS}: the one required, user-critical write — given the
 *   longest budget so a slow-but-alive backend can still land the submission.
 *
 * A timeout/abort is surfaced as {@link YeeMobileApiError} status `0`, so the
 * existing sync classifier treats it as a retryable transport failure.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
export const DRAFT_MIRROR_TIMEOUT_MS = 4_000;
export const SUBMIT_TIMEOUT_MS = 20_000;

interface RequestOptions {
    /** Override the default timeout for this request. */
    readonly timeoutMs?: number;
}

export async function fetchYeeInstrument(): Promise<YeeInstrumentResponse> {
    return getJson<YeeInstrumentResponse>("/yee/instrument");
}

export async function fetchAssignedPlaces(
    session: AuthSession,
): Promise<readonly YeeAssignedPlace[]> {
    return getAuthedJson<readonly YeeAssignedPlace[]>("/yee/dashboard/my-places", session);
}

export async function fetchMyAudits(session: AuthSession): Promise<readonly YeeMyAuditItem[]> {
    return getAuthedJson<readonly YeeMyAuditItem[]>("/yee/my-audits", session);
}

export async function fetchAuditState(
    placeId: string,
    session: AuthSession,
): Promise<YeeAuditStateResponse> {
    return getAuthedJson<YeeAuditStateResponse>(`/yee/places/${placeId}/audit-state`, session);
}

export async function saveAuditDraft(
    placeId: string,
    session: AuthSession,
    payload: {
        participant_info: Record<string, unknown>;
        responses: Record<string, unknown>;
    },
): Promise<YeeAuditStateResponse> {
    // Best-effort remote mirror — short timeout so a stalled PUT gives up fast
    // and stays queued rather than hanging the background drain.
    return sendAuthedJson<YeeAuditStateResponse>(
        `/yee/places/${placeId}/draft`,
        session,
        "PUT",
        payload,
        { timeoutMs: DRAFT_MIRROR_TIMEOUT_MS },
    );
}

export async function previewScore(
    session: AuthSession,
    payload: {
        place_id: string;
        participant_info: Record<string, unknown>;
        responses: Record<string, unknown>;
    },
): Promise<YeeAuditStateResponse["score"]> {
    // Score preview is optional UI sugar — same short budget as the draft mirror.
    return sendAuthedJson<YeeAuditStateResponse["score"]>(
        "/yee/audits/score",
        session,
        "POST",
        payload,
        { timeoutMs: DRAFT_MIRROR_TIMEOUT_MS },
    );
}

export async function submitAudit(
    session: AuthSession,
    payload: {
        place_id: string;
        participant_info: Record<string, unknown>;
        responses: Record<string, unknown>;
        /**
         * Stable idempotency key (max 64 chars). Sent as `idempotency_key` in
         * the POST body so an exact-key replay returns the existing record (200)
         * instead of creating a duplicate. This is the primary duplicate-submit
         * guard; omit only for legacy callers.
         */
        idempotency_key?: string;
    },
): Promise<YeeSubmissionResponse> {
    const body: Record<string, unknown> = {
        place_id: payload.place_id,
        participant_info: payload.participant_info,
        responses: payload.responses,
    };
    if (typeof payload.idempotency_key === "string" && payload.idempotency_key.length > 0) {
        body.idempotency_key = payload.idempotency_key;
    }
    // The one required write — give it the longest budget so a slow-but-alive
    // backend can still land the submission before we classify it as a timeout.
    return sendAuthedJson<YeeSubmissionResponse>("/yee/audits", session, "POST", body, {
        timeoutMs: SUBMIT_TIMEOUT_MS,
    });
}

export async function fetchSubmission(
    submissionId: string,
    session: AuthSession,
): Promise<YeeSubmissionResponse> {
    return getAuthedJson<YeeSubmissionResponse>(`/yee/audits/${submissionId}`, session);
}

async function getJson<T>(path: string, options?: RequestOptions): Promise<T> {
    return requestJson<T>(
        path,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
        },
        options,
    );
}

async function getAuthedJson<T>(
    path: string,
    session: AuthSession,
    options?: RequestOptions,
): Promise<T> {
    return requestJson<T>(
        path,
        {
            method: "GET",
            headers: buildAuthedHeaders(session),
        },
        options,
    );
}

async function sendAuthedJson<T>(
    path: string,
    session: AuthSession,
    method: "POST" | "PUT",
    body: Record<string, unknown>,
    options?: RequestOptions,
): Promise<T> {
    return requestJson<T>(
        path,
        {
            method,
            headers: {
                ...buildAuthedHeaders(session),
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        },
        options,
    );
}

function buildAuthedHeaders(session: AuthSession): HeadersInit {
    return {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
    };
}

async function requestJson<T>(
    path: string,
    init: RequestInit,
    options?: RequestOptions,
): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const timeoutMs =
        typeof options?.timeoutMs === "number" && options.timeoutMs > 0
            ? options.timeoutMs
            : DEFAULT_REQUEST_TIMEOUT_MS;

    // Abort the fetch if it outruns the timeout so a false-online device cannot
    // hang the request forever. An abort classifies as a transport failure
    // (status 0 -> retryable) exactly like a dropped connection.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new YeeMobileApiError(
                "YEE request timed out.",
                0,
                `Request exceeded ${timeoutMs}ms and was aborted.`,
            );
        }
        const message = error instanceof Error ? error.message : "Network request failed.";
        throw new YeeMobileApiError("Unable to reach YEE service.", 0, message);
    } finally {
        clearTimeout(timeoutId);
    }

    const text = await response.text();
    const payload = text.length > 0 ? safeParseJson(text) : null;

    if (!response.ok) {
        const details = extractErrorDetails(payload, response.statusText);
        throw new YeeMobileApiError("YEE mobile request failed.", response.status, details);
    }

    return payload as T;
}

function safeParseJson(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

function extractErrorDetails(payload: unknown, fallback: string): string | null {
    if (payload !== null && typeof payload === "object") {
        const details = payload as Record<string, unknown>;
        if (typeof details.detail === "string") return details.detail;
        if (typeof details.error === "string") return details.error;
        if (typeof details.message === "string") return details.message;
    }

    return fallback || null;
}
