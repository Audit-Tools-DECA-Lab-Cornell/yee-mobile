/**
 * Lazily-constructed PostHog client singleton.
 *
 * Native import — only pulled in by `AnalyticsProvider` (real app), never by
 * stores or unit tests. Returns `null` when analytics is disabled so callers can
 * cheaply skip all work.
 */
import { PostHog } from "posthog-react-native";

import { POSTHOG_HOST, POSTHOG_KEY, isPostHogEnabled } from "./config";

let client: PostHog | null = null;

/** Get (or lazily create) the shared PostHog client. `null` when disabled. */
export function getPostHogClient(): PostHog | null {
    if (!isPostHogEnabled) {
        return null;
    }

    if (!client) {
        client = new PostHog(POSTHOG_KEY, {
            host: POSTHOG_HOST,
            // Full-fidelity session replay: no masking, per product decision for the
            // pilot. Recording must also be enabled in the PostHog project settings.
            enableSessionReplay: true,
            sessionReplayConfig: {
                maskAllTextInputs: false,
                maskAllImages: false,
                maskAllSandboxedViews: false,
            },
            // App open/backgrounded/updated events for retention + funnels.
            captureAppLifecycleEvents: true,
        });
    }

    return client;
}
