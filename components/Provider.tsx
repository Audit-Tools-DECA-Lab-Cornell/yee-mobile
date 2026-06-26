import { TamaguiProvider, type TamaguiProviderProps } from "tamagui";
import { ToastProvider, ToastViewport } from "@tamagui/toast";
import { CurrentToast } from "./CurrentToast";
import { config as tamaguiConfig } from "../tamagui.config";
import { usePreferencesStore } from "stores/preferences-store";

export function Provider({
    children,
    ...rest
}: Readonly<Omit<TamaguiProviderProps, "config" | "defaultTheme">>) {
    const resolvedTheme = usePreferencesStore((state) => state.resolvedTheme);
    return (
        <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme} {...rest}>
            <ToastProvider
                swipeDirection="horizontal"
                duration={6000}
                native={
                    [
                        // uncomment the next line to do native toasts on mobile. NOTE: it'll require you making a dev build and won't work with Expo Go
                        // 'mobile'
                    ]
                }
            >
                {children}
                <CurrentToast />
                <ToastViewport top="$8" left={0} right={0} />
            </ToastProvider>
        </TamaguiProvider>
    );
}
