import "../tamagui.generated.css";

import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Provider } from "components/Provider";
import { useAuthStore } from "stores/auth-store";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
    initialRouteName: "(auth)",
};

/**
 * Keep splash visible until fonts are loaded.
 */
SplashScreen.preventAutoHideAsync();

/**
 * Root app layout that mounts providers and tab routes.
 */
export default function RootLayout() {
    const [interLoaded, interError] = useFonts({
        Inter: require("@tamagui/font-inter/otf/Inter-Medium.otf"),
        InterBold: require("@tamagui/font-inter/otf/Inter-Bold.otf"),
    });

    useEffect(() => {
        if (interLoaded || interError) {
            SplashScreen.hideAsync();
        }
    }, [interLoaded, interError]);

    if (!interLoaded && !interError) {
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
    const colorScheme = useColorScheme();
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
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack>
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
