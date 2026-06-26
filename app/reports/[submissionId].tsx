import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { Platform, ScrollView, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { BarChart3, CloudOff } from "components/icons";
import { Button, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { fetchSubmission } from "lib/yee-api";
import { getSubmissionSyncLabel, getSubmissionTimestampLabel } from "lib/yee-mobile-selectors";
import {
    buildSubmissionCsv,
    buildDomainScoreRows,
    buildMobileSubmissionScorePreview,
    getOverallComments,
    getReadableWeather,
    getSectionComments,
    getWeightingComments,
    getYouthWeightedScoreMaximum,
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
import { readSubmissionDetail, writeSubmissionDetail } from "lib/yee-offline-storage";
import type { YeeSubmissionResponse } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

// Two-series palette for the section score chart. Raw and Youth-Weighted use two
// brand greens (deep + soft) so the whole report reads as one calm system instead
// of a different hue per domain.
const RAW_SERIES_COLOR = designSystem.colors.primary;
const WEIGHTED_SERIES_COLOR = designSystem.colors.success;

type DomainScoreRow = ReturnType<typeof buildDomainScoreRows>[number];

export default function MobileReportDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ submissionId?: string }>();
    const scrollViewRef = useRef<ScrollView>(null);
    const insets = useSafeAreaInsets();
    const [footerHeight, setFooterHeight] = useState(0);
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";
    const session = useAuthStore((state) => state.session);
    const { isOnline, submittedAudits } = useYeeMobileStore(
        useShallow((state) => ({
            isOnline: state.isOnline,
            submittedAudits: state.submittedAudits,
        })),
    );
    const submissionSummary = submittedAudits.find((audit) => audit.id === submissionId) ?? null;

    const [submission, setSubmission] = useState<YeeSubmissionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (submissionId.length === 0) {
                setErrorMessage("Missing submission id.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage(null);

            const cached = await readSubmissionDetail(submissionId);
            if (!cancelled && cached !== null) {
                setSubmission(cached);
            }

            if (!session || !isOnline) {
                if (!cancelled) {
                    setLoading(false);
                    if (cached === null) {
                        setErrorMessage(
                            "This report detail is available after sync or the next online refresh.",
                        );
                    }
                }
                return;
            }

            try {
                const fresh = await fetchSubmission(submissionId, session);
                await writeSubmissionDetail(fresh);
                if (!cancelled) {
                    setSubmission(fresh);
                }
            } catch (error) {
                if (!cancelled && cached === null) {
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
    }, [isOnline, session, submissionId]);

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
        return (
            <YStack flex={1} items="center" justify="center" bg={designSystem.colors.background}>
                <Spinner size="large" color={designSystem.colors.primary} />
            </YStack>
        );
    }

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                ref={scrollViewRef}
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    paddingBottom: (footerHeight > 0 ? footerHeight : 88) + 24,
                    gap: 20,
                }}
            >
                <YStack gap="$1.5">
                    <Paragraph
                        color={designSystem.colors.primary}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={10}
                        textTransform="uppercase"
                        letterSpacing={1.5}
                    >
                        Audit report
                    </Paragraph>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={30}
                    >
                        {submission?.place_name ??
                            submissionSummary?.place_name ??
                            "Submitted audit"}
                    </Text>
                    <Paragraph color={designSystem.colors.mutedForeground}>
                        {submission?.syncState === "pending_upload"
                            ? "Results are being uploaded. Scores shown are preliminary."
                            : "Final audit results for this place."}
                    </Paragraph>
                </YStack>

                {submission === null ? (
                    <Card title="Report unavailable offline">
                        <Paragraph color={designSystem.colors.mutedForeground}>
                            {errorMessage ??
                                "Open this report once while online to make it available offline."}
                        </Paragraph>
                        {submissionListItem === null ? null : (
                            <YStack gap="$1.5">
                                <MetricRow
                                    label="Submitted"
                                    value={getSubmissionTimestampLabel(submissionListItem)}
                                />
                                <MetricRow
                                    label="Total raw score"
                                    value={`${submissionListItem.total_score}%`}
                                />
                            </YStack>
                        )}
                    </Card>
                ) : (
                    <>
                        {submission.syncState === "pending_upload" ? (
                            <Card title="Pending upload">
                                <Paragraph color={designSystem.colors.warning}>
                                    Scores shown are preliminary and will update once the upload
                                    completes.
                                </Paragraph>
                            </Card>
                        ) : null}
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
                                    value={submission.auditor_generated_id ?? submission.auditor_id}
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
                                        submission.participant_info.audit_date ?? "Not recorded",
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

                        <SectionScoreChart rows={rows} />

                        <ScoreResultsTable rows={rows} preview={preview} />

                        <WeightingSummaryCard rows={rows} />

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
                                        />
                                    );
                                },
                            )}
                        </XStack>

                        {!isOnline ? (
                            <Card title="Offline note">
                                <XStack items="center" gap="$2.5">
                                    <CloudOff size={15} color={designSystem.colors.warning} />
                                    <Paragraph color={designSystem.colors.secondaryForeground}>
                                        You are viewing a cached report copy on this device.
                                    </Paragraph>
                                </XStack>
                            </Card>
                        ) : null}
                    </>
                )}
            </ScrollView>

            <YStack
                position="absolute"
                onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
                style={{
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: designSystem.colors.background,
                    borderTopWidth: 1,
                    borderTopColor: designSystem.colors.border,
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: 12,
                    paddingBottom: insets.bottom + 12,
                }}
            >
                <XStack gap="$3">
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
    );
}

function ReportHeroCard({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <YStack
            rounded={designSystem.radii.xl}
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
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.lg}
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
                        gap="$3"
                        py="$2.5"
                        borderTopWidth={index === 0 ? 0 : 1}
                        borderColor={designSystem.colors.border}
                    >
                        <YStack flex={1} gap="$0.5">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={15}
                            >
                                {row.label}
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={12}
                            >
                                {getWeightLabel(row.weightValue)}
                            </Paragraph>
                        </YStack>
                        <ImportanceMeter value={row.weightValue} />
                    </XStack>
                ))}
            </YStack>
        </Card>
    );
}

/** Three-segment importance indicator (1-3). Filled segments use the brand green. */
function ImportanceMeter({ value }: { value: number }) {
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
                                    ? designSystem.colors.primary
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
                    accentColor={designSystem.colors.primary}
                />
                <MetricCard
                    label="Total Youth-Weighted average"
                    value={`${preview?.totalWeightedScore ?? 0} / ${preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 0} (${Math.round(((preview?.totalWeightedScore ?? 0) / (preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 1) || 0) * 100)}%)`}
                    helperText="Weighted by domain importance ratings."
                    accentColor={designSystem.colors.success}
                />
            </XStack>
        </Card>
    );
}

function ScoreTableHeader() {
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
                    flex={index === 0 ? 1.5 : 1}
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
    return (
        <XStack
            px="$2"
            py="$3"
            borderBottomWidth={1}
            borderColor={designSystem.colors.border}
            gap="$2"
        >
            <Text
                flex={1.5}
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {row.label}
            </Text>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.rawScore}/{row.rawMax} ({Math.round(row.rawPercentage)}%)
            </Paragraph>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.weightedScore}/{row.weightedMax} ({Math.round(row.weightedPercentage)}%)
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
    return (
        <Card title="Score by section">
            <Paragraph color={designSystem.colors.mutedForeground}>
                Every domain on one scale: the raw section score and the Youth-Weighted average,
                each as a percentage of the available score.
            </Paragraph>
            <XStack gap="$4" flexWrap="wrap">
                <ChartLegendItem color={RAW_SERIES_COLOR} label="Raw score" />
                <ChartLegendItem color={WEIGHTED_SERIES_COLOR} label="Youth-Weighted" />
            </XStack>
            <YStack gap="$3.5" mt="$1">
                {rows.map((row) => (
                    <YStack key={row.domain} gap="$2">
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={14}
                        >
                            {row.label}
                        </Text>
                        <ChartBar
                            color={RAW_SERIES_COLOR}
                            percentage={row.rawPercentage}
                            accessibilityLabel={`${row.label} raw score ${Math.round(row.rawPercentage)} percent`}
                        />
                        <ChartBar
                            color={WEIGHTED_SERIES_COLOR}
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
                <MetricRow
                    label="Highest"
                    value={`${highestRaw?.label ?? "N/A"} (${Math.round(highestRaw?.rawPercentage ?? 0)}%)`}
                />
                <MetricRow
                    label="Lowest"
                    value={`${lowestRaw?.label ?? "N/A"} (${Math.round(lowestRaw?.rawPercentage ?? 0)}%)`}
                />
            </InfoPanel>
            <InfoPanel title="Highest and lowest Youth-Weighted sections">
                <MetricRow
                    label="Highest"
                    value={`${highestWeighted?.label ?? "N/A"} (${Math.round(highestWeighted?.weightedPercentage ?? 0)}%)`}
                />
                <MetricRow
                    label="Lowest"
                    value={`${lowestWeighted?.label ?? "N/A"} (${Math.round(lowestWeighted?.weightedPercentage ?? 0)}%)`}
                />
            </InfoPanel>
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
    return (
        <YStack
            rounded={designSystem.radii.lg}
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
    accentColor,
}: {
    label: string;
    value: string;
    helperText: string;
    accentColor: string;
}) {
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2"
            style={{ minWidth: 150, boxShadow: designSystem.shadows.card }}
        >
            <Text
                style={{ color: accentColor }}
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

function CommentBlock({ title, body }: { title: string; body: string }) {
    const trimmed = body.trim();
    return (
        <YStack
            flex={1}
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.input}
            p="$3"
            gap="$1.5"
            style={{ minWidth: 250 }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={14}
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
