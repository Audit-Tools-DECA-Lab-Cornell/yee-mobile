import { useEffect } from "react";
import { AppState, Keyboard, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";

export function applyHiddenNavBar(): void {
    if (Platform.OS !== "android") {
        return;
    }
    void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
}

export function useHiddenAndroidNavBar(routeKey: string): void {
    useEffect(() => {
        applyHiddenNavBar();

        const subscription = AppState.addEventListener("change", (nextAppState) => {
            if (nextAppState === "active") {
                applyHiddenNavBar();
            }
        });
        const keyboardShowSubscription = Keyboard.addListener("keyboardDidShow", applyHiddenNavBar);
        const keyboardHideSubscription = Keyboard.addListener("keyboardDidHide", applyHiddenNavBar);

        return () => {
            subscription.remove();
            keyboardShowSubscription.remove();
            keyboardHideSubscription.remove();
        };
    }, []);

    useEffect(() => {
        applyHiddenNavBar();
    }, [routeKey]);
}
