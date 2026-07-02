import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle2, LayoutList, RefreshCcw } from "components/icons";
import { YeeStackHeaderTitle } from "components/navigation/YeeStackHeaderTitle";
import { useYeeStackHeaderOptions } from "components/navigation/useYeeStackHeaderOptions";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";
import { buildAuditSubmittedHeaderLabels } from "lib/yee-navigation-labels";
import { useYeeMobileStore } from "stores/yee-mobile-store";

export default function AuditSubmittedScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        placeId?: string;
        mode?: string;
        submissionId?: string;
    }>();
    const layout = useResponsiveLayout();
    const stackHeaderOptions = useYeeStackHeaderOptions();
    const { assignedPlaces, draftsByPlace, submittedAudits } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            submittedAudits: state.submittedAudits,
        })),
    );
    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const queued = params.mode === "queued";
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";
    const place = assignedPlaces.find((entry) => entry.id === placeId) ?? null;
    const draft = draftsByPlace[placeId] ?? null;
    const submission =
        submittedAudits.find((entry) => entry.id === submissionId) ??
        submittedAudits.find((entry) => entry.place_id === placeId) ??
        null;
    const headerLabels = buildAuditSubmittedHeaderLabels({
        placeName:
            submission?.place_name ?? draft?.participantInfo.place_name?.toString() ?? place?.name,
        queued,
    });

    return (
        <>
            <Stack.Screen
                options={{
                    ...stackHeaderOptions,
                    headerTitle: () => (
                        <YeeStackHeaderTitle
                            primary={headerLabels.primary}
                            secondary={headerLabels.secondary}
                        />
                    ),
                }}
            />
            <YStack
                flex={1}
                bg={designSystem.colors.background}
                justify="center"
                style={{
                    paddingHorizontal: layout.screenPaddingHorizontal,
                    paddingVertical: layout.screenPaddingVertical,
                }}
            >
                <YStack
                    rounded={designSystem.radii.xl}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    p="$5"
                    gap="$4"
                    style={{
                        alignSelf: "center",
                        boxShadow: designSystem.shadows.card,
                        maxWidth: layout.formMaxWidth,
                        width: "100%",
                    }}
                >
                    <XStack items="center" gap="$3">
                        <CheckCircle2
                            size={24}
                            color={
                                queued ? designSystem.colors.warning : designSystem.colors.success
                            }
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
                                    View report
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
                                <LayoutList
                                    size={16}
                                    color={designSystem.colors.primaryForeground}
                                />
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
        </>
    );
}
