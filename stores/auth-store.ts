import { create } from "zustand";
import { AuthApiError, loginWithPassword, signupWithPassword } from "lib/auth/api";
import {
    clearAuthSession,
    clearOfflineLoginCredentials,
    readAuthSession,
    readOfflineLoginCredentials,
    saveAuthSession,
    saveOfflineLoginCredentials,
} from "lib/auth/storage";
import type { AuthSession, LoginPayload, SignupPayload } from "lib/auth/types";
import { setActiveAccount } from "lib/yee-secure-draft-storage";
import { prepareLegacyMigrationOwner } from "lib/yee-legacy-draft-migration";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const AUTH_INITIALIZE_TIMEOUT_MS = 5000;

/**
 * Auth loading states used by route guards.
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Global auth store shape.
 */
interface AuthStoreState {
    readonly status: AuthStatus;
    readonly session: AuthSession | null;
    readonly isSubmitting: boolean;
    readonly errorMessage: string | null;
    readonly hasOfflineLoginCredentials: boolean;
    initialize: () => Promise<void>;
    login: (payload: LoginPayload) => Promise<void>;
    signup: (payload: SignupPayload) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

/**
 * Global auth state store for session management and route gating.
 */
export const useAuthStore = create<AuthStoreState>((set, get) => ({
    status: "loading",
    session: null,
    isSubmitting: false,
    errorMessage: null,
    hasOfflineLoginCredentials: false,

    initialize: async () => {
        const currentStatus = get().status;
        if (currentStatus !== "loading") {
            return;
        }

        try {
            const cachedOfflineLogin = await withTimeout(
                readOfflineLoginCredentials(),
                "offline login credentials",
            );
            const persistedSession = await withTimeout(readAuthSession(), "auth session");
            if (persistedSession === null || !isSupportedFieldSession(persistedSession)) {
                await prepareLegacyMigrationOwner(null);
                activateOfflineAccount(null);
                if (persistedSession !== null) {
                    await clearAuthSession();
                }

                set(() => ({
                    session: null,
                    status: "unauthenticated",
                    hasOfflineLoginCredentials: cachedOfflineLogin !== null,
                    // Explain the sign-out instead of silently ejecting a
                    // manager who has no auditor profile yet.
                    errorMessage: persistedSession !== null ? AUDITOR_ONLY_MESSAGE : null,
                }));
                return;
            }

            // Keep the last valid auditor identity available for offline field work,
            // even if the backend token is stale. Online requests will still require
            // a fresh backend-accepted session.
            await prepareLegacyMigrationOwner(persistedSession.user.id);
            activateOfflineAccount(persistedSession.user.id);
            set(() => ({
                session: persistedSession,
                status: "authenticated",
                hasOfflineLoginCredentials: cachedOfflineLogin !== null,
            }));
        } catch {
            activateOfflineAccount(null);
            set(() => ({
                session: null,
                status: "unauthenticated",
                hasOfflineLoginCredentials: false,
            }));
        }
    },

    login: async (payload: LoginPayload) => {
        set(() => ({
            isSubmitting: true,
            errorMessage: null,
        }));

        try {
            const session = ensureAuditorSession(await loginWithPassword(payload));
            await saveAuthSession(session);
            await saveOfflineLoginCredentials(payload);

            activateOfflineAccount(session.user.id);
            set(() => ({
                session,
                status: "authenticated",
                isSubmitting: false,
                errorMessage: null,
                hasOfflineLoginCredentials: true,
            }));
        } catch (error) {
            if (error instanceof AuthApiError && error.statusCode === 0) {
                const cachedCredentials = await readOfflineLoginCredentials();
                const cachedSession = await readAuthSession();
                const normalizedEmail = payload.email.trim().toLowerCase();

                if (
                    cachedCredentials !== null &&
                    cachedSession !== null &&
                    isSupportedFieldSession(cachedSession) &&
                    cachedCredentials.email === normalizedEmail &&
                    cachedCredentials.password === payload.password
                ) {
                    await prepareLegacyMigrationOwner(cachedSession.user.id);
                    activateOfflineAccount(cachedSession.user.id);
                    set(() => ({
                        session: cachedSession,
                        status: "authenticated",
                        isSubmitting: false,
                        errorMessage: null,
                        hasOfflineLoginCredentials: true,
                    }));
                    return;
                }
            }

            const message = toAuthErrorMessage(error);
            activateOfflineAccount(null);

            set(() => ({
                session: null,
                status: "unauthenticated",
                isSubmitting: false,
                errorMessage: message,
            }));

            throw error;
        }
    },

    signup: async (payload: SignupPayload) => {
        set(() => ({
            isSubmitting: true,
            errorMessage: null,
        }));

        try {
            const session = ensureAuditorSession(await signupWithPassword(payload));
            await saveAuthSession(session);
            await saveOfflineLoginCredentials({
                email: payload.email,
                password: payload.password,
            });

            activateOfflineAccount(session.user.id);
            set(() => ({
                session,
                status: "authenticated",
                isSubmitting: false,
                errorMessage: null,
                hasOfflineLoginCredentials: true,
            }));
        } catch (error) {
            const message = toAuthErrorMessage(error);
            activateOfflineAccount(null);

            set(() => ({
                session: null,
                status: "unauthenticated",
                isSubmitting: false,
                errorMessage: message,
            }));

            throw error;
        }
    },

    logout: async () => {
        // Invalidate stale hydration, refresh, and drain work synchronously before
        // any secure-storage await gives it a chance to mutate another account.
        activateOfflineAccount(null);
        await clearAuthSession();
        await clearOfflineLoginCredentials();
        // Clear the active-account pointer only. Drafts and the sync queue are
        // intentionally preserved so token-expiry logout never loses unsynced
        // field work; they are removed only on explicit account removal.
        set(() => ({
            session: null,
            status: "unauthenticated",
            isSubmitting: false,
            errorMessage: null,
            hasOfflineLoginCredentials: false,
        }));
    },

    clearError: () => {
        set(() => ({
            errorMessage: null,
        }));
    },
}));

function activateOfflineAccount(accountId: string | null): void {
    setActiveAccount(accountId);
    useYeeMobileStore.getState().clearOfflineSnapshot();
}

/**
 * Bound startup storage reads so a native SecureStore stall cannot trap the app on splash.
 */
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`${label} read timed out.`));
        }, AUTH_INITIALIZE_TIMEOUT_MS);

        promise.then(
            (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timeoutId);
                reject(error);
            },
        );
    });
}

/**
 * Convert unknown auth error values to a user-facing message.
 *
 * @param error Unknown error value.
 * @returns Readable error message.
 */
function toAuthErrorMessage(error: unknown): string {
    if (error instanceof AuthApiError) {
        if (error.details !== null && error.details.trim().length > 0) {
            return error.details;
        }

        if (error.statusCode === 0) {
            return "Unable to reach the authentication service.";
        }

        if (error.statusCode === 403) {
            return "This mobile app is built for field auditors. Sign in with your auditor account.";
        }

        return "Authentication failed. Please check your details and try again.";
    }

    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message;
    }

    return "An unexpected authentication error occurred.";
}

/**
 * Message shown when a manager without a usable auditor profile is signed out
 * or rejected. Managers become field-capable by creating a self auditor profile
 * in the web app.
 */
const AUDITOR_ONLY_MESSAGE =
    "This app is for auditor field work. Managers can create their auditor profile in the web app's Manager Settings, then sign in here again.";

/**
 * Check that a session can run the auditor field workflows: a standard auditor,
 * or a manager who owns a usable self auditor profile (the backend already
 * applies the same-organization rule before setting hasAuditorProfile).
 *
 * @param session Auth session to check.
 * @returns True when the session supports field work.
 */
function isSupportedFieldSession(session: AuthSession): boolean {
    if (session.user.accountType === "AUDITOR") {
        return true;
    }

    return session.user.accountType === "MANAGER" && session.user.hasAuditorProfile;
}

/**
 * Ensure the session can run the mobile auditor workflow.
 *
 * @param session Auth session from backend.
 * @returns Same session when it supports field work.
 */
function ensureAuditorSession(session: AuthSession): AuthSession {
    if (!isSupportedFieldSession(session)) {
        throw new AuthApiError(AUDITOR_ONLY_MESSAGE, 403, AUDITOR_ONLY_MESSAGE);
    }

    return session;
}
