import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";
import { Alert, Platform } from "react-native";
import {
    KeyboardAwareScrollView,
    type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { ArrowLeft, ChevronLeft, Send } from "components/icons";
import { useYeeStackHeaderOptions } from "components/navigation/useYeeStackHeaderOptions";
import { Button, Paragraph, Spinner, Text, XStack, YStack } from "tamagui";
import { useDesignSystem, type ColorTokens } from "lib/design-system";
import {
    getContentTrackInnerWidth,
    getResponsiveContentContainerStyle,
    useResponsiveLayout,
} from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { buildAuditReviewHeaderLabels } from "lib/yee-navigation-labels";
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
import {
    deriveSubmitStatus,
    findFirstIncompleteStep,
    findPendingSubmission,
    type SubmitUiStatus,
} from "lib/yee-submit-guard";
import { previewScore } from "lib/yee-api";
import { readInstrumentCache } from "lib/yee-offline-storage";
import type { YeeScoreResult, YeeSubmissionResponse } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { useSurveyPalette } from "components/audit/survey-theme";
import { NoticeCard, SurveyCard } from "components/audit/primitives";
import {
    ReviewSectionCard,
    ReviewSummaryRow,
    type ReviewSection,
} from "components/audit/review/ReviewSectionCard";

/**
 * Backend-preview score state for the review screen. There is deliberately no
 * locally-computed value: `unavailable` is shown when the backend preview cannot
 * be reached (offline or no session) instead of a local fallback.
 */
type ScorePreviewState =
    | { readonly status: "loading" }
    | { readonly status: "unavailable" }
    | { readonly status: "ready"; readonly totalScore: number };

export default function AuditReviewScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const params = useLocalSearchParams<{ placeId?: string }>();
    const layout = useResponsiveLayout();
    const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
    const insets = useSafeAreaInsets();
    const stackHeaderOptions = useYeeStackHeaderOptions();
    const [footerHeight, setFooterHeight] = useState(0);
    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const session = useAuthStore((state) => state.session);
    const {
        assignedPlaces,
        draftsByPlace,
        syncQueue,
        submittedAudits,
        isOnline,
        saveDraftLocally,
        queueSubmissionSync,
        syncPendingQueue,
        refreshRemoteState,
        reconcilePlaceSubmission,
    } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            draftsByPlace: state.draftsByPlace,
            syncQueue: state.syncQueue,
            submittedAudits: state.submittedAudits,
            isOnline: state.isOnline,
            saveDraftLocally: state.saveDraftLocally,
            queueSubmissionSync: state.queueSubmissionSync,
            syncPendingQueue: state.syncPendingQueue,
            refreshRemoteState: state.refreshRemoteState,
            reconcilePlaceSubmission: state.reconcilePlaceSubmission,
        })),
    );
    const place = assignedPlaces.find((entry) => entry.id === placeId) ?? null;
    const storedDraft = draftsByPlace[placeId] ?? null;

    // Persisted in-flight guard: a queued submission item for this place survives
    // app restarts (the queue lives in MMKV), so a restart mid-submit must NOT be
    // able to enqueue a second submission for the same place.
    const pendingSubmission = useMemo(
        () => findPendingSubmission(syncQueue, placeId),
        [syncQueue, placeId],
    );
    const hasSyncedSubmission = useMemo(
        () =>
            submittedAudits.some(
                (audit) => audit.place_id === placeId && audit.syncState !== "pending_upload",
            ),
        [submittedAudits, placeId],
    );

    // Shared active-audit session store (populated by the persistent shell at
    // app/audit/[placeId]/index.tsx, which stays mounted underneath review). When
    // the shell already loaded this exact place, its instrument/draft are reused
    // as-is — no re-fetch, no draft rebuild. Otherwise (deep link / cold entry
    // where the shell never mounted) we fall back to the screen's own self-load
    // path below so review still works standalone and offline.
    const sessionPlaceId = useAuditSessionStore((state) => state.placeId);
    const sessionInstrument = useAuditSessionStore((state) => state.instrument);
    const sessionDraft = useAuditSessionStore((state) => state.draft);
    const hasSharedSession =
        sessionPlaceId === placeId && sessionInstrument !== null && sessionDraft !== null;

    const [fallbackDraft, setFallbackDraft] = useState<MobileAuditFormState | null>(null);
    const [fallbackInstrument, setFallbackInstrument] = useState<NormalizedInstrument | null>(null);

    useEffect(() => {
        if (hasSharedSession || placeId.length === 0) {
            return;
        }

        setFallbackDraft(
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
    }, [hasSharedSession, place?.name, placeId, storedDraft]);

    useEffect(() => {
        if (hasSharedSession) {
            return;
        }

        let cancelled = false;

        async function loadInstrument() {
            const cachedInstrument = await readInstrumentCache();
            if (cachedInstrument === null || cancelled) {
                return;
            }
            setFallbackInstrument(normalizeInstrument(cachedInstrument));
        }

        void loadInstrument();
        return () => {
            cancelled = true;
        };
    }, [hasSharedSession]);

    const draft = hasSharedSession ? sessionDraft : fallbackDraft;
    const instrument = hasSharedSession ? sessionInstrument : fallbackInstrument;

    const [scorePreview, setScorePreview] = useState<ScorePreviewState>({ status: "loading" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // The backend is the only scoring authority. The review preview reflects a
    // live backend preview (/yee/audits/score); when it cannot be reached we show
    // an unavailable state rather than computing a local fallback.
    useEffect(() => {
        let cancelled = false;

        async function loadPreview() {
            if (draft === null) {
                return;
            }

            if (session === null || !isOnline) {
                setScorePreview({ status: "unavailable" });
                return;
            }

            setScorePreview({ status: "loading" });
            try {
                const score = await previewScore(session, {
                    place_id: placeId,
                    participant_info: buildParticipantInfo(draft),
                    responses: draft.responses,
                });
                if (cancelled) {
                    return;
                }
                setScorePreview(
                    score === null
                        ? { status: "unavailable" }
                        : { status: "ready", totalScore: score.total_score },
                );
            } catch {
                if (!cancelled) {
                    setScorePreview({ status: "unavailable" });
                }
            }
        }

        void loadPreview();
        return () => {
            cancelled = true;
        };
    }, [draft, isOnline, placeId, session]);

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
                    };
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

    const submitStatus = useMemo<SubmitUiStatus>(
        () => deriveSubmitStatus({ pendingSubmission, hasSyncedSubmission }),
        [pendingSubmission, hasSyncedSubmission],
    );
    // Disable the final-submit affordance while a submission is in flight OR a
    // persisted submission queue item exists for this place (survives restart),
    // OR the audit has already been submitted.
    const submitDisabled =
        isSubmitting || pendingSubmission !== null || submitStatus === "submitted";
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    // There is no per-step route (app/audit/[placeId]/[step] does not exist):
    // the persistent shell at app/audit/[placeId]/index.tsx swaps step content
    // in place via the shared session store's `step`. When that shell is still
    // mounted underneath review (the normal case — review is pushed on top of
    // it), drive it directly and pop back to reveal it, so the shell is never
    // remounted. On cold/deep-link entry where the shell never mounted, fall
    // back to opening the audit route fresh; it lands on the first incomplete
    // step on its own.
    const goToStep = useCallback(
        (target: MobileYeeStepNumber) => {
            const sessionState = useAuditSessionStore.getState();
            if (sessionState.placeId === placeId && sessionState.draft !== null) {
                sessionState.setStep(target);
                router.back();
            } else {
                router.replace(`/audit/${placeId}`);
            }
        },
        [placeId, router],
    );

    useScreenshotScrollAutomation({
        contentReady: draft !== null,
        rerunKey: `${placeId}:${reviewSections.length}:${answeredCount}`,
        scrollToOffset,
    });

    const headerLabels = useMemo(
        () =>
            buildAuditReviewHeaderLabels({
                placeName: draft?.placeName ?? place?.name,
            }),
        [draft?.placeName, place?.name],
    );
    const stackHeader = (
        <Stack.Screen
            options={{
                ...stackHeaderOptions,
                headerShown: false,
            }}
        />
    );

    if (draft === null) {
        return (
            <>
                {stackHeader}
                <YStack
                    flex={1}
                    items="center"
                    justify="center"
                    bg={designSystem.colors.background}
                >
                    <Spinner size="large" color={designSystem.colors.primary} />
                </YStack>
            </>
        );
    }

    const currentDraft = draft;

    async function submitNow() {
        // Persisted in-flight guard. Block a rapid double-tap OR a re-tap after an
        // app restart that left a queued submission for this place: only ever one
        // submission queue item per place. The button is also disabled in the UI,
        // but guard here too because the async confirm dialog yields the event loop.
        if (isSubmitting || pendingSubmission !== null) {
            if (pendingSubmission !== null && session !== null && isOnline) {
                // Best-effort: nudge the existing queued item forward instead of
                // creating a new one, then route to the appropriate status screen.
                await syncPendingQueue(session);
                await reconcileAfterSync(pendingSubmission.payload.provisional_submission_id ?? "");
            }
            return;
        }

        const incomplete = findFirstIncompleteStep(currentDraft, instrument);
        if (incomplete !== null) {
            const goFix = await confirmChoice(
                "Audit is incomplete",
                `${incomplete.label} still has unanswered required fields. Do you want to jump back and fix it now?`,
                "Go to section",
                "Stay on review",
            );

            if (goFix) {
                goToStep(incomplete.step);
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
        setIsSubmitting(true);

        try {
            // Backend is the only scoring authority: carry the last backend preview
            // score (from a prior /yee/audits/score or draft save) as a provisional
            // placeholder. The canonical score is written once the backend accepts
            // the submission on sync — no score is computed locally.
            const provisionalScore = storedDraft?.scorePreview ?? emptyScoreResult();
            const provisionalSubmission = buildLocalQueuedSubmission(
                finalizedDraft,
                provisionalScore,
            );
            const draftForQueue = buildStoredDraft(
                finalizedDraft,
                storedDraft,
                storedDraft?.scorePreview ?? null,
                "pending_upload",
            );
            await saveDraftLocally(draftForQueue);
            await queueSubmissionSync(draftForQueue, provisionalSubmission);

            if (session !== null && isOnline) {
                await syncPendingQueue(session);
            }
            await reconcileAfterSync(provisionalSubmission.id);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to queue submission.");
        } finally {
            setIsSubmitting(false);
        }
    }

    /**
     * Resolve the post-sync outcome and route to the submitted screen.
     *
     * PRIMARY path: the queue drain already re-POSTs with the same idempotency
     * key, so a landed submission converges with no duplicate. After it runs we
     * inspect the live store: if the queued submission item is gone and a synced
     * summary exists, treat it as submitted.
     *
     * SECONDARY (ambiguous-success) fallback: if the item is STILL queued but we
     * are online — i.e. the key path was inconclusive (timeout / lost response) —
     * ask the backend directly via GET /yee/places/{placeId}/audit-state
     * (reconcilePlaceSubmission). If it reports SUBMITTED we drop the local
     * provisional record and converge as submitted; otherwise we stay queued.
     */
    async function reconcileAfterSync(fallbackSubmissionId: string) {
        if (session !== null && isOnline) {
            await refreshRemoteState(session);
        }

        let currentState = useYeeMobileStore.getState();
        let queuedStillPresent = currentState.syncQueue.some(
            (item) => item.kind === "submission" && item.placeId === placeId,
        );

        // Secondary fallback: still queued while online means the idempotency-key
        // drain was inconclusive. Confirm directly with audit-state.
        if (queuedStillPresent && session !== null && isOnline) {
            const reconciledStatus = await reconcilePlaceSubmission(placeId, session);
            if (reconciledStatus === "SUBMITTED") {
                currentState = useYeeMobileStore.getState();
                queuedStillPresent = currentState.syncQueue.some(
                    (item) => item.kind === "submission" && item.placeId === placeId,
                );
            }
        }

        const latestSubmissionForPlace = currentState.submittedAudits
            .filter((audit) => audit.place_id === placeId)
            .sort(
                (left, right) => Date.parse(right.submitted_at) - Date.parse(left.submitted_at),
            )[0];

        let nextMode: "queued" | "submitted" = "queued";
        let nextSubmissionId = fallbackSubmissionId;
        if (
            latestSubmissionForPlace !== undefined &&
            latestSubmissionForPlace.syncState !== "pending_upload"
        ) {
            nextMode = "submitted";
            nextSubmissionId = latestSubmissionForPlace.id;
        } else if (!queuedStillPresent) {
            nextMode = "submitted";
        }

        router.replace(
            `/audit/${placeId}/submitted?mode=${nextMode}&submissionId=${nextSubmissionId}`,
        );
    }

    return (
        <>
            {stackHeader}
            <YStack flex={1} bg={designSystem.colors.background}>
                <KeyboardAwareScrollView
                    ref={scrollViewRef}
                    bottomOffset={24}
                    contentInsetAdjustmentBehavior="automatic"
                    style={{ backgroundColor: designSystem.colors.background }}
                    contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                        bottomPadding: (footerHeight > 0 ? footerHeight : 96) + 24,
                        gap: 28,
                    })}
                >
                    <ReviewHeader
                        primary={headerLabels.primary}
                        secondary={headerLabels.secondary}
                        placeName={draft.placeName}
                        onBack={() => router.back()}
                    />

                    <ReviewChipRow
                        auditorId={draft.auditorId}
                        placeName={draft.placeName}
                        answeredCount={answeredCount}
                        isComplete={incompleteStep === null}
                    />

                    <SubmitStatusBanner status={submitStatus} />

                    <QuickActionsCard
                        submitStatus={submitStatus}
                        isSubmitting={isSubmitting}
                        submitDisabled={submitDisabled}
                        incompleteLabel={incompleteStep?.label ?? null}
                        onBackToDashboard={() => router.replace("/(tabs)")}
                        onEditAudit={() => goToStep(1)}
                        onSubmit={() => void submitNow()}
                    />

                    <SurveyPagesCard onJump={goToStep} />

                    <ContextSummaryCard draft={draft} answeredCount={answeredCount} />

                    <WeightingSummaryCard draft={draft} />

                    {reviewSections.map((section) => (
                        <ReviewSectionCard
                            key={section.domain}
                            section={section}
                            sectionComment={draft.sectionComments[section.domain]}
                            onEditSection={goToStep}
                        />
                    ))}

                    <SurveyCard title="Final comments">
                        <ReviewSummaryRow
                            label="Overall comments"
                            value={draft.comments || "No overall comments added."}
                        />
                    </SurveyCard>

                    <ScorePreviewCard scorePreview={scorePreview} />

                    {errorMessage === null ? null : (
                        <NoticeCard tone="danger" title="Submission note" body={errorMessage} />
                    )}
                </KeyboardAwareScrollView>

                <ReviewFooter
                    footerHeight={footerHeight}
                    onMeasure={setFooterHeight}
                    contentWidth={getContentTrackInnerWidth(layout)}
                    bottomInset={insets.bottom}
                    onBack={() => goToStep(9)}
                    onSubmit={() => void submitNow()}
                    submitDisabled={submitDisabled}
                    isSubmitting={isSubmitting}
                    submitLabel={submitActionLabel(submitStatus, isSubmitting)}
                />
            </YStack>
        </>
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

/** Button label that reflects the current persisted submit status. */
function submitActionLabel(status: SubmitUiStatus, isSubmitting: boolean): string {
    if (isSubmitting) {
        return "Submitting...";
    }
    switch (status) {
        case "queued":
            return "Queued for upload";
        case "retry_scheduled":
            return "Retry scheduled";
        case "auth_required":
            return "Sign in to upload";
        case "sync_failed":
            return "Retry upload";
        case "submitted":
            return "Submitted";
        default:
            return "Submit audit";
    }
}

interface SubmitStatusCopy {
    readonly title: string;
    readonly message: string;
    readonly tone: "neutral" | "info" | "warning" | "danger" | "success";
}

/** Map a {@link SubmitUiStatus} to user-facing banner copy + tone. */
function submitStatusCopy(status: SubmitUiStatus): SubmitStatusCopy | null {
    switch (status) {
        case "saved_locally":
            return {
                title: "Saved on this device",
                message:
                    "Your answers are saved locally. They will upload automatically when you are back online.",
                tone: "info",
            };
        case "queued":
            return {
                title: "Queued for upload",
                message:
                    "This audit is saved on the device and queued. It will upload automatically as soon as connectivity is available.",
                tone: "info",
            };
        case "retry_scheduled":
            return {
                title: "Retry scheduled",
                message:
                    "The last upload attempt did not complete. A retry is scheduled automatically; no duplicate will be created.",
                tone: "warning",
            };
        case "auth_required":
            return {
                title: "Sign in to upload",
                message:
                    "Your session expired before the upload finished. The audit is safe on this device — sign in again to upload it.",
                tone: "warning",
            };
        case "sync_failed":
            return {
                title: "Upload failed",
                message:
                    "Upload failed. Your audit is still saved on this device — tap to retry or contact support if the issue persists.",
                tone: "danger",
            };
        case "submitted":
            return {
                title: "Submitted",
                message: "This audit has been submitted and is locked for editing.",
                tone: "success",
            };
        default:
            return null;
    }
}

function submitStatusToneColors(
    tone: SubmitStatusCopy["tone"],
    colors: ColorTokens,
): {
    readonly accent: string;
    readonly soft: string;
    readonly text: string;
} {
    switch (tone) {
        case "warning":
            return {
                accent: colors.warning,
                soft: colors.warningSoft,
                text: colors.warningText,
            };
        case "danger":
            return {
                accent: colors.danger,
                soft: colors.dangerSoft,
                text: colors.dangerText,
            };
        case "success":
            return {
                accent: colors.success,
                soft: colors.successSoft,
                text: colors.successText,
            };
        default:
            return {
                accent: colors.info,
                soft: colors.infoSoft,
                text: colors.infoText,
            };
    }
}

/** Single, clear status line for the final-submit lifecycle. Renders nothing
 * when there is no persisted submission state to report (idle). */
const SubmitStatusBanner = memo(function SubmitStatusBanner({
    status,
}: {
    status: SubmitUiStatus;
}) {
    const designSystem = useDesignSystem();
    const copy = submitStatusCopy(status);
    if (copy === null) {
        return null;
    }
    const { accent, soft, text } = submitStatusToneColors(copy.tone, designSystem.colors);
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            p="$3.5"
            gap="$1.5"
            style={{ backgroundColor: soft, borderColor: accent }}
        >
            <Text style={{ color: text }} fontFamily={designSystem.fonts.bodyBold}>
                {copy.title}
            </Text>
            <Paragraph color={designSystem.colors.secondaryForeground}>{copy.message}</Paragraph>
        </YStack>
    );
});

/** Compact review header, mirroring components/audit/AuditHeader.tsx's language. */
const ReviewHeader = memo(function ReviewHeader({
    primary,
    secondary,
    placeName,
    onBack,
}: {
    primary: string;
    secondary: string;
    placeName: string;
    onBack: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <YStack gap="$6">
            <XStack justify="space-between" items="center" gap="$3">
                <XStack items="center" gap="$3" flex={1}>
                    <Button
                        width={44}
                        height={44}
                        p={0}
                        rounded={designSystem.radii.button}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surfaceMuted}
                        pressStyle={{ opacity: 0.92, scale: 0.985 }}
                        onPress={onBack}
                        accessibilityLabel="Go back"
                    >
                        <ChevronLeft size={18} color={designSystem.colors.foreground} />
                    </Button>
                    <YStack flex={1} gap="$0.5">
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={10}
                            textTransform="uppercase"
                            letterSpacing={1.4}
                        >
                            {primary}
                        </Paragraph>
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={15}
                        >
                            {secondary}
                        </Text>
                    </YStack>
                </XStack>
            </XStack>

            <YStack gap="$1.5">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.headingBold}
                    fontSize={34}
                    lineHeight={38}
                    letterSpacing={-0.8}
                >
                    Review and submit
                </Text>
                <Paragraph
                    color={designSystem.colors.mutedForeground}
                    fontFamily={designSystem.fonts.bodySemiBold}
                >
                    Review every answer for {placeName || "this place"} before the final submission.
                </Paragraph>
            </YStack>
        </YStack>
    );
});

const ReviewChipRow = memo(function ReviewChipRow({
    auditorId,
    placeName,
    answeredCount,
    isComplete,
}: {
    auditorId: string;
    placeName: string;
    answeredCount: number;
    isComplete: boolean;
}) {
    return (
        <XStack gap="$2" flexWrap="wrap">
            <Chip>{auditorId}</Chip>
            <Chip>{placeName || "Assigned place"}</Chip>
            <Chip>{answeredCount} saved answers</Chip>
            <Chip>{isComplete ? "Ready to submit" : "Still incomplete"}</Chip>
        </XStack>
    );
});

const QuickActionsCard = memo(function QuickActionsCard({
    submitStatus,
    isSubmitting,
    submitDisabled,
    incompleteLabel,
    onBackToDashboard,
    onEditAudit,
    onSubmit,
}: {
    submitStatus: SubmitUiStatus;
    isSubmitting: boolean;
    submitDisabled: boolean;
    incompleteLabel: string | null;
    onBackToDashboard: () => void;
    onEditAudit: () => void;
    onSubmit: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <SurveyCard title="Quick actions">
            <XStack gap="$2.5" flexWrap="wrap">
                <ActionButton
                    label="Back to dashboard"
                    onPress={onBackToDashboard}
                    tone="neutral"
                />
                <ActionButton label="Edit audit" onPress={onEditAudit} tone="neutral" />
                <ActionButton
                    label={submitActionLabel(submitStatus, isSubmitting)}
                    onPress={onSubmit}
                    tone="primary"
                    disabled={submitDisabled}
                />
            </XStack>
            {incompleteLabel === null ? null : (
                <Paragraph color={designSystem.colors.warningText}>
                    {incompleteLabel} still needs required answers before this audit can be
                    submitted.
                </Paragraph>
            )}
        </SurveyCard>
    );
});

const SurveyPagesCard = memo(function SurveyPagesCard({
    onJump,
}: {
    onJump: (step: MobileYeeStepNumber) => void;
}) {
    return (
        <SurveyCard title="Survey pages">
            <XStack gap="$2" flexWrap="wrap">
                {mobileYeeSteps.map((entry) => (
                    <StepJumpButton
                        key={entry.step}
                        step={entry.step}
                        label={entry.title}
                        onPress={() => onJump(entry.step)}
                    />
                ))}
            </XStack>
        </SurveyCard>
    );
});

const ContextSummaryCard = memo(function ContextSummaryCard({
    draft,
    answeredCount,
}: {
    draft: MobileAuditFormState;
    answeredCount: number;
}) {
    const layout = useResponsiveLayout();
    return (
        <SurveyCard title="Context summary">
            <SummaryGrid isWideTablet={layout.isWideTablet}>
                <ReviewSummaryRow
                    label="Visit frequency"
                    value={getVisitFrequencyLabel(draft.visitFrequency)}
                />
                <ReviewSummaryRow
                    label="Open to the public"
                    value={getPublicAccessLabel(draft.publicAccess)}
                />
                <ReviewSummaryRow
                    label="Open all hours"
                    value={getOpenHoursAccessLabel(draft.openHoursAccess)}
                />
                <ReviewSummaryRow label="Season" value={getSeasonLabel(draft.season)} />
                <ReviewSummaryRow label="Weather" value={getWeatherLabelList(draft.weather)} />
                <ReviewSummaryRow label="Answered audit fields" value={`${answeredCount}`} />
            </SummaryGrid>
        </SurveyCard>
    );
});

const WeightingSummaryCard = memo(function WeightingSummaryCard({
    draft,
}: {
    draft: MobileAuditFormState;
}) {
    return (
        <SurveyCard title="Youth weighting">
            <YStack gap="$3">
                {(Object.keys(mobileYeeDomainLabels) as MobileYeeDomainKey[]).map((domain) => (
                    <WeightingDomainRow
                        key={domain}
                        label={mobileYeeDomainLabels[domain]}
                        weight={draft.weights[domain]}
                    />
                ))}
                <ReviewSummaryRow
                    label="Weighting comments"
                    value={draft.weightingComments || "No weighting comments added."}
                />
            </YStack>
        </SurveyCard>
    );
});

const WeightingDomainRow = memo(function WeightingDomainRow({
    label,
    weight,
}: {
    label: string;
    weight: string;
}) {
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <YStack
            rounded={designSystem.radii.md}
            borderWidth={1}
            p="$3.5"
            gap="$1.5"
            style={{
                backgroundColor: palette.inner,
                borderColor: palette.innerBorder,
            }}
        >
            <XStack justify="space-between" items="center" gap="$3">
                <Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                    flex={1}
                >
                    {label}
                </Text>
                <YStack
                    rounded={designSystem.radii.full}
                    px="$3"
                    py="$1.5"
                    style={{ backgroundColor: palette.accent }}
                >
                    <Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        {getWeightNumber(weight)}
                    </Text>
                </YStack>
            </XStack>
            <Paragraph color={designSystem.colors.secondaryForeground}>
                {getWeightLabel(weight)}
            </Paragraph>
        </YStack>
    );
});

const ScorePreviewCard = memo(function ScorePreviewCard({
    scorePreview,
}: {
    scorePreview: ScorePreviewState;
}) {
    return (
        <SurveyCard title="Score preview">
            <ReviewSummaryRow
                label="Estimated score"
                value={
                    scorePreview.status === "ready"
                        ? `${scorePreview.totalScore}%`
                        : scorePreview.status === "loading"
                          ? "Calculating..."
                          : "Available when online"
                }
            />
        </SurveyCard>
    );
});

const ReviewFooter = memo(function ReviewFooter({
    onMeasure,
    contentWidth,
    bottomInset,
    onBack,
    onSubmit,
    submitDisabled,
    isSubmitting,
    submitLabel,
}: {
    footerHeight: number;
    onMeasure: (height: number) => void;
    contentWidth: number;
    bottomInset: number;
    onBack: () => void;
    onSubmit: () => void;
    submitDisabled: boolean;
    isSubmitting: boolean;
    submitLabel: string;
}) {
    const designSystem = useDesignSystem();
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
                paddingTop: 12,
                paddingBottom: bottomInset + 12,
            }}
        >
            <XStack
                gap="$2.5"
                style={{
                    alignSelf: "center",
                    maxWidth: "100%",
                    width: contentWidth,
                }}
            >
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
                    bg={designSystem.colors.primary}
                    borderWidth={1}
                    borderColor={designSystem.colors.primary}
                    disabled={submitDisabled}
                    opacity={submitDisabled ? 0.6 : 1}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onSubmit}
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
                            {submitLabel}
                        </Button.Text>
                    </XStack>
                </Button>
            </XStack>
        </YStack>
    );
});

function SummaryGrid({ children, isWideTablet }: PropsWithChildren<{ isWideTablet: boolean }>) {
    if (!isWideTablet) {
        return <YStack gap="$3">{children}</YStack>;
    }

    const items = Array.isArray(children) ? children : [children];
    return (
        <XStack gap="$3" flexWrap="wrap">
            {items.map((child, index) => (
                <YStack key={index} style={{ minWidth: 260, width: "48%" }}>
                    {child}
                </YStack>
            ))}
        </XStack>
    );
}

function Chip({ children }: PropsWithChildren) {
    const designSystem = useDesignSystem();
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
    const designSystem = useDesignSystem();
    const palette = useSurveyPalette();
    return (
        <Button
            rounded={designSystem.radii.button}
            borderWidth={1}
            px="$3.5"
            py="$2.5"
            hoverStyle={{ opacity: 0.96 }}
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
            onPress={onPress}
            style={{
                backgroundColor: palette.inner,
                borderColor: palette.innerBorder,
            }}
        >
            <Button.Text
                style={{ color: designSystem.colors.foreground }}
                fontFamily={designSystem.fonts.bodyBold}
            >
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
    const designSystem = useDesignSystem();
    const primary = tone === "primary";
    return (
        <Button
            rounded={designSystem.radii.button}
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
