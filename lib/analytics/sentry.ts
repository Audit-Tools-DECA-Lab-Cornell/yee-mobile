/**
 * Sentry (React Native) initialisation.
 *
 * Imported for its side effect at the very top of the root layout so crashes
 * during startup are captured. A no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset.
 * Kept separate from the React tree so `Sentry.wrap` can wrap the root export.
 */
import * as Sentry from "@sentry/react-native";

import { SENTRY_DSN, isSentryEnabled } from "./config";

let initialised = false;

/** Initialise the Sentry SDK once. Safe to call repeatedly. */
export function initSentry(): void {
    if (initialised || !isSentryEnabled) {
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        // Full traces in dev, light sampling in production.
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
        // PostHog owns session replay; keep Sentry replay off to avoid duplication.
        enableAutoSessionTracking: true,
        sendDefaultPii: true,
    });

    initialised = true;
}

export { Sentry };
