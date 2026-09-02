import "../tamagui.generated.css";

import {
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import NetInfo from "@react-native-community/netinfo";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { BugReportFab } from "components/bug-report/BugReportFab";
import { Provider } from "components/Provider";
import {
    ForceUpdateScreen,
    ReleasePolicyLoadingScreen,
} from "components/release-policy/ForceUpdateScreen";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useBugReportFlushPrompt } from "lib/bug-report/use-flush-prompt";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import { useEasUpdateBootstrap } from "lib/eas-updates";
import { useReleasePolicyGate } from "lib/release-policy";
import { useHiddenAndroidNavBar } from "lib/system-bars";
import { shouldDrainQueue } from "lib/yee-sync-triggers";
import { useEffect, useMemo, useState } from "react";
import { AppState, Appearance, KeyboardAvoidingView, Platform } from "react-native";
import { useAuthStore } from "stores/auth-store";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";
import { identifyUser, resetUser, trackScreen } from "lib/analytics/client";
import { Sentry, initSentry } from "lib/analytics/sentry";

// Initialise crash/error monitoring as early as possible so startup errors are
// captured. Configured centrally in lib/analytics/sentry.ts (DSN from
// EXPO_PUBLIC_SENTRY_DSN); a no-op when the DSN is unset.
initSentry();

export { ErrorBoundary } from "expo-router";

const SCREENSHOT_AUTOMATION_ENABLED = __DEV__;

export const unstable_settings = {
    initialRouteName: "(auth)",
};

/**
 * Keep splash visible until fonts and auth startup are ready.
 */
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Load saved display preferences synchronously before first paint so the app
// opens directly in the auditor's chosen theme without a flash.
usePreferencesStore.getState().hydrate();

/**
 * Build a React Navigation theme from the active palette.
 *
 * @param colors Active color tokens.
 * @param scheme Resolved light or dark theme.
 * @returns Navigation theme matching the app palette.
 */
function buildNavigationTheme(colors: ColorTokens, scheme: ResolvedTheme) {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
        ...base,
        colors: {
            ...base.colors,
            background: colors.background,
            card: colors.surface,
            primary: colors.primary,
            text: colors.foreground,
            border: colors.border,
            notification: colors.primary,
        },
    };
}

/**
 * Root app layout that mounts providers and tab routes.
 */
const STARTUP_FALLBACK_TIMEOUT_MS = 8000;

function RootLayout() {
    const [startupFallbackElapsed, setStartupFallbackElapsed] = useState(false);
    const [fontsLoaded, fontError] = useFonts({
        "Geist-Regular": Geist_400Regular,
        "Geist-Medium": Geist_500Medium,
        "Geist-SemiBold": Geist_600SemiBold,
        "Geist-Bold": Geist_700Bold,
        "JetBrainsMono-Regular": JetBrainsMono_400Regular,
        "JetBrainsMono-Medium": JetBrainsMono_500Medium,
        "JetBrainsMono-SemiBold": JetBrainsMono_600SemiBold,
        "JetBrainsMono-Bold": JetBrainsMono_700Bold,
        "OpenDyslexic-Regular": require("../assets/fonts/OpenDyslexic-Regular.ttf"),
        "OpenDyslexic-Bold": require("../assets/fonts/OpenDyslexic-Bold.ttf"),
    });
    const canRenderApp = fontsLoaded || Boolean(fontError) || startupFallbackElapsed;

    useEffect(() => {
        if (canRenderApp) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setStartupFallbackElapsed(true);
            void SplashScreen.hideAsync().catch(() => undefined);
        }, STARTUP_FALLBACK_TIMEOUT_MS);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [canRenderApp]);

    if (!canRenderApp) {
        return null;
    }

    return (
        <Providers>
            <RootLayoutNav />
        </Providers>
    );
}

// Wrap the root so Sentry captures render errors and instruments touch/navigation.
export default Sentry.wrap(RootLayout);

interface ProvidersProps {
    readonly children: React.ReactNode;
}

/**
 * Wrapper for all global providers.
 */
function Providers({ children }: ProvidersProps) {
    return <Provider>{children}</Provider>;
}

/**
 * Root navigator with auth and app route groups.
 */
function RootLayoutNav() {
    const releasePolicyGate = useReleasePolicyGate();
    const router = useRouter();
    const segments = useSegments();
    const routeKey = segments.join("/");
    const authStatus = useAuthStore((state) => state.status);
    const session = useAuthStore((state) => state.session);
    const sessionUserId = useAuthStore((state) => state.session?.user.id ?? null);
    const initializeAuth = useAuthStore((state) => state.initialize);
    const hydrateOfflineState = useYeeMobileStore((state) => state.hydrateOfflineState);
    const refreshRemoteState = useYeeMobileStore((state) => state.refreshRemoteState);
    const syncPendingQueue = useYeeMobileStore((state) => state.syncPendingQueue);
    const setConnectivityState = useYeeMobileStore((state) => state.setConnectivityState);
    const isOnline = useYeeMobileStore((state) => state.isOnline);
    const hydratedAccountId = useYeeMobileStore((state) => state.hydratedAccountId);
    const clearOfflineSnapshot = useYeeMobileStore((state) => state.clearOfflineSnapshot);
    const probeOfflineReadiness = useYeeMobileStore((state) => state.probeOfflineReadiness);
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    const syncSystemTheme = usePreferencesStore((state) => state.syncSystemTheme);
    const designSystem = useDesignSystem();
    const navigationTheme = useMemo(
        () => buildNavigationTheme(designSystem.colors, resolvedTheme),
        [designSystem.colors, resolvedTheme],
    );

    useHiddenAndroidNavBar(routeKey);
    useEasUpdateBootstrap();
    useBugReportFlushPrompt(session, authStatus === "authenticated");

    // Manual screen tracking (expo-router does not expose the NavigationContainer
    // that PostHog autocapture needs), keyed on the resolved route.
    useEffect(() => {
        trackScreen(routeKey || "index");
    }, [routeKey]);

    // Keep PostHog + Sentry identity in sync with the auth session. Reacting to
    // the store's `session` selector covers every login path (password, offline
    // fallback, signup, restored session) and logout with one effect.
    useEffect(() => {
        const user = session?.user;
        if (user) {
            identifyUser(user.id, {
                email: user.email,
                name: user.name,
                role: user.accountType,
                has_auditor_profile: user.hasAuditorProfile,
            });
        } else if (authStatus === "unauthenticated") {
            resetUser();
        }
    }, [session, authStatus]);

    useEffect(() => {
        void initializeAuth();
        // Readiness flags only — the pre-sign-in checklist needs them, and this
        // cannot open the drain gate because it never sets a hydrated account.
        void probeOfflineReadiness();
    }, [initializeAuth, probeOfflineReadiness]);

    // Load the signed-in account's offline state. Ordering this AFTER auth, rather
    // than racing it at mount, is what removes the startup race: there is no
    // longer a concurrent load for the drain trigger to miss. `hydrateOfflineState`
    // is idempotent per account, so this may fire freely.
    //
    // Depends only on the account id — never on what it writes.
    useEffect(() => {
        if (sessionUserId === null) {
            clearOfflineSnapshot();
            return;
        }
        void hydrateOfflineState(sessionUserId);
    }, [clearOfflineSnapshot, hydrateOfflineState, sessionUserId]);

    useEffect(() => {
        const subscription = Appearance.addChangeListener(() => {
            syncSystemTheme();
        });

        return () => {
            subscription.remove();
        };
    }, [syncSystemTheme]);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setConnectivityState(Boolean(state.isConnected && state.isInternetReachable !== false));
        });

        return () => {
            unsubscribe();
        };
    }, [setConnectivityState]);

    const canDrainQueue = shouldDrainQueue({
        authStatus,
        isOnline,
        sessionUserId,
        hydratedAccountId,
    });

    // Pull remote state. Kept SEPARATE from the drain below: chaining a refresh
    // onto the drain is what turned a trigger defect into a request storm, since
    // the refresh moved the very state the trigger read.
    useEffect(() => {
        if (authStatus !== "authenticated" || session === null || !isOnline) {
            return;
        }

        void refreshRemoteState(session);
    }, [authStatus, isOnline, refreshRemoteState, session]);

    // Push the outbox. Makes no network call when the queue is empty, so even a
    // misbehaving trigger cannot generate traffic on its own.
    useEffect(() => {
        if (!canDrainQueue || session === null) {
            return;
        }

        void syncPendingQueue(session, { throttle: true });
    }, [canDrainQueue, session, syncPendingQueue]);

    // Reopening the app is the other moment a stranded queue can move — and the
    // retry for a hydration that failed, since that leaves no account loaded and
    // nothing else would attempt it again this session.
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (next) => {
            if (next !== "active") {
                return;
            }
            // Read current state at FIRE time rather than capturing it in deps.
            // Depending on `hydratedAccountId` here would make this effect depend
            // on state its own body writes — the shape of the production request
            // storm — and would re-register the listener on every change.
            const currentSession = useAuthStore.getState().session;
            if (currentSession === null) {
                return;
            }
            // Local read, so worth attempting with or without a network. This is
            // also the retry for a hydration that failed at sign-in.
            void useYeeMobileStore.getState().hydrateOfflineState(currentSession.user.id);
            if (useYeeMobileStore.getState().isOnline) {
                // Self-guarding: drainQueue refuses a session that does not own
                // the loaded queue, and the interval floor bounds the rate.
                void useYeeMobileStore
                    .getState()
                    .syncPendingQueue(currentSession, { throttle: true });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (authStatus !== "loading") {
            void SplashScreen.hideAsync().catch(() => undefined);
        }
    }, [authStatus]);

    useEffect(() => {
        if (authStatus === "loading") {
            return;
        }

        const segment0 = String(segments[0] ?? "");
        const inAuthGroup = segment0 === "(auth)";
        const isScreenshotAutomationRoute = segment0 === "__screenshot-bootstrap";
        const canBypassAuthForScreenshotAutomation =
            SCREENSHOT_AUTOMATION_ENABLED && isScreenshotAutomationRoute;

        // Allow the screenshot bootstrap route to manage auth state and
        // redirection itself so simulator automation can open any target page.
        if (canBypassAuthForScreenshotAutomation) {
            return;
        }

        if (authStatus === "authenticated" && inAuthGroup) {
            router.replace("/(tabs)");
            return;
        }

        if (authStatus === "unauthenticated" && !inAuthGroup) {
            router.replace("/(auth)/login");
        }
    }, [authStatus, router, segments]);

    if (releasePolicyGate.status === "loading") {
        return <ReleasePolicyLoadingScreen />;
    }

    if (releasePolicyGate.status === "blocked") {
        return (
            <ForceUpdateScreen
                decision={releasePolicyGate.decision}
                onRetry={releasePolicyGate.retry}
            />
        );
    }

    if (authStatus === "loading") {
        return null;
    }

    return (
        <ThemeProvider value={navigationTheme}>
            <StatusBar
                hidden={Platform.OS === "android"}
                style={resolvedTheme === "dark" ? "light" : "dark"}
            />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <Stack
                    screenOptions={{
                        contentStyle: {
                            backgroundColor: designSystem.colors.background,
                            paddingTop: 20,
                        },
                    }}
                >
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="audit/[placeId]" options={{ headerShown: false }} />
                    <Stack.Screen name="reports/[submissionId]" options={{ headerShown: false }} />
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                </Stack>
            </KeyboardAvoidingView>
            <BugReportFab />
        </ThemeProvider>
    );
}
