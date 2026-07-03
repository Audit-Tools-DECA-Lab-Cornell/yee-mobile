import { Stack } from "expo-router";

/**
 * Audit stack. The wizard is no longer a route-per-step: `index` is a single
 * persistent shell that swaps step content in place, so the only real screen
 * transitions here are shell → review → submitted. Each screen manages its own
 * header; the stack just declares the group.
 */
export default function AuditLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, title: "Audit" }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="review" />
            <Stack.Screen name="submitted" />
        </Stack>
    );
}
