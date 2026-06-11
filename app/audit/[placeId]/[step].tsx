import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, ArrowRight, Save } from "components/icons";
import { Button, Input, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import {
    buildParticipantInfo,
    buildStoredDraft,
    buildFormStateFromSources,
    createEmptyFormState,
    type MobileAuditFormState,
} from "lib/yee-mobile-draft";
import {
    ensureQuestionMark,
    getDomainForStep,
    getNextStep,
    getPreviousStep,
    getStepTitle,
    mobileYeeDomainLabels,
    mobileYeeSteps,
    mobileYeeWeightOptions,
    seasonOptions,
    visitFrequencyOptions,
    weatherOptions,
    type MobileYeeDomainKey,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import {
    getSectionForStep,
    isAffirmativeAnswer,
    normalizeInstrument,
    type NormalizedInstrument,
} from "lib/yee-mobile-instrument";
import { fetchYeeInstrument, saveAuditDraft } from "lib/yee-api";
import { readInstrumentCache, writeInstrumentCache } from "lib/yee-offline-storage";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

const STEP_VALUES = new Set(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
const SURVEY_CARD = "rgba(226, 239, 229, 0.55)";
const SURVEY_CARD_BORDER = "rgba(110, 156, 124, 0.22)";
const OPTION_SURFACE = "rgba(243, 247, 238, 0.95)";
const OPTION_SELECTED = "rgba(169, 236, 217, 0.46)";
const INTRO_SURFACE = "rgba(242, 247, 239, 0.92)";

export default function AuditStepScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ placeId?: string; step?: string }>();
    const session = useAuthStore((state) => state.session);
    const {
        assignedPlaces,
        draftsByPlace,
        isOnline,
        loadPlaceAuditState,
        saveDraftLocally,
        queueDraftSync,
    } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            isOnline: state.isOnline,
            loadPlaceAuditState: state.loadPlaceAuditState,
            saveDraftLocally: state.saveDraftLocally,
            queueDraftSync: state.queueDraftSync,
        })),
    );

    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const step = STEP_VALUES.has(String(params.step))
        ? (Number(params.step) as MobileYeeStepNumber)
        : 1;
    const place = assignedPlaces.find((entry) => entry.id === placeId) ?? null;
    const existingDraft = draftsByPlace[placeId] ?? null;
    const existingDraftRef = useRef(existingDraft);

    const [instrument, setInstrument] = useState<NormalizedInstrument | null>(null);
    const [draft, setDraft] = useState<MobileAuditFormState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const lastPersistedFingerprintRef = useRef<string | null>(null);

    useEffect(() => {
        existingDraftRef.current = existingDraft;
    }, [existingDraft]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (placeId.length === 0) {
                setErrorMessage("Missing place id for this audit.");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setErrorMessage(null);
            const storedDraft = existingDraftRef.current;

            try {
                const cachedInstrument = await readInstrumentCache();
                let normalizedInstrument: NormalizedInstrument | null = null;
                if (cachedInstrument !== null) {
                    normalizedInstrument = normalizeInstrument(cachedInstrument as never);
                }

                try {
                    const instrumentPayload = await fetchYeeInstrument();
                    normalizedInstrument = normalizeInstrument(instrumentPayload);
                    await writeInstrumentCache(
                        instrumentPayload as unknown as Record<string, unknown>,
                    );
                } catch (error) {
                    if (normalizedInstrument === null) {
                        throw error;
                    }
                }

                const remoteState =
                    session !== null && isOnline
                        ? await loadPlaceAuditState(placeId, session).catch(() => null)
                        : null;
                const nextDraft = buildFormStateFromSources({
                    placeId,
                    placeName:
                        place?.name ??
                        storedDraft?.participantInfo.place_name?.toString() ??
                        "Assigned place",
                    auditorId:
                        remoteState?.auditor_generated_id ??
                        storedDraft?.participantInfo.auditor_id?.toString() ??
                        "AUDITOR",
                    storedDraft,
                    auditState: remoteState,
                });

                if (!cancelled) {
                    setInstrument(normalizedInstrument);
                    setDraft(nextDraft);
                    lastPersistedFingerprintRef.current = buildDraftFingerprint(nextDraft);
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(
                        error instanceof Error ? error.message : "Unable to load this audit step.",
                    );
                    const fallbackDraft = createEmptyFormState(
                        placeId,
                        place?.name ?? "Assigned place",
                        storedDraft?.participantInfo.auditor_id?.toString() ?? "AUDITOR",
                    );
                    setDraft(fallbackDraft);
                    lastPersistedFingerprintRef.current = buildDraftFingerprint(fallbackDraft);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [isOnline, loadPlaceAuditState, place?.name, placeId, session]);

    const domain = getDomainForStep(step);
    const section = useMemo(() => {
        return instrument === null ? null : getSectionForStep(instrument, step);
    }, [instrument, step]);

    const persistDraft = useCallback(
        async (
            draftState: MobileAuditFormState,
            syncIntent: "autosave" | "manual",
        ): Promise<void> => {
            const previousDraft = existingDraftRef.current;
            const draftToPersist = buildStoredDraft(
                draftState,
                previousDraft,
                previousDraft?.scorePreview ?? null,
                syncIntent === "autosave" ? "local_only" : isOnline ? "synced" : "pending_upload",
            );
            await saveDraftLocally({
                ...draftToPersist,
                syncState:
                    syncIntent === "autosave" ? "local_only" : isOnline ? "synced" : "local_only",
            });

            const payload = {
                participant_info: buildParticipantInfo(draftState),
                responses: draftState.responses,
            };

            if (session === null) {
                lastPersistedFingerprintRef.current = buildDraftFingerprint(draftState);
                return;
            }

            if (syncIntent === "autosave") {
                lastPersistedFingerprintRef.current = buildDraftFingerprint(draftState);
                return;
            }

            if (!isOnline) {
                await queueDraftSync({ ...draftToPersist, syncState: "pending_upload" });
                lastPersistedFingerprintRef.current = buildDraftFingerprint(draftState);
                return;
            }

            try {
                const savedState = await saveAuditDraft(placeId, session, payload);
                await saveDraftLocally({
                    ...draftToPersist,
                    syncState: "synced",
                    scorePreview: savedState.score,
                    lastKnownBackendStatus: savedState.status,
                    lastKnownSubmissionId: savedState.submission_id,
                });
                lastPersistedFingerprintRef.current = buildDraftFingerprint(draftState);
            } catch (error) {
                await queueDraftSync({ ...draftToPersist, syncState: "pending_upload" });
                lastPersistedFingerprintRef.current = buildDraftFingerprint(draftState);
                if (syncIntent === "manual") {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Draft saved locally and queued for sync.",
                    );
                }
            }
        },
        [isOnline, placeId, queueDraftSync, saveDraftLocally, session],
    );

    useEffect(() => {
        if (draft === null || isLoading) {
            return;
        }

        const nextFingerprint = buildDraftFingerprint(draft);
        if (nextFingerprint === lastPersistedFingerprintRef.current) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void persistDraft(draft, "autosave");
        }, 500);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [draft, isLoading, persistDraft]);

    if (draft === null || isLoading) {
        return <LoadingScreen />;
    }

    if (place === null) {
        return (
            <BlockedAuditScreen
                title="Place not available"
                body="This audit route is not available on this device right now. Return to the places list and refresh the assigned-place cache when you are online."
                onBack={() => router.replace("/(tabs)/places")}
            />
        );
    }

    if (!isOnline && instrument === null) {
        return (
            <BlockedAuditScreen
                title="Survey not cached yet"
                body="This device has not cached the full YEE survey instrument yet. Connect once online and refresh the mobile app before starting or continuing this audit offline."
                onBack={() => router.replace("/(tabs)/places")}
            />
        );
    }

    const currentDraft = draft;

    async function goNext() {
        const canProceed = await confirmStepProgress(step, currentDraft, section);
        if (!canProceed) {
            return;
        }

        const draftForSave = withUpdatedTiming(currentDraft);
        setDraft(draftForSave);
        setIsSaving(true);
        try {
            await persistDraft(draftForSave, "manual");
            const nextStep = getNextStep(step);
            if (nextStep === null) {
                router.push(`/audit/${placeId}/review`);
            } else {
                router.push(`/audit/${placeId}/${nextStep}`);
            }
        } finally {
            setIsSaving(false);
        }
    }

    async function saveAndExit() {
        const draftForSave = withUpdatedTiming(currentDraft);
        setDraft(draftForSave);
        setIsSaving(true);
        try {
            await persistDraft(draftForSave, "manual");
            router.replace("/(tabs)/places");
        } finally {
            setIsSaving(false);
        }
    }

    function withUpdatedTiming(draftState: MobileAuditFormState): MobileAuditFormState {
        const now = new Date();
        const finishTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return {
            ...draftState,
            finishTime,
            totalMinutes: estimateMinutes(draftState.auditDate, draftState.startTime, now),
        };
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
                <StepHeader
                    step={step}
                    placeName={draft.placeName || place?.name || "Assigned place"}
                    auditorId={draft.auditorId}
                />

                {errorMessage === null ? null : (
                    <NoticeCard tone="danger" title="Sync note" body={errorMessage} />
                )}

                {step === 1 ? (
                    <ContextStep draft={draft} onChange={setDraft} />
                ) : step === 2 ? (
                    <WeightingStep
                        draft={draft}
                        onChange={setDraft}
                        placeName={draft.placeName || place?.name || "this place"}
                    />
                ) : step === 9 ? (
                    <FinalCommentsStep draft={draft} onChange={setDraft} />
                ) : section !== null && domain !== null ? (
                    <DomainStep
                        section={section}
                        draft={draft}
                        onChange={setDraft}
                        domain={domain}
                    />
                ) : (
                    <NoticeCard
                        tone="warning"
                        title="Section unavailable"
                        body="This domain could not be loaded from the cached YEE instrument yet."
                    />
                )}
            </ScrollView>

            <FooterNav
                isSaving={isSaving}
                onBack={() => {
                    const previousStep = getPreviousStep(step);
                    if (previousStep === null) {
                        router.replace("/(tabs)/places");
                    } else {
                        router.push(`/audit/${placeId}/${previousStep}`);
                    }
                }}
                onSaveExit={() => void saveAndExit()}
                onNext={() => void goNext()}
                nextLabel={step === 9 ? "Review Audit" : "Next"}
            />
        </YStack>
    );
}

function LoadingScreen() {
    return (
        <YStack
            flex={1}
            items="center"
            justify="center"
            bg={designSystem.colors.background}
            gap="$3"
        >
            <Spinner size="large" color={designSystem.colors.primary} />
            <Text color={designSystem.colors.foreground} fontFamily={designSystem.fonts.bodyBold}>
                Loading mobile audit step...
            </Text>
        </YStack>
    );
}

function BlockedAuditScreen({
    title,
    body,
    onBack,
}: {
    title: string;
    body: string;
    onBack: () => void;
}) {
    return (
        <YStack flex={1} bg={designSystem.colors.background} px="$4" py="$6" justify="center">
            <YStack
                rounded={designSystem.radii.xl}
                borderWidth={1}
                borderColor={designSystem.colors.warning}
                bg={designSystem.colors.surface}
                p="$5"
                gap="$4"
                style={{ boxShadow: designSystem.shadows.card }}
            >
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={28}
                >
                    {title}
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {body}
                </Paragraph>
                <Button
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.primary}
                    borderWidth={1}
                    borderColor={designSystem.colors.primary}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onBack}
                >
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Back to places
                    </Button.Text>
                </Button>
            </YStack>
        </YStack>
    );
}

function StepHeader({
    step,
    placeName,
    auditorId,
}: {
    step: MobileYeeStepNumber;
    placeName: string;
    auditorId: string;
}) {
    const progressLabel =
        step <= 2 ? "Setup and weighting" : step === 9 ? "Final comments" : "Domain section";
    const chipTone = getStepTone(step);
    return (
        <YStack gap="$3.5">
            <YStack gap="$1">
                <Paragraph
                    color={designSystem.colors.primary}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={10}
                    textTransform="uppercase"
                    letterSpacing={1.5}
                >
                    {placeName}
                </Paragraph>
                <XStack gap="$2" flexWrap="wrap" mb="$1">
                    <YStack
                        rounded={designSystem.radii.full}
                        px="$3"
                        py="$1.5"
                        bg={designSystem.colors.mintSoft}
                    >
                        <Text
                            color={designSystem.colors.success}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={11}
                        >
                            {auditorId}
                        </Text>
                    </YStack>
                    <YStack
                        rounded={designSystem.radii.full}
                        px="$3"
                        py="$1.5"
                        bg={designSystem.colors.surface}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                    >
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyMedium}
                            fontSize={11}
                        >
                            Step {step} of 9
                        </Text>
                    </YStack>
                </XStack>
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={30}
                    lineHeight={34}
                >
                    {getStepTitle(step)}
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {mobileYeeSteps.find((entry) => entry.step === step)?.description}
                </Paragraph>
            </YStack>
            <XStack
                rounded={designSystem.radii.lg}
                borderWidth={1}
                bg={designSystem.colors.surface}
                px="$3.5"
                py="$3"
                justify="space-between"
                items="center"
                gap="$3"
                style={{ borderColor: chipTone.border, boxShadow: designSystem.shadows.card }}
            >
                <YStack gap="$0.5" flex={1}>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={10}
                        textTransform="uppercase"
                        letterSpacing={1.4}
                    >
                        Audit progress
                    </Paragraph>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={14}
                    >
                        Step {step} of 9
                    </Text>
                </YStack>
                <YStack
                    rounded={designSystem.radii.full}
                    px="$3"
                    py="$1.5"
                    style={{ backgroundColor: chipTone.surface }}
                >
                    <Text
                        color={chipTone.text}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={11}
                    >
                        {progressLabel}
                    </Text>
                </YStack>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
                {mobileYeeSteps.map((entry) => {
                    const active = entry.step === step;
                    const tone = getStepTone(entry.step);
                    return (
                        <YStack
                            key={entry.step}
                            rounded={designSystem.radii.full}
                            borderWidth={1}
                            px="$3"
                            py="$2"
                            style={{
                                minWidth: 92,
                                borderColor: active ? tone.border : tone.softBorder,
                                backgroundColor: active ? tone.surface : tone.softSurface,
                            }}
                        >
                            <Text
                                color={active ? tone.text : designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={11}
                            >
                                {entry.step}. {entry.title}
                            </Text>
                        </YStack>
                    );
                })}
            </XStack>
        </YStack>
    );
}

function ContextStep({
    draft,
    onChange,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
}) {
    return (
        <YStack gap="$4">
            <Card
                title="Visit details"
                description={`Record the visit context for ${draft.placeName || "this place"}.`}
            >
                <ReadOnlyField label="Generated auditor ID" value={draft.auditorId} />
                <ReadOnlyField label="Audit date" value={draft.auditDate} />
                <ChoiceQuestion
                    label="How often have you been to / visited this space in the last 6 months"
                    value={draft.visitFrequency}
                    options={
                        visitFrequencyOptions as unknown as readonly {
                            value: string;
                            label: string;
                        }[]
                    }
                    onChange={(value) =>
                        onChange((current) =>
                            current === null ? current : { ...current, visitFrequency: value },
                        )
                    }
                />
                <ChoiceQuestion
                    label="What is the current season"
                    value={draft.season}
                    options={
                        seasonOptions as unknown as readonly { value: string; label: string }[]
                    }
                    onChange={(value) =>
                        onChange((current) =>
                            current === null ? current : { ...current, season: value },
                        )
                    }
                />
                <MultiChoiceQuestion
                    label="What is the weather like today"
                    values={draft.weather}
                    options={
                        weatherOptions as unknown as readonly { value: string; label: string }[]
                    }
                    onToggle={(value) =>
                        onChange((current) => {
                            if (current === null) return current;
                            const exists = current.weather.includes(value);
                            return {
                                ...current,
                                weather: exists
                                    ? current.weather.filter((entry) => entry !== value)
                                    : [...current.weather, value],
                            };
                        })
                    }
                />
            </Card>
        </YStack>
    );
}

function WeightingStep({
    draft,
    onChange,
    placeName,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    placeName: string;
}) {
    return (
        <Card
            title="Youth weighting"
            description={`Please start by telling us how important each of the following issues are to you, especially about the play/recreation and green spaces in your community or neighborhood and at ${placeName}.`}
        >
            {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => (
                <ChoiceQuestion
                    key={domain}
                    label={mobileYeeDomainLabels[domain]}
                    value={draft.weights[domain]}
                    options={
                        mobileYeeWeightOptions as unknown as readonly {
                            value: string;
                            label: string;
                        }[]
                    }
                    onChange={(value) =>
                        onChange((current) =>
                            current === null
                                ? current
                                : {
                                      ...current,
                                      weights: {
                                          ...current.weights,
                                          [domain]: value,
                                      },
                                  },
                        )
                    }
                    promptOverride={weightPrompt(domain)}
                />
            ))}
            <CommentField
                label="Optional weighting comments"
                value={draft.weightingComments}
                onChange={(value) =>
                    onChange((current) =>
                        current === null ? current : { ...current, weightingComments: value },
                    )
                }
            />
            <SectionProgressCard
                title="Weighting progress"
                helperText="Each domain should have one importance selection before you move into the scored YEE sections."
                completedCount={
                    Object.values(draft.weights).filter((value) => value.length > 0).length
                }
                totalCount={Object.keys(mobileYeeDomainLabels).length}
            />
        </Card>
    );
}

function FinalCommentsStep({
    draft,
    onChange,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
}) {
    return (
        <Card
            title="Final comments"
            description="Add any overall comments you want included before review and submission."
        >
            <CommentField
                label="Overall survey comments"
                value={draft.comments}
                onChange={(value) =>
                    onChange((current) =>
                        current === null ? current : { ...current, comments: value },
                    )
                }
            />
        </Card>
    );
}

function DomainStep({
    section,
    draft,
    onChange,
    domain,
}: {
    section: Exclude<ReturnType<typeof getSectionForStep>, null>;
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    domain: MobileYeeDomainKey;
}) {
    return (
        <YStack gap="$4">
            <SectionIntroCard
                title={section.blockLabel}
                description={section.introText || `Complete the ${section.title} section.`}
            />
            <Card
                title={section.title}
                description="Answer each item below. If the feature is present, the condition follow-up will appear right underneath it."
            >
                {section.groups.map((group) => (
                    <YStack key={group.id} gap="$3.5">
                        {group.instruction === null ? null : (
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                {group.instruction}
                            </Paragraph>
                        )}
                        {group.rows.map((row) => {
                            const presenceValue =
                                draft.responses[row.presenceItemId]?.[row.choiceId];
                            const showCondition =
                                row.conditionItemId !== null &&
                                isAffirmativeAnswer(row.presenceAnswers, presenceValue);
                            const conditionValue =
                                row.conditionItemId === null
                                    ? undefined
                                    : draft.responses[row.conditionItemId]?.[row.choiceId];
                            return (
                                <QuestionCard key={`${group.id}-${row.choiceId}`} label={row.label}>
                                    <OptionGrid
                                        value={presenceValue}
                                        options={row.presenceAnswers}
                                        onChange={(answerId) =>
                                            onChange((current) => {
                                                if (current === null) return current;
                                                return {
                                                    ...current,
                                                    responses: {
                                                        ...current.responses,
                                                        [row.presenceItemId]: {
                                                            ...(current.responses[
                                                                row.presenceItemId
                                                            ] ?? {}),
                                                            [row.choiceId]: answerId,
                                                        },
                                                        ...(row.conditionItemId !== null &&
                                                        !isAffirmativeAnswer(
                                                            row.presenceAnswers,
                                                            answerId,
                                                        )
                                                            ? {
                                                                  [row.conditionItemId]: {
                                                                      ...(current.responses[
                                                                          row.conditionItemId
                                                                      ] ?? {}),
                                                                      [row.choiceId]: "",
                                                                  },
                                                              }
                                                            : {}),
                                                    },
                                                };
                                            })
                                        }
                                    />
                                    {showCondition && row.conditionItemId !== null ? (
                                        <YStack
                                            gap="$2.5"
                                            rounded={designSystem.radii.md}
                                            p="$3"
                                            borderWidth={1}
                                            borderColor={SURVEY_CARD_BORDER}
                                            style={{ backgroundColor: OPTION_SURFACE }}
                                        >
                                            <Paragraph
                                                color={designSystem.colors.primary}
                                                fontFamily={designSystem.fonts.bodyBold}
                                            >
                                                If yes, please rate the condition.
                                            </Paragraph>
                                            <OptionGrid
                                                value={conditionValue}
                                                options={row.conditionAnswers}
                                                onChange={(answerId) =>
                                                    onChange((current) => {
                                                        if (current === null) return current;
                                                        return {
                                                            ...current,
                                                            responses: {
                                                                ...current.responses,
                                                                [row.conditionItemId!]: {
                                                                    ...(current.responses[
                                                                        row.conditionItemId!
                                                                    ] ?? {}),
                                                                    [row.choiceId]: answerId,
                                                                },
                                                            },
                                                        };
                                                    })
                                                }
                                            />
                                        </YStack>
                                    ) : null}
                                </QuestionCard>
                            );
                        })}
                    </YStack>
                ))}
                <CommentField
                    label={section.commentPrompt || `Optional comments for ${section.title}`}
                    value={draft.sectionComments[domain]}
                    onChange={(value) =>
                        onChange((current) =>
                            current === null
                                ? current
                                : {
                                      ...current,
                                      sectionComments: {
                                          ...current.sectionComments,
                                          [domain]: value,
                                      },
                                  },
                        )
                    }
                />
                <SectionProgressCard
                    title={`${section.title} progress`}
                    helperText="This count updates as each question row is answered. Presence questions drive the condition follow-up when needed."
                    completedCount={countAnsweredRows(section, draft)}
                    totalCount={countTotalRows(section)}
                />
            </Card>
        </YStack>
    );
}

function Card({
    title,
    description,
    children,
}: PropsWithChildren<{ title: string; description: string }>) {
    return (
        <YStack
            rounded={designSystem.radii.xl}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$3.5"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <YStack gap="$1.5">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={22}
                >
                    {title}
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    {description}
                </Paragraph>
            </YStack>
            {children}
        </YStack>
    );
}

function SectionIntroCard({ title, description }: { title: string; description: string }) {
    return (
        <YStack
            rounded={28}
            borderWidth={1}
            borderColor={SURVEY_CARD_BORDER}
            p="$4"
            gap="$2.5"
            style={{ backgroundColor: INTRO_SURFACE, boxShadow: designSystem.shadows.card }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={23}
            >
                {title}
            </Text>
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                lineHeight={21}
            >
                {description}
            </Paragraph>
        </YStack>
    );
}

function QuestionCard({ label, children }: PropsWithChildren<{ label: string }>) {
    return (
        <YStack
            rounded={28}
            borderWidth={1}
            borderColor={SURVEY_CARD_BORDER}
            p="$4"
            gap="$3"
            style={{ backgroundColor: SURVEY_CARD, boxShadow: designSystem.shadows.card }}
        >
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
                lineHeight={22}
            >
                {ensureQuestionMark(label)}
            </Text>
            {children}
        </YStack>
    );
}

function ChoiceQuestion({
    label,
    value,
    options,
    onChange,
    helperText,
    promptOverride,
}: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
    helperText?: string;
    promptOverride?: string;
}) {
    return (
        <QuestionCard label={promptOverride ?? label}>
            {helperText ? (
                <Paragraph color={designSystem.colors.mutedForeground}>{helperText}</Paragraph>
            ) : null}
            <OptionGrid
                value={value}
                options={options.map((option) => ({ id: option.value, label: option.label }))}
                onChange={onChange}
            />
        </QuestionCard>
    );
}

function MultiChoiceQuestion({
    label,
    values,
    options,
    onToggle,
}: {
    label: string;
    values: readonly string[];
    options: readonly { value: string; label: string }[];
    onToggle: (value: string) => void;
}) {
    return (
        <QuestionCard label={label}>
            <YStack gap="$2">
                {options.map((option) => {
                    const selected = values.includes(option.value);
                    return (
                        <SelectionButton
                            key={option.value}
                            label={option.label}
                            selected={selected}
                            onPress={() => onToggle(option.value)}
                        />
                    );
                })}
            </YStack>
        </QuestionCard>
    );
}

function OptionGrid({
    value,
    options,
    onChange,
}: {
    value: string | undefined;
    options: readonly { id: string; label: string }[];
    onChange: (value: string) => void;
    emphasizePrompt?: boolean;
}) {
    return (
        <YStack gap="$2">
            {options.map((option) => {
                const selected = value === option.id;
                return (
                    <SelectionButton
                        key={option.id}
                        label={option.label}
                        selected={selected}
                        onPress={() => onChange(option.id)}
                    />
                );
            })}
        </YStack>
    );
}

function SelectionButton({
    label,
    selected,
    onPress,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Button
            justify="flex-start"
            rounded={designSystem.radii.full}
            bg={designSystem.colors.surface}
            borderWidth={1}
            borderColor={selected ? designSystem.colors.success : SURVEY_CARD_BORDER}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            py="$3"
            px="$3.5"
            style={{
                backgroundColor: selected ? OPTION_SELECTED : OPTION_SURFACE,
                boxShadow: selected ? designSystem.shadows.accent : "none",
            }}
        >
            <Button.Text
                color={
                    selected
                        ? designSystem.colors.foreground
                        : designSystem.colors.secondaryForeground
                }
                fontFamily={designSystem.fonts.bodyBold}
                width="100%"
                style={{ textAlign: "left" }}
            >
                {label}
            </Button.Text>
        </Button>
    );
}

function CommentField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <YStack gap="$2">
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {label}
            </Paragraph>
            <Input
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={4}
                color={designSystem.colors.foreground}
                style={{ minHeight: 110, borderRadius: 20 }}
                bg={designSystem.colors.input}
                borderColor={SURVEY_CARD_BORDER}
                placeholder="Optional notes"
            />
        </YStack>
    );
}

function SectionProgressCard({
    title,
    helperText,
    completedCount,
    totalCount,
}: {
    title: string;
    helperText: string;
    completedCount: number;
    totalCount: number;
}) {
    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={SURVEY_CARD_BORDER}
            p="$3.5"
            gap="$2.5"
            style={{ backgroundColor: OPTION_SURFACE }}
        >
            <XStack justify="space-between" items="center" gap="$3">
                <YStack gap="$0.5" flex={1}>
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={15}
                    >
                        {title}
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {helperText}
                    </Paragraph>
                </YStack>
                <Text
                    color={designSystem.colors.primary}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={20}
                >
                    {percentage}%
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
                        backgroundColor: designSystem.colors.success,
                        width: `${Math.max(0, Math.min(percentage, 100))}%`,
                    }}
                />
            </YStack>
            <Paragraph
                color={designSystem.colors.secondaryForeground}
                fontFamily={designSystem.fonts.bodyBold}
            >
                {completedCount} of {totalCount} question rows answered
            </Paragraph>
        </YStack>
    );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
    return (
        <YStack gap="$1.5">
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
                rounded={designSystem.radii.md}
                borderWidth={1}
                borderColor={SURVEY_CARD_BORDER}
                p="$3"
                style={{ backgroundColor: OPTION_SURFACE }}
            >
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    {value}
                </Text>
            </YStack>
        </YStack>
    );
}

function NoticeCard({
    tone,
    title,
    body,
}: {
    tone: "danger" | "warning";
    title: string;
    body: string;
}) {
    const color = tone === "danger" ? designSystem.colors.danger : designSystem.colors.warning;
    const surface =
        tone === "danger" ? designSystem.colors.dangerSoft : designSystem.colors.warningSoft;
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={color}
            bg={surface}
            p="$4"
            gap="$1.5"
        >
            <Text style={{ color }} fontFamily={designSystem.fonts.bodyBold}>
                {title}
            </Text>
            <Paragraph color={designSystem.colors.secondaryForeground}>{body}</Paragraph>
        </YStack>
    );
}

function countTotalRows(section: Exclude<ReturnType<typeof getSectionForStep>, null>) {
    return section.groups.reduce((sum, group) => sum + group.rows.length, 0);
}

function countAnsweredRows(
    section: Exclude<ReturnType<typeof getSectionForStep>, null>,
    draft: MobileAuditFormState,
) {
    return section.groups.reduce((sum, group) => {
        return (
            sum +
            group.rows.filter((row) => {
                const presenceValue = draft.responses[row.presenceItemId]?.[row.choiceId];
                return typeof presenceValue === "string" && presenceValue.length > 0;
            }).length
        );
    }, 0);
}

function buildDraftFingerprint(draft: MobileAuditFormState): string {
    return JSON.stringify({
        visitFrequency: draft.visitFrequency,
        season: draft.season,
        weather: draft.weather,
        weights: draft.weights,
        responses: draft.responses,
        comments: draft.comments,
        sectionComments: draft.sectionComments,
        weightingComments: draft.weightingComments,
        finishTime: draft.finishTime,
        totalMinutes: draft.totalMinutes,
    });
}

async function confirmStepProgress(
    step: MobileYeeStepNumber,
    draft: MobileAuditFormState,
    section: Exclude<ReturnType<typeof getSectionForStep>, null> | null,
): Promise<boolean> {
    const incompleteMessage = getStepIncompleteMessage(step, draft, section);
    if (incompleteMessage === null) {
        return true;
    }

    return await new Promise<boolean>((resolve) => {
        Alert.alert("Some questions are still unanswered", incompleteMessage, [
            { text: "Stay here", style: "cancel", onPress: () => resolve(false) },
            { text: "Move forward", style: "default", onPress: () => resolve(true) },
        ]);
    });
}

function getStepIncompleteMessage(
    step: MobileYeeStepNumber,
    draft: MobileAuditFormState,
    section: Exclude<ReturnType<typeof getSectionForStep>, null> | null,
): string | null {
    if (step === 1) {
        const missing = [
            draft.visitFrequency.length === 0 ? "visit frequency" : null,
            draft.season.length === 0 ? "season" : null,
            draft.weather.length === 0 ? "weather" : null,
        ].filter(Boolean);
        return missing.length === 0 ? null : `This page is still missing: ${missing.join(", ")}.`;
    }

    if (step === 2) {
        const completedCount = Object.values(draft.weights).filter(
            (value) => value.length > 0,
        ).length;
        return completedCount === Object.keys(draft.weights).length
            ? null
            : "Not every domain weight has been answered yet.";
    }

    if (step >= 3 && step <= 8 && section !== null) {
        const completedCount = countAnsweredRows(section, draft);
        const totalCount = countTotalRows(section);
        return completedCount === totalCount
            ? null
            : `${section.title} still has unanswered question rows.`;
    }

    return null;
}

function FooterNav({
    isSaving,
    onBack,
    onSaveExit,
    onNext,
    nextLabel,
}: {
    isSaving: boolean;
    onBack: () => void;
    onSaveExit: () => void;
    onNext: () => void;
    nextLabel: string;
}) {
    return (
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
                onPress={onBack}
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
                bg={designSystem.colors.surfaceMuted}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                onPress={onSaveExit}
                icon={<Save size={16} color={designSystem.colors.foreground} />}
            >
                <Button.Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    Save & exit
                </Button.Text>
            </Button>
            <Button
                flex={1}
                rounded={designSystem.radii.full}
                bg={designSystem.colors.primary}
                borderWidth={1}
                borderColor={designSystem.colors.primary}
                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                onPress={onNext}
                disabled={isSaving}
            >
                <XStack items="center" gap="$2">
                    {isSaving ? (
                        <Spinner color={designSystem.colors.primaryForeground} size="small" />
                    ) : (
                        <ArrowRight size={16} color={designSystem.colors.primaryForeground} />
                    )}
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        {nextLabel}
                    </Button.Text>
                </XStack>
            </Button>
        </XStack>
    );
}

function getStepTone(step: MobileYeeStepNumber) {
    switch (step) {
        case 1:
            return {
                surface: designSystem.colors.mintSoft,
                border: "rgba(71, 203, 175, 0.40)",
                softSurface: "rgba(157, 220, 207, 0.12)",
                softBorder: "rgba(157, 220, 207, 0.28)",
                text: designSystem.colors.primary,
            };
        case 2:
            return {
                surface: designSystem.colors.skySoft,
                border: "rgba(74, 119, 200, 0.30)",
                softSurface: "rgba(223, 233, 251, 0.55)",
                softBorder: "rgba(123, 158, 217, 0.24)",
                text: designSystem.colors.info,
            };
        case 3:
            return {
                surface: "rgba(222, 246, 238, 0.88)",
                border: "rgba(62, 138, 103, 0.30)",
                softSurface: "rgba(222, 246, 238, 0.45)",
                softBorder: "rgba(94, 156, 131, 0.24)",
                text: designSystem.colors.success,
            };
        case 4:
            return {
                surface: designSystem.colors.skySoft,
                border: "rgba(74, 119, 200, 0.24)",
                softSurface: "rgba(223, 233, 251, 0.52)",
                softBorder: "rgba(123, 158, 217, 0.22)",
                text: designSystem.colors.info,
            };
        case 5:
            return {
                surface: designSystem.colors.amberSoft,
                border: "rgba(200, 139, 45, 0.28)",
                softSurface: "rgba(248, 230, 190, 0.56)",
                softBorder: "rgba(200, 154, 87, 0.24)",
                text: designSystem.colors.warning,
            };
        case 6:
            return {
                surface: "rgba(225, 248, 245, 0.9)",
                border: "rgba(71, 203, 175, 0.28)",
                softSurface: "rgba(225, 248, 245, 0.52)",
                softBorder: "rgba(157, 220, 207, 0.24)",
                text: designSystem.colors.success,
            };
        case 7:
            return {
                surface: designSystem.colors.roseSoft,
                border: "rgba(181, 72, 61, 0.22)",
                softSurface: "rgba(246, 218, 223, 0.52)",
                softBorder: "rgba(181, 72, 61, 0.18)",
                text: designSystem.colors.danger,
            };
        case 8:
            return {
                surface: designSystem.colors.violetSoft,
                border: "rgba(140, 114, 221, 0.30)",
                softSurface: "rgba(198, 182, 238, 0.34)",
                softBorder: "rgba(140, 114, 221, 0.22)",
                text: designSystem.colors.violet,
            };
        case 9:
        default:
            return {
                surface: designSystem.colors.mintSoft,
                border: "rgba(71, 203, 175, 0.30)",
                softSurface: "rgba(157, 220, 207, 0.12)",
                softBorder: "rgba(157, 220, 207, 0.22)",
                text: designSystem.colors.primary,
            };
    }
}

function estimateMinutes(auditDate: string, startTime: string, now: Date): number {
    const start = Date.parse(`${auditDate}T${normalizeTime(startTime)}`);
    if (Number.isNaN(start)) {
        return 0;
    }
    return Math.max(0, Math.round((now.getTime() - start) / 60000));
}

function normalizeTime(value: string): string {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) {
        return value;
    }
    let hour = Number(match[1]);
    const minute = match[2];
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}:00`;
}

function weightPrompt(domain: MobileYeeDomainKey): string {
    switch (domain) {
        case "access":
            return "How important is it to you that you can easily and safely get to these spaces?";
        case "activitySpaces":
            return "How important is it to you that these places have the spaces and/or equipment that allow you to do the activities you like (Ex: have spaces for sports/games, for hanging out with friends, for spending quiet time on your own, etc)?";
        case "amenities":
            return "How important is it to you that these places have amenities that make the space more comfortable and suitable (like bathrooms, WiFi, garbage bins, places to buy food/drinks, seating for groups, shade, etc)?";
        case "experienceOfSpace":
            return "How important is it to you that these places feel pleasant and safe to be in (Ex: feel peaceful, have lots of nature or nice views, feel safe and comfortable, where you will not be bothered or feel out of place, etc)?";
        case "aestheticsAndCare":
            return "How important is it to you that these places look nice and well cared for (Ex: have lots of greenery, have gardens or art to look at, are free from litter and graffiti, look like someone is taking good care of it, etc)?";
        case "useAndUsability":
            return "How important is it to you that these places are suitable for many activities for youth and/or the community (Ex: allow for lots of different types of activities, have lights that allow for night use, are good for youth programming or dog walking, etc)?";
    }
}
