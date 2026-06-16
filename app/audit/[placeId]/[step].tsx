import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView } from "react-native";
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
    getWeightPrompt,
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
type SurveyPalette = {
    readonly card: string;
    readonly cardBorder: string;
    readonly inner: string;
    readonly innerBorder: string;
    readonly selected: string;
    readonly selectedBorder: string;
    readonly intro: string;
    readonly introBorder: string;
    readonly accent: string;
    readonly mutedAccent: string;
    readonly progress: string;
    readonly progressTrack: string;
    readonly stepSurface: string;
    readonly stepBorder: string;
    readonly stepText: string;
};

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
    const stepPalette = useMemo(() => getSurveyPalette(step), [step]);
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
    const auditIsComplete = findFirstIncompleteStep(currentDraft, instrument) === null;

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
                    placeId={placeId}
                    placeName={draft.placeName || place?.name || "Assigned place"}
                    auditorId={draft.auditorId}
                    onStepPress={(nextStep) => router.push(`/audit/${placeId}/${nextStep}`)}
                />

                {errorMessage === null ? null : (
                    <NoticeCard tone="danger" title="Sync note" body={errorMessage} />
                )}

                {step === 1 ? (
                    <ContextStep draft={draft} onChange={setDraft} palette={stepPalette} />
                ) : step === 2 ? (
                    <WeightingStep
                        draft={draft}
                        onChange={setDraft}
                        placeName={draft.placeName || place?.name || "this place"}
                        palette={stepPalette}
                    />
                ) : step === 9 ? (
                    <FinalCommentsStep draft={draft} onChange={setDraft} palette={stepPalette} />
                ) : section !== null && domain !== null ? (
                    <DomainStep
                        section={section}
                        draft={draft}
                        onChange={setDraft}
                        domain={domain}
                        palette={stepPalette}
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
                nextTone={stepPalette}
                {...(step === 9 && auditIsComplete
                    ? {
                          extraActionLabel: "Submit audit",
                          onExtraAction: () => router.push(`/audit/${placeId}/review`),
                      }
                    : {})}
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
    placeId,
    placeName,
    auditorId,
    onStepPress,
}: {
    step: MobileYeeStepNumber;
    placeId: string;
    placeName: string;
    auditorId: string;
    onStepPress: (step: MobileYeeStepNumber) => void;
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
                    audit/{placeId}
                </Paragraph>
                <Text
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodySemiBold}
                    fontSize={13}
                >
                    {placeName}
                </Text>
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
                        style={{ color: chipTone.text }}
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
                        <Button
                            key={entry.step}
                            type="button"
                            rounded={designSystem.radii.full}
                            borderWidth={1}
                            px="$3"
                            py="$2"
                            onPress={() => onStepPress(entry.step)}
                            disabled={active}
                            hoverStyle={{ opacity: 0.96 }}
                            pressStyle={{ opacity: 0.94, scale: 0.985 }}
                            style={{
                                minWidth: 108,
                                borderColor: active ? tone.border : tone.softBorder,
                                backgroundColor: active ? tone.surface : tone.softSurface,
                            }}
                        >
                            <Button.Text
                                style={{
                                    color: active ? tone.text : designSystem.colors.mutedForeground,
                                }}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={11}
                            >
                                {entry.title}
                            </Button.Text>
                        </Button>
                    );
                })}
            </XStack>
        </YStack>
    );
}

function ContextStep({
    draft,
    onChange,
    palette,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    palette: SurveyPalette;
}) {
    return (
        <YStack gap="$4">
            <Card
                title="Visit details"
                description={`Record the visit context for ${draft.placeName || "this place"}.`}
                palette={palette}
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
                    palette={palette}
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
                    palette={palette}
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
                    palette={palette}
                />
            </Card>
        </YStack>
    );
}

function WeightingStep({
    draft,
    onChange,
    placeName,
    palette,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    placeName: string;
    palette: SurveyPalette;
}) {
    return (
        <Card
            title="Youth weighting"
            description={`Please start by telling us how important each of the following issues are to you, especially about the play/recreation and green spaces in your community or neighborhood and at ${placeName}.`}
            palette={palette}
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
                    promptOverride={getWeightPrompt(domain)}
                    palette={palette}
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
                palette={palette}
            />
            <SectionProgressCard
                title="Weighting progress"
                helperText="Each domain should have one importance selection before you move into the scored YEE sections."
                completedCount={
                    Object.values(draft.weights).filter((value) => value.length > 0).length
                }
                totalCount={Object.keys(mobileYeeDomainLabels).length}
                palette={palette}
            />
        </Card>
    );
}

function FinalCommentsStep({
    draft,
    onChange,
    palette,
}: {
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    palette: SurveyPalette;
}) {
    return (
        <Card
            title="Final comments"
            description="Add any overall comments you want included before review and submission."
            palette={palette}
        >
            <CommentField
                label="Overall survey comments"
                value={draft.comments}
                onChange={(value) =>
                    onChange((current) =>
                        current === null ? current : { ...current, comments: value },
                    )
                }
                palette={palette}
            />
        </Card>
    );
}

function DomainStep({
    section,
    draft,
    onChange,
    domain,
    palette,
}: {
    section: Exclude<ReturnType<typeof getSectionForStep>, null>;
    draft: MobileAuditFormState;
    onChange: Dispatch<SetStateAction<MobileAuditFormState | null>>;
    domain: MobileYeeDomainKey;
    palette: SurveyPalette;
}) {
    return (
        <YStack gap="$4">
            <SectionIntroCard
                title={section.blockLabel}
                description={section.introText || `Complete the ${section.title} section.`}
                palette={palette}
            />
            <Card
                title={section.title}
                description="Answer each item below. If the feature is present, the condition follow-up will appear right underneath it."
                palette={palette}
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
                                <QuestionCard
                                    key={`${group.id}-${row.choiceId}`}
                                    label={row.label}
                                    palette={palette}
                                >
                                    <OptionGrid
                                        value={presenceValue}
                                        options={row.presenceAnswers}
                                        palette={palette}
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
                                            style={{
                                                backgroundColor: palette.inner,
                                                borderColor: palette.innerBorder,
                                            }}
                                        >
                                            <Paragraph
                                                style={{ color: designSystem.colors.primary }}
                                                fontFamily={designSystem.fonts.bodyBold}
                                            >
                                                If yes, please rate the condition.
                                            </Paragraph>
                                            <OptionGrid
                                                value={conditionValue}
                                                options={row.conditionAnswers}
                                                palette={palette}
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
                    palette={palette}
                />
                <SectionProgressCard
                    title={`${section.title} progress`}
                    helperText="This count updates as each question row is answered. Presence questions drive the condition follow-up when needed."
                    completedCount={countAnsweredRows(section, draft)}
                    totalCount={countTotalRows(section)}
                    palette={palette}
                />
            </Card>
        </YStack>
    );
}

function Card({
    title,
    description,
    children,
    palette,
}: PropsWithChildren<{ title: string; description: string; palette: SurveyPalette }>) {
    return (
        <YStack
            rounded={designSystem.radii.xl}
            borderWidth={1}
            p="$4"
            gap="$3.5"
            style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                boxShadow: designSystem.shadows.card,
            }}
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

function SectionIntroCard({
    title,
    description,
    palette,
}: {
    title: string;
    description: string;
    palette: SurveyPalette;
}) {
    return (
        <YStack
            rounded={28}
            borderWidth={1}
            p="$4"
            gap="$2.5"
            style={{
                backgroundColor: palette.intro,
                borderColor: palette.introBorder,
                boxShadow: designSystem.shadows.card,
            }}
        >
            <Text
                style={{ color: palette.accent }}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={23}
            >
                {title}
            </Text>
            <Paragraph
                style={{ color: palette.mutedAccent }}
                fontFamily={designSystem.fonts.bodyMedium}
                lineHeight={21}
            >
                {description}
            </Paragraph>
        </YStack>
    );
}

function QuestionCard({
    label,
    children,
    palette,
}: PropsWithChildren<{ label: string; palette: SurveyPalette }>) {
    return (
        <YStack
            rounded={28}
            borderWidth={1}
            p="$4"
            gap="$3"
            style={{
                backgroundColor: palette.card,
                borderColor: palette.cardBorder,
                boxShadow: designSystem.shadows.card,
            }}
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
    palette,
}: {
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
    onChange: (value: string) => void;
    helperText?: string;
    promptOverride?: string;
    palette: SurveyPalette;
}) {
    return (
        <QuestionCard label={promptOverride ?? label} palette={palette}>
            {helperText ? (
                <Paragraph color={designSystem.colors.mutedForeground}>{helperText}</Paragraph>
            ) : null}
            <OptionGrid
                value={value}
                options={options.map((option) => ({ id: option.value, label: option.label }))}
                palette={palette}
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
    palette,
}: {
    label: string;
    values: readonly string[];
    options: readonly { value: string; label: string }[];
    onToggle: (value: string) => void;
    palette: SurveyPalette;
}) {
    return (
        <QuestionCard label={label} palette={palette}>
            <YStack gap="$2">
                {options.map((option) => {
                    const selected = values.includes(option.value);
                    return (
                        <SelectionButton
                            key={option.value}
                            label={option.label}
                            selected={selected}
                            palette={palette}
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
    palette,
}: {
    value: string | undefined;
    options: readonly { id: string; label: string }[];
    onChange: (value: string) => void;
    palette: SurveyPalette;
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
                        palette={palette}
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
    palette,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    palette: SurveyPalette;
}) {
    return (
        <Button
            justify="flex-start"
            rounded={designSystem.radii.full}
            borderWidth={1}
            hoverStyle={{ opacity: 0.96 }}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            py="$3"
            px="$3.5"
            style={{
                backgroundColor: selected ? palette.selected : palette.inner,
                boxShadow: selected ? designSystem.shadows.accent : "none",
            }}
        >
            <Button.Text
                style={{
                    color: selected ? designSystem.colors.primaryForeground : palette.mutedAccent,
                    textAlign: "left",
                }}
                fontFamily={designSystem.fonts.bodyBold}
                width="100%"
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
    palette,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    palette: SurveyPalette;
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
                style={{
                    minHeight: 110,
                    borderRadius: 20,
                    backgroundColor: palette.inner,
                    borderColor: palette.innerBorder,
                }}
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
    palette,
}: {
    title: string;
    helperText: string;
    completedCount: number;
    totalCount: number;
    palette: SurveyPalette;
}) {
    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            p="$3.5"
            gap="$2.5"
            style={{
                backgroundColor: palette.progress,
                borderColor: palette.cardBorder,
            }}
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
                    style={{ color: palette.accent }}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={20}
                >
                    {percentage}%
                </Text>
            </XStack>
            <YStack
                height={10}
                rounded={designSystem.radii.full}
                style={{ backgroundColor: palette.progressTrack }}
                overflow="hidden"
            >
                <YStack
                    height={10}
                    rounded={designSystem.radii.full}
                    style={{
                        backgroundColor: palette.accent,
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
                borderColor={designSystem.colors.border}
                p="$3"
                style={{ backgroundColor: designSystem.colors.surface }}
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

    return confirmChoice(
        "Some questions are still unanswered",
        incompleteMessage,
        "Move forward",
        "Stay here",
    );
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
        for (const domainStep of domainSteps) {
            const nextSection = getSectionForStep(instrument, domainStep);
            if (nextSection === null) {
                continue;
            }

            const completedCount = countAnsweredRows(nextSection, draft);
            const totalCount = countTotalRows(nextSection);
            if (completedCount < totalCount) {
                return { step: domainStep, label: nextSection.title };
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

function FooterNav({
    isSaving,
    onBack,
    onSaveExit,
    onNext,
    nextLabel,
    nextTone,
    extraActionLabel,
    onExtraAction,
}: {
    isSaving: boolean;
    onBack: () => void;
    onSaveExit: () => void;
    onNext: () => void;
    nextLabel: string;
    nextTone: SurveyPalette;
    extraActionLabel?: string;
    onExtraAction?: () => void;
}) {
    return (
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
                borderWidth={1}
                hoverStyle={{ opacity: 0.96 }}
                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                onPress={onNext}
                disabled={isSaving}
                style={{
                    backgroundColor: nextTone.stepText,
                    borderColor: nextTone.stepText,
                }}
            >
                <XStack items="center" gap="$2">
                    {isSaving ? (
                        <Spinner color={designSystem.colors.primaryForeground} size="small" />
                    ) : (
                        <ArrowRight size={16} color={designSystem.colors.primaryForeground} />
                    )}
                    <Button.Text
                        style={{ color: designSystem.colors.primaryForeground }}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        {nextLabel}
                    </Button.Text>
                </XStack>
            </Button>
            {extraActionLabel && onExtraAction ? (
                <Button
                    flexBasis="100%"
                    rounded={designSystem.radii.full}
                    borderWidth={1}
                    hoverStyle={{ opacity: 0.96 }}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onExtraAction}
                    style={{
                        backgroundColor: nextTone.stepSurface,
                        borderColor: nextTone.stepBorder,
                    }}
                >
                    <Button.Text
                        style={{ color: nextTone.stepText }}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        {extraActionLabel}
                    </Button.Text>
                </Button>
            ) : null}
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

function getSurveyPalette(step: MobileYeeStepNumber): SurveyPalette {
    switch (step) {
        case 1:
            return {
                card: "#F2F6FA",
                cardBorder: "#C9D8E5",
                inner: "#FFFFFF",
                innerBorder: "#B8D0E5",
                selected: "#7F9CB8",
                selectedBorder: "#6C88A4",
                intro: "#7F9CB8",
                introBorder: "#B8D0E5",
                accent: "#29465F",
                mutedAccent: "#49657D",
                progress: "#EEF5FB",
                progressTrack: "#D8E7F3",
                stepSurface: "#E4EEF8",
                stepBorder: "#9EB8D2",
                stepText: "#29465F",
            };
        case 2:
            return {
                card: "#FFF8F4",
                cardBorder: "#F0D0BE",
                inner: "#FFFDFB",
                innerBorder: "#E8C3AF",
                selected: "#DEA882",
                selectedBorder: "#C98F68",
                intro: "#DEA882",
                introBorder: "#EFCEBB",
                accent: "#7A4B2A",
                mutedAccent: "#8D5A38",
                progress: "#FFF3EA",
                progressTrack: "#F8E0D2",
                stepSurface: "#FBE9DD",
                stepBorder: "#E3B89B",
                stepText: "#7A4B2A",
            };
        case 3:
            return {
                card: "#EFF8F4",
                cardBorder: "#BCE2CF",
                inner: "#FFFFFF",
                innerBorder: "#B3D8C7",
                selected: "#57B894",
                selectedBorder: "#409E7A",
                intro: "#57B894",
                introBorder: "#8DD3B4",
                accent: "#145B43",
                mutedAccent: "#2D7259",
                progress: "#E9F6F0",
                progressTrack: "#CFE9DC",
                stepSurface: "#E3F4ED",
                stepBorder: "#9FCDB7",
                stepText: "#145B43",
            };
        case 4:
            return {
                card: "#F0F6FF",
                cardBorder: "#C8DBF3",
                inner: "#FFFFFF",
                innerBorder: "#BDD3EE",
                selected: "#7B9ED9",
                selectedBorder: "#668CC8",
                intro: "#7B9ED9",
                introBorder: "#B7CDEF",
                accent: "#274F90",
                mutedAccent: "#4A6DA8",
                progress: "#ECF3FD",
                progressTrack: "#D4E2F8",
                stepSurface: "#E5EEFC",
                stepBorder: "#AFC7EA",
                stepText: "#274F90",
            };
        case 5:
            return {
                card: "#FFF8EE",
                cardBorder: "#F0D9A9",
                inner: "#FFFFFF",
                innerBorder: "#E8CE98",
                selected: "#E5AE47",
                selectedBorder: "#C99232",
                intro: "#E5AE47",
                introBorder: "#F4D389",
                accent: "#8B5B08",
                mutedAccent: "#9D6A1A",
                progress: "#FFF4E2",
                progressTrack: "#F7E0B4",
                stepSurface: "#FBEFCC",
                stepBorder: "#E9CB7B",
                stepText: "#8B5B08",
            };
        case 6:
            return {
                card: "#EEF9F7",
                cardBorder: "#BFE8E2",
                inner: "#FFFFFF",
                innerBorder: "#B5DDD8",
                selected: "#58BBB2",
                selectedBorder: "#409D95",
                intro: "#58BBB2",
                introBorder: "#95E1DA",
                accent: "#155E63",
                mutedAccent: "#32747A",
                progress: "#E7F8F6",
                progressTrack: "#CBEAE7",
                stepSurface: "#DDF4F2",
                stepBorder: "#99D7D2",
                stepText: "#155E63",
            };
        case 7:
            return {
                card: "#FFF3F7",
                cardBorder: "#F2C6D5",
                inner: "#FFFFFF",
                innerBorder: "#E7B9CB",
                selected: "#DE7CAB",
                selectedBorder: "#C66293",
                intro: "#DE7CAB",
                introBorder: "#F0B6D0",
                accent: "#8B2452",
                mutedAccent: "#A03A66",
                progress: "#FEEBF2",
                progressTrack: "#F2C9DB",
                stepSurface: "#FCE5EE",
                stepBorder: "#E8B1C9",
                stepText: "#8B2452",
            };
        case 8:
            return {
                card: "#F7F2FF",
                cardBorder: "#D7C9F3",
                inner: "#FFFFFF",
                innerBorder: "#D0C0EF",
                selected: "#9D7FE8",
                selectedBorder: "#8666D4",
                intro: "#9D7FE8",
                introBorder: "#CCB2FF",
                accent: "#4F2EA7",
                mutedAccent: "#6847BB",
                progress: "#F2EDFF",
                progressTrack: "#DED0F8",
                stepSurface: "#EEE7FF",
                stepBorder: "#C7B0F2",
                stepText: "#4F2EA7",
            };
        case 9:
        default:
            return {
                card: "#EEF7F1",
                cardBorder: "#C0E0CD",
                inner: "#FFFFFF",
                innerBorder: "#B2D4C0",
                selected: "#57B894",
                selectedBorder: "#409E7A",
                intro: "#57B894",
                introBorder: "#8DD3B4",
                accent: "#145B43",
                mutedAccent: "#2D7259",
                progress: "#E7F5EC",
                progressTrack: "#CBE4D5",
                stepSurface: "#DFF1E7",
                stepBorder: "#9FCDB7",
                stepText: "#145B43",
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
