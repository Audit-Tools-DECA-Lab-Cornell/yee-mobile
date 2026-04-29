import type { AuthSession } from "lib/auth/types";
import type {
    YeeAssignedPlace,
    YeeAuditStateResponse,
    YeeInstrumentResponse,
    YeeMyAuditItem,
    YeeSubmissionResponse,
} from "lib/yee-types";

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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

export async function fetchYeeInstrument(): Promise<YeeInstrumentResponse> {
    return getJson<YeeInstrumentResponse>("/yee/instrument");
}

export async function fetchAssignedPlaces(session: AuthSession): Promise<readonly YeeAssignedPlace[]> {
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
    return sendAuthedJson<YeeAuditStateResponse>(`/yee/places/${placeId}/draft`, session, "PUT", payload);
}

export async function previewScore(
    session: AuthSession,
    payload: {
        place_id: string;
        participant_info: Record<string, unknown>;
        responses: Record<string, unknown>;
    },
): Promise<YeeAuditStateResponse["score"]> {
    return sendAuthedJson<YeeAuditStateResponse["score"]>("/yee/audits/score", session, "POST", payload);
}

export async function submitAudit(
    session: AuthSession,
    payload: {
        place_id: string;
        participant_info: Record<string, unknown>;
        responses: Record<string, unknown>;
    },
): Promise<YeeSubmissionResponse> {
    return sendAuthedJson<YeeSubmissionResponse>("/yee/audits", session, "POST", payload);
}

export async function fetchSubmission(
    submissionId: string,
    session: AuthSession,
): Promise<YeeSubmissionResponse> {
    return getAuthedJson<YeeSubmissionResponse>(`/yee/audits/${submissionId}`, session);
}

async function getJson<T>(path: string): Promise<T> {
    return requestJson<T>(path, {
        method: "GET",
        headers: {
            Accept: "application/json",
        },
    });
}

async function getAuthedJson<T>(path: string, session: AuthSession): Promise<T> {
    return requestJson<T>(path, {
        method: "GET",
        headers: buildAuthedHeaders(session),
    });
}

async function sendAuthedJson<T>(
    path: string,
    session: AuthSession,
    method: "POST" | "PUT",
    body: Record<string, unknown>,
): Promise<T> {
    return requestJson<T>(path, {
        method,
        headers: {
            ...buildAuthedHeaders(session),
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

function buildAuthedHeaders(session: AuthSession): HeadersInit {
    return {
        Accept: "application/json",
        Authorization: `Bearer ${session.accessToken}`,
    };
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const baseUrl = getApiBaseUrl();

    let response: Response;
    try {
        response = await fetch(`${baseUrl}${path}`, init);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Network request failed.";
        throw new YeeMobileApiError("Unable to reach YEE service.", 0, message);
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
