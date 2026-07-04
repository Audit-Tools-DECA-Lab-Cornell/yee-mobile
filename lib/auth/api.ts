import { z } from "zod";
import type { AuthSession, LoginPayload, SignupPayload } from "lib/auth/types";

const DEFAULT_API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || "https://audit-tools-backend.onrender.com/";
const authResponseSchema = z.object({
    access_token: z.string().min(1),
    token_type: z.literal("bearer"),
    expires_at: z.string().min(1),
    user: z.object({
        id: z.string().min(1),
        email: z.string().min(1),
        name: z.string().nullable(),
        account_type: z.enum(["MANAGER", "AUDITOR"]),
        has_auditor_profile: z.boolean().default(false),
    }),
});

/**
 * Error returned for failed authentication API requests.
 */
export class AuthApiError extends Error {
    readonly statusCode: number;
    readonly details: string | null;

    constructor(message: string, statusCode: number, details: string | null = null) {
        super(message);
        this.name = "AuthApiError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

/**
 * Authenticate an existing user with email and password.
 *
 * @param payload Login payload.
 * @returns Parsed auth session.
 */
export async function loginWithPassword(payload: LoginPayload): Promise<AuthSession> {
    const responsePayload = await postJson("/yee/auth/login", {
        email: payload.email,
        password: payload.password,
    });

    return parseAuthResponse(responsePayload);
}

/**
 * Create a new account and return an auth session.
 *
 * @param payload Signup payload.
 * @returns Parsed auth session.
 */
export async function signupWithPassword(payload: SignupPayload): Promise<AuthSession> {
    const responsePayload = await postJson("/yee/auth/signup", {
        email: payload.email,
        password: payload.password,
        name: payload.name,
        account_type: payload.accountType,
    });

    return parseAuthResponse(responsePayload);
}

/**
 * Resolve API base URL from environment with fallback.
 *
 * @returns Sanitized API base URL.
 */
function getApiBaseUrl(): string {
    const configuredValue = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (typeof configuredValue === "string" && configuredValue.trim().length > 0) {
        return configuredValue.trim();
    }

    return DEFAULT_API_BASE_URL;
}

/**
 * Execute a POST request and parse JSON response.
 *
 * @param path API path.
 * @param payload JSON payload.
 * @returns Parsed unknown response body.
 */
async function postJson(path: string, payload: Record<string, string>): Promise<unknown> {
    const baseUrl = getApiBaseUrl();

    let response: Response;

    try {
        response = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Network request failed.";
        throw new AuthApiError("Unable to reach authentication service.", 0, message);
    }

    if (!response.ok) {
        const details = await readErrorDetails(response);
        throw new AuthApiError("Authentication request failed.", response.status, details);
    }

    try {
        return await response.json();
    } catch {
        throw new AuthApiError("Authentication service returned invalid JSON.", response.status);
    }
}

/**
 * Read structured error details from a failed response.
 *
 * @param response Failed fetch response.
 * @returns Readable error details when available.
 */
async function readErrorDetails(response: Response): Promise<string | null> {
    const contentType = response.headers.get("content-type") ?? "";
    const isJsonResponse = contentType.includes("application/json");

    if (!isJsonResponse) {
        return response.statusText || null;
    }

    try {
        const payload: unknown = await response.json();

        if (!isRecord(payload)) {
            return response.statusText || null;
        }

        if (typeof payload.detail === "string") {
            return payload.detail;
        }

        if (typeof payload.message === "string") {
            return payload.message;
        }
    } catch {
        return response.statusText || null;
    }

    return response.statusText || null;
}

/**
 * Parse backend auth response into mobile auth session shape.
 *
 * @param payload Unknown backend payload.
 * @returns Validated auth session.
 */
function parseAuthResponse(payload: unknown): AuthSession {
    const parsedPayload = authResponseSchema.safeParse(payload);
    if (!parsedPayload.success) {
        throw new AuthApiError(
            "Authentication response shape is invalid.",
            500,
            formatZodIssues(parsedPayload.error),
        );
    }

    const sessionPayload = parsedPayload.data;

    return {
        accessToken: sessionPayload.access_token,
        tokenType: sessionPayload.token_type,
        expiresAt: sessionPayload.expires_at,
        user: {
            id: sessionPayload.user.id,
            email: sessionPayload.user.email,
            name: sessionPayload.user.name,
            accountType: sessionPayload.user.account_type,
            hasAuditorProfile: sessionPayload.user.has_auditor_profile,
        },
    };
}

/**
 * Check that a value is a non-null object map.
 *
 * @param value Value to validate.
 * @returns True when value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Convert schema validation issues into a compact readable string.
 *
 * @param error Zod validation error.
 * @returns Semicolon-delimited issue summary.
 */
function formatZodIssues(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const issuePath = issue.path.length > 0 ? issue.path.join(".") : "root";
            return `${issuePath}: ${issue.message}`;
        })
        .join("; ");
}
