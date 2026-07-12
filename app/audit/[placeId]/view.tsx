import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, ArrowRight, Eye } from "components/icons";
import { Button, Text, XStack, YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import {
    getContentTrackInnerWidth,
    getResponsiveContentContainerStyle,
    useResponsiveLayout,
} from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { fetchSubmission } from "lib/yee-api";
import { buildFormStateFromSources } from "lib/yee-mobile-draft";
import { buildMobileAuditProjection } from "lib/yee-mobile-selectors";
import {
    getNextStep,
    getPreviousStep,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import type { YeeAuditStateResponse } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { AuditHeader } from "components/audit/AuditHeader";
import { AuditStepper } from "components/audit/AuditStepper";
import { AuditBlockedScreen, AuditSkeleton } from "components/audit/AuditStates";
import { ContextStep } from "components/audit/ContextStep";
import { WeightingStep } from "components/audit/WeightingStep";
import { FinalCommentsStep } from "components/audit/FinalCommentsStep";
import { DomainStep } from "components/audit/DomainStep";

/**
 * View-only audit walkthrough. Pages through a submitted audit (steps 1–9) with
 * every control locked. Reuses the exact same step screens as the editable shell,
 * driving them through the shared session store opened in `readOnly` mode so no
 * autosave, remote merge, or commit can ever fire.
 *
 * Data source, in priority order:
 *   1. A local draft for the place (queued/unsynced audits — works offline).
 *   2. Otherwise the canonical submission fetched from the backend (online only:
 *      a synced audit's local draft is deleted on submit, so the answers live
 *      only on the server — same constraint as the report screen).
 */
export default function AuditViewScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ placeId?: string; submissionId?: string }>();
    const placeIdParam = typeof params.placeId === "string" ? params.placeId : "";
    const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";

    const scrollRef = useRef<ScrollView>(null);
    const [footerHeight, setFooterHeight] = useState(0);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const session = useAuthStore((state) => state.session);
    const { assignedPlaces, draftsByPlace, submittedAudits, syncQueue } = useYeeMobileStore(
        useShallow((state) => ({
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
                selectedPlaceId: placeIdParam,
                selectedSubmissionId: submissionId,
            }),
        [assignedPlaces, draftsByPlace, submittedAudits, syncQueue, placeIdParam, submissionId],
    );
    const submissionSummary =
        projection.sortedReports.find((audit) => audit.id === submissionId) ??
        projection.selectedPlaceView?.submission ??
        null;
    const effectivePlaceId = placeIdParam || submissionSummary?.place_id || "";

    const step = useAuditSessionStore((state) => state.step);
    const loadPhase = useAuditSessionStore((state) => state.loadPhase);
    const readOnly = useAuditSessionStore((state) => state.readOnly);
    const setStep = useAuditSessionStore((state) => state.setStep);
    const openReadOnly = useAuditSessionStore((state) => state.openReadOnly);
    const close = useAuditSessionStore((state) => state.close);

    // Load the audit into the session store in read-only mode, then tear the
    // session down on unmount. Reads the live store inside so connectivity/store
    // churn does not re-run the loader on every tick.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setErrorMessage(null);

            if (submissionId.length === 0 && effectivePlaceId.length === 0) {
                setErrorMessage("This audit reference is missing.");
                setLoading(false);
                return;
            }

            const store = useYeeMobileStore.getState();
            const draft = effectivePlaceId ? (store.draftsByPlace[effectivePlaceId] ?? null) : null;
            const summary =
                store.submittedAudits.find((audit) => audit.id === submissionId) ?? null;
            const unsynced =
                summary?.syncState === "pending_upload" || summary?.syncState === "sync_failed";

            // 1) A not-yet-uploaded (queued / failed) submission keeps its local
            // draft, which holds exactly the submitted answers — view it straight
            // from there so it works offline. A synced submission's draft is deleted
            // on upload, so we never trust a stray local draft for it; the backend
            // is the only authority (branch 2).
            if (unsynced) {
                if (draft === null) {
                    setErrorMessage(
                        "This audit is still uploading. Its answers open once the upload finishes.",
                    );
                    setLoading(false);
                    return;
                }
                await openReadOnly(
                    buildFormStateFromSources({
                        placeId: effectivePlaceId,
                        placeName:
                            summary?.place_name ??
                            asText(draft.participantInfo.place_name) ??
                            "Assigned place",
                        auditorId: asText(draft.participantInfo.auditor_id) ?? "AUDITOR",
                        storedDraft: draft,
                    }),
                );
                if (!cancelled) {
                    finishFromStore();
                }
                return;
            }

            // 2) Synced submission — fetch the canonical answers from the backend.
            if (submissionId.length === 0) {
                setErrorMessage("This submitted audit is not available on this device.");
                setLoading(false);
                return;
            }
            if (!session || !store.isOnline) {
                setErrorMessage("Connect to the internet to view this submitted audit.");
                setLoading(false);
                return;
            }

            try {
                const submission = await fetchSubmission(submissionId, session);
                if (cancelled) {
                    return;
                }
                const auditState: YeeAuditStateResponse = {
                    audit_id: null,
                    submission_id: submission.id,
                    place_id: submission.place_id,
                    place_name: submission.place_name ?? submission.place_id,
                    auditor_generated_id: submission.auditor_generated_id ?? submission.auditor_id,
                    status: "SUBMITTED",
                    submitted_at: submission.submitted_at,
                    participant_info: submission.participant_info,
                    responses: submission.responses,
                    score: submission.score,
                };
                await openReadOnly(
                    buildFormStateFromSources({
                        placeId: submission.place_id,
                        placeName: submission.place_name ?? submission.place_id,
                        auditorId: submission.auditor_generated_id ?? submission.auditor_id,
                        auditState,
                    }),
                );
                if (!cancelled) {
                    finishFromStore();
                }
            } catch (error) {
                if (!cancelled) {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Unable to load this submitted audit.",
                    );
                    setLoading(false);
                }
            }
        }

        // openReadOnly resolves the instrument (cache or fetch). If it could not be
        // loaded it parks the session in `error`; surface that as the screen error.
        function finishFromStore() {
            const sessionState = useAuditSessionStore.getState();
            if (sessionState.loadPhase === "error") {
                setErrorMessage(
                    sessionState.errorMessage ?? "This audit's survey could not be loaded.",
                );
            }
            setLoading(false);
        }

        void load();
        return () => {
            cancelled = true;
        };
        // isOnline / draft / summary are read from the live store inside `load`, so
        // they are intentionally not deps — a connectivity blip must not reset the
        // walkthrough to step 1.
    }, [submissionId, effectivePlaceId, session, openReadOnly]);

    useEffect(() => {
        return () => {
            close();
        };
    }, [close]);

    // Snap to the top whenever the step changes (content swaps in place).
    useEffect(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [step]);

    const scrollToOffset = useCallback((offset: number) => {
        scrollRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    const ready = !loading && errorMessage === null && readOnly && loadPhase === "ready";

    useScreenshotScrollAutomation({
        contentReady: ready,
        rerunKey: `${submissionId}:${step}`,
        scrollToOffset,
    });

    const exit = useCallback(() => router.back(), [router]);
    const goPrev = useCallback(() => {
        const previous = getPreviousStep(step);
        if (previous !== null) {
            setStep(previous);
        }
    }, [step, setStep]);
    // Header chevron: step back, or leave the walkthrough from the first step.
    const headerBack = useCallback(() => {
        const previous = getPreviousStep(step);
        if (previous === null) {
            exit();
        } else {
            setStep(previous);
        }
    }, [step, setStep, exit]);
    const goNext = useCallback(() => {
        const next = getNextStep(step);
        if (next === null) {
            exit();
        } else {
            setStep(next);
        }
    }, [step, setStep, exit]);

    const stackScreen = <Stack.Screen options={{ headerShown: false }} />;

    if (loading) {
        return (
            <>
                {stackScreen}
                <YStack
                    flex={1}
                    style={{ paddingTop: insets.top }}
                    bg={designSystem.colors.background}
                >
                    <AuditSkeleton />
                </YStack>
            </>
        );
    }

    if (errorMessage !== null || !ready) {
        return (
            <>
                {stackScreen}
                <AuditBlockedScreen
                    title="Audit unavailable"
                    body={
                        errorMessage ??
                        "This submitted audit could not be opened for viewing right now."
                    }
                    onBack={exit}
                />
            </>
        );
    }

    const isLastStep = getNextStep(step) === null;
    // Match the editable audit shell: cap the read-only walkthrough at the form
    // column and align the footer to the same track.
    const formTrackMaxWidth = layout.formMaxWidth;
    const footerContentWidth = getContentTrackInnerWidth(layout, formTrackMaxWidth);

    return (
        <>
            {stackScreen}
            <YStack flex={1} bg={designSystem.colors.background} style={{ paddingTop: insets.top }}>
                <AuditHeader step={step} onBack={headerBack} onHome={exit} />

                <ReadOnlyNotice />

                <YStack
                    py="$2"
                    style={{ borderBottomWidth: 1, borderBottomColor: designSystem.colors.border }}
                >
                    <AuditStepper activeStep={step} onSelect={(next) => setStep(next)} />
                </YStack>

                <ScrollView
                    ref={scrollRef}
                    style={{ backgroundColor: designSystem.colors.background }}
                    contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                        bottomPadding: (footerHeight > 0 ? footerHeight : 96) + 32,
                        gap: layout.sectionGap,
                        maxWidth: formTrackMaxWidth,
                    })}
                >
                    <AuditStepContent step={step} />
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
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 12,
                        paddingHorizontal: 16,
                    }}
                >
                    <XStack
                        gap="$2.5"
                        style={{ alignSelf: "center", width: "100%", maxWidth: footerContentWidth }}
                    >
                        <Button
                            flex={1}
                            rounded={designSystem.radii.button}
                            bg={designSystem.colors.surfaceMuted}
                            borderWidth={1}
                            borderColor={designSystem.colors.border}
                            disabled={step === 1}
                            opacity={step === 1 ? 0.5 : 1}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={goPrev}
                            icon={<ArrowLeft size={16} color={designSystem.colors.foreground} />}
                        >
                            <Button.Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                Previous
                            </Button.Text>
                        </Button>
                        <Button
                            flex={1}
                            rounded={designSystem.radii.button}
                            borderWidth={1}
                            pressStyle={{ opacity: 0.92, scale: 0.985 }}
                            onPress={goNext}
                            style={{
                                backgroundColor: designSystem.colors.primary,
                                borderColor: designSystem.colors.primary,
                            }}
                            {...(isLastStep
                                ? {}
                                : {
                                      iconAfter: (
                                          <ArrowRight
                                              size={16}
                                              color={designSystem.colors.primaryForeground}
                                          />
                                      ),
                                  })}
                        >
                            <Button.Text
                                style={{ color: designSystem.colors.primaryForeground }}
                                fontFamily={designSystem.fonts.bodyBold}
                            >
                                {isLastStep ? "Done" : "Next"}
                            </Button.Text>
                        </Button>
                    </XStack>
                </YStack>
            </YStack>
        </>
    );
}

/** Choose the step body — mirrors the editable shell's switch. */
function AuditStepContent({ step }: { step: MobileYeeStepNumber }) {
    if (step === 1) {
        return <ContextStep />;
    }
    if (step === 2) {
        return <WeightingStep />;
    }
    if (step === 9) {
        return <FinalCommentsStep />;
    }
    return <DomainStep step={step} />;
}

/** Slim banner making the view-only state explicit (visibility of system status). */
function ReadOnlyNotice() {
    const designSystem = useDesignSystem();
    return (
        <XStack
            items="center"
            gap="$2"
            px="$4"
            py="$2"
            style={{ backgroundColor: designSystem.colors.surfaceMuted }}
        >
            <Eye size={13} color={designSystem.colors.mutedForeground} />
            <Text
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
                fontSize={12}
            >
                Read-only — this audit has been submitted and cannot be edited.
            </Text>
        </XStack>
    );
}

function asText(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}
