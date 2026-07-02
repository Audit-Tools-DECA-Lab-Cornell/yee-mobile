import { ScrollView } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";

export interface YeeStackHeaderTitleProps {
    readonly primary: string;
    readonly secondary?: string | undefined;
    readonly size?: "md" | "lg";
}

const TABLET_LIMIT = 120;
const MOBILE_PRIMARY_LIMIT = 34;
const MOBILE_SECONDARY_LIMIT = 52;

function truncateHeaderText(text: string, limit: number): string {
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, Math.max(limit - 3, 0))}...`;
}

export function YeeStackHeaderTitle({ primary, secondary, size = "md" }: YeeStackHeaderTitleProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const primarySize = Math.round((size === "lg" ? 17 : 15) * designSystem.fontScale);
    const secondarySize = Math.round(12 * designSystem.fontScale);
    const primaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_PRIMARY_LIMIT;
    const secondaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_SECONDARY_LIMIT;
    const displayPrimary = truncateHeaderText(primary, primaryLimit);
    const displaySecondary =
        secondary === undefined ? undefined : truncateHeaderText(secondary, secondaryLimit);

    return (
        <YStack justify="center" style={{ maxWidth: "100%" }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center" }}
            >
                {layout.isTablet && displaySecondary !== undefined ? (
                    <XStack items="center" gap="$2">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            |
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displaySecondary}
                        </Text>
                    </XStack>
                ) : (
                    <YStack justify="center">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        {displaySecondary === undefined ? null : (
                            <Text
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={secondarySize}
                                lineHeight={secondarySize + 4}
                            >
                                {displaySecondary}
                            </Text>
                        )}
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
