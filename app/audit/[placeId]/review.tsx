import { Alert, ScrollView } from "react-native";
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
    mobileYeeDomainLabels,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
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

    const answeredCount = useMemo(() => {
        if (draft === null) return 0;
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
            const goFix = await new Promise<boolean>((resolve) => {
                Alert.alert(
                    "Audit is incomplete",
                    `${incomplete.label} still has unanswered required fields. Complete that section before submitting this audit.`,
                    [
                        { text: "Stay on review", style: "cancel", onPress: () => resolve(false) },
                        { text: "Go to section", style: "default", onPress: () => resolve(true) },
                    ],
                );
            });

            if (goFix) {
                router.push(`/audit/${placeId}/${incomplete.step}`);
            }
            return;
        }

        const confirmed = await new Promise<boolean>((resolve) => {
            Alert.alert(
                "Submit audit?",
                "After submission, this audit will be locked and can no longer be edited on mobile or web.",
                [
                    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                    { text: "Submit", style: "default", onPress: () => resolve(true) },
                ],
            );
        });
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
                    paddingBottom: 128,
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
                        {draft.placeName}
                    </Paragraph>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={30}
                    >
                        Review and submit
                    </Text>
                    <Paragraph color={designSystem.colors.mutedForeground}>
                        Review the saved mobile answers before final submission.
                    </Paragraph>
                </YStack>

                <SummaryCard title="Context summary">
                    <SummaryRow
                        label="Visit frequency"
                        value={draft.visitFrequency || "Not answered"}
                    />
                    <SummaryRow label="Season" value={draft.season || "Not answered"} />
                    <SummaryRow
                        label="Weather"
                        value={
                            draft.weather.length === 0 ? "Not answered" : draft.weather.join(", ")
                        }
                    />
                    <SummaryRow label="Answered audit fields" value={`${answeredCount}`} />
                </SummaryCard>

                <SummaryCard title="Youth weighting">
                    {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => (
                        <SummaryRow
                            key={domain}
                            label={mobileYeeDomainLabels[domain]}
                            value={draft.weights[domain] || "Not answered"}
                        />
                    ))}
                    <SummaryRow
                        label="Weighting comments"
                        value={draft.weightingComments || "No weighting comments added."}
                    />
                </SummaryCard>

                {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => (
                    <SummaryCard key={domain} title={mobileYeeDomainLabels[domain]}>
                        <SummaryRow
                            label="Section comments"
                            value={draft.sectionComments[domain] || "No section comments added."}
                        />
                    </SummaryCard>
                ))}

                <SummaryCard title="Final comments">
                    <SummaryRow
                        label="Overall comments"
                        value={draft.comments || "No overall comments added."}
                    />
                </SummaryCard>

                <SummaryCard title="Score preview">
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
                        Mobile preview uses the same backend scoring endpoint as the website when
                        the device is online.
                    </Paragraph>
                </SummaryCard>

                {errorMessage === null ? null : (
                    <SummaryCard title="Submission note">
                        <Paragraph color={designSystem.colors.danger}>{errorMessage}</Paragraph>
                    </SummaryCard>
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

function SummaryCard({ title, children }: PropsWithChildren<{ title: string }>) {
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2.5"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={20}
            >
                {title}
            </Text>
            {children}
        </YStack>
    );
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
