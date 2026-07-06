import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { CloudOff, FileBarChart, Save, Send } from "components/icons";
import { XStack, YStack } from "tamagui";
import {
    AppButton,
    Badge,
    Card,
    EmptyState,
    MetricCard,
    ScaledParagraph as Paragraph,
    ScreenHeader,
    StatusBanner,
} from "components/ui";
import { useDesignSystem, getPlaceStatusTone } from "lib/design-system";
import { toScorePercentage } from "lib/yee-mobile-reporting";
import {
    getContentTrackInnerWidth,
    getResponsiveContentContainerStyle,
    useResponsiveLayout,
} from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import { buildMobileAuditProjection, getStatusLabel } from "lib/yee-mobile-selectors";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Execution tab reflecting the real assigned-place selection and offline draft state.
 */
export default function ExecuteScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const selectedPlaceId = useSelectionStore((state) => state.selectedPlaceId);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const {
        assignedPlaces,
        submittedAudits,
        draftsByPlace,
        syncQueue,
        isOnline,
        isOfflineReady,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            submittedAudits: state.submittedAudits,
            draftsByPlace: state.draftsByPlace,
            syncQueue: state.syncQueue,
            isOnline: state.isOnline,
            isOfflineReady: state.isOfflineReady,
            hasCachedAssignedPlaces: state.hasCachedAssignedPlaces,
            hasCachedInstrument: state.hasCachedInstrument,
        })),
    );

    const projection = useMemo(
        () =>
            buildMobileAuditProjection({
                assignedPlaces,
                draftsByPlace,
                submittedAudits,
                syncQueue,
                selectedPlaceId,
            }),
        [assignedPlaces, draftsByPlace, submittedAudits, syncQueue, selectedPlaceId],
    );
    const placeViews = projection.placeViews;
    const executablePlaceViews = useMemo(
        () => placeViews.filter((view) => view.status !== "submitted"),
        [placeViews],
    );
    const activePlaceView = useMemo(() => {
        if (
            projection.selectedPlaceView !== null &&
            projection.selectedPlaceView.status !== "submitted"
        ) {
            return projection.selectedPlaceView;
        }
        return executablePlaceViews[0] ?? null;
    }, [executablePlaceViews, projection.selectedPlaceView]);
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: activePlaceView !== null,
        rerunKey: activePlaceView?.place.id ?? "empty",
        scrollToOffset,
    });

    if (activePlaceView === null) {
        return (
            <YStack flex={1} bg={designSystem.colors.background} px="$4" py="$6" justify="center">
                <EmptyState
                    icon={<FileBarChart size={22} color={designSystem.colors.primary} />}
                    title="No pending audits to complete"
                    description="All assigned audits on this device have already been submitted. Submitted audits are locked for editing."
                    action={
                        <AppButton
                            variant="primary"
                            label="View reports"
                            onPress={() => router.push("/(tabs)/reports")}
                        />
                    }
                />
            </YStack>
        );
    }

    const tone = getPlaceStatusTone(
        mapStatusToPlaceTone(activePlaceView.status),
        designSystem.colors,
    );
    const placeScore =
        activePlaceView.submission?.total_score ??
        activePlaceView.draft?.scorePreview?.total_score ??
        null;
    const offlineReadinessMessage = getOfflineReadinessMessage({
        hasOfflineLoginCredentials,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    });
    const pendingForPlace = activePlaceView.pendingSyncCount;
    const isSubmitted = activePlaceView.status === "submitted";

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                ref={scrollViewRef}
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                    bottomPadding: 132,
                    gap: layout.sectionGap,
                })}
            >
                <ScreenHeader title="Execute" subtitle="Continue or review the selected place." />

                <Card gap="$3">
                    <ScreenHeader
                        eyebrow={activePlaceView.place.project}
                        title={activePlaceView.place.name}
                        subtitle={activePlaceView.place.address}
                        trailing={
                            <Badge label={getStatusLabel(activePlaceView.status)} tone={tone} />
                        }
                    />
                    <YStack gap="$1">
                        <Paragraph
                            fontFamily={designSystem.fonts.bodyBold}
                            style={{ color: tone.text }}
                        >
                            {activePlaceView.syncLabel}
                        </Paragraph>
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            {activePlaceView.latestActivityLabel}
                        </Paragraph>
                    </YStack>
                </Card>

                <XStack gap="$3" flexWrap="wrap">
                    <MetricCard label="Audits" value={activePlaceView.place.audits.toString()} />
                    <MetricCard label="Pending" value={pendingForPlace.toString()} />
                    <MetricCard
                        label="Score"
                        value={placeScore === null ? "—" : `${toScorePercentage(placeScore)}%`}
                    />
                </XStack>

                <StatusBanner isOnline={isOnline} pendingCount={pendingForPlace} />

                <Card gap="$3">
                    <XStack items="center" gap="$2.5">
                        {isSubmitted ? (
                            <FileBarChart size={15} color={designSystem.colors.primary} />
                        ) : (
                            <CloudOff size={15} color={designSystem.colors.primary} />
                        )}
                        <Paragraph
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={15}
                        >
                            {isSubmitted ? "Report available" : "Ready for offline capture"}
                        </Paragraph>
                    </XStack>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {isSubmitted
                            ? "View the submitted report for this place."
                            : "Your responses are saved on this device and will sync when you are back online."}
                    </Paragraph>
                </Card>
            </ScrollView>

            <YStack
                position="absolute"
                style={{
                    left: 0,
                    right: 0,
                    bottom: 16,
                }}
            >
                <XStack
                    gap="$3"
                    style={{
                        alignSelf: "center",
                        maxWidth: "100%",
                        width: getContentTrackInnerWidth(layout, layout.readableMaxWidth),
                    }}
                >
                    <AppButton
                        flex={1}
                        variant="secondary"
                        label={
                            activePlaceView.status === "draft" ? "Continue survey" : "Start survey"
                        }
                        leadingIcon={<Save size={16} color={designSystem.colors.foreground} />}
                        onPress={() => {
                            openAuditForPlace(activePlaceView.place.id);
                        }}
                    />
                    <AppButton
                        flex={1}
                        variant="primary"
                        label={
                            isSubmitted
                                ? "Open report"
                                : activePlaceView.status === "draft"
                                  ? "Resume audit"
                                  : "Open audit"
                        }
                        leadingIcon={
                            <Send size={16} color={designSystem.colors.primaryForeground} />
                        }
                        onPress={() => {
                            if (isSubmitted && activePlaceView.submission !== null) {
                                router.push(`/reports/${activePlaceView.submission.id}`);
                                return;
                            }

                            openAuditForPlace(activePlaceView.place.id);
                        }}
                    />
                </XStack>
            </YStack>
        </YStack>
    );

    function openAuditForPlace(placeId: string) {
        if (!isOnline && !isOfflineReady) {
            Alert.alert("Offline setup incomplete", offlineReadinessMessage);
            return;
        }

        router.push(`/audit/${placeId}`);
    }
}

function mapStatusToPlaceTone(status: "not_started" | "draft" | "submitted") {
    if (status === "submitted") {
        return "submitted" as const;
    }

    if (status === "draft") {
        return "in_progress" as const;
    }

    return "not_started" as const;
}
