/**
 * Analytics + error-monitoring configuration for the mobile app.
 *
 * All keys come from `EXPO_PUBLIC_*` env vars (inlined at build time). Every
 * integration is a no-op when its key is missing, so Expo Go / key-less builds
 * behave exactly as before. This module has NO native imports so it is safe to
 * pull into stores and unit tests.
 */

/** Master switch, mirrors the existing `EXPO_PUBLIC_BUG_REPORTING_ENABLED` gate. */
export const isAnalyticsEnabled = process.env.EXPO_PUBLIC_ANALYTICS_ENABLED === "true";

/** PostHog project API key (public). */
export const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";

/** PostHog ingestion host. */
export const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/** Sentry DSN (public). */
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/** PostHog product analytics + session replay should run. */
export const isPostHogEnabled = isAnalyticsEnabled && POSTHOG_KEY.length > 0;

/** Sentry crash/error monitoring should run. */
export const isSentryEnabled = isAnalyticsEnabled && SENTRY_DSN.length > 0;
