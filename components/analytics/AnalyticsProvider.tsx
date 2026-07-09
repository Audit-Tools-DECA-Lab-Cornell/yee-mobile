import { PostHogProvider } from "posthog-react-native";
import * as React from "react";

import { registerAnalytics } from "lib/analytics/client";
import { getPostHogClient } from "lib/analytics/posthog-client";
import { Sentry } from "lib/analytics/sentry";

/**
 * Wires PostHog product analytics + session replay and connects the analytics
 * registry so imperative `identifyUser` / `trackEvent` calls elsewhere in the
 * app reach both PostHog and Sentry.
 *
 * When PostHog is disabled the tree renders untouched; the registry is still
 * wired so Sentry user context is maintained.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
    const client = getPostHogClient();

    // Register concrete implementations during first render (before child effects
    // fire) so the initial identify from the root navigator is never dropped.
    React.useState(() => {
        registerAnalytics({
            identify: (distinctId, properties) => {
                client?.identify(distinctId, properties);
                const email = properties?.email;
                Sentry.setUser({ id: distinctId, ...(typeof email === "string" ? { email } : {}) });
            },
            reset: () => {
                client?.reset();
                Sentry.setUser(null);
            },
            capture: (event, properties) => client?.capture(event, properties),
            screen: (name, properties) => client?.screen(name, properties),
        });
        return null;
    });

    if (!client) {
        return <>{children}</>;
    }

    // expo-router does not expose the NavigationContainer, so screen views are
    // captured manually (see RootLayoutNav); touch autocapture stays on.
    return (
        <PostHogProvider
            client={client}
            autocapture={{ captureScreens: false, captureTouches: true }}
        >
            {children}
        </PostHogProvider>
    );
}
