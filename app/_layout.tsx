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
import {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import NetInfo from "@react-native-community/netinfo";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Provider } from "components/Provider";
import { useFonts } from "expo-font";
import { setVisibilityAsync } from "expo-navigation-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import { useEffect, useMemo, useState } from "react";
import { Appearance, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "stores/auth-store";
import { usePreferencesStore, type ResolvedTheme } from "stores/preferences-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

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

export default function RootLayout() {
    const [startupFallbackElapsed, setStartupFallbackElapsed] = useState(false);
    const [fontsLoaded, fontError] = useFonts({
        "Geist-Regular": Geist_400Regular,
        "Geist-Medium": Geist_500Medium,
        "Geist-SemiBold": Geist_600SemiBold,
        "Geist-Bold": Geist_700Bold,
        "SpaceGrotesk-Regular": SpaceGrotesk_400Regular,
        "SpaceGrotesk-Medium": SpaceGrotesk_500Medium,
        "SpaceGrotesk-SemiBold": SpaceGrotesk_600SemiBold,
        "SpaceGrotesk-Bold": SpaceGrotesk_700Bold,
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
    const router = useRouter();
    const segments = useSegments();
    const authStatus = useAuthStore((state) => state.status);
    const session = useAuthStore((state) => state.session);
    const initializeAuth = useAuthStore((state) => state.initialize);
    const hydrateOfflineState = useYeeMobileStore((state) => state.hydrateOfflineState);
    const refreshRemoteState = useYeeMobileStore((state) => state.refreshRemoteState);
    const syncPendingQueue = useYeeMobileStore((state) => state.syncPendingQueue);
    const setConnectivityState = useYeeMobileStore((state) => state.setConnectivityState);
    const isOnline = useYeeMobileStore((state) => state.isOnline);
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    const syncSystemTheme = usePreferencesStore((state) => state.syncSystemTheme);
    const designSystem = useDesignSystem();
    const navigationTheme = useMemo(
        () => buildNavigationTheme(designSystem.colors, resolvedTheme),
        [designSystem.colors, resolvedTheme],
    );

    useEffect(() => {
        void initializeAuth();
        void hydrateOfflineState();
    }, [hydrateOfflineState, initializeAuth]);

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

    useEffect(() => {
        if (authStatus !== "authenticated" || session === null || !isOnline) {
            return;
        }

        void syncPendingQueue(session).then(() => refreshRemoteState(session));
    }, [authStatus, isOnline, refreshRemoteState, session, syncPendingQueue]);

    useEffect(() => {
        if (authStatus !== "loading") {
            void SplashScreen.hideAsync().catch(() => undefined);
        }
    }, [authStatus]);

    useEffect(() => {
        setVisibilityAsync("hidden");
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

    if (authStatus === "loading") {
        return null;
    }

    return (
        <ThemeProvider value={navigationTheme}>
            <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <SafeAreaView
                    edges={["top"]}
                    style={{ flex: 1, backgroundColor: designSystem.colors.background }}
                >
                    <Stack
                        screenOptions={{
                            contentStyle: {
                                backgroundColor: designSystem.colors.background,
                            },
                        }}
                    >
                        <Stack.Screen
                            name="(auth)"
                            options={{
                                headerShown: false,
                            }}
                        />
                        <Stack.Screen
                            name="(tabs)"
                            options={{
                                headerShown: false,
                            }}
                        />
                        <Stack.Screen
                            name="settings"
                            options={{
                                headerShown: false,
                            }}
                        />
                    </Stack>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </ThemeProvider>
    );
}
