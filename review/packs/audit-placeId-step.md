# CODE CONTEXT PACK — app/audit/[placeId]/[step].tsx

_Read `review/core.md` alongside this file._

design_system_components_used: (none)

## Screen slice

### app/audit/[placeId]/[step].tsx

```tsx
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import {
    KeyboardAwareScrollView,
    type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, ArrowRight, Save } from "components/icons";
import { YeeStackHeaderTitle } from "components/navigation/YeeStackHeaderTitle";
import { useYeeStackHeaderOptions } from "components/navigation/useYeeStackHeaderOptions";
import { Button, Input, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { designSystem } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { buildAuditStepHeaderLabels } from "lib/yee-navigation-labels";
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
    openHoursAccessOptions,
    publicAccessOptions,
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
    const layout = useResponsiveLayout();
    const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
    const insets = useSafeAreaInsets();
    const stackHeaderOptions = useYeeStackHeaderOptions();
    const [footerHeight, setFooterHeight] = useState(0);
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
                    normalizedInstrument = normalizeInstrument(cachedInstrument);
                }

                try {
                    const instrumentPayload = await fetchYeeInstrument();
                    normalizedInstrument = normalizeInstrument(instrumentPayload);
                    await writeInstrumentCache(instrumentPayload);
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
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: draft !== null && !isLoading,
        rerunKey: `${placeId}:${step}:${instrument?.sections.length ?? 0}`,
        scrollToOffset,
    });

    const headerLabels = useMemo(
        () =>
            buildAuditStepHeaderLabels({
                placeName: draft?.placeName ?? place?.name,
                stepTitle: getStepTitle(step),
            }),
        [draft?.placeName, place?.name, step],
    );
    const stackHeader = (
        <Stack.Screen
            options={{
                ...stackHeaderOptions,
                headerTitle: () => (
                    <YeeStackHeaderTitle
                        primary={headerLabels.primary}
                        secondary={headerLabels.secondary}
                    />
                ),
            }}
        />
    );

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
            // Local MMKV draft is the SOURCE OF TRUTH. Commit it durably BEFORE
            // any network work so recovery never depends on a remote draft save.
            // For a manual save we are about to attempt the (legacy, optional)
            // remote mirror, so the honest local state is "pending_upload" until
            // that remote call confirms — a crash mid-call then leaves a state the
            // queue can recover rather than a false "synced".
            await saveDraftLocally({
                ...draftToPersist,
                syncState:
                    syncIntent === "autosave"
                        ? "local_only"
                        : isOnline
                          ? "pending_upload"
                          : "local_only",
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

            // Remote draft save is OPTIONAL legacy sync (the web mirror). It never
            // blocks local recovery: the local draft is already durably committed
            // above, so a failure here merely queues a best-effort retry.
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
        return (
            <>
                {stackHeader}
                <LoadingScreen />
            </>
        );
    }

    if (place === null) {
        return (
            <>
                {stackHeader}
                <BlockedAuditScreen
                    title="Place not available"
                    body="This audit route is not available on this device right now. Return to the places list and refresh the assigned-place cache when you are online."
                    onBack={() => router.replace("/(tabs)/places")}
                />
            </>
        );
    }

    if (!isOnline && instrument === null) {
        return (
            <>
                {stackHeader}
                <BlockedAuditScreen
                    title="Survey not cached yet"
                    body="This device has not cached the full YEE survey instrument yet. Connect once online and refresh the mobile app before starting or continuing this audit offline."
                    onBack={() => router.replace("/(tabs)/places")}
                />
            </>
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
        <>
            {stackHeader}
            <YStack flex={1} bg={designSystem.colors.background}>
                <KeyboardAwareScrollView
                    ref={scrollViewRef}
                    bottomOffset={24}
                    contentInsetAdjustmentBehavior="automatic"
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    style={{ backgroundColor: designSystem.colors.background }}
                    contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                        bottomPadding: (footerHeight > 0 ? footerHeight : 96) + 48,
                        gap: 20,
                    })}
                >
                    <StepHeader
                        step={step}
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
                        <FinalCommentsStep
                            draft={draft}
                            onChange={setDraft}
                            palette={stepPalette}
                        />
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
                </KeyboardAwareScrollView>

                <FooterNav
                    isSaving={isSaving}
                    bottomInset={insets.bottom}
                    horizontalPadding={layout.screenPaddingHorizontal}
                    onMeasure={setFooterHeight}
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
        </>
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
                    rounded={designSystem.radii.button}
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
    onStepPress,
}: {
    step: MobileYeeStepNumber;
    onStepPress: (step: MobileYeeStepNumber) => void;
}) {
    const progressLabel =
        step <= 2 ? "Setup and weighting" : step === 9 ? "Final comments" : "Domain section";
    const chipTone = getStepTone(step);
    return (
        <YStack gap="$3.5">
            <YStack gap="$1">
                <XStack gap="$2" flexWrap="wrap" mb="$1">
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
                            rounded={designSystem.radii.button}
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
                    label="Is this place open to the public (or can only certain people use it)"
                    value={draft.publicAccess}
                    options={
                        publicAccessOptions as unknown as readonly {
                            value: string;
                            label: string;
                        }[]
                    }
                    onChange={(value) =>
                        onChange((current) =>
                            current === null ? current : { ...current, publicAccess: value },
                        )
                    }
                    palette={palette}
                />
                <ChoiceQuestion
                    label="Is this place open all hours or is it closed for some hours (Ex: closed after 11pm)"
                    value={draft.openHoursAccess}
                    options={
                        openHoursAccessOptions as unknown as readonly {
                            value: string;
                            label: string;
                        }[]
                    }
                    onChange={(value) =>
                        onChange((current) =>
                            current === null ? current : { ...current, openHoursAccess: value },
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
            rounded={designSystem.radii.lg}
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
            rounded={designSystem.radii.lg}
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
    // Built from a pressable XStack rather than Tamagui's Button so the label can
    // wrap onto multiple lines and the row grows with it. The Button component
    // pins a fixed size-token height, which clipped longer option labels.
    return (
        <XStack
            items="center"
            rounded={designSystem.radii.button}
            borderWidth={1}
            py="$3"
            px="$3.5"
            cursor="pointer"
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hoverStyle={{ opacity: 0.98 }}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            style={{
                backgroundColor: selected ? palette.selected : palette.inner,
                borderColor: selected ? palette.selectedBorder : palette.innerBorder,
                boxShadow: selected ? designSystem.shadows.accent : "none",
            }}
        >
            <Text
                fontFamily={designSystem.fonts.bodyBold}
                style={{
                    color: selected ? designSystem.colors.primaryForeground : palette.accent,
                    flexShrink: 1,
                    textAlign: "left",
                }}
            >
                {label}
            </Text>
        </XStack>
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
                color={designSystem.colors.foreground}
                placeholder="Optional notes"
                // Dropping `numberOfLines` is the real fix: a fixed line count on a
                // multiline field fought the minHeight, so content spilled past the
                // frame and the next card overlapped it. minHeight + top alignment +
                // padding now keep the box sized to its content and text inside it.
                rounded={designSystem.radii.lg}
                borderWidth={1}
                px="$3"
                py="$3"
                verticalAlign="top"
                style={{
                    minHeight: 110,
                    backgroundColor: palette.inner,
                    borderColor: palette.innerBorder,
                }}
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
        publicAccess: draft.publicAccess,
        openHoursAccess: draft.openHoursAccess,
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
            draft.publicAccess.length === 0 ? "public access" : null,
            draft.openHoursAccess.length === 0 ? "hours / availability" : null,
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
    bottomInset,
    horizontalPadding,
    onMeasure,
    onBack,
    onSaveExit,
    onNext,
    nextLabel,
    nextTone,
    extraActionLabel,
    onExtraAction,
}: {
    isSaving: boolean;
    bottomInset: number;
    horizontalPadding: number;
    onMeasure: (height: number) => void;
    onBack: () => void;
    onSaveExit: () => void;
    onNext: () => void;
    nextLabel: string;
    nextTone: SurveyPalette;
    extraActionLabel?: string;
    onExtraAction?: () => void;
}) {
    return (
        <YStack
            position="absolute"
            onLayout={(event) => onMeasure(event.nativeEvent.layout.height)}
            style={{
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: designSystem.colors.background,
                borderTopWidth: 1,
                borderTopColor: designSystem.colors.border,
                paddingHorizontal: horizontalPadding,
                paddingTop: 12,
                paddingBottom: bottomInset + 12,
            }}
        >
            <XStack gap="$2.5" flexWrap="wrap">
                <Button
                    flex={1}
                    rounded={designSystem.radii.button}
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
                    rounded={designSystem.radii.button}
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
                    rounded={designSystem.radii.button}
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
                        rounded={designSystem.radii.button}
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
        </YStack>
    );
}

// Unified brand tone for the step pills and progress chip. The active step reads
// as a soft green chip; inactive steps stay neutral so the wizard no longer uses
// a different hue per section.
function getStepTone(_step: MobileYeeStepNumber) {
    return {
        surface: designSystem.colors.primarySoft,
        border: "rgba(16, 35, 31, 0.16)",
        softSurface: designSystem.colors.surfaceMuted,
        softBorder: designSystem.colors.border,
        text: designSystem.colors.primary,
    };
}

// Single brand survey palette shared by every step. Domain colour is expressed
// through structure (cards, the active step pill, progress) rather than a unique
// hue per section, keeping the wizard calm and on-brand (green on cream).
function getSurveyPalette(_step: MobileYeeStepNumber): SurveyPalette {
    return {
        card: designSystem.colors.surface,
        cardBorder: designSystem.colors.border,
        inner: designSystem.colors.input,
        innerBorder: designSystem.colors.border,
        selected: designSystem.colors.primary,
        selectedBorder: designSystem.colors.primary,
        intro: designSystem.colors.successSoft,
        introBorder: designSystem.colors.border,
        accent: designSystem.colors.primary,
        mutedAccent: designSystem.colors.secondaryForeground,
        progress: designSystem.colors.surfaceMuted,
        progressTrack: designSystem.colors.mutedSurface,
        stepSurface: designSystem.colors.primarySoft,
        stepBorder: designSystem.colors.border,
        stepText: designSystem.colors.primary,
    };
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
```

### components/icons.tsx

```tsx
import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = ComponentProps<typeof Feather>["name"];

interface IconProps {
    readonly color?: string;
    readonly size?: number;
}

function makeIcon(name: FeatherIconName) {
    return function Icon({ color, size = 16 }: IconProps) {
        return <Feather name={name} size={size} color={color} />;
    };
}

export const ArrowLeft = makeIcon("arrow-left");
export const ArrowRight = makeIcon("arrow-right");
export const ArrowUpRight = makeIcon("arrow-up-right");
export const BarChart3 = makeIcon("bar-chart-2");
export const Bell = makeIcon("bell");
export const Check = makeIcon("check");
export const CheckCircle2 = makeIcon("check-circle");
export const ChevronLeft = makeIcon("chevron-left");
export const ChevronRight = makeIcon("chevron-right");
export const CircleCheckBig = makeIcon("check-circle");
export const ClipboardCheck = makeIcon("clipboard");
export const Clock3 = makeIcon("clock");
export const CloudOff = makeIcon("cloud-off");
export const Eye = makeIcon("eye");
export const EyeOff = makeIcon("eye-off");
export const FileBarChart = makeIcon("bar-chart-2");
export const FileText = makeIcon("file-text");
export const KeyRound = makeIcon("key");
export const LayoutDashboard = makeIcon("grid");
export const LayoutList = makeIcon("list");
export const LogOut = makeIcon("log-out");
export const MapPin = makeIcon("map-pin");
export const MapPinned = makeIcon("map-pin");
export const Monitor = makeIcon("monitor");
export const Moon = makeIcon("moon");
export const RefreshCcw = makeIcon("refresh-ccw");
export const Save = makeIcon("save");
export const Send = makeIcon("send");
export const Settings = makeIcon("settings");
export const ShieldAlert = makeIcon("shield");
export const ShieldCheck = makeIcon("shield");
export const Sun = makeIcon("sun");
export const TriangleAlert = makeIcon("alert-triangle");
export const Type = makeIcon("type");
export const UploadCloud = makeIcon("upload-cloud");
export const UserRound = makeIcon("user");
export const WifiOff = makeIcon("wifi-off");
```

### components/navigation/YeeStackHeaderTitle.tsx

```tsx
import { ScrollView } from "react-native";
import { Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import { useResponsiveLayout } from "lib/responsive-layout";

export interface YeeStackHeaderTitleProps {
    readonly primary: string;
    readonly secondary?: string | undefined;
    readonly size?: "md" | "lg";
}

const TABLET_LIMIT = 120;
const MOBILE_PRIMARY_LIMIT = 34;
const MOBILE_SECONDARY_LIMIT = 52;

function truncateHeaderText(text: string, limit: number): string {
    if (text.length <= limit) {
        return text;
    }

    return `${text.slice(0, Math.max(limit - 3, 0))}...`;
}

export function YeeStackHeaderTitle({ primary, secondary, size = "md" }: YeeStackHeaderTitleProps) {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const primarySize = Math.round((size === "lg" ? 17 : 15) * designSystem.fontScale);
    const secondarySize = Math.round(12 * designSystem.fontScale);
    const primaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_PRIMARY_LIMIT;
    const secondaryLimit = layout.isTablet ? TABLET_LIMIT : MOBILE_SECONDARY_LIMIT;
    const displayPrimary = truncateHeaderText(primary, primaryLimit);
    const displaySecondary =
        secondary === undefined ? undefined : truncateHeaderText(secondary, secondaryLimit);

    return (
        <YStack justify="center" style={{ maxWidth: "100%" }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center" }}
            >
                {layout.isTablet && displaySecondary !== undefined ? (
                    <XStack items="center" gap="$2">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            |
                        </Text>
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyRegular}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displaySecondary}
                        </Text>
                    </XStack>
                ) : (
                    <YStack justify="center">
                        <Text
                            color={designSystem.colors.primary}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={primarySize}
                            lineHeight={primarySize + 4}
                        >
                            {displayPrimary}
                        </Text>
                        {displaySecondary === undefined ? null : (
                            <Text
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                                fontSize={secondarySize}
                                lineHeight={secondarySize + 4}
                            >
                                {displaySecondary}
                            </Text>
                        )}
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}
```

### components/navigation/useYeeStackHeaderOptions.ts

```tsx
import { useMemo } from "react";
import { Platform } from "react-native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useDesignSystem } from "lib/design-system";

export function useYeeStackHeaderOptions() {
    const designSystem = useDesignSystem();

    return useMemo<NativeStackNavigationOptions>(() => {
        const headerTitleAlign: NativeStackNavigationOptions["headerTitleAlign"] =
            Platform.OS === "ios" ? "center" : "left";

        return {
            headerShown: true,
            headerBackButtonDisplayMode: "generic",
            headerBackButtonMenuEnabled: true,
            headerBackVisible: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: designSystem.colors.surfaceMuted },
            headerTintColor: designSystem.colors.primary,
            headerTitleAlign,
            headerTitleStyle: {
                color: designSystem.colors.foreground,
                fontFamily: designSystem.fonts.bodyBold,
            },
        };
    }, [designSystem]);
}
```
