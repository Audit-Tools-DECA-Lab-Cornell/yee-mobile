import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, BarChart3, CloudOff, FileText } from "@tamagui/lucide-icons";
import { Button, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { fetchSubmission } from "lib/yee-api";
import {
    buildDomainScoreRows,
    buildMobileSubmissionScorePreview,
    formatAuditTimestamp,
    getOverallComments,
    getReadableWeather,
    getSectionComments,
    getWeightingComments,
    getYouthWeightedScoreMaximum,
    totalRawScoreMaximum,
} from "lib/yee-mobile-reporting";
import { mobileYeeDomainLabels, type MobileYeeDomainKey } from "lib/yee-mobile-audit-config";
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

export default function MobileReportDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ submissionId?: string }>();
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";
    const session = useAuthStore((state) => state.session);
    const { isOnline, submittedAudits } = useYeeMobileStore((state) => ({
        isOnline: state.isOnline,
        submittedAudits: state.submittedAudits,
    }));
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
                        Locked results for one YEE audit. This mobile report uses the same backend
                        scoring data as the website.
                    </Paragraph>
                </YStack>

                {submission === null ? (
                    <Card title="Report not cached yet">
                        <Paragraph color={designSystem.colors.mutedForeground}>
                            {errorMessage ??
                                "This audit summary is available, but the detailed report needs one online load before it can be reopened offline."}
                        </Paragraph>
                        {submissionSummary === null ? null : (
                            <YStack gap="$1.5">
                                <MetricRow
                                    label="Submitted"
                                    value={formatAuditTimestamp(submissionSummary.submitted_at)}
                                />
                                <MetricRow
                                    label="Total raw score"
                                    value={`${submissionSummary.total_score}%`}
                                />
                            </YStack>
                        )}
                    </Card>
                ) : (
                    <>
                        <XStack gap="$3" flexWrap="wrap">
                            <MetricCard
                                label="Total Raw Score"
                                value={`${preview?.totalRawScore ?? 0} / ${totalRawScoreMaximum}`}
                                helperText={`${Math.round(((preview?.totalRawScore ?? 0) / totalRawScoreMaximum || 0) * 100)}% of the available raw score`}
                                accentColor={designSystem.colors.primary}
                            />
                            <MetricCard
                                label="Total Youth Weighted"
                                value={`${preview?.totalWeightedScore ?? 0} / ${preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 0}`}
                                helperText={`${Math.round(((preview?.totalWeightedScore ?? 0) / (preview ? getYouthWeightedScoreMaximum(preview.selectedWeights) : 1) || 0) * 100)}% of the selected-weight maximum`}
                                accentColor={designSystem.colors.success}
                            />
                        </XStack>

                        <Card title="Submission details">
                            <MetricRow
                                label="Auditor ID"
                                value={submission.auditor_generated_id ?? submission.auditor_id}
                            />
                            <MetricRow
                                label="Submitted"
                                value={formatAuditTimestamp(submission.submitted_at)}
                            />
                            <MetricRow
                                label="Audit date"
                                value={String(
                                    submission.participant_info.audit_date ?? "Not recorded",
                                )}
                            />
                            <MetricRow
                                label="Visit frequency"
                                value={String(
                                    submission.participant_info.visit_frequency ?? "Not recorded",
                                )}
                            />
                            <MetricRow
                                label="Season"
                                value={String(submission.participant_info.season ?? "Not recorded")}
                            />
                            <MetricRow
                                label="Weather"
                                value={getReadableWeather(submission.participant_info)}
                            />
                        </Card>

                        <Card title="How to read these score bars">
                            <Paragraph color={designSystem.colors.mutedForeground}>
                                Each percentage bar shows how much of the available score was
                                reached for that domain. Raw and Youth Weighted bars are shown
                                separately because they answer slightly different questions about
                                the same audit.
                            </Paragraph>
                            <LegendRow
                                color={designSystem.colors.primary}
                                label="Raw"
                                detail="Observed domain score out of the worksheet raw maximum"
                            />
                            <LegendRow
                                color={designSystem.colors.success}
                                label="Youth Weighted"
                                detail="Raw score multiplied by the importance weight selected earlier"
                            />
                        </Card>

                        {rows.map((row) => {
                            const tone = domainTone[row.domain];
                            return (
                                <Card
                                    key={row.domain}
                                    title={row.label}
                                    accent={tone.accent}
                                    soft={tone.soft}
                                >
                                    <YStack gap="$3">
                                        <ScoreBar
                                            label="Raw"
                                            numerator={row.rawScore}
                                            denominator={row.rawMax}
                                            percentage={row.rawPercentage}
                                            fill={designSystem.colors.primary}
                                        />
                                        <ScoreBar
                                            label="Youth Weighted"
                                            numerator={row.weightedScore}
                                            denominator={row.weightedMax}
                                            percentage={row.weightedPercentage}
                                            fill={designSystem.colors.success}
                                        />
                                        <Paragraph
                                            color={designSystem.colors.mutedForeground}
                                            fontFamily={designSystem.fonts.bodyMedium}
                                        >
                                            Selected importance weight: {row.weightValue}
                                        </Paragraph>
                                    </YStack>
                                </Card>
                            );
                        })}

                        <Card title="Comments and notes">
                            <YStack gap="$3">
                                <CommentBlock
                                    title="Weighting comments"
                                    body={getWeightingComments(submission.participant_info)}
                                />
                                <CommentBlock
                                    title="Overall comments"
                                    body={getOverallComments(submission.participant_info)}
                                />
                            </YStack>
                        </Card>

                        <Card title="Section comments">
                            <YStack gap="$3">
                                {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map(
                                    (domain) => {
                                        const comments = getSectionComments(
                                            submission.participant_info,
                                        );
                                        return (
                                            <CommentBlock
                                                key={domain}
                                                title={mobileYeeDomainLabels[domain]}
                                                body={comments[domain] ?? ""}
                                            />
                                        );
                                    },
                                )}
                            </YStack>
                        </Card>

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
                    onPress={() => router.back()}
                    icon={<ArrowLeft size={16} color={designSystem.colors.foreground} />}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.primary}
                    borderWidth={1}
                    borderColor={designSystem.colors.primary}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={() => router.replace("/(tabs)/reports")}
                    icon={<FileText size={16} color={designSystem.colors.primaryForeground} />}
                >
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        All reports
                    </Button.Text>
                </Button>
            </XStack>
        </YStack>
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
    accent?: string;
    soft?: string;
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

function ScoreBar({
    label,
    numerator,
    denominator,
    percentage,
    fill,
}: {
    label: string;
    numerator: number;
    denominator: number;
    percentage: number;
    fill: string;
}) {
    return (
        <YStack gap="$1.5">
            <XStack justify="space-between" items="center">
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
                >
                    {numerator} / {denominator} · {Math.round(percentage)}%
                </Paragraph>
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
                        backgroundColor: fill,
                        width: `${Math.max(0, Math.min(percentage, 100))}%`,
                    }}
                />
            </YStack>
        </YStack>
    );
}

function LegendRow({ color, label, detail }: { color: string; label: string; detail: string }) {
    return (
        <XStack items="flex-start" gap="$2.5">
            <YStack
                width={10}
                height={10}
                rounded={designSystem.radii.full}
                style={{ backgroundColor: color, marginTop: 4 }}
            />
            <YStack flex={1} gap="$0.5">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={13}
                >
                    {label}
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {detail}
                </Paragraph>
            </YStack>
        </XStack>
    );
}

function CommentBlock({ title, body }: { title: string; body: string }) {
    const trimmed = body.trim();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.input}
            p="$3"
            gap="$1.5"
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
