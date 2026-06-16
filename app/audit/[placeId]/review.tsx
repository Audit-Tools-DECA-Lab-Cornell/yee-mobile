import { Alert, Platform, ScrollView } from "react-native";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, Send } from "components/icons";
import { Button, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import {
    buildParticipantInfo,
    buildStoredDraft,
    buildFormStateFromSources,
    type MobileAuditFormState,
} from "lib/yee-mobile-draft";
import {
    getOpenHoursAccessLabel,
    getPublicAccessLabel,
    getSeasonLabel,
    getVisitFrequencyLabel,
    getWeatherLabelList,
    getWeightLabel,
    getWeightNumber,
    mobileYeeDomainLabels,
    mobileYeeSteps,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
    answerLabel,
    getSectionForStep,
    normalizeInstrument,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { scoreYeeResponsesLocally } from "lib/yee-local-scoring";
import { previewScore } from "lib/yee-api";
import { readInstrumentCache } from "lib/yee-offline-storage";
import type { YeeScoreResult, YeeSubmissionResponse } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

type ReviewRow = {
    readonly prompt: string;
    readonly response: string;
    readonly condition: string | null;
};

type ReviewSection = {
    readonly domain: MobileYeeDomainKey;
    readonly label: string;
    readonly step: MobileYeeStepNumber;
    readonly rows: readonly ReviewRow[];
    readonly answeredCount: number;
    readonly totalCount: number;
};

export default function AuditReviewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ placeId?: string }>();
    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const session = useAuthStore((state) => state.session);
    const {
        assignedPlaces,
        draftsByPlace,
        isOnline,
        saveDraftLocally,
        queueSubmissionSync,
        syncPendingQueue,
        refreshRemoteState,
    } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            isOnline: state.isOnline,
            saveDraftLocally: state.saveDraftLocally,
            queueSubmissionSync: state.queueSubmissionSync,
            syncPendingQueue: state.syncPendingQueue,
            refreshRemoteState: state.refreshRemoteState,
        })),
    );
    const place = assignedPlaces.find((entry) => entry.id === placeId) ?? null;
    const storedDraft = draftsByPlace[placeId] ?? null;

    const [draft, setDraft] = useState<MobileAuditFormState | null>(null);
    const [instrument, setInstrument] = useState<NormalizedInstrument | null>(null);
    const [rawInstrument, setRawInstrument] = useState<Record<string, unknown> | null>(null);
    const [scorePreview, setScorePreview] = useState<number | null>(
        storedDraft?.scorePreview?.total_score ?? null,
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (placeId.length === 0) {
            return;
        }

        setDraft(
            buildFormStateFromSources({
                placeId,
                placeName:
                    place?.name ??
                    storedDraft?.participantInfo.place_name?.toString() ??
                    "Assigned place",
                auditorId: storedDraft?.participantInfo.auditor_id?.toString() ?? "AUDITOR",
                storedDraft,
            }),
        );
    }, [place?.name, placeId, storedDraft]);

    useEffect(() => {
        let cancelled = false;

        async function loadInstrument() {
            const cachedInstrument = await readInstrumentCache();
            if (cachedInstrument === null || cancelled) {
                return;
            }
            setRawInstrument(cachedInstrument);
            setInstrument(normalizeInstrument(cachedInstrument as never));
        }

        void loadInstrument();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        async function loadPreview() {
            if (draft === null) {
                return;
            }

            const localScore =
                rawInstrument === null
                    ? null
                    : scoreYeeResponsesLocally(rawInstrument, draft.responses);

            if (session === null || !isOnline) {
                if (localScore !== null) {
                    setScorePreview(localScore.total_score);
                    if (storedDraft !== null) {
                        await saveDraftLocally(
                            buildStoredDraft(draft, storedDraft, localScore, storedDraft.syncState),
                        );
                    }
                }
                return;
            }

            try {
                const score = await previewScore(session, {
                    place_id: placeId,
                    participant_info: buildParticipantInfo(draft),
                    responses: draft.responses,
                });
                setScorePreview(score?.total_score ?? null);
                if (storedDraft !== null) {
                    await saveDraftLocally(
                        buildStoredDraft(draft, storedDraft, score ?? null, storedDraft.syncState),
                    );
                }
            } catch {
                if (localScore !== null) {
                    setScorePreview(localScore.total_score);
                    if (storedDraft !== null) {
                        await saveDraftLocally(
                            buildStoredDraft(draft, storedDraft, localScore, storedDraft.syncState),
                        );
                    }
                }
            }
        }

        void loadPreview();
    }, [draft, isOnline, placeId, rawInstrument, saveDraftLocally, session, storedDraft]);

    const reviewSections = useMemo<readonly ReviewSection[]>(() => {
        if (draft === null || instrument === null) {
            return [];
        }

        return (Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => {
            const step = getStepForDomain(domain);
            const section = getSectionForStep(instrument, step);
            if (section === null) {
                return {
                    domain,
                    label: mobileYeeDomainLabels[domain],
                    step,
                    rows: [],
                    answeredCount: 0,
                    totalCount: 0,
                };
            }

            const rows = section.groups.flatMap((group) =>
                group.rows.map((row) => {
                    const responseId = draft.responses[row.presenceItemId]?.[row.choiceId];
                    const response = answerLabel(row.presenceAnswers, responseId) ?? "Not answered";
                    const showCondition =
                        responseId !== undefined &&
                        (response.toLowerCase().startsWith("yes") ||
                            response.toLowerCase().includes("yes,"));
                    const condition =
                        showCondition && row.conditionItemId !== null
                            ? (answerLabel(
                                  row.conditionAnswers,
                                  draft.responses[row.conditionItemId]?.[row.choiceId],
                              ) ?? "Not answered")
                            : null;

                    return {
                        prompt: row.label,
                        response,
                        condition,
                    } satisfies ReviewRow;
                }),
            );

            return {
                domain,
                label: section.title,
                step,
                rows,
                answeredCount: rows.filter((row) => row.response !== "Not answered").length,
                totalCount: rows.length,
            } satisfies ReviewSection;
        });
    }, [draft, instrument]);

    const incompleteStep = useMemo(
        () => (draft === null ? null : findFirstIncompleteStep(draft, instrument)),
        [draft, instrument],
    );
    const answeredCount = useMemo(() => {
        if (draft === null) {
            return 0;
        }

        return Object.values(draft.responses).reduce(
            (sum, responseMap) => sum + Object.values(responseMap).filter(Boolean).length,
            0,
        );
    }, [draft]);

    if (draft === null) {
        return (
            <YStack flex={1} items="center" justify="center" bg={designSystem.colors.background}>
                <Spinner size="large" color={designSystem.colors.primary} />
            </YStack>
        );
    }

    const currentDraft = draft;

    async function submitNow() {
        const incomplete = findFirstIncompleteStep(currentDraft, instrument);
        if (incomplete !== null) {
            const goFix = await confirmChoice(
                "Audit is incomplete",
                `${incomplete.label} still has unanswered required fields. Do you want to jump back and fix it now?`,
                "Go to section",
                "Stay on review",
            );

            if (goFix) {
                router.push(`/audit/${placeId}/${incomplete.step}`);
            }
            return;
        }

        const confirmed = await confirmChoice(
            "Submit audit?",
            "After submission, this audit will be locked and can no longer be edited on mobile or web.",
            "Submit",
            "Cancel",
        );
        if (!confirmed) {
            return;
        }

        const finalizedDraft = finalizeDraftBeforeSubmit(currentDraft);
        setDraft(finalizedDraft);
        setIsSubmitting(true);

        try {
            const localScore =
                rawInstrument === null
                    ? (storedDraft?.scorePreview ?? emptyScoreResult())
                    : scoreYeeResponsesLocally(rawInstrument, finalizedDraft.responses);
            const provisionalSubmission = buildLocalQueuedSubmission(finalizedDraft, localScore);
            const draftForQueue = buildStoredDraft(
                finalizedDraft,
                storedDraft,
                localScore,
                "pending_upload",
            );
            await saveDraftLocally(draftForQueue);
            await queueSubmissionSync(draftForQueue, provisionalSubmission);

            let nextMode: "queued" | "submitted" = "queued";
            let nextSubmissionId = provisionalSubmission.id;
            if (session !== null && isOnline) {
                await syncPendingQueue(session);
                await refreshRemoteState(session);
                const currentState = useYeeMobileStore.getState();
                const latestSubmissionForPlace = currentState.submittedAudits
                    .filter((audit) => audit.place_id === placeId)
                    .sort(
                        (left, right) =>
                            Date.parse(right.submitted_at) - Date.parse(left.submitted_at),
                    )[0];
                const queuedSubmissionStillPresent = currentState.syncQueue.some(
                    (item) => item.kind === "submission" && item.placeId === placeId,
                );

                if (
                    latestSubmissionForPlace !== undefined &&
                    latestSubmissionForPlace.syncState !== "pending_upload"
                ) {
                    nextMode = "submitted";
                    nextSubmissionId = latestSubmissionForPlace.id;
                } else if (!queuedSubmissionStillPresent) {
                    nextMode = "submitted";
                }
            }

            router.replace(
                `/audit/${placeId}/submitted?mode=${nextMode}&submissionId=${nextSubmissionId}`,
            );
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to queue submission.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    paddingBottom: 150,
                    gap: 18,
                }}
            >
                <YStack gap="$2">
                    <Paragraph
                        color={designSystem.colors.primary}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={10}
                        textTransform="uppercase"
                        letterSpacing={1.5}
                    >
                        audit/{placeId}
                    </Paragraph>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={30}
                    >
                        Review and submit
                    </Text>
                    <Paragraph color={designSystem.colors.mutedForeground}>
                        Review every answer for {draft.placeName || "this place"} before the final
                        submission.
                    </Paragraph>
                </YStack>

                <XStack gap="$2" flexWrap="wrap">
                    <Chip>{draft.auditorId}</Chip>
                    <Chip>{draft.placeName || "Assigned place"}</Chip>
                    <Chip>{answeredCount} saved answers</Chip>
                    <Chip>{incompleteStep === null ? "Ready to submit" : "Still incomplete"}</Chip>
                </XStack>

                <SectionCard title="Quick actions">
                    <XStack gap="$2.5" flexWrap="wrap">
                        <ActionButton
                            label="Back to dashboard"
                            onPress={() => router.replace("/(tabs)/index")}
                            tone="neutral"
                        />
                        <ActionButton
                            label="Edit audit"
                            onPress={() => router.push(`/audit/${placeId}/1`)}
                            tone="neutral"
                        />
                        <ActionButton
                            label={isSubmitting ? "Submitting..." : "Submit audit"}
                            onPress={() => void submitNow()}
                            tone="primary"
                            disabled={isSubmitting}
                        />
                    </XStack>
                    {incompleteStep === null ? null : (
                        <Paragraph color={designSystem.colors.warning}>
                            {incompleteStep.label} still needs required answers before this audit
                            can be submitted.
                        </Paragraph>
                    )}
                </SectionCard>

                <SectionCard title="Survey pages">
                    <XStack gap="$2" flexWrap="wrap">
                        {mobileYeeSteps.map((entry) => (
                            <StepJumpButton
                                key={entry.step}
                                step={entry.step}
                                label={entry.title}
                                onPress={() => router.push(`/audit/${placeId}/${entry.step}`)}
                            />
                        ))}
                    </XStack>
                </SectionCard>

                <SectionCard title="Context summary">
                    <SummaryGrid>
                        <SummaryRow
                            label="Visit frequency"
                            value={getVisitFrequencyLabel(draft.visitFrequency)}
                        />
                        <SummaryRow
                            label="Open to the public"
                            value={getPublicAccessLabel(draft.publicAccess)}
                        />
                        <SummaryRow
                            label="Open all hours"
                            value={getOpenHoursAccessLabel(draft.openHoursAccess)}
                        />
                        <SummaryRow label="Season" value={getSeasonLabel(draft.season)} />
                        <SummaryRow label="Weather" value={getWeatherLabelList(draft.weather)} />
                        <SummaryRow label="Answered audit fields" value={`${answeredCount}`} />
                    </SummaryGrid>
                </SectionCard>

                <SectionCard title="Youth weighting">
                    <YStack gap="$3">
                        {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map(
                            (domain) => {
                                const theme = getReviewTheme(domain);
                                return (
                                    <YStack
                                        key={domain}
                                        rounded={18}
                                        borderWidth={1}
                                        p="$3.5"
                                        gap="$1.5"
                                        style={{
                                            backgroundColor: theme.soft,
                                            borderColor: theme.border,
                                        }}
                                    >
                                        <XStack justify="space-between" items="center" gap="$3">
                                            <Text
                                                style={{ color: theme.accent }}
                                                fontFamily={designSystem.fonts.bodyBold}
                                                flex={1}
                                            >
                                                {mobileYeeDomainLabels[domain]}
                                            </Text>
                                            <YStack
                                                rounded={designSystem.radii.full}
                                                px="$3"
                                                py="$1.5"
                                                style={{ backgroundColor: theme.accent }}
                                            >
                                                <Text
                                                    color={designSystem.colors.primaryForeground}
                                                    fontFamily={designSystem.fonts.bodyBold}
                                                >
                                                    {getWeightNumber(draft.weights[domain])}
                                                </Text>
                                            </YStack>
                                        </XStack>
                                        <Paragraph color={designSystem.colors.secondaryForeground}>
                                            {getWeightLabel(draft.weights[domain])}
                                        </Paragraph>
                                    </YStack>
                                );
                            },
                        )}
                        <SummaryRow
                            label="Weighting comments"
                            value={draft.weightingComments || "No weighting comments added."}
                        />
                    </YStack>
                </SectionCard>

                {reviewSections.map((section) => {
                    const theme = getReviewTheme(section.domain);
                    return (
                        <SectionCard
                            key={section.domain}
                            title={section.label}
                            accent={theme.accent}
                            soft={theme.soft}
                            border={theme.border}
                        >
                            <XStack justify="space-between" items="center" gap="$3" flexWrap="wrap">
                                <Paragraph color={designSystem.colors.secondaryForeground}>
                                    {section.answeredCount} of {section.totalCount} question rows
                                    answered
                                </Paragraph>
                                <Button
                                    rounded={designSystem.radii.full}
                                    borderWidth={1}
                                    style={{
                                        backgroundColor: theme.accent,
                                        borderColor: theme.accent,
                                    }}
                                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                                    onPress={() => router.push(`/audit/${placeId}/${section.step}`)}
                                >
                                    <Button.Text
                                        color={designSystem.colors.primaryForeground}
                                        fontFamily={designSystem.fonts.bodyBold}
                                    >
                                        Edit section
                                    </Button.Text>
                                </Button>
                            </XStack>
                            <YStack gap="$3">
                                {section.rows.map((row, index) => (
                                    <YStack
                                        key={`${section.domain}-${index}`}
                                        rounded={18}
                                        borderWidth={1}
                                        p="$3.5"
                                        gap="$2"
                                        style={{
                                            backgroundColor: designSystem.colors.surface,
                                            borderColor: theme.border,
                                        }}
                                    >
                                        <Text
                                            color={designSystem.colors.foreground}
                                            fontFamily={designSystem.fonts.bodyBold}
                                        >
                                            {row.prompt}
                                        </Text>
                                        <AnswerPill
                                            label="Answer"
                                            value={row.response}
                                            accent={theme.accent}
                                            soft={theme.soft}
                                        />
                                        {row.condition ? (
                                            <AnswerPill
                                                label="Condition"
                                                value={row.condition}
                                                accent={theme.accent}
                                                soft={designSystem.colors.surfaceMuted}
                                            />
                                        ) : null}
                                    </YStack>
                                ))}
                                <SummaryRow
                                    label={`${section.label} comments`}
                                    value={
                                        draft.sectionComments[section.domain] ||
                                        "No section comments added."
                                    }
                                />
                            </YStack>
                        </SectionCard>
                    );
                })}

                <SectionCard title="Final comments">
                    <SummaryRow
                        label="Overall comments"
                        value={draft.comments || "No overall comments added."}
                    />
                </SectionCard>

                <SectionCard title="Score preview">
                    <SummaryRow
                        label="Current preview"
                        value={
                            scorePreview === null
                                ? isOnline
                                    ? "Calculating..."
                                    : "Available when online"
                                : `${scorePreview}%`
                        }
                    />
                    <Paragraph color={designSystem.colors.mutedForeground}>
                        This uses the same scoring logic as the website whenever the device is
                        online.
                    </Paragraph>
                </SectionCard>

                {errorMessage === null ? null : (
                    <SectionCard title="Submission note">
                        <Paragraph color={designSystem.colors.danger}>{errorMessage}</Paragraph>
                    </SectionCard>
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
                    onPress={() => router.push(`/audit/${placeId}/9`)}
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
                    onPress={() => void submitNow()}
                >
                    <XStack items="center" gap="$2">
                        {isSubmitting ? (
                            <Spinner color={designSystem.colors.primaryForeground} size="small" />
                        ) : (
                            <Send size={16} color={designSystem.colors.primaryForeground} />
                        )}
                        <Button.Text
                            color={designSystem.colors.primaryForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                        >
                            Submit audit
                        </Button.Text>
                    </XStack>
                </Button>
            </XStack>
        </YStack>
    );
}

function buildLocalQueuedSubmission(
    draft: MobileAuditFormState,
    score: YeeScoreResult,
): YeeSubmissionResponse {
    return {
        id: `local-submission-${draft.placeId}-${Date.now()}`,
        place_id: draft.placeId,
        place_name: draft.placeName,
        auditor_id: draft.auditorId,
        auditor_generated_id: draft.auditorId,
        submitted_at: new Date().toISOString(),
        participant_info: buildParticipantInfo(draft),
        responses: draft.responses,
        score,
        syncState: "pending_upload",
    };
}

function emptyScoreResult(): YeeScoreResult {
    return {
        total_score: 0,
        section_scores: {},
        category_scores: {},
        matched_scored_answers: 0,
    };
}

function SectionCard({
    title,
    children,
    accent,
    soft,
    border,
}: PropsWithChildren<{
    title: string;
    accent?: string;
    soft?: string;
    border?: string;
}>) {
    return (
        <YStack
            rounded={24}
            borderWidth={1}
            p="$4"
            gap="$3"
            style={{
                backgroundColor: soft ?? designSystem.colors.surface,
                borderColor: border ?? designSystem.colors.border,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                style={{ color: accent ?? designSystem.colors.foreground }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={22}
            >
                {title}
            </Text>
            {children}
        </YStack>
    );
}

function SummaryGrid({ children }: PropsWithChildren) {
    return <YStack gap="$3">{children}</YStack>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <YStack gap="$0.5">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.1}
            >
                {label}
            </Paragraph>
            <Text color={designSystem.colors.foreground} fontFamily={designSystem.fonts.bodyMedium}>
                {value}
            </Text>
        </YStack>
    );
}

function AnswerPill({
    label,
    value,
    accent,
    soft,
}: {
    label: string;
    value: string;
    accent: string;
    soft: string;
}) {
    return (
        <YStack gap="$1">
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.1}
            >
                {label}
            </Paragraph>
            <YStack
                rounded={designSystem.radii.full}
                px="$3"
                py="$2"
                borderWidth={1}
                style={{ backgroundColor: soft, borderColor: accent }}
            >
                <Text style={{ color: accent }} fontFamily={designSystem.fonts.bodyBold}>
                    {value}
                </Text>
            </YStack>
        </YStack>
    );
}

function Chip({ children }: PropsWithChildren) {
    return (
        <YStack
            rounded={designSystem.radii.full}
            px="$3"
            py="$1.5"
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surfaceMuted}
        >
            <Text color={designSystem.colors.foreground} fontFamily={designSystem.fonts.bodyBold}>
                {children}
            </Text>
        </YStack>
    );
}

function StepJumpButton({
    step,
    label,
    onPress,
}: {
    step: MobileYeeStepNumber;
    label: string;
    onPress: () => void;
}) {
    const theme = getReviewThemeByStep(step);
    return (
        <Button
            rounded={designSystem.radii.full}
            borderWidth={1}
            px="$3.5"
            py="$2.5"
            hoverStyle={{ opacity: 0.96 }}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            style={{
                backgroundColor: theme.soft,
                borderColor: theme.border,
            }}
        >
            <Button.Text style={{ color: theme.accent }} fontFamily={designSystem.fonts.bodyBold}>
                {step}. {label}
            </Button.Text>
        </Button>
    );
}

function ActionButton({
    label,
    onPress,
    tone,
    disabled,
}: {
    label: string;
    onPress: () => void;
    tone: "primary" | "neutral";
    disabled?: boolean;
}) {
    const primary = tone === "primary";
    return (
        <Button
            rounded={designSystem.radii.full}
            borderWidth={1}
            disabled={disabled}
            hoverStyle={{ opacity: 0.96 }}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            style={{
                backgroundColor: primary
                    ? designSystem.colors.primary
                    : designSystem.colors.surfaceMuted,
                borderColor: primary ? designSystem.colors.primary : designSystem.colors.border,
            }}
        >
            <Button.Text
                color={
                    primary ? designSystem.colors.primaryForeground : designSystem.colors.foreground
                }
                fontFamily={designSystem.fonts.bodyBold}
            >
                {label}
            </Button.Text>
        </Button>
    );
}

function finalizeDraftBeforeSubmit(draft: MobileAuditFormState): MobileAuditFormState {
    const now = new Date();
    return {
        ...draft,
        finishTime: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        totalMinutes: estimateMinutes(draft.auditDate, draft.startTime, now),
    };
}

function estimateMinutes(auditDate: string, startTime: string, finishDate: Date): number {
    const start = Date.parse(`${auditDate}T${normalizeTime(startTime)}`);
    if (Number.isNaN(start)) {
        return 0;
    }

    return Math.max(0, Math.round((finishDate.getTime() - start) / 60000));
}

function normalizeTime(value: string): string {
    if (value.includes(":") && (value.includes("AM") || value.includes("PM"))) {
        const [time = "", meridiem = ""] = value.split(" ");
        const [hoursText = "", minutesText = "00"] = time.split(":");
        let hours = Number(hoursText);
        const minutes = Number(minutesText);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return "00:00:00";
        }
        if (meridiem === "PM" && hours < 12) {
            hours += 12;
        }
        if (meridiem === "AM" && hours === 12) {
            hours = 0;
        }
        return `${hours.toString().padStart(2, "0")}:${minutesText}:00`;
    }

    if (/^\d{2}:\d{2}/.test(value)) {
        return `${value.slice(0, 5)}:00`;
    }

    return "00:00:00";
}

function findFirstIncompleteStep(
    draft: MobileAuditFormState,
    instrument: NormalizedInstrument | null,
): { step: MobileYeeStepNumber; label: string } | null {
    if (
        draft.visitFrequency.length === 0 ||
        draft.publicAccess.length === 0 ||
        draft.openHoursAccess.length === 0 ||
        draft.season.length === 0 ||
        draft.weather.length === 0
    ) {
        return { step: 1, label: "Context" };
    }

    if (Object.values(draft.weights).some((value) => value.length === 0)) {
        return { step: 2, label: "Weighting" };
    }

    if (instrument !== null) {
        const domainSteps: readonly MobileYeeStepNumber[] = [3, 4, 5, 6, 7, 8];
        for (const step of domainSteps) {
            const section = getSectionForStep(instrument, step);
            if (section === null) {
                continue;
            }

            const totalRows = section.groups.reduce((sum, group) => sum + group.rows.length, 0);
            const answeredRows = section.groups.reduce((sum, group) => {
                return (
                    sum +
                    group.rows.filter((row) => {
                        const presenceValue = draft.responses[row.presenceItemId]?.[row.choiceId];
                        return typeof presenceValue === "string" && presenceValue.length > 0;
                    }).length
                );
            }, 0);
            if (answeredRows < totalRows) {
                return { step, label: section.title };
            }
        }
    }

    return null;
}

async function confirmChoice(
    title: string,
    message: string,
    confirmLabel: string,
    cancelLabel: string,
): Promise<boolean> {
    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
        return globalThis.confirm(`${title}\n\n${message}`);
    }

    return await new Promise<boolean>((resolve) => {
        Alert.alert(title, message, [
            { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
            { text: confirmLabel, style: "default", onPress: () => resolve(true) },
        ]);
    });
}

function getStepForDomain(domain: MobileYeeDomainKey): MobileYeeStepNumber {
    switch (domain) {
        case "access":
            return 3;
        case "activitySpaces":
            return 4;
        case "amenities":
            return 5;
        case "experienceOfSpace":
            return 6;
        case "aestheticsAndCare":
            return 7;
        case "useAndUsability":
            return 8;
    }
}

function getReviewThemeByStep(step: MobileYeeStepNumber) {
    switch (step) {
        case 1:
            return { accent: "#29465F", soft: "#E9F1F8", border: "#B9D0E3" };
        case 2:
            return { accent: "#7A4B2A", soft: "#FBEDE3", border: "#E7C6B3" };
        case 3:
            return { accent: "#145B43", soft: "#E7F4ED", border: "#B9DCCB" };
        case 4:
            return { accent: "#274F90", soft: "#EAF1FB", border: "#C0D3EF" };
        case 5:
            return { accent: "#8B5B08", soft: "#FBF2DA", border: "#E8D29A" };
        case 6:
            return { accent: "#155E63", soft: "#E7F6F5", border: "#BFE3E0" };
        case 7:
            return { accent: "#8B2452", soft: "#FBEAF1", border: "#EDBED0" };
        case 8:
            return { accent: "#4F2EA7", soft: "#F0EAFF", border: "#D5C5F5" };
        case 9:
        default:
            return { accent: "#145B43", soft: "#E7F4ED", border: "#B9DCCB" };
    }
}

function getReviewTheme(domain: MobileYeeDomainKey) {
    return getReviewThemeByStep(getStepForDomain(domain));
}
