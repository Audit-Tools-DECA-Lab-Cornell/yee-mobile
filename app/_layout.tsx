import "../tamagui.generated.css";

import { useEffect } from "react";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
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
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { StatusBar } from "expo-status-bar";
import { Provider } from "components/Provider";
import { designSystem } from "lib/design-system";
import { useAuthStore } from "stores/auth-store";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
    initialRouteName: "(auth)",
};

/**
 * Keep splash visible until fonts are loaded.
 */
SplashScreen.preventAutoHideAsync();

const navigationTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: designSystem.colors.background,
        card: designSystem.colors.background,
        primary: designSystem.colors.primary,
        text: designSystem.colors.foreground,
        border: designSystem.colors.border,
        notification: designSystem.colors.primary,
    },
};

/**
 * Root app layout that mounts providers and tab routes.
 */
export default function RootLayout() {
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
    });

    useEffect(() => {
        if (fontsLoaded || fontError) {
            void SplashScreen.hideAsync();
        }
    }, [fontError, fontsLoaded]);

    if (!fontsLoaded && !fontError) {
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
    const initializeAuth = useAuthStore((state) => state.initialize);

    useEffect(() => {
        void initializeAuth();
    }, [initializeAuth]);

    useEffect(() => {
        if (authStatus === "loading") {
            return;
        }

        const inAuthGroup = segments[0] === "(auth)";

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
            <StatusBar style="light" />
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
            </Stack>
        </ThemeProvider>
    );
}
