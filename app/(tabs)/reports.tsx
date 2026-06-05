import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { FileBarChart, TriangleAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { averageSubmittedScore, getTopSubmission } from "lib/yee-mobile-selectors";
import { formatAuditTimestamp } from "lib/yee-mobile-reporting";
import { useDemoUiStore } from "stores/demo-ui-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Reports tab backed by synced YEE submissions.
 */
export default function ReportsScreen() {
    const router = useRouter();
    const selectedPlaceId = useDemoUiStore((state) => state.selectedPlaceId);
    const submittedAudits = useYeeMobileStore((state) => state.submittedAudits);

    const averageScore = useMemo(() => averageSubmittedScore(submittedAudits), [submittedAudits]);
    const topSubmission = useMemo(() => getTopSubmission(submittedAudits), [submittedAudits]);
    const focusedSubmission = useMemo(() => {
        return submittedAudits.find((audit) => audit.place_id === selectedPlaceId) ?? topSubmission;
    }, [selectedPlaceId, submittedAudits, topSubmission]);

    return (
        <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={{
                paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                paddingTop: designSystem.spacing.screenPaddingVertical,
                paddingBottom: 132,
                gap: 24,
            }}
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
                        Submitted mobile audits appear here after sync. Open any locked report to
                        review domain scores, comments, and result context from the field.
                    </Paragraph>
                </YStack>

                <XStack gap="$3">
                    <MetricCard
                        label="Average raw score"
                        value={`${averageScore}%`}
                        accentColor={designSystem.colors.primary}
                        helperText="Across synced submissions"
                    />
                    <MetricCard
                        label="Top synced score"
                        value={topSubmission === null ? "--" : `${topSubmission.total_score}%`}
                        accentColor={designSystem.colors.success}
                        helperText={topSubmission?.place_name ?? "No submission yet"}
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
                        Once an audit is submitted and synced, this screen will show each locked
                        report and allow it to be opened again on the device.
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
                                Selected report
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
                                Submitted {formatAuditTimestamp(focusedSubmission.submitted_at)}
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
                            rounded={designSystem.radii.full}
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
                            Synced submissions
                        </Text>
                        <YStack gap="$3">
                            {submittedAudits.map((audit) => (
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
                                                Submitted {formatAuditTimestamp(audit.submitted_at)}
                                            </Paragraph>
                                        </YStack>
                                        <YStack items="flex-end" gap="$0.5">
                                            <Paragraph
                                                color={designSystem.colors.success}
                                                fontFamily={designSystem.fonts.bodyBold}
                                            >
                                                {audit.total_score}%
                                            </Paragraph>
                                            <Paragraph
                                                color={designSystem.colors.mutedForeground}
                                                fontFamily={designSystem.fonts.bodyMedium}
                                                fontSize={12}
                                            >
                                                Locked result
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
                                        rounded={designSystem.radii.full}
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
                                            Open report
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
                borderColor={designSystem.colors.warning}
                bg={designSystem.colors.warningSoft}
                p="$4"
                gap="$3"
            >
                <XStack items="flex-start" gap="$2.5" width="100%">
                    <TriangleAlert size={16} color={designSystem.colors.warning} />
                    <Text
                        flex={1}
                        color={designSystem.colors.warning}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={13}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                        style={{ flexShrink: 1, lineHeight: 18 }}
                    >
                        Full comparison reports and export packages remain available in the web
                        dashboard
                    </Text>
                </XStack>
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                    lineHeight={20}
                >
                    Mobile now supports read-only submitted audit reports for field confirmation.
                    Broader comparison views and exports still live on the browser dashboard for
                    stakeholder review.
                </Paragraph>
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
