# CODE CONTEXT PACK — app/(tabs)/places.tsx

_Read `review/core.md` alongside this file._

design_system_components_used: ScaledParagraph, ScaledText

## Screen slice

### app/(tabs)/places.tsx

```tsx
import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { Clock3, MapPin, UploadCloud } from "components/icons";
import { Button, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem, getPlaceStatusTone } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import { buildPlaceViews, getStatusLabel, summarizeMobileAudits } from "lib/yee-mobile-selectors";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Assigned places tab for auditor field execution.
 */
export default function PlacesScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const setSelectedPlaceId = useSelectionStore((state) => state.setSelectedPlaceId);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const { assignedPlaces, submittedAudits, draftsByPlace, syncQueue, isOnline } =
        useYeeMobileStore(
            useShallow((state) => ({
                assignedPlaces: state.assignedPlaces,
                submittedAudits: state.submittedAudits,
                draftsByPlace: state.draftsByPlace,
                syncQueue: state.syncQueue,
                isOnline: state.isOnline,
            })),
        );
    const hasCachedAssignedPlaces = useYeeMobileStore((state) => state.hasCachedAssignedPlaces);
    const hasCachedInstrument = useYeeMobileStore((state) => state.hasCachedInstrument);
    const isOfflineReady = useYeeMobileStore((state) => state.isOfflineReady);

    const placeViews = useMemo(
        () => buildPlaceViews(assignedPlaces, draftsByPlace, submittedAudits),
        [assignedPlaces, draftsByPlace, submittedAudits],
    );
    const summary = useMemo(() => summarizeMobileAudits(placeViews), [placeViews]);
    const offlineReadinessMessage = getOfflineReadinessMessage({
        hasOfflineLoginCredentials,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    });
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: true,
        rerunKey: placeViews.length,
        scrollToOffset,
    });

    return (
        <ScrollView
            ref={scrollViewRef}
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                bottomPadding: 132,
                gap: 24,
            })}
        >
            <YStack gap="$4">
                <YStack gap="$1.5">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={32}
                        lineHeight={36}
                        letterSpacing={-0.7}
                    >
                        My Audits
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        Your assigned places and their audit status.
                    </Paragraph>
                </YStack>

                <XStack gap="$3" flexWrap="wrap">
                    <SummaryTile label="Drafts" value={summary.draftCount} tone="draft" />
                    <SummaryTile
                        label="Submitted"
                        value={summary.submittedCount}
                        tone="submitted"
                    />
                    <SummaryTile label="Queued" value={syncQueue.length} tone="queued" />
                </XStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={
                        isOfflineReady ? designSystem.colors.success : designSystem.colors.warning
                    }
                    bg={
                        isOfflineReady
                            ? designSystem.colors.successSoft
                            : designSystem.colors.warningSoft
                    }
                    p="$3.5"
                    gap="$2"
                >
                    <Paragraph
                        color={
                            isOfflineReady
                                ? designSystem.colors.success
                                : designSystem.colors.warning
                        }
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={12}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {isOfflineReady ? "Ready for offline use" : "Online sync needed"}
                    </Paragraph>
                    <Paragraph
                        color={designSystem.colors.secondaryForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {isOfflineReady
                            ? "This device can capture audits without an internet connection."
                            : "Sign in once while online to prepare for offline field work."}
                    </Paragraph>
                </YStack>
            </YStack>

            <YStack gap="$3">
                {placeViews.length === 0 ? (
                    <EmptyStateCard
                        title="No assigned places yet"
                        body="Once a manager assigns places to this auditor, they will appear here and stay available for offline audit capture."
                    />
                ) : (
                    placeViews.map((view) => {
                        const tone = getPlaceStatusTone(
                            mapStatusToPlaceTone(view.status),
                            designSystem.colors,
                        );
                        return (
                            <YStack
                                key={view.place.id}
                                rounded={designSystem.radii.lg}
                                borderWidth={1}
                                borderColor={designSystem.colors.border}
                                bg={designSystem.colors.surface}
                                overflow="hidden"
                                style={{ boxShadow: designSystem.shadows.card }}
                            >
                                <XStack>
                                    <YStack width={4} style={{ backgroundColor: tone.accent }} />

                                    <YStack flex={1} p="$4" gap="$3">
                                        <XStack justify="space-between" items="flex-start" gap="$3">
                                            <YStack flex={1} gap="$1">
                                                <Text
                                                    color={designSystem.colors.foreground}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={17}
                                                >
                                                    {view.place.name}
                                                </Text>
                                                <Paragraph
                                                    color={designSystem.colors.mutedForeground}
                                                    fontFamily={designSystem.fonts.bodyMedium}
                                                >
                                                    {view.place.project}
                                                </Paragraph>
                                            </YStack>
                                            <YStack
                                                rounded={designSystem.radii.full}
                                                px="$3"
                                                py="$1"
                                                style={{ backgroundColor: tone.surface }}
                                            >
                                                <Text
                                                    style={{ color: tone.text }}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={10}
                                                    textTransform="uppercase"
                                                    letterSpacing={1.2}
                                                >
                                                    {getStatusLabel(view.status)}
                                                </Text>
                                            </YStack>
                                        </XStack>

                                        <XStack items="center" gap="$2">
                                            <MapPin
                                                size={14}
                                                color={designSystem.colors.mutedForeground}
                                            />
                                            <Paragraph
                                                color={designSystem.colors.secondaryForeground}
                                                fontFamily={designSystem.fonts.bodyMedium}
                                            >
                                                {view.place.address}
                                            </Paragraph>
                                        </XStack>

                                        <YStack
                                            rounded={designSystem.radii.md}
                                            borderWidth={1}
                                            borderColor={designSystem.colors.border}
                                            bg={designSystem.colors.surfaceMuted}
                                            p="$3"
                                            gap="$3"
                                        >
                                            <XStack
                                                justify="space-between"
                                                items="center"
                                                gap="$2.5"
                                            >
                                                <XStack
                                                    items="center"
                                                    gap="$2"
                                                    flex={1}
                                                    style={{ minWidth: 0 }}
                                                >
                                                    <Clock3
                                                        size={14}
                                                        color={designSystem.colors.mutedForeground}
                                                    />
                                                    <Paragraph
                                                        color={designSystem.colors.mutedForeground}
                                                        fontFamily={designSystem.fonts.bodyMedium}
                                                    >
                                                        {view.latestActivityLabel}
                                                    </Paragraph>
                                                </XStack>
                                                <XStack items="center" gap="$1.5">
                                                    <UploadCloud size={13} color={tone.text} />
                                                    <Paragraph
                                                        style={{ color: tone.text }}
                                                        fontFamily={designSystem.fonts.bodyBold}
                                                        fontSize={12}
                                                    >
                                                        {view.syncLabel}
                                                    </Paragraph>
                                                </XStack>
                                            </XStack>

                                            <XStack gap="$2" flexWrap="wrap">
                                                <ActionButton
                                                    label={
                                                        view.status === "draft"
                                                            ? "Continue draft"
                                                            : "Start audit"
                                                    }
                                                    onPress={() => {
                                                        setSelectedPlaceId(view.place.id);
                                                        openAuditForPlace(view.place.id);
                                                    }}
                                                />
                                                {view.status === "submitted" ? (
                                                    <ActionButton
                                                        label="View report"
                                                        variant="secondary"
                                                        onPress={() => {
                                                            setSelectedPlaceId(view.place.id);
                                                            if (view.submission !== null) {
                                                                router.push(
                                                                    `/reports/${view.submission.id}`,
                                                                );
                                                                return;
                                                            }

                                                            router.push("/(tabs)/reports");
                                                        }}
                                                    />
                                                ) : null}
                                            </XStack>
                                        </YStack>
                                    </YStack>
                                </XStack>
                            </YStack>
                        );
                    })
                )}
            </YStack>
        </ScrollView>
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

interface SummaryTileProps {
    readonly label: string;
    readonly value: number;
    readonly tone: "draft" | "submitted" | "queued";
}

function SummaryTile({ label, value, tone }: SummaryTileProps) {
    const designSystem = useDesignSystem();
    const palette =
        tone === "submitted"
            ? {
                  accent: designSystem.colors.success,
                  surface: designSystem.colors.successSoft,
                  text: designSystem.colors.success,
              }
            : tone === "queued"
              ? {
                    accent: designSystem.colors.warning,
                    surface: designSystem.colors.warningSoft,
                    text: designSystem.colors.warning,
                }
              : {
                    accent: designSystem.colors.primary,
                    surface: designSystem.colors.primarySoft,
                    text: designSystem.colors.primary,
                };

    return (
        <YStack
            flex={1}
            style={{ minWidth: 102, boxShadow: designSystem.shadows.card }}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={palette.accent}
            bg={palette.surface}
            p="$3"
            gap="$1.5"
        >
            <YStack
                rounded={designSystem.radii.full}
                px="$2.5"
                py="$1"
                style={{
                    alignSelf: "flex-start",
                    backgroundColor: designSystem.colors.surface,
                }}
            >
                <Paragraph
                    style={{ color: palette.text }}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={10}
                    textTransform="uppercase"
                    letterSpacing={1.1}
                >
                    {label}
                </Paragraph>
            </YStack>
            <Text
                color={palette.text}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={26}
                lineHeight={28}
            >
                {value.toString()}
            </Text>
        </YStack>
    );
}

interface ActionButtonProps {
    readonly label: string;
    readonly onPress: () => void;
    readonly variant?: "primary" | "secondary";
}

function ActionButton({ label, onPress, variant = "primary" }: ActionButtonProps) {
    const designSystem = useDesignSystem();
    return (
        <Button
            onPress={onPress}
            rounded={designSystem.radii.button}
            bg={variant === "primary" ? designSystem.colors.primary : designSystem.colors.surface}
            borderWidth={1}
            borderColor={
                variant === "primary" ? designSystem.colors.primary : designSystem.colors.border
            }
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
        >
            <Button.Text
                color={
                    variant === "primary"
                        ? designSystem.colors.primaryForeground
                        : designSystem.colors.foreground
                }
                fontFamily={designSystem.fonts.bodyBold}
            >
                {label}
            </Button.Text>
        </Button>
    );
}

interface EmptyStateCardProps {
    readonly title: string;
    readonly body: string;
}

function EmptyStateCard({ title, body }: EmptyStateCardProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2.5"
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
            >
                {title}
            </Text>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                {body}
            </Paragraph>
        </YStack>
    );
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
