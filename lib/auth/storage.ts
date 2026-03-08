import { requireOptionalNativeModule } from "expo-modules-core";
import type { AccountType, AuthSession, AuthUser } from "lib/auth/types";

const AUTH_SESSION_STORAGE_KEY = "yee.auth.session.v1";
let inMemoryAuthSession: string | null = null;
let secureStoreApiCache: SecureStoreApi | null | undefined;

interface SecureStoreApi {
    readonly setItemAsync: (key: string, value: string) => Promise<void>;
    readonly getItemAsync: (key: string) => Promise<string | null>;
    readonly deleteItemAsync: (key: string) => Promise<void>;
    readonly isAvailableAsync?: () => Promise<boolean>;
}

type SetValueWithKeyAsyncFunction = (
    value: string,
    key: string,
    options?: Record<string, unknown>,
) => Promise<void>;
type GetValueWithKeyAsyncFunction = (
    key: string,
    options?: Record<string, unknown>,
) => Promise<string | null>;
type DeleteValueWithKeyAsyncFunction = (
    key: string,
    options?: Record<string, unknown>,
) => Promise<void>;

/**
 * Persist auth session in secure device storage.
 *
 * @param session Session to persist.
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
    const serializedSession = JSON.stringify(session);
    const secureStoreApi = await resolveSecureStoreApi();
    if (secureStoreApi === null) {
        inMemoryAuthSession = serializedSession;
        return;
    }

    try {
        await secureStoreApi.setItemAsync(AUTH_SESSION_STORAGE_KEY, serializedSession);
    } catch {
        inMemoryAuthSession = serializedSession;
    }
}

/**
 * Read auth session from secure device storage.
 *
 * @returns Persisted session if valid, otherwise null.
 */
export async function readAuthSession(): Promise<AuthSession | null> {
    const secureStoreApi = await resolveSecureStoreApi();

    let rawSession: string | null = null;
    if (secureStoreApi === null) {
        rawSession = inMemoryAuthSession;
    } else {
        try {
            rawSession = await secureStoreApi.getItemAsync(AUTH_SESSION_STORAGE_KEY);
        } catch {
            rawSession = inMemoryAuthSession;
        }
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
    const secureStoreApi = await resolveSecureStoreApi();
    inMemoryAuthSession = null;

    if (secureStoreApi === null) {
        return;
    }

    try {
        await secureStoreApi.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
    } catch {
        // Ignore fallback clear errors.
    }
}

/**
 * Resolve secure-store module safely for runtimes without native support.
 *
 * @returns SecureStore API when available, otherwise null.
 */
async function resolveSecureStoreApi(): Promise<SecureStoreApi | null> {
    if (secureStoreApiCache !== undefined) {
        return secureStoreApiCache;
    }

    try {
        const optionalNativeModule: unknown = requireOptionalNativeModule("ExpoSecureStore");
        const resolvedApi = toSecureStoreApi(optionalNativeModule);
        if (resolvedApi === null) {
            secureStoreApiCache = null;
            return null;
        }

        const available = resolvedApi.isAvailableAsync
            ? await resolvedApi.isAvailableAsync()
            : true;
        secureStoreApiCache = available ? resolvedApi : null;
        return secureStoreApiCache;
    } catch {
        secureStoreApiCache = null;
        return null;
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
 * Validate imported module shape for secure-store usage.
 *
 * @param value Unknown imported module.
 * @returns True when required methods are present.
 */
function isSecureStoreApi(value: unknown): value is SecureStoreApi {
    if (!isRecord(value)) {
        return false;
    }

    const setItemAsync = value.setItemAsync;
    const getItemAsync = value.getItemAsync;
    const deleteItemAsync = value.deleteItemAsync;

    return (
        typeof setItemAsync === "function" &&
        typeof getItemAsync === "function" &&
        typeof deleteItemAsync === "function"
    );
}

/**
 * Convert optional native module shape into stable secure-store API methods.
 *
 * @param value Optional native module value.
 * @returns Normalized secure-store API or null.
 */
function toSecureStoreApi(value: unknown): SecureStoreApi | null {
    if (!isRecord(value)) {
        return null;
    }

    if (isSecureStoreApi(value)) {
        return value;
    }

    const setValueWithKeyAsync = toSetValueWithKeyAsyncFunction(value.setValueWithKeyAsync);
    const getValueWithKeyAsync = toGetValueWithKeyAsyncFunction(value.getValueWithKeyAsync);
    const deleteValueWithKeyAsync = toDeleteValueWithKeyAsyncFunction(
        value.deleteValueWithKeyAsync,
    );

    if (
        setValueWithKeyAsync === null ||
        getValueWithKeyAsync === null ||
        deleteValueWithKeyAsync === null
    ) {
        return null;
    }

    const isAvailableAsync = toIsAvailableAsyncFunction(value.isAvailableAsync);

    return {
        setItemAsync: async (key: string, storedValue: string) => {
            await setValueWithKeyAsync(storedValue, key);
        },
        getItemAsync: async (key: string) => {
            return await getValueWithKeyAsync(key);
        },
        deleteItemAsync: async (key: string) => {
            await deleteValueWithKeyAsync(key);
        },
        ...(isAvailableAsync !== null ? { isAvailableAsync } : {}),
    };
}

/**
 * Coerce unknown value to secure-store setValueWithKey function.
 *
 * @param value Unknown value.
 * @returns Typed function or null.
 */
function toSetValueWithKeyAsyncFunction(value: unknown): SetValueWithKeyAsyncFunction | null {
    return typeof value === "function" ? (value as SetValueWithKeyAsyncFunction) : null;
}

/**
 * Coerce unknown value to secure-store getValueWithKey function.
 *
 * @param value Unknown value.
 * @returns Typed function or null.
 */
function toGetValueWithKeyAsyncFunction(value: unknown): GetValueWithKeyAsyncFunction | null {
    return typeof value === "function" ? (value as GetValueWithKeyAsyncFunction) : null;
}

/**
 * Coerce unknown value to secure-store deleteValueWithKey function.
 *
 * @param value Unknown value.
 * @returns Typed function or null.
 */
function toDeleteValueWithKeyAsyncFunction(value: unknown): DeleteValueWithKeyAsyncFunction | null {
    return typeof value === "function" ? (value as DeleteValueWithKeyAsyncFunction) : null;
}

/**
 * Coerce unknown value to secure-store availability check function.
 *
 * @param value Unknown value.
 * @returns Typed function or null.
 */
function toIsAvailableAsyncFunction(value: unknown): (() => Promise<boolean>) | null {
    return typeof value === "function" ? (value as () => Promise<boolean>) : null;
}

/**
 * Read a string value from unknown input.
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
 * @returns String, null, or undefined when invalid type.
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
 * Read account type from unknown input.
 *
 * @param value Value to validate.
 * @returns Account type when valid, otherwise null.
 */
function readAccountType(value: unknown): AccountType | null {
    if (value === "MANAGER" || value === "AUDITOR") {
        return value;
    }

    return null;
}
