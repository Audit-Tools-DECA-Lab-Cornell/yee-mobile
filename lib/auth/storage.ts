import * as SecureStore from "expo-secure-store";
import type { AccountType, AuthSession, AuthUser } from "lib/auth/types";

const AUTH_SESSION_STORAGE_KEY = "yee.auth.session.v1";
const OFFLINE_LOGIN_STORAGE_KEY = "yee.auth.offline-login.v1";
let inMemoryAuthSession: string | null = null;
let inMemoryOfflineLogin: string | null = null;

interface OfflineLoginPayload {
    readonly email: string;
    readonly password: string;
}

/**
 * Persist auth session in secure device storage.
 *
 * @param session Session to persist.
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
    const serializedSession = JSON.stringify(session);

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        if (!isAvailable) {
            inMemoryAuthSession = serializedSession;
            return;
        }

        await SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, serializedSession);
    } catch {
        inMemoryAuthSession = serializedSession;
    }
}

export async function saveOfflineLoginCredentials(payload: OfflineLoginPayload): Promise<void> {
    const serializedPayload = JSON.stringify({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
    } satisfies OfflineLoginPayload);

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        if (!isAvailable) {
            inMemoryOfflineLogin = serializedPayload;
            return;
        }

        await SecureStore.setItemAsync(OFFLINE_LOGIN_STORAGE_KEY, serializedPayload);
    } catch {
        inMemoryOfflineLogin = serializedPayload;
    }
}

export async function readOfflineLoginCredentials(): Promise<OfflineLoginPayload | null> {
    let rawPayload: string | null = null;

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        rawPayload = isAvailable
            ? await SecureStore.getItemAsync(OFFLINE_LOGIN_STORAGE_KEY)
            : inMemoryOfflineLogin;
    } catch {
        rawPayload = inMemoryOfflineLogin;
    }

    if (rawPayload === null) {
        return null;
    }

    try {
        const parsedPayload: unknown = JSON.parse(rawPayload);
        const recordPayload = parsedPayload as Record<string, unknown>;
        if (
            typeof parsedPayload === "object" &&
            parsedPayload !== null &&
            typeof recordPayload.email === "string" &&
            typeof recordPayload.password === "string"
        ) {
            return {
                email: recordPayload.email.trim().toLowerCase(),
                password: recordPayload.password,
            };
        }
    } catch {
        // fall through
    }

    await clearOfflineLoginCredentials();
    return null;
}

export async function clearOfflineLoginCredentials(): Promise<void> {
    inMemoryOfflineLogin = null;

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        if (!isAvailable) {
            return;
        }

        await SecureStore.deleteItemAsync(OFFLINE_LOGIN_STORAGE_KEY);
    } catch {
        // Ignore fallback clear errors.
    }
}

/**
 * Read auth session from secure device storage.
 *
 * @returns Persisted session if valid, otherwise null.
 */
export async function readAuthSession(): Promise<AuthSession | null> {
    let rawSession: string | null = null;

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        rawSession = isAvailable
            ? await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY)
            : inMemoryAuthSession;
    } catch {
        rawSession = inMemoryAuthSession;
    }

    if (rawSession === null) {
        return null;
    }

    const parsedSession = parseAuthSession(rawSession);
    if (parsedSession === null) {
        await clearAuthSession();
    }

    return parsedSession;
}

/**
 * Remove any persisted auth session.
 */
export async function clearAuthSession(): Promise<void> {
    inMemoryAuthSession = null;

    try {
        const isAvailable = await SecureStore.isAvailableAsync();
        if (!isAvailable) {
            return;
        }

        await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
    } catch {
        // Ignore fallback clear errors.
    }
}

/**
 * Parse and validate serialized session JSON.
 *
 * @param rawSession Raw JSON payload.
 * @returns Valid session object or null.
 */
function parseAuthSession(rawSession: string): AuthSession | null {
    try {
        const unknownPayload: unknown = JSON.parse(rawSession);
        return toAuthSession(unknownPayload);
    } catch {
        return null;
    }
}

/**
 * Convert unknown payload to validated auth session.
 *
 * @param payload Unknown payload.
 * @returns Validated auth session or null.
 */
function toAuthSession(payload: unknown): AuthSession | null {
    if (!isRecord(payload)) {
        return null;
    }

    const accessToken = readString(payload.accessToken);
    const tokenType = readString(payload.tokenType);
    const expiresAt = readString(payload.expiresAt);
    const user = toAuthUser(payload.user);

    if (accessToken === null || tokenType !== "bearer" || expiresAt === null || user === null) {
        return null;
    }

    return {
        accessToken,
        tokenType: "bearer",
        expiresAt,
        user,
    };
}

/**
 * Convert unknown payload to validated auth user.
 *
 * @param payload Unknown payload.
 * @returns Validated auth user or null.
 */
function toAuthUser(payload: unknown): AuthUser | null {
    if (!isRecord(payload)) {
        return null;
    }

    const id = readString(payload.id);
    const email = readString(payload.email);
    const name = readNullableString(payload.name);
    const accountType = readAccountType(payload.accountType);
    // Sessions persisted before the dual-role flag default to false.
    const hasAuditorProfile = payload.hasAuditorProfile === true;

    if (id === null || email === null || name === undefined || accountType === null) {
        return null;
    }

    return {
        id,
        email,
        name,
        accountType,
        hasAuditorProfile,
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
 * Read a required string property.
 */
function readString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * Read a nullable string property.
 */
function readNullableString(value: unknown): string | null | undefined {
    if (value === null) {
        return null;
    }

    return typeof value === "string" ? value : undefined;
}

/**
 * Read an account type supported by the YEE mobile app.
 */
function readAccountType(value: unknown): AccountType | null {
    return value === "MANAGER" || value === "AUDITOR" ? value : null;
}
