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
            const cachedOfflineLogin = await readOfflineLoginCredentials();
            const persistedSession = await readAuthSession();
            if (persistedSession === null || persistedSession.user.accountType !== "AUDITOR") {
                if (persistedSession !== null) {
                    await clearAuthSession();
                }

                set(() => ({
                    session: null,
                    status: "unauthenticated",
                    hasOfflineLoginCredentials: cachedOfflineLogin !== null,
                }));
                return;
            }

            // Keep the last valid auditor identity available for offline field work,
            // even if the backend token is stale. Online requests will still require
            // a fresh backend-accepted session.
            set(() => ({
                session: persistedSession,
                status: "authenticated",
                hasOfflineLoginCredentials: cachedOfflineLogin !== null,
            }));
        } catch {
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
                    cachedSession.user.accountType === "AUDITOR" &&
                    cachedCredentials.email === normalizedEmail &&
                    cachedCredentials.password === payload.password
                ) {
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

            set(() => ({
                session,
                status: "authenticated",
                isSubmitting: false,
                errorMessage: null,
                hasOfflineLoginCredentials: true,
            }));
        } catch (error) {
            const message = toAuthErrorMessage(error);

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
        await clearAuthSession();
        await clearOfflineLoginCredentials();
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
 * Ensure session role matches the mobile auditor workflow.
 *
 * @param session Auth session from backend.
 * @returns Same session when role is AUDITOR.
 */
function ensureAuditorSession(session: AuthSession): AuthSession {
    if (session.user.accountType !== "AUDITOR") {
        throw new AuthApiError(
            "This mobile app supports auditor field workflows. Use an assigned auditor account.",
            403,
        );
    }

    return session;
}
