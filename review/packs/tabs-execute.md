# CODE CONTEXT PACK — app/(tabs)/execute.tsx

_Read `review/core.md` alongside this file._

design_system_components_used: AppButton, Badge, Card, EmptyState, MetricCard, ScaledParagraph, ScreenHeader, StatusBanner

## Screen slice

### app/(tabs)/execute.tsx

```tsx
import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { CloudOff, Save, Send } from "components/icons";
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
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
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
                    description="Select a place from the Places tab to begin an audit."
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
                contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                    gap: 20,
                    bottomPadding: 92,
                })}
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
                    <MetricCard label="Audits" value={activePlaceView.place.audits.toString()} />
                    <MetricCard label="Pending" value={pendingForPlace.toString()} />
                    <MetricCard
                        label="Score"
                        value={placeScore === null ? "—" : `${placeScore}%`}
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

            <XStack
                position="absolute"
                gap="$3"
                style={{
                    left: layout.screenPaddingHorizontal,
                    right: layout.screenPaddingHorizontal,
                    bottom: 16,
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
```

### components/icons.tsx

```tsx
import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface IconProps {
    readonly color?: string;
    readonly size?: number;
}

function makeIcon(name: FeatherIconName) {
    return function Icon({ color, size = 16 }: IconProps) {
        return <Feather name={name} size={size} color={color} />;
    };
}

export const ArrowLeft = makeIcon("arrow-left");
export const ArrowRight = makeIcon("arrow-right");
export const ArrowUpRight = makeIcon("arrow-up-right");
export const BarChart3 = makeIcon("bar-chart-2");
export const Bell = makeIcon("bell");
export const Check = makeIcon("check");
export const CheckCircle2 = makeIcon("check-circle");
export const ChevronLeft = makeIcon("chevron-left");
export const ChevronRight = makeIcon("chevron-right");
export const CircleCheckBig = makeIcon("check-circle");
export const ClipboardCheck = makeIcon("clipboard");
export const Clock3 = makeIcon("clock");
export const CloudOff = makeIcon("cloud-off");
export const Eye = makeIcon("eye");
export const EyeOff = makeIcon("eye-off");
export const FileBarChart = makeIcon("bar-chart-2");
export const FileText = makeIcon("file-text");
export const KeyRound = makeIcon("key");
export const LayoutDashboard = makeIcon("grid");
export const LayoutList = makeIcon("list");
export const LogOut = makeIcon("log-out");
export const MapPin = makeIcon("map-pin");
export const MapPinned = makeIcon("map-pin");
export const Monitor = makeIcon("monitor");
export const Moon = makeIcon("moon");
export const RefreshCcw = makeIcon("refresh-ccw");
export const Save = makeIcon("save");
export const Send = makeIcon("send");
export const Settings = makeIcon("settings");
export const ShieldAlert = makeIcon("shield");
export const ShieldCheck = makeIcon("shield");
export const Sun = makeIcon("sun");
export const TriangleAlert = makeIcon("alert-triangle");
export const Type = makeIcon("type");
export const UploadCloud = makeIcon("upload-cloud");
export const UserRound = makeIcon("user");
export const WifiOff = makeIcon("wifi-off");
```
