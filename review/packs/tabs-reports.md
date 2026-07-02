# CODE CONTEXT PACK — app/(tabs)/reports.tsx

_Read `review/core.md` alongside this file._

design_system_components_used: ScaledParagraph, ScaledText

## Screen slice

### app/(tabs)/reports.tsx

```tsx
import { useCallback, useMemo, useRef } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { FileBarChart, TriangleAlert } from "components/icons";
import { Button, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import {
    averageSubmittedScore,
    getLatestSubmissionForPlace,
    getSubmissionSyncLabel,
    getSubmissionTimestampLabel,
    getTopSubmission,
    sortAuditsNewestFirst,
} from "lib/yee-mobile-selectors";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Reports tab backed by synced YEE submissions.
 */
export default function ReportsScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const selectedPlaceId = useSelectionStore((state) => state.selectedPlaceId);
    const submittedAudits = useYeeMobileStore((state) => state.submittedAudits);

    const sortedAudits = useMemo(() => sortAuditsNewestFirst(submittedAudits), [submittedAudits]);
    const averageScore = useMemo(() => averageSubmittedScore(submittedAudits), [submittedAudits]);
    const topSubmission = useMemo(() => getTopSubmission(submittedAudits), [submittedAudits]);
    const focusedSubmission = useMemo(() => {
        return (
            getLatestSubmissionForPlace(sortedAudits, selectedPlaceId) ??
            topSubmission ??
            sortedAudits[0] ??
            null
        );
    }, [selectedPlaceId, sortedAudits, topSubmission]);
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: true,
        rerunKey: sortedAudits.length,
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
                        Reports
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        View submitted audit results for your assigned places.
                    </Paragraph>
                </YStack>

                <XStack gap="$3">
                    <MetricCard
                        label="Average score"
                        value={`${averageScore}%`}
                        accentColor={designSystem.colors.primary}
                        helperText="Across all reports"
                    />
                    <MetricCard
                        label="Top score"
                        value={topSubmission === null ? "--" : `${topSubmission.total_score}%`}
                        accentColor={designSystem.colors.success}
                        helperText={topSubmission?.place_name ?? "No reports yet"}
                    />
                </XStack>
            </YStack>

            {focusedSubmission === null ? (
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
                        No submitted audits yet
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        Reports will appear here after you submit an audit.
                    </Paragraph>
                </YStack>
            ) : (
                <YStack gap="$3">
                    <YStack
                        rounded={designSystem.radii.lg}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$4"
                        gap="$3"
                        style={{ boxShadow: designSystem.shadows.card }}
                    >
                        <XStack items="center" gap="$2">
                            <FileBarChart size={16} color={designSystem.colors.primary} />
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={20}
                            >
                                Current report
                            </Text>
                        </XStack>
                        <YStack gap="$1">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={17}
                            >
                                {focusedSubmission.place_name}
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                {getSubmissionTimestampLabel(focusedSubmission)}
                            </Paragraph>
                            <Paragraph
                                color={
                                    focusedSubmission.syncState === "pending_upload"
                                        ? designSystem.colors.warning
                                        : designSystem.colors.success
                                }
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={12}
                            >
                                {getSubmissionSyncLabel(focusedSubmission)}
                            </Paragraph>
                        </YStack>
                        <YStack gap="$2">
                            <XStack justify="space-between" items="center">
                                <Paragraph
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                >
                                    Total raw score
                                </Paragraph>
                                <Text
                                    color={designSystem.colors.primary}
                                    fontFamily={designSystem.fonts.headingBold}
                                    fontSize={26}
                                >
                                    {focusedSubmission.total_score}%
                                </Text>
                            </XStack>
                            <YStack
                                height={10}
                                rounded={designSystem.radii.full}
                                bg={designSystem.colors.mutedSurface}
                                overflow="hidden"
                            >
                                <YStack
                                    height={10}
                                    rounded={designSystem.radii.full}
                                    bg={designSystem.colors.primary}
                                    width={`${Math.max(0, Math.min(focusedSubmission.total_score, 100))}%`}
                                />
                            </YStack>
                        </YStack>
                        <Button
                            rounded={designSystem.radii.button}
                            bg={designSystem.colors.primary}
                            borderWidth={1}
                            borderColor={designSystem.colors.primary}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => router.push(`/reports/${focusedSubmission.id}`)}
                        >
                            <Button.Text
                                color={designSystem.colors.primaryForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                Open selected report
                            </Button.Text>
                        </Button>
                    </YStack>

                    <YStack
                        rounded={designSystem.radii.lg}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surface}
                        p="$4"
                        gap="$3"
                        style={{ boxShadow: designSystem.shadows.card }}
                    >
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={11}
                            textTransform="uppercase"
                            letterSpacing={1.5}
                        >
                            Report list
                        </Text>
                        <YStack gap="$3">
                            {sortedAudits.map((audit) => (
                                <YStack
                                    key={audit.id}
                                    rounded={designSystem.radii.md}
                                    borderWidth={1}
                                    borderColor={designSystem.colors.border}
                                    bg={designSystem.colors.input}
                                    p="$3"
                                    gap="$2.5"
                                >
                                    <XStack justify="space-between" items="flex-start" gap="$3">
                                        <YStack flex={1}>
                                            <Text
                                                color={designSystem.colors.foreground}
                                                fontFamily={designSystem.fonts.bodyBold}
                                                fontSize={15}
                                            >
                                                {audit.place_name}
                                            </Text>
                                            <Paragraph
                                                color={designSystem.colors.mutedForeground}
                                                fontFamily={designSystem.fonts.bodyMedium}
                                                fontSize={12}
                                            >
                                                {getSubmissionTimestampLabel(audit)}
                                            </Paragraph>
                                        </YStack>
                                        <YStack items="flex-end" gap="$0.5">
                                            <Paragraph
                                                color={
                                                    audit.syncState === "pending_upload"
                                                        ? designSystem.colors.warning
                                                        : designSystem.colors.success
                                                }
                                                fontFamily={designSystem.fonts.bodyBold}
                                            >
                                                {audit.total_score}%
                                            </Paragraph>
                                            <Paragraph
                                                color={designSystem.colors.mutedForeground}
                                                fontFamily={designSystem.fonts.bodyMedium}
                                                fontSize={12}
                                            >
                                                {getSubmissionSyncLabel(audit)}
                                            </Paragraph>
                                        </YStack>
                                    </XStack>
                                    <YStack
                                        height={6}
                                        rounded={designSystem.radii.full}
                                        bg={designSystem.colors.mutedSurface}
                                        overflow="hidden"
                                    >
                                        <YStack
                                            height={6}
                                            rounded={designSystem.radii.full}
                                            bg={
                                                audit.place_id === selectedPlaceId
                                                    ? designSystem.colors.success
                                                    : designSystem.colors.primary
                                            }
                                            width={`${Math.max(0, Math.min(audit.total_score, 100))}%`}
                                        />
                                    </YStack>
                                    <Button
                                        rounded={designSystem.radii.button}
                                        bg={designSystem.colors.surfaceMuted}
                                        borderWidth={1}
                                        borderColor={designSystem.colors.border}
                                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                        onPress={() => router.push(`/reports/${audit.id}`)}
                                    >
                                        <Button.Text
                                            color={designSystem.colors.foreground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                        >
                                            {audit.syncState === "pending_upload"
                                                ? "Open queued report"
                                                : "Open report"}
                                        </Button.Text>
                                    </Button>
                                </YStack>
                            ))}
                        </YStack>
                    </YStack>
                </YStack>
            )}

            <YStack
                rounded={designSystem.radii.lg}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                bg={designSystem.colors.surfaceMuted}
                p="$4"
                gap="$2"
            >
                <XStack items="center" gap="$2.5">
                    <TriangleAlert size={14} color={designSystem.colors.mutedForeground} />
                    <Paragraph
                        color={designSystem.colors.secondaryForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                        fontSize={13}
                    >
                        Comparison reports and exports are available on the web dashboard.
                    </Paragraph>
                </XStack>
            </YStack>
        </ScrollView>
    );
}

function MetricCard({
    label,
    value,
    accentColor,
    helperText,
}: {
    label: string;
    value: string;
    accentColor: string;
    helperText: string;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Text
                style={{ color: accentColor }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={30}
                lineHeight={32}
            >
                {value}
            </Text>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={14}
            >
                {label}
            </Text>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={12}
            >
                {helperText}
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
