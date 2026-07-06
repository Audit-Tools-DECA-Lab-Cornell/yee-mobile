import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner, YStack } from "tamagui";

import { AppButton, ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import type { ReleasePolicyDecision } from "lib/release-policy-core";

interface ForceUpdateScreenProps {
    readonly decision: ReleasePolicyDecision;
    readonly onRetry: () => void;
}

export function ForceUpdateScreen({ decision, onRetry }: ForceUpdateScreenProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    const handleOpenUpdate = (): void => {
        WebBrowser.openBrowserAsync(decision.updateUrl).catch(() => {
            Alert.alert(
                "Unable to open update",
                "Open the app store and install the latest YEE app.",
            );
        });
    };

    return (
        <YStack flex={1} bg={designSystem.colors.background} accessibilityViewIsModal>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                    bottomPadding: Math.max(insets.bottom + 28, 36),
                    gap: layout.isTablet ? 28 : 22,
                    maxWidth: layout.isTablet ? 640 : layout.contentMaxWidth,
                })}
            >
                <YStack minH={height - insets.top - insets.bottom - 40} justify="center" gap="$5">
                    <YStack
                        bg={designSystem.colors.surface}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        rounded={designSystem.radii.lg}
                        px={layout.isTablet ? "$6" : "$4"}
                        py={layout.isTablet ? "$6" : "$5"}
                        gap="$5"
                        accessibilityRole="alert"
                    >
                        <YStack gap="$3">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={layout.isTablet ? 32 : 26}
                                lineHeight={layout.isTablet ? 38 : 32}
                                accessibilityRole="header"
                            >
                                Update YEE to continue
                            </Text>
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={layout.isTablet ? 18 : 16}
                                lineHeight={layout.isTablet ? 26 : 23}
                            >
                                {decision.message}
                            </Paragraph>
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={layout.isTablet ? 18 : 16}
                                lineHeight={layout.isTablet ? 26 : 23}
                            >
                                Latest version: {decision.latestVersion}
                            </Paragraph>
                        </YStack>

                        <YStack gap="$3">
                            <AppButton
                                label="Open update"
                                variant="primary"
                                onPress={handleOpenUpdate}
                                accessibilityHint="Opens the store page for the latest YEE app."
                            />
                            <AppButton label="Check again" variant="ghost" onPress={onRetry} />
                        </YStack>
                    </YStack>
                </YStack>
            </ScrollView>
        </YStack>
    );
}

export function ReleasePolicyLoadingScreen() {
    const designSystem = useDesignSystem();

    return (
        <YStack
            flex={1}
            items="center"
            justify="center"
            gap="$3"
            bg={designSystem.colors.background}
        >
            <Spinner size="large" color={designSystem.colors.primary} />
            <Text
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                Checking app version...
            </Text>
        </YStack>
    );
}
