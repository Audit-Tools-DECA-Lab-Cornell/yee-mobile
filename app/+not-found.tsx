import { Stack, useRouter } from "expo-router";
import { YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { AppButton, EmptyState } from "components/ui";
import { ArrowRight, MapPin } from "components/icons";

/**
 * Fallback screen shown for unmatched routes, styled with the YEE design system.
 */
export default function NotFoundScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();

    return (
        <>
            <Stack.Screen options={{ title: "Page not found" }} />
            <YStack flex={1} justify="center" bg={designSystem.colors.background} px="$4">
                <EmptyState
                    icon={<MapPin size={22} color={designSystem.colors.primary} />}
                    title="This screen does not exist"
                    description="The page you were looking for could not be found. Head back to your dashboard to continue your fieldwork."
                    action={
                        <AppButton
                            label="Go to dashboard"
                            trailingIcon={
                                <ArrowRight
                                    size={16}
                                    color={designSystem.colors.primaryForeground}
                                />
                            }
                            onPress={() => {
                                router.replace("/(tabs)");
                            }}
                        />
                    }
                />
            </YStack>
        </>
    );
}
