import type { AccountType, AuthSession, AuthUser, LoginPayload, SignupPayload } from "lib/auth/types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

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
async function postJson(
  path: string,
  payload: Record<string, string>,
): Promise<unknown> {
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
  if (!isRecord(payload)) {
    throw new AuthApiError("Authentication response shape is invalid.", 500);
  }

  const accessToken = readString(payload.access_token);
  const tokenType = readString(payload.token_type);
  const expiresAt = readString(payload.expires_at);
  const user = parseAuthUser(payload.user);

  if (accessToken === null || tokenType !== "bearer" || expiresAt === null || user === null) {
    throw new AuthApiError("Authentication response fields are missing.", 500);
  }

  return {
    accessToken,
    tokenType: "bearer",
    expiresAt,
    user,
  };
}

/**
 * Parse backend user response into app user model.
 *
 * @param payload Unknown backend user payload.
 * @returns Validated auth user or null.
 */
function parseAuthUser(payload: unknown): AuthUser | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = readString(payload.id);
  const email = readString(payload.email);
  const name = readNullableString(payload.name);
  const accountType = readAccountType(payload.account_type);

  if (id === null || email === null || name === undefined || accountType === null) {
    return null;
  }

  return {
    id,
    email,
    name,
    accountType,
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
 * Read a required string from unknown input.
 *
 * @param value Value to validate.
 * @returns String when valid, otherwise null.
 */
function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Read a nullable string from unknown input.
 *
 * @param value Value to validate.
 * @returns String, null, or undefined if invalid type.
 */
function readNullableString(value: unknown): string | null | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return null;
  }

  return undefined;
}

/**
 * Read account type enum from unknown input.
 *
 * @param value Value to validate.
 * @returns Valid account type or null.
 */
function readAccountType(value: unknown): AccountType | null {
  if (value === "MANAGER" || value === "AUDITOR") {
    return value;
  }

  return null;
}
