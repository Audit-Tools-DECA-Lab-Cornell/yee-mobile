import { useMemo } from "react";
import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useDesignSystem } from "lib/design-system";

export function useYeeStackHeaderOptions() {
    const designSystem = useDesignSystem();

    return useMemo<NativeStackNavigationOptions>(() => {
        const headerTitleAlign: NativeStackNavigationOptions["headerTitleAlign"] =
            Platform.OS === "ios" ? "center" : "left";

        return {
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
            headerBackButtonMenuEnabled: true,
            headerBackVisible: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: designSystem.colors.surfaceMuted },
            headerTintColor: designSystem.colors.primary,
            headerTitleAlign,
            headerTitleStyle: {
                color: designSystem.colors.foreground,
                fontFamily: designSystem.fonts.bodyBold,
            },
        };
    }, [designSystem]);
}
