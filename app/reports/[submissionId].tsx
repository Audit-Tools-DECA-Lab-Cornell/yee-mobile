import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { Platform, ScrollView, Share, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { BarChart3, ChevronLeft } from "components/icons";
import { useYeeStackHeaderOptions } from "components/navigation/useYeeStackHeaderOptions";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { BrandLogo, Skeleton } from "components/ui";
import { DomainDot, DomainLabel } from "components/DomainLabel";
import { getScoreBandTone, useDesignSystem } from "lib/design-system";
import {
    getContentTrackInnerWidth,
    getResponsiveContentContainerStyle,
    useResponsiveLayout,
} from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { fetchSubmission } from "lib/yee-api";
import { buildReportHeaderLabels } from "lib/yee-navigation-labels";
import {
    buildMobileAuditProjection,
    getSubmissionSyncLabel,
    getSubmissionTimestampLabel,
} from "lib/yee-mobile-selectors";
import {
    buildSubmissionCsv,
    buildDomainScoreRows,
    buildMobileSubmissionScorePreview,
    getOverallComments,
    getReadableWeather,
    getSectionComments,
    getWeightingComments,
    totalRawScoreMaximum,
} from "lib/yee-mobile-reporting";
import {
    getOpenHoursAccessLabel,
    getPublicAccessLabel,
    getSeasonLabel,
    getVisitFrequencyLabel,
    getWeightLabel,
    mobileYeeDomainLabels,
    type MobileYeeDomainKey,
} from "lib/yee-mobile-audit-config";
import type { YeeSubmissionResponse } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

type DomainScoreRow = ReturnType<typeof buildDomainScoreRows>[number];

export default function MobileReportDetailScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const params = useLocalSearchParams<{ submissionId?: string }>();
    const layout = useResponsiveLayout();
    const scrollViewRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const stackHeaderOptions = useYeeStackHeaderOptions();
    const [footerHeight, setFooterHeight] = useState(0);
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";
    const session = useAuthStore((state) => state.session);
    const { isOnline, assignedPlaces, draftsByPlace, submittedAudits, syncQueue } =
        useYeeMobileStore(
            useShallow((state) => ({
                isOnline: state.isOnline,
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
                selectedSubmissionId: submissionId,
            }),
        [assignedPlaces, draftsByPlace, submittedAudits, syncQueue, submissionId],
    );
    const submissionSummary =
        projection.sortedReports.find((audit) => audit.id === submissionId) ?? null;
    // A queued or failed submission has no backend record yet: its id is a local
    // provisional id, so there is nothing to fetch and no offline report to show.
    const isUnsyncedSubmission =
        submissionSummary?.syncState === "pending_upload" ||
        submissionSummary?.syncState === "sync_failed";

    const [submission, setSubmission] = useState<YeeSubmissionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Reports render backend canonical score fields only. There is no offline
    // report cache: the submission is always fetched live from the backend, and
    // when it cannot be fetched we show an unavailable/pending state.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (submissionId.length === 0) {
                setSubmission(null);
                setErrorMessage("Missing submission id.");
                setLoading(false);
                return;
            }

            if (isUnsyncedSubmission) {
                setSubmission(null);
                setErrorMessage(null);
                setLoading(false);
                return;
            }

            if (!session || !isOnline) {
                setSubmission(null);
                setErrorMessage("Connect to the internet to view this report.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage(null);

            try {
                const fresh = await fetchSubmission(submissionId, session);
                if (!cancelled) {
                    setSubmission(fresh);
                }
            } catch (error) {
                if (!cancelled) {
                    setSubmission(null);
                    setErrorMessage(
                        error instanceof Error ? error.message : "Unable to load this report.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [isOnline, isUnsyncedSubmission, session, submissionId]);

    const preview = useMemo(() => {
        if (!submission) return null;
        return buildMobileSubmissionScorePreview(submission.score, submission.participant_info);
    }, [submission]);
    const rows = useMemo(() => (preview ? buildDomainScoreRows(preview) : []), [preview]);
    const submissionListItem = useMemo(() => {
        if (submissionSummary !== null) {
            return submissionSummary;
        }
        if (submission === null) {
            return null;
        }

        return {
            id: submission.id,
            place_id: submission.place_id,
            place_name: submission.place_name ?? submission.place_id,
            submitted_at: submission.submitted_at,
            total_score: submission.score.total_score,
            ...(submission.syncState ? { syncState: submission.syncState } : {}),
        };
    }, [submission, submissionSummary]);
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: !loading || submission !== null,
        rerunKey: `${submissionId}:${rows.length}`,
        scrollToOffset,
    });

    const headerLabels = useMemo(
        () =>
            buildReportHeaderLabels({
                placeName: submission?.place_name ?? submissionSummary?.place_name,
                isPendingUpload: isUnsyncedSubmission,
            }),
        [isUnsyncedSubmission, submission?.place_name, submissionSummary?.place_name],
    );
    const stackHeader = (
        <Stack.Screen
            options={{
                ...stackHeaderOptions,
                headerShown: false,
            }}
        />
    );

    /**
     * Share the submission as CSV through the native OS share sheet, which on
     * iOS and Android exposes Print, Files, Mail, and other export targets.
     */
    async function shareSubmissionCsv(): Promise<void> {
        if (submission === null) {
            return;
        }

        try {
            await Share.share({
                title: `${submission.place_name ?? submission.place_id} audit report`,
                message: buildSubmissionCsv(submission),
            });
        } catch {
            // The user dismissed the share sheet or it was unavailable.
        }
    }

    function handleExportData() {
        if (Platform.OS !== "web") {
            void shareSubmissionCsv();
            return;
        }

        if (submission === null || typeof window === "undefined") {
            return;
        }

        const csv = buildSubmissionCsv(submission);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${submission.place_name ?? submission.place_id}-submission-${submission.id}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
    }

    if (loading && submission === null) {
        // Content-shaped skeleton (header block, score hero, chart card) instead
        // of a blocking spinner, per the skeleton-first loading convention.
        return (
            <>
                {stackHeader}
                <YStack flex={1} bg={designSystem.colors.background} px="$4" pt="$5" gap="$4">
                    <Skeleton height={44} width="70%" />
                    <Skeleton height={120} />
                    <XStack gap="$3">
                        <YStack flex={1}>
                            <Skeleton height={96} />
                        </YStack>
                        <YStack flex={1}>
                            <Skeleton height={96} />
                        </YStack>
                    </XStack>
                    <Skeleton height={260} />
                </YStack>
            </>
        );
    }

    return (
        <>
            {stackHeader}
            <YStack flex={1} bg={designSystem.colors.background}>
                <ScrollView
                    ref={scrollViewRef}
                    contentInsetAdjustmentBehavior="automatic"
                    style={{ backgroundColor: designSystem.colors.background }}
                    contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                        bottomPadding: (footerHeight > 0 ? footerHeight : 88) + 24,
                        gap: 28,
                    })}
                >
                    <YStack gap="$6">
                        <XStack justify="space-between" items="center" gap="$3">
                            <XStack items="center" gap="$3" flex={1}>
                                <Button
                                    width={48}
                                    height={48}
                                    p={0}
                                    rounded={designSystem.radii.button}
                                    borderWidth={1}
                                    borderColor={designSystem.colors.border}
                                    bg={designSystem.colors.surfaceMuted}
                                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                    onPress={() => router.back()}
                                    accessibilityLabel="Go back"
                                >
                                    <ChevronLeft size={24} color={designSystem.colors.foreground} />
                                </Button>
                                <YStack flex={1} justify="center" items="flex-start">
                                    <Paragraph
                                        color={designSystem.colors.mutedForeground}
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={10}
                                        textTransform="uppercase"
                                        letterSpacing={1.4}
                                    >
                                        {headerLabels.primary}
                                    </Paragraph>
                                    <Text
                                        color={designSystem.colors.foreground}
                                        fontFamily={designSystem.fonts.bodyBold}
                                        fontSize={15}
                                    >
                                        {headerLabels.secondary}
                                    </Text>
                                </YStack>
                            </XStack>
                        </XStack>

                        <XStack items="flex-start" justify="space-between" gap="$3">
                            <YStack gap="$1.5" flex={1}>
                                <Text
                                    color={designSystem.colors.foreground}
                                    fontFamily={designSystem.fonts.headingBold}
                                    fontSize={34}
                                    lineHeight={38}
                                    letterSpacing={-0.8}
                                >
                                    Report overview
                                </Text>
                                <Paragraph
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodySemiBold}
                                >
                                    {submission === null
                                        ? isUnsyncedSubmission
                                            ? "This audit is still uploading. The full report opens once it finishes."
                                            : "This report is available online only."
                                        : `Final audit results for ${
                                              submission.place_name ??
                                              submissionSummary?.place_name ??
                                              "this place"
                                          }.`}
                                </Paragraph>
                            </YStack>
                            {/* Branded report chrome, matching the web report headers. */}
                            <BrandLogo size={44} accessibilityLabel={null} />
                        </XStack>
                    </YStack>

                    {submission === null ? (
                        <Card
                            title={
                                isUnsyncedSubmission
                                    ? "Report not uploaded yet"
                                    : "Report unavailable"
                            }
                        >
                            <Paragraph color={designSystem.colors.mutedForeground}>
                                {errorMessage ??
                                    (isUnsyncedSubmission
                                        ? "This audit hasn't finished uploading yet. Its full report will be available once the upload completes."
                                        : "Connect to the internet to view this report.")}
                            </Paragraph>
                            {submissionListItem === null ? null : (
                                <YStack gap="$1.5">
                                    <MetricRow
                                        label="Submitted"
                                        value={getSubmissionTimestampLabel(submissionListItem)}
                                    />
                                    <MetricRow
                                        label="Status"
                                        value={getSubmissionSyncLabel(submissionListItem)}
                                    />
                                </YStack>
                            )}
                        </Card>
                    ) : (
                        <>
                            <ReportHeroCard
                                title="Audit results"
                                subtitle="Scores and responses for this submitted audit."
                            />

                            <XStack gap="$3" flexWrap="wrap">
                                <InfoPanel title="Submission details">
                                    <MetricRow
                                        label="Place"
                                        value={submission.place_name ?? submission.place_id}
                                    />
                                    <MetricRow
                                        label="Auditor ID"
                                        value={
                                            submission.auditor_generated_id ?? submission.auditor_id
                                        }
                                    />
                                    <MetricRow
                                        label="Submitted at"
                                        value={getSubmissionTimestampLabel(
                                            submissionListItem ?? {
                                                id: submission.id,
                                                place_id: submission.place_id,
                                                place_name:
                                                    submission.place_name ?? submission.place_id,
                                                submitted_at: submission.submitted_at,
                                                total_score: submission.score.total_score,
                                            },
                                        )}
                                    />
                                    <MetricRow
                                        label="Status"
                                        value={getSubmissionSyncLabel(
                                            submissionListItem ?? {
                                                id: submission.id,
                                                place_id: submission.place_id,
                                                place_name:
                                                    submission.place_name ?? submission.place_id,
                                                submitted_at: submission.submitted_at,
                                                total_score: submission.score.total_score,
                                            },
                                        )}
                                    />
                                </InfoPanel>

                                <InfoPanel title="Context">
                                    <MetricRow
                                        label="Date"
                                        value={String(
                                            submission.participant_info.audit_date ??
                                                "Not recorded",
                                        )}
                                    />
                                    <MetricRow
                                        label="Visit frequency"
                                        value={getVisitFrequencyLabel(
                                            typeof submission.participant_info.visit_frequency ===
                                                "string"
                                                ? submission.participant_info.visit_frequency
                                                : null,
                                        )}
                                    />
                                    <MetricRow
                                        label="Public access"
                                        value={getPublicAccessLabel(
                                            typeof submission.participant_info.public_access ===
                                                "string"
                                                ? submission.participant_info.public_access
                                                : null,
                                        )}
                                    />
                                    <MetricRow
                                        label="Open all hours"
                                        value={getOpenHoursAccessLabel(
                                            typeof submission.participant_info.open_hours_access ===
                                                "string"
                                                ? submission.participant_info.open_hours_access
                                                : null,
                                        )}
                                    />
                                    <MetricRow
                                        label="Season"
                                        value={getSeasonLabel(
                                            typeof submission.participant_info.season === "string"
                                                ? submission.participant_info.season
                                                : null,
                                        )}
                                    />
                                    <MetricRow
                                        label="Weather"
                                        value={getReadableWeather(submission.participant_info)}
                                    />
                                </InfoPanel>
                            </XStack>

                            <WeightingSummaryCard rows={rows} />

                            <SectionScoreChart rows={rows} />

                            <ScoreResultsTable rows={rows} preview={preview} />

                            <HighlightsRow rows={rows} />

                            <XStack gap="$3" flexWrap="wrap">
                                <CommentBlock
                                    title="Weighting comments"
                                    body={getWeightingComments(submission.participant_info)}
                                />
                                <CommentBlock
                                    title="Overall comments"
                                    body={getOverallComments(submission.participant_info)}
                                />
                                {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map(
                                    (domain) => {
                                        const comments = getSectionComments(
                                            submission.participant_info,
                                        );
                                        return (
                                            <CommentBlock
                                                key={domain}
                                                title={`${mobileYeeDomainLabels[domain]} comments`}
                                                body={comments[domain] ?? ""}
                                                domain={domain}
                                            />
                                        );
                                    },
                                )}
                            </XStack>
                        </>
                    )}
                </ScrollView>

                <YStack
                    position="absolute"
                    onLayout={(event: LayoutChangeEvent) =>
                        setFooterHeight(event.nativeEvent.layout.height)
                    }
                    style={{
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: designSystem.colors.background,
                        borderTopWidth: 1,
                        borderTopColor: designSystem.colors.border,
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 12,
                    }}
                >
                    <XStack
                        gap="$3"
                        style={{
                            alignSelf: "center",
                            maxWidth: "100%",
                            width: getContentTrackInnerWidth(layout),
                        }}
                    >
                        <Button
                            flex={1}
                            rounded={designSystem.radii.button}
                            bg={designSystem.colors.surfaceMuted}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={handleExportData}
                        >
                            <Button.Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                Share
                            </Button.Text>
                        </Button>
                        <Button
                            flex={1}
                            rounded={designSystem.radii.button}
                            bg={designSystem.colors.primary}
                            borderWidth={1}
                            borderColor={designSystem.colors.primary}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={() => router.replace("/(tabs)/places")}
                        >
                            <Button.Text
                                color={designSystem.colors.primaryForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                Back to My Audits
                            </Button.Text>
                        </Button>
                    </XStack>
                </YStack>
            </YStack>
        </>
    );
}

function ReportHeroCard({ title, subtitle }: { title: string; subtitle: string }) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$4.5"
            gap="$2"
            style={{
                backgroundColor: designSystem.colors.surface,
                borderColor: designSystem.colors.border,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={28}
            >
                {title}
            </Text>
            <Paragraph color={designSystem.colors.mutedForeground}>{subtitle}</Paragraph>
        </YStack>
    );
}

function InfoPanel({ title, children }: PropsWithChildren<{ title: string }>) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$4"
            gap="$2.5"
            style={{
                minWidth: 280,
                backgroundColor: designSystem.colors.surface,
                borderColor: designSystem.colors.border,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={18}
            >
                {title}
            </Text>
            {children}
        </YStack>
    );
}

function WeightingSummaryCard({ rows }: { rows: readonly DomainScoreRow[] }) {
    const designSystem = useDesignSystem();
    return (
        <Card title="Section weighting">
            <Paragraph color={designSystem.colors.mutedForeground}>
                How important each domain was rated by the auditor (1 = lowest, 3 = highest). The
                weight scales that section&apos;s Youth-Weighted average.
            </Paragraph>
            <YStack gap="$0">
                {rows.map((row, index) => (
                    <XStack
                        key={row.domain}
                        items="center"
                        gap="$12"
                        py="$2.5"
                        pr="$4"
                        borderTopWidth={index === 0 ? 0 : 1}
                        borderColor={designSystem.colors.border}
                    >
                        <YStack flex={1} gap="$0.5">
                            <DomainLabel domain={row.domain} label={row.label} />
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={12}
                            >
                                {getWeightLabel(row.weightValue)}
                            </Paragraph>
                        </YStack>
                        <ImportanceMeter value={row.weightValue} domain={row.domain} />
                    </XStack>
                ))}
            </YStack>
        </Card>
    );
}

/** Three-segment importance indicator (1-3), filled in the domain's own colour. */
function ImportanceMeter({ value, domain }: { value: number; domain: MobileYeeDomainKey }) {
    const designSystem = useDesignSystem();
    const filled = Math.max(0, Math.min(3, Math.round(value)));
    return (
        <XStack items="center" gap="$2">
            <XStack gap={4}>
                {[1, 2, 3].map((segment) => (
                    <YStack
                        key={segment}
                        width={22}
                        height={8}
                        rounded={designSystem.radii.full}
                        style={{
                            backgroundColor:
                                segment <= filled
                                    ? designSystem.domains[domain].fill
                                    : designSystem.colors.mutedSurface,
                        }}
                    />
                ))}
            </XStack>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={13}
                width={20}
                style={{ textAlign: "right" }}
            >
                {filled}
            </Text>
        </XStack>
    );
}

function ScoreResultsTable({
    rows,
    preview,
}: {
    rows: readonly DomainScoreRow[];
    preview: ReturnType<typeof buildMobileSubmissionScorePreview> | null;
}) {
    const designSystem = useDesignSystem();
    return (
        <Card title="Score results">
            <Paragraph color={designSystem.colors.mutedForeground}>
                Raw scores and Youth-Weighted averages by section.
            </Paragraph>

            <YStack gap="$0">
                <ScoreTableHeader />
                {rows.map((row) => (
                    <ScoreTableRow key={row.domain} row={row} />
                ))}
            </YStack>

            <XStack gap="$3" flexWrap="wrap" mt="$2">
                <MetricCard
                    label="Total raw score"
                    value={`${preview?.totalRawScore ?? 0} / ${totalRawScoreMaximum} (${Math.round(((preview?.totalRawScore ?? 0) / totalRawScoreMaximum || 0) * 100)}%)`}
                    helperText="Sum of all section raw scores."
                    textColor={
                        getScoreBandTone(
                            ((preview?.totalRawScore ?? 0) / totalRawScoreMaximum || 0) * 100,
                            designSystem.scoreBands,
                        ).text
                    }
                />
                <MetricCard
                    label="Total Youth-Weighted average"
                    value={`${preview?.totalWeightedScore ?? 0} / ${preview?.totalWeightedMax ?? 0} (${Math.round(((preview?.totalWeightedScore ?? 0) / (preview?.totalWeightedMax ?? 1) || 0) * 100)}%)`}
                    helperText="Backend canonical weighted average."
                    textColor={
                        getScoreBandTone(
                            ((preview?.totalWeightedScore ?? 0) /
                                (preview?.totalWeightedMax ?? 1) || 0) * 100,
                            designSystem.scoreBands,
                        ).text
                    }
                />
            </XStack>
        </Card>
    );
}

function ScoreTableHeader() {
    const designSystem = useDesignSystem();
    return (
        <XStack
            px="$2"
            py="$2.5"
            borderBottomWidth={1}
            borderColor={designSystem.colors.border}
            gap="$2"
        >
            {["Section", "Raw", "Weighted"].map((label, index) => (
                <Text
                    key={label}
                    flex={index === 0 ? 1.25 : 1}
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={13}
                >
                    {label}
                </Text>
            ))}
        </XStack>
    );
}

function ScoreTableRow({ row }: { row: DomainScoreRow }) {
    const designSystem = useDesignSystem();
    return (
        <XStack
            px="$2"
            py="$3"
            borderBottomWidth={1}
            borderColor={designSystem.colors.border}
            gap="$2"
        >
            <XStack flex={1.25} items="center" gap="$1.5">
                <DomainDot domain={row.domain} />
                <Text
                    fontFamily={designSystem.fonts.bodyBold}
                    numberOfLines={1}
                    overflow="hidden"
                    style={{
                        color: designSystem.domains[row.domain].text,
                        textOverflow: "ellipsis",
                    }}
                >
                    {row.label}
                </Text>
            </XStack>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.rawScore}/{row.rawMax}{" "}
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={12}
                >
                    ({Math.round(row.rawPercentage)}%)
                </Text>
            </Paragraph>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.weightedScore}/{row.weightedMax}{" "}
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={12}
                >
                    ({Math.round(row.weightedPercentage)}%)
                </Text>
            </Paragraph>
        </XStack>
    );
}

/**
 * Single grouped horizontal bar chart for all six domains. Each domain shows two
 * bars — raw score and Youth-Weighted average — sharing a 0–100% scale, with one
 * legend describing the two series. Replaces the previous per-domain meter cards.
 */
function SectionScoreChart({ rows }: { rows: readonly DomainScoreRow[] }) {
    const designSystem = useDesignSystem();
    // Categorical chart-series tokens shared with the web (`--chart-series-*`):
    // brand green leads for the raw score; the harmonized blue carries the
    // Youth-Weighted series.
    const rawSeriesColor = designSystem.charts.series[0];
    const weightedSeriesColor = designSystem.charts.series[1];
    return (
        <Card title="Score by section">
            <Paragraph color={designSystem.colors.mutedForeground}>
                Every domain on one scale: the raw section score and the Youth-Weighted average,
                each as a percentage of the available score.
            </Paragraph>
            <XStack gap="$4" flexWrap="wrap">
                <ChartLegendItem color={rawSeriesColor} label="Raw score" />
                <ChartLegendItem color={weightedSeriesColor} label="Youth-Weighted" />
            </XStack>
            <YStack gap="$3.5" mt="$1">
                {rows.map((row) => (
                    <YStack key={row.domain} gap="$2">
                        <DomainLabel domain={row.domain} label={row.label} fontSize={14} />
                        <ChartBar
                            color={rawSeriesColor}
                            percentage={row.rawPercentage}
                            accessibilityLabel={`${row.label} raw score ${Math.round(row.rawPercentage)} percent`}
                        />
                        <ChartBar
                            color={weightedSeriesColor}
                            percentage={row.weightedPercentage}
                            accessibilityLabel={`${row.label} Youth-Weighted average ${Math.round(row.weightedPercentage)} percent`}
                        />
                    </YStack>
                ))}
            </YStack>
        </Card>
    );
}

function ChartLegendItem({ color, label }: { color: string; label: string }) {
    const designSystem = useDesignSystem();
    return (
        <XStack items="center" gap="$2">
            <YStack
                width={12}
                height={12}
                rounded={designSystem.radii.sm}
                style={{ backgroundColor: color }}
            />
            <Text
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={12}
            >
                {label}
            </Text>
        </XStack>
    );
}

function ChartBar({
    color,
    percentage,
    accessibilityLabel,
}: {
    color: string;
    percentage: number;
    accessibilityLabel: string;
}) {
    const designSystem = useDesignSystem();
    const clamped = Math.max(0, Math.min(100, percentage));
    return (
        <XStack
            items="center"
            gap="$2.5"
            accessibilityRole="progressbar"
            accessibilityLabel={accessibilityLabel}
        >
            <YStack
                flex={1}
                height={14}
                rounded={designSystem.radii.full}
                overflow="hidden"
                style={{ backgroundColor: designSystem.colors.mutedSurface }}
            >
                <YStack
                    height={14}
                    rounded={designSystem.radii.full}
                    style={{ width: `${Math.max(2, clamped)}%`, backgroundColor: color }}
                />
            </YStack>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={13}
                width={40}
                style={{ textAlign: "right" }}
            >
                {Math.round(percentage)}%
            </Text>
        </XStack>
    );
}

function HighlightsRow({ rows }: { rows: readonly DomainScoreRow[] }) {
    const highestRaw = [...rows].sort((a, b) => b.rawPercentage - a.rawPercentage)[0];
    const lowestRaw = [...rows].sort((a, b) => a.rawPercentage - b.rawPercentage)[0];
    const highestWeighted = [...rows].sort(
        (a, b) => b.weightedPercentage - a.weightedPercentage,
    )[0];
    const lowestWeighted = [...rows].sort((a, b) => a.weightedPercentage - b.weightedPercentage)[0];

    return (
        <XStack gap="$3" flexWrap="wrap">
            <InfoPanel title="Highest and lowest raw score sections">
                <DomainHighlightRow label="Highest" row={highestRaw} mode="raw" />
                <DomainHighlightRow label="Lowest" row={lowestRaw} mode="raw" />
            </InfoPanel>
            <InfoPanel title="Highest and lowest Youth-Weighted sections">
                <DomainHighlightRow label="Highest" row={highestWeighted} mode="weighted" />
                <DomainHighlightRow label="Lowest" row={lowestWeighted} mode="weighted" />
            </InfoPanel>
        </XStack>
    );
}

/**
 * One highlight line. The section named here is a domain, so it is named in that
 * domain's colours rather than as plain text — the same treatment the score
 * table and the section chart use, so the reader can match them at a glance.
 */
function DomainHighlightRow({
    label,
    row,
    mode,
}: {
    label: string;
    row: DomainScoreRow | undefined;
    mode: "raw" | "weighted";
}) {
    const designSystem = useDesignSystem();
    if (row === undefined) return <MetricRow label={label} value="N/A" />;
    const percentage = mode === "raw" ? row.rawPercentage : row.weightedPercentage;
    return (
        <XStack justify="space-between" items="center" gap="$3" py="$1">
            <Paragraph color={designSystem.colors.mutedForeground}>{label}</Paragraph>
            <XStack items="center" gap="$1.5" flex={0} shrink={1}>
                <DomainLabel domain={row.domain} label={row.label} fontSize={13} />
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={13}
                >
                    ({Math.round(percentage)}%)
                </Text>
            </XStack>
        </XStack>
    );
}

function Card({
    title,
    children,
    accent,
    soft,
}: {
    title: string;
    children: ReactNode;
    accent?: string | undefined;
    soft?: string | undefined;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$3"
            style={{
                boxShadow: designSystem.shadows.card,
                borderColor: accent ?? designSystem.colors.border,
                backgroundColor: soft ?? designSystem.colors.surface,
            }}
        >
            <XStack items="center" gap="$2">
                <BarChart3 size={16} color={accent ?? designSystem.colors.primary} />
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={20}
                >
                    {title}
                </Text>
            </XStack>
            {children}
        </YStack>
    );
}

function MetricCard({
    label,
    value,
    helperText,
    textColor,
}: {
    label: string;
    value: string;
    helperText: string;
    textColor: string;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2"
            style={{ minWidth: 150, boxShadow: designSystem.shadows.card }}
        >
            <Text
                style={{ color: textColor }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={24}
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

function MetricRow({ label, value }: { label: string; value: string }) {
    const designSystem = useDesignSystem();
    return (
        <XStack justify="space-between" items="center" gap="$3">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                {label}
            </Paragraph>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={14}
                flex={1}
                style={{ textAlign: "right" }}
            >
                {value}
            </Text>
        </XStack>
    );
}

function CommentBlock({
    title,
    body,
    domain,
}: {
    title: string;
    body: string;
    /** Set when the comment belongs to one domain; omitted for overall/weighting. */
    domain?: MobileYeeDomainKey;
}) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const trimmed = body.trim();
    const colors = domain === undefined ? null : designSystem.domains[domain];
    // Fixed-width columns (not flex) so every card is the same width regardless
    // of how many land on the final row; a min height keeps empty and filled
    // cards visually consistent.
    return (
        <YStack
            width={layout.isTablet ? "48.5%" : "100%"}
            rounded={designSystem.radii.sm}
            borderWidth={1}
            p="$3"
            gap="$1.5"
            style={{
                minHeight: 76,
                borderColor: colors?.strong ?? designSystem.colors.border,
                backgroundColor: colors?.light ?? designSystem.colors.input,
            }}
        >
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={14}
                style={{ color: colors?.text ?? designSystem.colors.foreground }}
            >
                {title}
            </Text>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                {trimmed.length > 0 ? trimmed : "No comments submitted."}
            </Paragraph>
        </YStack>
    );
}
