import { useCallback, useMemo, useRef } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { FileBarChart, TriangleAlert } from "components/icons";
import { Button, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text, ScreenHeader } from "components/ui";
import { getScoreBandTone, useDesignSystem } from "lib/design-system";
import { toScorePercentage } from "lib/yee-mobile-reporting";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import {
    buildMobileAuditProjection,
    getSubmissionSyncLabel,
    getSubmissionTimestampLabel,
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
    const { assignedPlaces, draftsByPlace, submittedAudits, syncQueue } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            submittedAudits: state.submittedAudits,
            syncQueue: state.syncQueue,
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
    const sortedAudits = projection.sortedReports;
    const averageScore = projection.averageScore;
    const topSubmission = projection.topSubmission;
    const focusedSubmission = projection.focusedSubmission;
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: true,
        rerunKey: sortedAudits.length,
        scrollToOffset,
    });

    const summaryMetrics = (
        <XStack gap="$3">
            <MetricCard
                label="Average score"
                value={`${toScorePercentage(averageScore)}%`}
                textColor={
                    getScoreBandTone(toScorePercentage(averageScore), designSystem.scoreBands).text
                }
                helperText="Across all reports"
            />
            <MetricCard
                label="Top score"
                value={
                    topSubmission === null
                        ? "--"
                        : `${toScorePercentage(topSubmission.total_score)}%`
                }
                textColor={
                    topSubmission === null
                        ? designSystem.colors.mutedForeground
                        : getScoreBandTone(
                              toScorePercentage(topSubmission.total_score),
                              designSystem.scoreBands,
                          ).text
                }
                helperText={topSubmission?.place_name ?? "No reports yet"}
            />
        </XStack>
    );

    const focusedReportCard =
        focusedSubmission === null ? null : (
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
                                ? designSystem.colors.warningText
                                : designSystem.colors.successText
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
                            Overall score
                        </Paragraph>
                        <Text
                            style={{
                                color: getScoreBandTone(
                                    toScorePercentage(focusedSubmission.total_score),
                                    designSystem.scoreBands,
                                ).text,
                            }}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={26}
                        >
                            {toScorePercentage(focusedSubmission.total_score)}%
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
                            style={{
                                backgroundColor: getScoreBandTone(
                                    toScorePercentage(focusedSubmission.total_score),
                                    designSystem.scoreBands,
                                ).accent,
                            }}
                            width={`${toScorePercentage(focusedSubmission.total_score)}%`}
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
        );

    const reportsSupportNote = (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surfaceMuted}
            p="$4"
            gap="$2"
        >
            <XStack items="flex-start" gap="$2.5">
                <YStack style={{ paddingTop: 2 }}>
                    <TriangleAlert size={14} color={designSystem.colors.mutedForeground} />
                </YStack>
                <Paragraph
                    flex={1}
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    fontSize={13}
                >
                    Comparison reports and exports are available on the web dashboard.
                </Paragraph>
            </XStack>
        </YStack>
    );

    const reportList = (
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
                                    style={{
                                        color:
                                            audit.syncState === "pending_upload"
                                                ? designSystem.colors.warningText
                                                : getScoreBandTone(
                                                      toScorePercentage(audit.total_score),
                                                      designSystem.scoreBands,
                                                  ).text,
                                    }}
                                    fontFamily={designSystem.fonts.bodyBold}
                                >
                                    {toScorePercentage(audit.total_score)}%
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
                                style={{
                                    backgroundColor: getScoreBandTone(
                                        toScorePercentage(audit.total_score),
                                        designSystem.scoreBands,
                                    ).accent,
                                }}
                                width={`${toScorePercentage(audit.total_score)}%`}
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
    );

    const emptyReportList = (
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
    );

    return (
        <ScrollView
            ref={scrollViewRef}
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                bottomPadding: 132,
                gap: layout.sectionGap,
                // Content-light report list: cap at the readable column on tablet.
                maxWidth: layout.readableMaxWidth,
            })}
        >
            <ScreenHeader
                title="Reports"
                subtitle="View submitted audit results for your assigned places."
            />

            {summaryMetrics}
            {focusedReportCard}
            {sortedAudits.length === 0 ? emptyReportList : reportList}
            {reportsSupportNote}
        </ScrollView>
    );
}

function MetricCard({
    label,
    value,
    textColor,
    helperText,
    fill = true,
}: {
    label: string;
    value: string;
    textColor: string;
    helperText: string;
    fill?: boolean;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={fill ? 1 : undefined}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Text
                style={{ color: textColor }}
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
