import { Stack } from "expo-router";

/**
 * Auth route group layout.
 */
export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}
