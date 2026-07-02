import { Stack } from "expo-router";

export default function AuditLayout() {
    // `fade` (not the default zoom/slide) so stepping between survey pages reads
    // as an in-place content change, not navigating to a different screen.
    return (
        <Stack
            screenOptions={{ headerShown: true, title: "Audit", animation: "slide_from_bottom" }}
        />
    );
}
