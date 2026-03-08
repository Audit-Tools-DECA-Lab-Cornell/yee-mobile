import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, ShieldAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";

/**
 * Signup route shares auditor access setup guidance.
 */
export default function SignupScreen() {
    const router = useRouter();

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                paddingVertical: 32,
                justifyContent: "center",
                backgroundColor: designSystem.colors.background,
            }}
        >
            <YStack gap="$6" width="100%" style={{ maxWidth: 440, alignSelf: "center" }}>
                <YStack items="center" gap="$4">
                    <YStack
                        width={88}
                        height={88}
                        items="center"
                        justify="center"
                        rounded={designSystem.radii.xl}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surfaceMuted}
                        style={{
                            boxShadow: designSystem.shadows.card,
                        }}
                    >
                        <ShieldAlert size={34} color={designSystem.colors.warning} />
                    </YStack>

                    <YStack items="center" gap="$2">
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={32}
                            textTransform="uppercase"
                            letterSpacing={-0.5}
                        >
                            Access setup
                        </Text>
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                            style={{ textAlign: "center" }}
                        >
                            Mobile access is provisioned during project onboarding. Self-signup is
                            not available in the app.
                        </Paragraph>
                    </YStack>
                </YStack>

                <YStack
                    borderWidth={1}
                    borderColor={designSystem.colors.warning}
                    bg={designSystem.colors.warningSoft}
                    rounded={designSystem.radii.lg}
                    p="$4"
                    gap="$3"
                >
                    <XStack items="center" gap="$2">
                        <ShieldAlert size={18} color={designSystem.colors.warning} />
                        <Text
                            color={designSystem.colors.warning}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={14}
                            textTransform="uppercase"
                            letterSpacing={1.2}
                        >
                            Use your assigned auditor credentials.
                        </Text>
                    </XStack>
                    <Paragraph
                        color={designSystem.colors.secondaryForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        If you need access, ask your project lead to set up your auditor account and
                        share sign-in details.
                    </Paragraph>
                </YStack>

                <Button
                    height={52}
                    rounded={designSystem.radii.md}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => {
                        router.replace("/(auth)/login");
                    }}
                >
                    <XStack items="center" gap="$2">
                        <ArrowLeft size={16} color={designSystem.colors.foreground} />
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={13}
                            textTransform="uppercase"
                            letterSpacing={1.3}
                        >
                            Back to sign in
                        </Text>
                    </XStack>
                </Button>
            </YStack>
        </ScrollView>
    );
}
