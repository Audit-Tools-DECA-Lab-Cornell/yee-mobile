import { Stack } from "expo-router";

export const unstable_settings = {
    initialRouteName: "login",
};

/**
 * Auth route group layout.
 */
export default function AuthLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
