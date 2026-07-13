import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle2, LayoutList, RefreshCcw } from "components/icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";
import { buildMobileAuditProjection } from "lib/yee-mobile-selectors";
import { useYeeMobileStore } from "stores/yee-mobile-store";

export default function AuditSubmittedScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const params = useLocalSearchParams<{
        placeId?: string;
        mode?: string;
        submissionId?: string;
    }>();
    const layout = useResponsiveLayout();
    const { assignedPlaces, draftsByPlace, submittedAudits, syncQueue } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            submittedAudits: state.submittedAudits,
            syncQueue: state.syncQueue,
        })),
    );
    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const routeSubmissionId = typeof params.submissionId === "string" ? params.submissionId : "";
    const projection = buildMobileAuditProjection({
        assignedPlaces,
        draftsByPlace,
        submittedAudits,
        syncQueue,
        selectedPlaceId: placeId,
        selectedSubmissionId: routeSubmissionId,
    });
    const placeView = projection.selectedPlaceView;
    const submission =
        (routeSubmissionId.length > 0
            ? projection.sortedReports.find((entry) => entry.id === routeSubmissionId)
            : null) ??
        placeView?.submission ??
        null;
    const submissionId = routeSubmissionId.length > 0 ? routeSubmissionId : (submission?.id ?? "");
    const queued =
        params.mode === "queued" ||
        placeView?.isPendingSync === true ||
        submission?.syncState === "pending_upload" ||
        submission?.syncState === "sync_failed";

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: false,
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
                        width: "100%",
                    }}
                >
                    <XStack items="center" gap="$3">
                        <CheckCircle2
                            size={24}
                            color={
                                queued
                                    ? designSystem.colors.warningText
                                    : designSystem.colors.successText
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
                                icon={
                                    <RefreshCcw size={16} color={designSystem.colors.successText} />
                                }
                            >
                                <Button.Text
                                    color={designSystem.colors.successText}
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
