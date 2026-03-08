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
