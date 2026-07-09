import { TamaguiProvider, type TamaguiProviderProps } from "tamagui";
import { ToastProvider, ToastViewport } from "@tamagui/toast";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CurrentToast } from "./CurrentToast";
import { AnalyticsProvider } from "./analytics/AnalyticsProvider";
import { config as tamaguiConfig } from "../tamagui.config";
import { usePreferencesStore } from "stores/preferences-store";

function SafeToastViewport() {
    const insets = useSafeAreaInsets();

    return <ToastViewport top={insets.top + 8} left={insets.left} right={insets.right} />;
}

export function Provider({
    children,
    ...rest
}: Readonly<Omit<TamaguiProviderProps, "config" | "defaultTheme">>) {
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    return (
        <KeyboardProvider>
            <SafeAreaProvider>
                <AnalyticsProvider>
                    <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme} {...rest}>
                        <ToastProvider swipeDirection="horizontal" duration={6000} native={[]}>
                            {children}
                            <CurrentToast />
                            <SafeToastViewport />
                        </ToastProvider>
                    </TamaguiProvider>
                </AnalyticsProvider>
            </SafeAreaProvider>
        </KeyboardProvider>
    );
}
