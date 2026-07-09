/**
 * Framework-agnostic analytics registry.
 *
 * The real PostHog + Sentry implementations are injected once by
 * `AnalyticsProvider` at app startup via {@link registerAnalytics}. Everything
 * else in the app (stores, screens, the root navigator) imports only the thin
 * `identifyUser` / `resetUser` / `trackEvent` / `trackScreen` helpers below, so
 * no native SDK is pulled into store logic or unit tests. Calls before
 * registration (or when analytics is disabled) are silent no-ops.
 */

/** JSON-safe event/user properties (matches what analytics backends accept). */
type Props = Record<string, string | number | boolean | null>;

type AnalyticsImpls = {
    identify: (distinctId: string, properties?: Props) => void;
    reset: () => void;
    capture: (event: string, properties?: Props) => void;
    screen: (name: string, properties?: Props) => void;
};

let impls: AnalyticsImpls | null = null;

/** Wire the concrete PostHog/Sentry implementations. Called once at startup. */
export function registerAnalytics(next: AnalyticsImpls): void {
    impls = next;
}

/** Identify the current user across analytics + error monitoring. */
export function identifyUser(distinctId: string, properties?: Props): void {
    impls?.identify(distinctId, properties);
}

/** Clear the identified user (call on logout). */
export function resetUser(): void {
    impls?.reset();
}

/** Capture a product event. Safe to call from anywhere; no-ops if unwired. */
export function trackEvent(event: string, properties?: Props): void {
    impls?.capture(event, properties);
}

/** Record a screen view (manual, since expo-router needs manual capture). */
export function trackScreen(name: string, properties?: Props): void {
    impls?.screen(name, properties);
}
