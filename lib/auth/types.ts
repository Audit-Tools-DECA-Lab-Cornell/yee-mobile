/**
 * Account roles supported by the YEE backend.
 */
export type AccountType = "MANAGER" | "AUDITOR";

/**
 * Authenticated user shape consumed by the mobile app.
 */
export interface AuthUser {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
    readonly accountType: AccountType;
    /**
     * True when the user owns a usable auditor profile in their own
     * organization. A manager with such a profile uses the auditor field
     * workflows like a normal auditor. The backend already applies the
     * same-organization rule before setting this flag.
     */
    readonly hasAuditorProfile: boolean;
}

/**
 * Auth session persisted locally for route guarding.
 */
export interface AuthSession {
    readonly accessToken: string;
    readonly tokenType: "bearer";
    readonly expiresAt: string;
    readonly user: AuthUser;
}

/**
 * Login payload for password-based authentication.
 */
export interface LoginPayload {
    readonly email: string;
    readonly password: string;
}

/**
 * Signup payload for account creation.
 */
export interface SignupPayload {
    readonly email: string;
    readonly password: string;
    readonly name: string;
    readonly accountType: AccountType;
}
