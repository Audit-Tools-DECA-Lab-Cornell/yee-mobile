import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { BarChart3, CloudOff } from "components/icons";
import { Button, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
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

const domainTone: Record<MobileYeeDomainKey, { accent: string; soft: string }> = {
    access: { accent: designSystem.colors.success, soft: designSystem.colors.successSoft },
    activitySpaces: { accent: designSystem.colors.info, soft: designSystem.colors.infoSoft },
    amenities: { accent: designSystem.colors.warning, soft: designSystem.colors.warningSoft },
    experienceOfSpace: {
        accent: designSystem.colors.primary,
        soft: designSystem.colors.primarySoft,
    },
    aestheticsAndCare: { accent: designSystem.colors.violet, soft: designSystem.colors.violetSoft },
    useAndUsability: { accent: designSystem.colors.danger, soft: designSystem.colors.dangerSoft },
};

const sectionWeightingTone = {
    accent: "#77D6A7",
    soft: "#E7FAEE",
    border: "#8BE0B5",
} as const;

type DomainScoreRow = ReturnType<typeof buildDomainScoreRows>[number];

export default function MobileReportDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ submissionId?: string }>();
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

    function handlePrintReport() {
        if (typeof window === "undefined") {
            return;
        }

        window.print();
    }

    function handleExportData() {
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
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    paddingBottom: 120,
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
                        Mobile submitted report
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
                            ? "This is the device-saved preview for one YEE audit while upload is still pending."
                            : "Locked results for one YEE audit. This mobile report uses the same backend scoring data as the website."}
                    </Paragraph>
                </YStack>

                {submission === null ? (
                    <Card title="Report not cached yet">
                        <Paragraph color={designSystem.colors.mutedForeground}>
                            {errorMessage ??
                                "This audit summary is available, but the detailed report needs one online load before it can be reopened offline."}
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
                            <Card title="Offline report preview">
                                <Paragraph color={designSystem.colors.warning}>
                                    This report was generated from the locally queued submission and
                                    will be replaced by the backend version after sync.
                                </Paragraph>
                            </Card>
                        ) : null}
                        <ReportHeroCard
                            title="Submitted audit results"
                            subtitle="This is a locked, read-only report for the submitted YEE audit."
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
                                <MetricRow label="Submission ID" value={submission.id} />
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

                        <WeightingSummaryCard rows={rows} />

                        <ScoreResultsTable rows={rows} preview={preview} />

                        <RangeGuideCard />

                        <SectionScoreCard
                            title="Raw score by section"
                            rows={rows}
                            valueKey="raw"
                            surface={designSystem.colors.surface}
                        />

                        <SectionScoreCard
                            title="Youth-Weighted average by section"
                            rows={rows}
                            valueKey="weighted"
                            surface={sectionWeightingTone.soft}
                            accent={sectionWeightingTone.border}
                        />

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

            <XStack
                position="absolute"
                gap="$2.5"
                flexWrap="wrap"
                style={{
                    left: designSystem.spacing.screenPaddingHorizontal,
                    right: designSystem.spacing.screenPaddingHorizontal,
                    bottom: 20,
                }}
            >
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={handlePrintReport}
                    style={{ minWidth: 150 }}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Print report
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={handleExportData}
                    style={{ minWidth: 150 }}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Export data
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.primary}
                    borderWidth={1}
                    borderColor={designSystem.colors.primary}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => router.replace("/(tabs)/places")}
                    style={{ minWidth: 150 }}
                >
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back to My Audits
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surface}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => router.replace("/(tabs)")}
                    style={{ minWidth: 150 }}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back to Dashboard
                    </Button.Text>
                </Button>
            </XStack>
        </YStack>
    );
}

function ReportHeroCard({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <YStack
            rounded={28}
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
            rounded={24}
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
        <YStack
            rounded={26}
            borderWidth={1}
            p="$4"
            gap="$3"
            style={{
                backgroundColor: sectionWeightingTone.soft,
                borderColor: sectionWeightingTone.border,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <YStack gap="$1">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={20}
                >
                    Section weighting used in this audit
                </Text>
                <Paragraph color={designSystem.colors.mutedForeground}>
                    Youth Weighted values are calculated by normalizing the participant&apos;s
                    section weights, computing the average score within each section, and then
                    applying the normalized weight to that section average.
                </Paragraph>
            </YStack>

            <XStack gap="$3" flexWrap="wrap">
                {rows.map((row) => {
                    const tone = domainTone[row.domain];
                    return (
                        <YStack
                            key={row.domain}
                            flex={1}
                            rounded={22}
                            borderWidth={1}
                            p="$3.5"
                            gap="$1"
                            style={{
                                minWidth: 170,
                                backgroundColor: tone.soft,
                                borderColor: tone.accent,
                            }}
                        >
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.headingBold}
                                fontSize={16}
                            >
                                {row.label}
                            </Text>
                            <Paragraph color={designSystem.colors.secondaryForeground}>
                                {getWeightLabel(row.weightValue)}
                            </Paragraph>
                            <Paragraph color={designSystem.colors.mutedForeground} fontSize={12}>
                                Weight value: {row.weightValue}
                            </Paragraph>
                        </YStack>
                    );
                })}
            </XStack>
        </YStack>
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
                Read-only raw scores and Youth Weighted averages computed from the submitted
                responses.
            </Paragraph>

            <YStack gap="$0">
                <ScoreTableHeader />
                {rows.map((row) => (
                    <ScoreTableRow key={row.domain} row={row} />
                ))}
            </YStack>

            <XStack gap="$3" flexWrap="wrap" mt="$2">
                <MetricCard
                    label="Total Enabling Environment Raw Score"
                    value={`${preview?.totalRawScore ?? 0} / ${totalRawScoreMaximum} (${Math.round(((preview?.totalRawScore ?? 0) / totalRawScoreMaximum || 0) * 100)}%)`}
                    helperText="This percentage shows how much of the available raw score was achieved across the full audit."
                    accentColor={designSystem.colors.primary}
                />
                <MetricCard
                    label="Total Enabling Environment Youth Weighted Average"
                    value={`${preview?.totalWeightedScore ?? 0} / ${preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 0} (${Math.round(((preview?.totalWeightedScore ?? 0) / (preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 1) || 0) * 100)}%)`}
                    helperText="This Youth Weighted maximum is based on normalized domain weights and each domain's maximum average value."
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
            {[
                "Section",
                "Raw Section Score",
                "Raw %",
                "Youth-Weighted Section Average",
                "Youth-Weighted %",
            ].map((label, index) => (
                <Text
                    key={label}
                    flex={index === 0 ? 1.4 : 1}
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
                flex={1.4}
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {row.label}
            </Text>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.rawScore} / {row.rawMax}
            </Paragraph>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {Math.round(row.rawPercentage)}% ({row.rawScore}/{row.rawMax})
            </Paragraph>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {row.weightedScore} / {row.weightedMax}
            </Paragraph>
            <Paragraph flex={1} color={designSystem.colors.secondaryForeground}>
                {Math.round(row.weightedPercentage)}% ({row.weightedScore}/{row.weightedMax})
            </Paragraph>
        </XStack>
    );
}

function RangeGuideCard() {
    return (
        <Card title="How to read these graphs">
            <Paragraph color={designSystem.colors.mutedForeground}>
                Each bar represents 100% of the available score for that section. The colored fill
                shows how much of that available score was reached. Raw and Youth Weighted
                percentages are shown separately because they answer slightly different questions
                about the same audit.
            </Paragraph>
            <XStack gap="$3" flexWrap="wrap">
                <LegendPill
                    color="#EF6B81"
                    title="Lower range"
                    detail="0% to 33% of the available score"
                />
                <LegendPill
                    color="#F1B433"
                    title="Middle range"
                    detail="34% to 66% of the available score"
                />
                <LegendPill
                    color="#56BF84"
                    title="Upper range"
                    detail="67% to 100% of the available score"
                />
            </XStack>
        </Card>
    );
}

function LegendPill({ color, title, detail }: { color: string; title: string; detail: string }) {
    return (
        <YStack
            flex={1}
            rounded={22}
            borderWidth={1}
            p="$3"
            gap="$1"
            style={{
                minWidth: 170,
                backgroundColor: designSystem.colors.surface,
                borderColor: designSystem.colors.border,
            }}
        >
            <XStack items="center" gap="$2">
                <YStack width={14} height={14} rounded={999} style={{ backgroundColor: color }} />
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    {title}
                </Text>
            </XStack>
            <Paragraph color={designSystem.colors.secondaryForeground}>{detail}</Paragraph>
        </YStack>
    );
}

function SectionScoreCard({
    title,
    rows,
    valueKey,
    surface,
    accent,
}: {
    title: string;
    rows: readonly DomainScoreRow[];
    valueKey: "raw" | "weighted";
    surface: string;
    accent?: string;
}) {
    return (
        <Card title={title} soft={surface} {...(accent ? { accent } : {})}>
            <XStack gap="$3" flexWrap="wrap">
                {rows.map((row) => (
                    <DomainScoreStatCard
                        key={`${valueKey}-${row.domain}`}
                        row={row}
                        valueKey={valueKey}
                    />
                ))}
            </XStack>
        </Card>
    );
}

function DomainScoreStatCard({
    row,
    valueKey,
}: {
    row: DomainScoreRow;
    valueKey: "raw" | "weighted";
}) {
    const tone = domainTone[row.domain];
    const numerator = valueKey === "raw" ? row.rawScore : row.weightedScore;
    const denominator = valueKey === "raw" ? row.rawMax : row.weightedMax;
    const percentage = valueKey === "raw" ? row.rawPercentage : row.weightedPercentage;
    const fillColor = getRangeColor(percentage);

    return (
        <YStack
            flex={1}
            rounded={24}
            borderWidth={1}
            p="$3.5"
            gap="$1.5"
            style={{
                minWidth: 145,
                backgroundColor: tone.soft,
                borderColor: tone.accent,
            }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={16}
            >
                {row.label}
            </Text>
            <Paragraph color={designSystem.colors.secondaryForeground}>
                {valueKey === "raw" ? "Raw score" : "Youth-Weighted average"}
            </Paragraph>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={18}
            >
                {numerator} / {denominator} ({Math.round(percentage)}%)
            </Text>
            <VerticalMeter percentage={percentage} fillColor={fillColor} />
        </YStack>
    );
}

function VerticalMeter({ percentage, fillColor }: { percentage: number; fillColor: string }) {
    return (
        <YStack
            width={42}
            height={150}
            rounded={999}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            justify="flex-end"
            overflow="hidden"
            self="center"
            mt="$1"
        >
            <YStack
                rounded={999}
                mx={6}
                mb={6}
                style={{
                    height: `${Math.max(8, Math.min(100, percentage))}%`,
                    backgroundColor: fillColor,
                }}
            />
        </YStack>
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

function getRangeColor(percentage: number): string {
    if (percentage <= 33) {
        return "#EF6B81";
    }
    if (percentage <= 66) {
        return "#F1B433";
    }
    return "#56BF84";
}
