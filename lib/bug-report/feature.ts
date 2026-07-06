/**
 * Developer-mode flag for the internal bug-reporting feature on mobile.
 *
 * The whole feature is gated behind a single env flag so it can be hidden for
 * production with one change (and removed cleanly later). When unset or not
 * "true", the floating report button never mounts.
 */
export function isBugReportingEnabled(): boolean {
    return process.env.EXPO_PUBLIC_BUG_REPORTING_ENABLED === "true";
}
