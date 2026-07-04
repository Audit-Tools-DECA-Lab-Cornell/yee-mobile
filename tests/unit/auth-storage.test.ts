/**
 * Baseline tests for lib/auth/storage.ts.
 *
 * Covers:
 * - Valid session round-trip: saveAuthSession / readAuthSession.
 * - Invalid / partial payloads are rejected (readAuthSession returns null).
 * - expiresAt is preserved as-is (the module stores it verbatim; expiry
 *   checking is intentionally deferred to API-call time per the plan).
 * - clearAuthSession removes the persisted session.
 * - SecureStore unavailable falls back to in-memory storage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "lib/auth/types";

// Import the functions after setup.ts has installed the expo-secure-store mock.
import { clearAuthSession, readAuthSession, saveAuthSession } from "lib/auth/storage";

// Re-import SecureStore so tests can inject failures.
import * as SecureStore from "expo-secure-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession(overrides: Partial<AuthSession> = {}): AuthSession {
    return {
        accessToken: "tok-abc-123",
        tokenType: "bearer",
        expiresAt: "2030-01-01T00:00:00.000Z",
        user: {
            id: "user-1",
            email: "auditor@example.com",
            name: "Test Auditor",
            accountType: "AUDITOR",
            hasAuditorProfile: false,
        },
        ...overrides,
    };
}

beforeEach(async () => {
    // Clear any leftover session between tests.
    await clearAuthSession();
});

// ---------------------------------------------------------------------------
// Valid session round-trip
// ---------------------------------------------------------------------------
describe("saveAuthSession / readAuthSession — valid session", () => {
    it("persists and retrieves a full valid session", async () => {
        const session = makeSession();
        await saveAuthSession(session);
        const result = await readAuthSession();
        expect(result).not.toBeNull();
        expect(result?.accessToken).toBe("tok-abc-123");
        expect(result?.tokenType).toBe("bearer");
        expect(result?.expiresAt).toBe("2030-01-01T00:00:00.000Z");
        expect(result?.user.id).toBe("user-1");
        expect(result?.user.email).toBe("auditor@example.com");
        expect(result?.user.name).toBe("Test Auditor");
        expect(result?.user.accountType).toBe("AUDITOR");
    });

    it("preserves expiresAt verbatim (expiry is checked at API-call time, not here)", async () => {
        // Deliberately use a past date — the storage layer must NOT reject it.
        const session = makeSession({ expiresAt: "2000-01-01T00:00:00.000Z" });
        await saveAuthSession(session);
        const result = await readAuthSession();
        expect(result?.expiresAt).toBe("2000-01-01T00:00:00.000Z");
    });

    it("preserves a null name on the user", async () => {
        const session = makeSession();
        const sessionWithNullName: AuthSession = {
            ...session,
            user: { ...session.user, name: null },
        };
        await saveAuthSession(sessionWithNullName);
        const result = await readAuthSession();
        expect(result?.user.name).toBeNull();
    });

    it("supports MANAGER account type", async () => {
        const session = makeSession({
            user: {
                id: "manager-1",
                email: "manager@example.com",
                name: "Test Manager",
                accountType: "MANAGER",
                hasAuditorProfile: true,
            },
        });
        await saveAuthSession(session);
        const result = await readAuthSession();
        expect(result?.user.accountType).toBe("MANAGER");
        expect(result?.user.hasAuditorProfile).toBe(true);
    });

    it("defaults hasAuditorProfile to false for sessions persisted before the dual-role flag", async () => {
        const session = makeSession();
        const legacyUser = { ...session.user } as Record<string, unknown>;
        delete legacyUser.hasAuditorProfile;
        await saveAuthSession({ ...session, user: legacyUser } as unknown as AuthSession);
        const result = await readAuthSession();
        expect(result).not.toBeNull();
        expect(result?.user.hasAuditorProfile).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// clearAuthSession
// ---------------------------------------------------------------------------
describe("clearAuthSession", () => {
    it("returns null after clearing a previously saved session", async () => {
        await saveAuthSession(makeSession());
        await clearAuthSession();
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("is a no-op when no session is persisted", async () => {
        await expect(clearAuthSession()).resolves.toBeUndefined();
        expect(await readAuthSession()).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Invalid / partial persisted payloads are rejected
// ---------------------------------------------------------------------------
describe("readAuthSession — invalid persisted payloads", () => {
    it("returns null and clears when stored JSON is corrupted", async () => {
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce("{not valid json");
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when tokenType is not 'bearer'", async () => {
        const badSession = {
            accessToken: "tok",
            tokenType: "basic", // invalid
            expiresAt: "2030-01-01T00:00:00.000Z",
            user: {
                id: "u-1",
                email: "x@x.com",
                name: null,
                accountType: "AUDITOR",
            },
        };
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(JSON.stringify(badSession));
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when accessToken is an empty string", async () => {
        const badSession = {
            accessToken: "",
            tokenType: "bearer",
            expiresAt: "2030-01-01T00:00:00.000Z",
            user: {
                id: "u-1",
                email: "x@x.com",
                name: null,
                accountType: "AUDITOR",
            },
        };
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(JSON.stringify(badSession));
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when expiresAt is missing", async () => {
        const badSession = {
            accessToken: "tok",
            tokenType: "bearer",
            // expiresAt is absent
            user: {
                id: "u-1",
                email: "x@x.com",
                name: null,
                accountType: "AUDITOR",
            },
        };
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(JSON.stringify(badSession));
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when user.email is missing", async () => {
        const badSession = {
            accessToken: "tok",
            tokenType: "bearer",
            expiresAt: "2030-01-01T00:00:00.000Z",
            user: {
                id: "u-1",
                // email is absent
                name: null,
                accountType: "AUDITOR",
            },
        };
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(JSON.stringify(badSession));
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when user.accountType is an unknown value", async () => {
        const badSession = {
            accessToken: "tok",
            tokenType: "bearer",
            expiresAt: "2030-01-01T00:00:00.000Z",
            user: {
                id: "u-1",
                email: "x@x.com",
                name: null,
                accountType: "SUPERADMIN", // unknown
            },
        };
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(JSON.stringify(badSession));
        const result = await readAuthSession();
        expect(result).toBeNull();
    });

    it("returns null when the stored value is a JSON array (not an object)", async () => {
        vi.spyOn(SecureStore, "getItemAsync").mockResolvedValueOnce(
            JSON.stringify(["not", "an", "object"]),
        );
        const result = await readAuthSession();
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// SecureStore unavailable — falls back to in-memory storage
// ---------------------------------------------------------------------------
describe("saveAuthSession — SecureStore unavailable", () => {
    it("stores session in memory when SecureStore is not available", async () => {
        vi.spyOn(SecureStore, "isAvailableAsync").mockResolvedValueOnce(false);
        const session = makeSession();
        await saveAuthSession(session);

        // Now restore isAvailableAsync for the read so it uses memory fallback too.
        vi.spyOn(SecureStore, "isAvailableAsync").mockResolvedValueOnce(false);
        const result = await readAuthSession();
        expect(result?.accessToken).toBe("tok-abc-123");
    });
});
