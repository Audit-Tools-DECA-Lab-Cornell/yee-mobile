# CODE CONTEXT PACK — app/(tabs)/index.tsx

_Read `review/core.md` alongside this file._

design_system_components_used: ScaledParagraph, ScaledText

## Screen slice

### app/(tabs)/index.tsx

```tsx
import type { ReactElement } from "react";
import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import {
    ArrowUpRight,
    Bell,
    FileBarChart,
    LayoutList,
    RefreshCcw,
    Settings,
    UserRound,
    WifiOff,
} from "components/icons";
import { Button, Spinner, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem, getMetricTone, getPlaceStatusTone } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import { buildPlaceViews, getStatusLabel, summarizeMobileAudits } from "lib/yee-mobile-selectors";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Dashboard tab for YEE mobile field operations.
 */
export default function DashboardScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const session = useAuthStore((state) => state.session);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const setSelectedPlaceId = useSelectionStore((state) => state.setSelectedPlaceId);
    const {
        status,
        isOnline,
        assignedPlaces,
        submittedAudits,
        draftsByPlace,
        syncQueue,
        errorMessage,
        lastPlacesSyncAt,
        lastAuditsSyncAt,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
        isOfflineReady,
        refreshRemoteState,
        syncPendingQueue,
    } = useYeeMobileStore(
        useShallow((state) => ({
            status: state.status,
            isOnline: state.isOnline,
            assignedPlaces: state.assignedPlaces,
            submittedAudits: state.submittedAudits,
            draftsByPlace: state.draftsByPlace,
            syncQueue: state.syncQueue,
            errorMessage: state.errorMessage,
            lastPlacesSyncAt: state.lastPlacesSyncAt,
            lastAuditsSyncAt: state.lastAuditsSyncAt,
            hasCachedAssignedPlaces: state.hasCachedAssignedPlaces,
            hasCachedInstrument: state.hasCachedInstrument,
            isOfflineReady: state.isOfflineReady,
            refreshRemoteState: state.refreshRemoteState,
            syncPendingQueue: state.syncPendingQueue,
        })),
    );

    const placeViews = useMemo(() => {
        return buildPlaceViews(assignedPlaces, draftsByPlace, submittedAudits);
    }, [assignedPlaces, draftsByPlace, submittedAudits]);
    const summary = useMemo(() => summarizeMobileAudits(placeViews), [placeViews]);
    const primaryDraft = placeViews.find((view) => view.status === "draft") ?? null;
    const activeAuditorName = session?.user.name ?? session?.user.email ?? "Active auditor";
    const dateLabel = useMemo(() => {
        return new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            weekday: "long",
        });
    }, []);
    const syncSummary = describeSync(lastPlacesSyncAt, lastAuditsSyncAt, syncQueue.length);
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
                gap: 28,
            })}
        >
            <YStack gap="$6">
                <XStack justify="space-between" items="center" gap="$3">
                    <XStack items="center" gap="$3" flex={1}>
                        <YStack
                            width={44}
                            height={44}
                            items="center"
                            justify="center"
                            rounded={designSystem.radii.md}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                        >
                            <UserRound size={20} color={designSystem.colors.primary} />
                        </YStack>
                        <YStack flex={1} gap="$0.5">
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.4}
                            >
                                Active auditor
                            </Paragraph>
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={15}
                            >
                                {activeAuditorName}
                            </Text>
                        </YStack>
                    </XStack>

                    <XStack gap="$2">
                        <Button
                            width={42}
                            height={42}
                            p={0}
                            rounded={designSystem.radii.button}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={async () => {
                                if (session === null) {
                                    return;
                                }

                                await syncPendingQueue(session);
                                await refreshRemoteState(session);
                            }}
                        >
                            <RefreshCcw size={16} color={designSystem.colors.foreground} />
                        </Button>
                        <Button
                            width={42}
                            height={42}
                            p={0}
                            rounded={designSystem.radii.button}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            bg={designSystem.colors.surfaceMuted}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => router.push("/settings")}
                            accessibilityLabel="Settings"
                        >
                            <Settings size={16} color={designSystem.colors.foreground} />
                        </Button>
                    </XStack>
                </XStack>

                <YStack gap="$1.5">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={34}
                        lineHeight={38}
                        letterSpacing={-0.8}
                    >
                        Dashboard
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodySemiBold}
                    >
                        {dateLabel}
                    </Paragraph>
                </YStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={
                        isOnline ? designSystem.colors.border : designSystem.colors.warning
                    }
                    bg={isOnline ? designSystem.colors.surface : designSystem.colors.warningSoft}
                    p="$4"
                    gap="$2.5"
                >
                    <XStack items="center" gap="$2.5">
                        {isOnline ? (
                            <Bell size={15} color={designSystem.colors.primary} />
                        ) : (
                            <WifiOff size={15} color={designSystem.colors.warning} />
                        )}
                        <Text
                            color={
                                isOnline
                                    ? designSystem.colors.foreground
                                    : designSystem.colors.warning
                            }
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={13}
                        >
                            {isOnline ? "Online and ready to sync" : "Offline mode active"}
                        </Text>
                    </XStack>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {syncSummary}
                    </Paragraph>
                    {errorMessage === null ? null : (
                        <Paragraph
                            color={designSystem.colors.danger}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            {errorMessage}
                        </Paragraph>
                    )}
                </YStack>

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
                    p="$4"
                    gap="$2.5"
                >
                    <Text
                        color={
                            isOfflineReady
                                ? designSystem.colors.success
                                : designSystem.colors.warning
                        }
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={13}
                        textTransform="uppercase"
                        letterSpacing={1.2}
                    >
                        {isOfflineReady ? "Ready for offline use" : "Online sync needed"}
                    </Text>
                    {isOfflineReady ? null : (
                        <>
                            <ChecklistLine
                                done={hasOfflineLoginCredentials}
                                label="Sign-in saved"
                            />
                            <ChecklistLine
                                done={hasCachedAssignedPlaces}
                                label="Places available"
                            />
                            <ChecklistLine
                                done={hasCachedInstrument}
                                label="Survey instrument ready"
                            />
                        </>
                    )}
                </YStack>

                <XStack gap="$3" flexWrap="wrap">
                    <MetricCard label="Places" value={summary.assignedCount} tone="blue" />
                    <MetricCard label="Drafts" value={summary.draftCount} tone="purple" />
                    <MetricCard label="Submitted" value={summary.submittedCount} tone="green" />
                    <MetricCard
                        label="Pending Sync"
                        value={summary.pendingSyncCount}
                        tone="orange"
                    />
                </XStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor="rgba(71, 203, 175, 0.18)"
                    bg={designSystem.colors.primary}
                    p="$5"
                    gap="$3.5"
                    style={{ boxShadow: designSystem.shadows.card }}
                >
                    <YStack gap="$1">
                        <Paragraph
                            color="rgba(255,255,255,0.78)"
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.5}
                        >
                            Field workflow
                        </Paragraph>
                        <Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={26}
                            lineHeight={30}
                        >
                            Your assigned places
                        </Text>
                        <Paragraph
                            color="rgba(255,255,255,0.76)"
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            Start audits, resume drafts, or view submitted reports.
                        </Paragraph>
                    </YStack>

                    <XStack gap="$2.5" flexWrap="wrap">
                        <ActionButton
                            label="View places"
                            icon={<LayoutList size={14} color={designSystem.colors.primary} />}
                            onPress={() => router.push("/(tabs)/places")}
                        />
                        <ActionButton
                            label={primaryDraft === null ? "Open audit" : "Continue draft"}
                            variant="secondary"
                            icon={
                                <ArrowUpRight
                                    size={14}
                                    color={designSystem.colors.primaryForeground}
                                />
                            }
                            onPress={() => {
                                const target = primaryDraft ?? placeViews[0] ?? null;
                                if (target === null) {
                                    return;
                                }

                                setSelectedPlaceId(target.place.id);
                                openAuditForPlace(target.place.id);
                            }}
                        />
                        <ActionButton
                            label="View reports"
                            variant="secondary"
                            icon={
                                <FileBarChart
                                    size={14}
                                    color={designSystem.colors.primaryForeground}
                                />
                            }
                            onPress={() => router.push("/(tabs)/reports")}
                        />
                    </XStack>
                </YStack>
            </YStack>

            <YStack gap="$3">
                <XStack justify="space-between" items="center">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={21}
                    >
                        Assigned places
                    </Text>
                    {status === "loading" ? (
                        <Spinner color={designSystem.colors.primary} size="small" />
                    ) : null}
                </XStack>

                {placeViews.length === 0 ? (
                    <EmptyStateCard
                        title="No assigned places yet"
                        body="Once a manager assigns places to this auditor, they will be cached here for online and offline fieldwork."
                    />
                ) : (
                    placeViews.slice(0, 3).map((view) => {
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
                                        <Paragraph
                                            color={designSystem.colors.secondaryForeground}
                                            fontFamily={designSystem.fonts.bodyMedium}
                                        >
                                            {view.place.address}
                                        </Paragraph>
                                        <XStack justify="space-between" items="center" gap="$3">
                                            <YStack gap="$0.5" flex={1}>
                                                <Paragraph
                                                    color={designSystem.colors.mutedForeground}
                                                    fontFamily={designSystem.fonts.bodyMedium}
                                                >
                                                    {view.latestActivityLabel}
                                                </Paragraph>
                                                <Paragraph
                                                    style={{ color: tone.text }}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                    fontSize={12}
                                                >
                                                    {view.syncLabel}
                                                </Paragraph>
                                            </YStack>
                                            <Button
                                                size="$3"
                                                rounded={designSystem.radii.button}
                                                bg={
                                                    view.status === "submitted"
                                                        ? designSystem.colors.successSoft
                                                        : designSystem.colors.primary
                                                }
                                                borderWidth={1}
                                                borderColor={
                                                    view.status === "submitted"
                                                        ? designSystem.colors.success
                                                        : designSystem.colors.primary
                                                }
                                                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                                onPress={() => {
                                                    setSelectedPlaceId(view.place.id);
                                                    if (
                                                        view.status === "submitted" &&
                                                        view.submission !== null
                                                    ) {
                                                        router.push(
                                                            `/reports/${view.submission.id}`,
                                                        );
                                                        return;
                                                    }

                                                    openAuditForPlace(view.place.id);
                                                }}
                                            >
                                                <Button.Text
                                                    color={
                                                        view.status === "submitted"
                                                            ? designSystem.colors.success
                                                            : designSystem.colors.primaryForeground
                                                    }
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                >
                                                    {view.status === "submitted"
                                                        ? "View report"
                                                        : view.status === "draft"
                                                          ? "Continue"
                                                          : "Start"}
                                                </Button.Text>
                                            </Button>
                                        </XStack>
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

function ChecklistLine({ done, label }: { done: boolean; label: string }) {
    const designSystem = useDesignSystem();
    return (
        <Paragraph
            color={designSystem.colors.secondaryForeground}
            fontFamily={designSystem.fonts.bodyMedium}
        >
            {done ? "✓" : "•"} {label}
        </Paragraph>
    );
}

function mapStatusToPlaceTone(status: ReturnType<typeof buildPlaceViews>[number]["status"]) {
    if (status === "submitted") {
        return "submitted" as const;
    }

    if (status === "draft") {
        return "in_progress" as const;
    }

    return "not_started" as const;
}

function describeSync(
    lastPlacesSyncAt: string | null,
    lastAuditsSyncAt: string | null,
    pendingCount: number,
): string {
    const lastSync = lastAuditsSyncAt ?? lastPlacesSyncAt;
    if (lastSync === null) {
        return pendingCount > 0
            ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to upload.`
            : "No sync activity yet.";
    }

    const formatted = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(lastSync));

    if (pendingCount > 0) {
        return `Last sync ${formatted}. ${pendingCount} item${pendingCount === 1 ? "" : "s"} waiting to upload.`;
    }

    return `Last sync ${formatted}. All data is up to date.`;
}

interface MetricCardProps {
    readonly label: string;
    readonly value: number;
    readonly tone: "blue" | "green" | "purple" | "orange";
}

function MetricCard({ label, value, tone }: MetricCardProps) {
    const designSystem = useDesignSystem();
    const palette = getMetricTone(tone, designSystem.colors);
    return (
        <YStack
            width="48%"
            style={{
                minWidth: 160,
                boxShadow: designSystem.shadows.card,
                borderColor: palette.accent,
                backgroundColor: palette.surface,
            }}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            p="$4"
            gap="$2"
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
                    letterSpacing={1.2}
                >
                    {label}
                </Paragraph>
            </YStack>
            <Text
                style={{ color: palette.text }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={30}
                lineHeight={32}
            >
                {value.toString()}
            </Text>
        </YStack>
    );
}

interface ActionButtonProps {
    readonly label: string;
    readonly onPress: () => void;
    readonly icon: ReactElement;
    readonly variant?: "primary" | "secondary";
}

function ActionButton({ label, onPress, icon, variant = "primary" }: ActionButtonProps) {
    const designSystem = useDesignSystem();
    return (
        <Button
            onPress={onPress}
            rounded={designSystem.radii.button}
            bg={
                variant === "primary"
                    ? designSystem.colors.primaryForeground
                    : "rgba(255,255,255,0.1)"
            }
            borderWidth={1}
            borderColor={
                variant === "primary"
                    ? designSystem.colors.primaryForeground
                    : "rgba(255,255,255,0.16)"
            }
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
        >
            <XStack items="center" gap="$2">
                {icon}
                <Button.Text
                    color={
                        variant === "primary"
                            ? designSystem.colors.primary
                            : designSystem.colors.primaryForeground
                    }
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    {label}
                </Button.Text>
            </XStack>
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
