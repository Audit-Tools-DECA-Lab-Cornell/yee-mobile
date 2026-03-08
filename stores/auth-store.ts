import { create } from "zustand";
import { AuthApiError, loginWithPassword, signupWithPassword } from "lib/auth/api";
import { clearAuthSession, readAuthSession, saveAuthSession } from "lib/auth/storage";
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

  initialize: async () => {
    const currentStatus = get().status;
    if (currentStatus !== "loading") {
      return;
    }

    try {
      const persistedSession = await readAuthSession();
      if (persistedSession === null || isSessionExpired(persistedSession)) {
        if (persistedSession !== null) {
          await clearAuthSession();
        }

        set(() => ({
          session: null,
          status: "unauthenticated",
        }));
        return;
      }

      set(() => ({
        session: persistedSession,
        status: "authenticated",
      }));
    } catch {
      set(() => ({
        session: null,
        status: "unauthenticated",
      }));
    }
  },

  login: async (payload: LoginPayload) => {
    set(() => ({
      isSubmitting: true,
      errorMessage: null,
    }));

    try {
      const session = await loginWithPassword(payload);
      await saveAuthSession(session);

      set(() => ({
        session,
        status: "authenticated",
        isSubmitting: false,
        errorMessage: null,
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

  signup: async (payload: SignupPayload) => {
    set(() => ({
      isSubmitting: true,
      errorMessage: null,
    }));

    try {
      const session = await signupWithPassword(payload);
      await saveAuthSession(session);

      set(() => ({
        session,
        status: "authenticated",
        isSubmitting: false,
        errorMessage: null,
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
    set(() => ({
      session: null,
      status: "unauthenticated",
      isSubmitting: false,
      errorMessage: null,
    }));
  },

  clearError: () => {
    set(() => ({
      errorMessage: null,
    }));
  },
}));

/**
 * Determine whether a session should be treated as expired.
 *
 * @param session Auth session to inspect.
 * @returns True when expired or invalid timestamp.
 */
function isSessionExpired(session: AuthSession): boolean {
  const expiresAtTimestamp = Date.parse(session.expiresAt);
  if (Number.isNaN(expiresAtTimestamp)) {
    return true;
  }

  return expiresAtTimestamp <= Date.now();
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

    return "Authentication failed. Please check your details and try again.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "An unexpected authentication error occurred.";
}
