import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { CloudOff, Save, Send } from "components/icons";
import { Paragraph, XStack, YStack } from "tamagui";
import {
    AppButton,
    Badge,
    Card,
    EmptyState,
    MetricCard,
    ScreenHeader,
    StatusBanner,
} from "components/ui";
import { designSystem, getPlaceStatusTone } from "lib/design-system";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import { buildPlaceViews, getStatusLabel } from "lib/yee-mobile-selectors";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Execution tab reflecting the real assigned-place selection and offline draft state.
 */
export default function ExecuteScreen() {
    const insets = useSafeAreaInsets();
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

    const placeViews = useMemo(
        () => buildPlaceViews(assignedPlaces, draftsByPlace, submittedAudits),
        [assignedPlaces, draftsByPlace, submittedAudits],
    );
    const activePlaceView = useMemo(() => {
        return (
            placeViews.find((view) => view.place.id === selectedPlaceId) ?? placeViews[0] ?? null
        );
    }, [placeViews, selectedPlaceId]);
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
                    icon={<CloudOff size={22} color={designSystem.colors.primary} />}
                    title="Select a place to begin"
                    description="Assigned places appear here once the auditor has been synced from the YEE backend."
                />
            </YStack>
        );
    }

    const tone = getPlaceStatusTone(mapStatusToPlaceTone(activePlaceView.status));
    const placeScore =
        activePlaceView.submission?.total_score ??
        activePlaceView.draft?.scorePreview?.total_score ??
        null;
    const offlineReadinessMessage = getOfflineReadinessMessage({
        hasOfflineLoginCredentials,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    });
    const pendingForPlace = syncQueue.filter(
        (item) => item.placeId === activePlaceView.place.id,
    ).length;
    const isSubmitted = activePlaceView.status === "submitted";

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                ref={scrollViewRef}
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    gap: 20,
                    paddingBottom: insets.bottom + 116,
                }}
            >
                <StatusBanner isOnline={isOnline} pendingCount={pendingForPlace} />

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
                    <MetricCard
                        label="Audits logged"
                        value={activePlaceView.place.audits.toString()}
                    />
                    <MetricCard label="Sync queue" value={`${pendingForPlace} pending`} />
                    <MetricCard
                        label="Latest score"
                        value={placeScore === null ? "Not scored" : `${placeScore}%`}
                    />
                </XStack>

                <Card gap="$3">
                    <XStack items="center" gap="$2.5">
                        <CloudOff size={15} color={designSystem.colors.primary} />
                        <Paragraph
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={15}
                        >
                            {isSubmitted
                                ? "Report access is ready"
                                : "Offline audit capture is ready"}
                        </Paragraph>
                    </XStack>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {isSubmitted
                            ? "This place already has a mobile report available. Open the report now, or return to the backend later for broader comparisons and exports."
                            : "Draft responses are saved securely on this device and queued changes sync back to the backend the moment connectivity returns."}
                    </Paragraph>
                </Card>
            </ScrollView>

            <XStack
                position="absolute"
                gap="$3"
                style={{
                    left: designSystem.spacing.screenPaddingHorizontal,
                    right: designSystem.spacing.screenPaddingHorizontal,
                    bottom: insets.bottom + 16,
                }}
            >
                <AppButton
                    flex={1}
                    variant="secondary"
                    label={activePlaceView.status === "draft" ? "Continue survey" : "Start survey"}
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
                    leadingIcon={<Send size={16} color={designSystem.colors.primaryForeground} />}
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
    );

    function openAuditForPlace(placeId: string) {
        if (!isOnline && !isOfflineReady) {
            Alert.alert("Offline setup incomplete", offlineReadinessMessage);
            return;
        }

        router.push(`/audit/${placeId}/1`);
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
