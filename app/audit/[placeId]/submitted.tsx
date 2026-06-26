import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, LayoutList, RefreshCcw } from "components/icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";

export default function AuditSubmittedScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        placeId?: string;
        mode?: string;
        submissionId?: string;
    }>();
    const queued = params.mode === "queued";
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";

    return (
        <YStack flex={1} bg={designSystem.colors.background} px="$4" py="$6" justify="center">
            <YStack
                rounded={designSystem.radii.xl}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                bg={designSystem.colors.surface}
                p="$5"
                gap="$4"
                style={{ boxShadow: designSystem.shadows.card }}
            >
                <XStack items="center" gap="$3">
                    <CheckCircle2
                        size={24}
                        color={queued ? designSystem.colors.warning : designSystem.colors.success}
                    />
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={28}
                    >
                        {queued ? "Audit saved and queued" : "Audit submitted"}
                    </Text>
                </XStack>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {queued
                        ? "Your audit is saved and will upload automatically when you are back online."
                        : "Your audit has been submitted and is now locked."}
                </Paragraph>
                <YStack gap="$2.5">
                    {submissionId.length > 0 ? (
                        <Button
                            rounded={designSystem.radii.button}
                            bg={designSystem.colors.successSoft}
                            borderWidth={1}
                            borderColor={designSystem.colors.success}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => router.replace(`/reports/${submissionId}`)}
                            icon={<RefreshCcw size={16} color={designSystem.colors.success} />}
                        >
                            <Button.Text
                                color={designSystem.colors.success}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                {queued ? "View report" : "View report"}
                            </Button.Text>
                        </Button>
                    ) : null}
                    <Button
                        rounded={designSystem.radii.button}
                        bg={designSystem.colors.primary}
                        borderWidth={1}
                        borderColor={designSystem.colors.primary}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                        onPress={() => router.replace("/(tabs)/places")}
                        icon={
                            <LayoutList size={16} color={designSystem.colors.primaryForeground} />
                        }
                    >
                        <Button.Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            Back to places
                        </Button.Text>
                    </Button>
                    <Button
                        rounded={designSystem.radii.button}
                        bg={designSystem.colors.surfaceMuted}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                        onPress={() => router.replace("/(tabs)/reports")}
                        icon={<RefreshCcw size={16} color={designSystem.colors.foreground} />}
                    >
                        <Button.Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            View reports
                        </Button.Text>
                    </Button>
                </YStack>
            </YStack>
        </YStack>
    );
}
