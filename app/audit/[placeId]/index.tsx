import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, BackHandler, Platform, View } from "react-native";
import {
    KeyboardAwareScrollView,
    type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { YStack } from "tamagui";
import { useDesignSystem } from "lib/design-system";
import {
    getContentTrackInnerWidth,
    getResponsiveContentContainerStyle,
    useResponsiveLayout,
} from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import {
    getNextStep,
    getPreviousStep,
    type MobileYeeStepNumber,
} from "lib/yee-mobile-audit-config";
import { countAnsweredQuestions, countTotalQuestions } from "lib/yee-audit-question-view";
import { getSectionForStep, type NormalizedInstrument } from "lib/yee-mobile-instrument";
import type { MobileAuditFormState } from "lib/yee-mobile-draft";
import { getLatestSubmissionForPlace } from "lib/yee-mobile-selectors";
import { useYeeMobileStore } from "stores/yee-mobile-store";
import { useAuditSessionStore } from "stores/yee-audit-session-store";
import { AuditHeader } from "components/audit/AuditHeader";
import { AuditStepper } from "components/audit/AuditStepper";
import { AuditFooterNav } from "components/audit/AuditFooterNav";
import { useAuditConfirm } from "components/audit/AuditConfirmDialog";
import {
    AuditRowScrollContext,
    type AuditRowScrollController,
} from "components/audit/audit-scroll";
import { AuditBlockedScreen, AuditSkeleton } from "components/audit/AuditStates";
import { ContextStep } from "components/audit/ContextStep";
import { WeightingStep } from "components/audit/WeightingStep";
import { FinalCommentsStep } from "components/audit/FinalCommentsStep";
import { DomainStep } from "components/audit/DomainStep";
import { NoticeCard } from "components/audit/primitives";

/**
 * Persistent audit shell. Mounts once per audit, loads the instrument + draft
 * once, and swaps step content IN PLACE via state — no route change, no remount,
 * no re-fetch, no full-screen spinner. This screen deliberately does NOT
 * subscribe to the draft: it reads it imperatively in handlers, so typing and
 * answering never re-render the shell.
 */
export default function AuditShellScreen() {
    const designSystem = useDesignSystem();
    const router = useRouter();
    const layout = useResponsiveLayout();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        placeId?: string;
        __screenshotAuditStep?: string;
    }>();
    const placeId = typeof params.placeId === "string" ? params.placeId : "";
    const screenshotAuditStep = parseScreenshotAuditStep(params.__screenshotAuditStep);
    const { requestConfirm, confirmDialog } = useAuditConfirm();

    const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
    // Native node of the scrolled content + a registry of question-row nodes, so
    // "Jump to next unanswered" can measure a row against the content and scroll
    // to it — without the shell subscribing to the draft.
    const contentWrapperRef = useRef<View>(null);
    const rowNodesRef = useRef<Map<string, View>>(new Map());
    const [footerHeight, setFooterHeight] = useState(0);
    const [navBusy, setNavBusy] = useState(false);

    const place = useYeeMobileStore(
        (state) => state.assignedPlaces.find((entry) => entry.id === placeId) ?? null,
    );
    const hasLoadedPlaces = useYeeMobileStore((state) => state.assignedPlaces.length > 0);
    const isOnline = useYeeMobileStore((state) => state.isOnline);
    const submittedAudit = useYeeMobileStore((state) =>
        getLatestSubmissionForPlace(state.submittedAudits, placeId),
    );

    const loadPhase = useAuditSessionStore((state) => state.loadPhase);
    const errorMessage = useAuditSessionStore((state) => state.errorMessage);
    const step = useAuditSessionStore((state) => state.step);
    const open = useAuditSessionStore((state) => state.open);
    const close = useAuditSessionStore((state) => state.close);
    const retryLoad = useAuditSessionStore((state) => state.retryLoad);
    const setStep = useAuditSessionStore((state) => state.setStep);
    const commitAndQueueRemote = useAuditSessionStore((state) => state.commitAndQueueRemote);

    // Mount once per audit: open the session, close it on unmount.
    useEffect(() => {
        if (placeId.length === 0) {
            return;
        }
        if (submittedAudit !== null) {
            close();
            return;
        }
        void open(placeId, { place });
        return () => {
            close();
        };
        // `place` is intentionally excluded: open() re-reads live place data, and
        // re-opening on every place-cache refresh would discard in-progress edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeId, open, close, submittedAudit]);

    // Flush the freshest draft to the remote mirror when the app leaves the
    // foreground, so work is queued without waiting for the auditor to navigate.
    // No-op for submitted (read-only) audits and before the session is ready;
    // commitAndQueueRemote itself guards read-only and never blocks on the network.
    const editable = submittedAudit === null && loadPhase === "ready";
    useEffect(() => {
        if (!editable) {
            return;
        }
        const subscription = AppState.addEventListener("change", (next) => {
            if (next === "background" || next === "inactive") {
                void commitAndQueueRemote();
            }
        });
        return () => subscription.remove();
    }, [editable, commitAndQueueRemote]);

    // On reconnect while editing, enqueue the current draft so the freshest content
    // drains — not just whatever stale queue items already existed. The root layout
    // still drives the actual queue drain; single-flight dedupes the two triggers.
    const wasOnlineRef = useRef(isOnline);
    useEffect(() => {
        const reconnected = !wasOnlineRef.current && isOnline;
        wasOnlineRef.current = isOnline;
        if (reconnected && editable) {
            void commitAndQueueRemote();
        }
    }, [isOnline, editable, commitAndQueueRemote]);

    const scrollToTop = useCallback(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []);
    const scrollToOffset = useCallback((offset: number) => {
        scrollRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    // Stable controller: nested rows register their nodes here, and asking to
    // scroll a row measures it against the scrolled content and scrolls it to the
    // top. Memoized so the context value never changes → no extra row re-renders.
    const rowScrollController = useMemo<AuditRowScrollController>(
        () => ({
            registerRow: (key, node) => {
                if (node === null) {
                    rowNodesRef.current.delete(key);
                } else {
                    rowNodesRef.current.set(key, node);
                }
            },
            scrollToRow: (key) => {
                const node = rowNodesRef.current.get(key);
                const container = contentWrapperRef.current;
                if (node == null || container == null) {
                    return;
                }
                // Measure both nodes in window coordinates and scroll by their
                // delta. On the New Architecture (Fabric) `measureLayout` rejects a
                // numeric findNodeHandle — it warns "must be called with a ref to a
                // native component" and no-ops. Measuring in-window and subtracting
                // the content-wrapper origin yields the same row offset within the
                // scrolled content and works on both architectures with no handle.
                container.measureInWindow((_containerX, containerY) => {
                    node.measureInWindow((_rowX, rowY) => {
                        scrollToOffset(Math.max(0, rowY - containerY - 8));
                    });
                });
            },
        }),
        [scrollToOffset],
    );

    // Content swaps in place; snap to the top so a new step starts at its header.
    useEffect(() => {
        scrollToTop();
    }, [step, scrollToTop]);

    // Screenshot capture targets steps explicitly because the persistent audit
    // route normally resumes at the first incomplete step from the session store.
    useEffect(() => {
        if (loadPhase === "ready" && screenshotAuditStep !== null) {
            setStep(screenshotAuditStep);
        }
    }, [loadPhase, screenshotAuditStep, setStep]);

    useScreenshotScrollAutomation({
        contentReady: loadPhase === "ready",
        rerunKey: `${placeId}:${step}`,
        scrollToOffset,
    });

    const goToStep = useCallback(
        (next: MobileYeeStepNumber) => {
            setStep(next);
        },
        [setStep],
    );

    const exitToPlaces = useCallback(async () => {
        setNavBusy(true);
        try {
            // Awaits only the durable LOCAL write + enqueue (fast MMKV work); the
            // remote mirror drains in the background and never blocks the exit.
            await commitAndQueueRemote();
        } finally {
            setNavBusy(false);
            router.replace("/(tabs)/places");
        }
    }, [commitAndQueueRemote, router]);

    const goBack = useCallback(() => {
        const previous = getPreviousStep(step);
        if (previous === null) {
            void exitToPlaces();
        } else {
            setStep(previous);
        }
    }, [step, exitToPlaces, setStep]);

    const goHome = useCallback(async () => {
        setNavBusy(true);
        try {
            await commitAndQueueRemote();
        } finally {
            setNavBusy(false);
            router.replace("/(tabs)");
        }
    }, [commitAndQueueRemote, router]);

    const goReview = useCallback(async () => {
        setNavBusy(true);
        try {
            await commitAndQueueRemote();
        } finally {
            setNavBusy(false);
        }
        router.push(`/audit/${placeId}/review`);
    }, [commitAndQueueRemote, router, placeId]);

    const goNext = useCallback(async () => {
        const { draft, instrument } = useAuditSessionStore.getState();
        if (draft === null) {
            return;
        }
        const incompleteMessage = getStepIncompleteMessage(step, draft, instrument);
        if (incompleteMessage !== null) {
            const proceed = await requestConfirm({
                title: "Some questions are still unanswered",
                message: incompleteMessage,
                confirmLabel: "Move forward",
                cancelLabel: "Stay here",
            });
            if (!proceed) {
                return;
            }
        }
        setNavBusy(true);
        try {
            await commitAndQueueRemote();
        } finally {
            setNavBusy(false);
        }
        const next = getNextStep(step);
        if (next === null) {
            router.push(`/audit/${placeId}/review`);
        } else {
            setStep(next);
        }
    }, [step, commitAndQueueRemote, router, placeId, setStep, requestConfirm]);

    // Android hardware / gesture back decrements the step (or exits on step 1)
    // instead of popping the whole audit.
    useEffect(() => {
        if (Platform.OS !== "android") {
            return;
        }
        const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
            goBack();
            return true;
        });
        return () => subscription.remove();
    }, [goBack]);

    const stackScreen = <Stack.Screen options={{ headerShown: false }} />;

    if (placeId.length === 0 || (place === null && hasLoadedPlaces)) {
        return (
            <>
                {stackScreen}
                <AuditBlockedScreen
                    title="Place not available"
                    body="This audit route is not available on this device right now. Return to the places list and refresh the assigned-place cache when you are online."
                    onBack={() => router.replace("/(tabs)/places")}
                />
            </>
        );
    }

    if (submittedAudit !== null) {
        return (
            <>
                {stackScreen}
                <AuditBlockedScreen
                    title="Audit already submitted"
                    body="This audit has been submitted and is locked for editing. Open the submitted report to review the results."
                    onBack={() => router.replace("/(tabs)/reports")}
                />
            </>
        );
    }

    if (loadPhase === "error") {
        return (
            <>
                {stackScreen}
                <AuditBlockedScreen
                    title="Survey not ready"
                    body={
                        errorMessage ??
                        "This device has not cached the full YEE survey instrument yet. Connect once online and refresh the app before continuing offline."
                    }
                    onBack={() => router.replace("/(tabs)/places")}
                    onRetry={() => void retryLoad()}
                />
            </>
        );
    }

    if (loadPhase !== "ready") {
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

    const formTrackMaxWidth = layout.isTablet ? layout.readableMaxWidth : layout.formMaxWidth;
    const footerContentWidth = getContentTrackInnerWidth(layout, formTrackMaxWidth);
    const nextLabel = step === 9 ? "Review Audit" : "Next";

    return (
        <>
            {stackScreen}
            <YStack flex={1} bg={designSystem.colors.background} style={{ paddingTop: insets.top }}>
                <AuditHeader step={step} onBack={goBack} onHome={() => void goHome()} />
                <YStack
                    py="$2"
                    style={{ borderBottomWidth: 1, borderBottomColor: designSystem.colors.border }}
                >
                    <AuditStepper
                        activeStep={step}
                        onSelect={goToStep}
                        onReview={() => void goReview()}
                    />
                </YStack>

                <AuditRowScrollContext.Provider value={rowScrollController}>
                    <KeyboardAwareScrollView
                        ref={scrollRef}
                        bottomOffset={24}
                        keyboardDismissMode="on-drag"
                        keyboardShouldPersistTaps="handled"
                        style={{ backgroundColor: designSystem.colors.background }}
                        contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                            bottomPadding: (footerHeight > 0 ? footerHeight : 96) + 32,
                        })}
                    >
                        {/* Single measurable content node: row offsets for
                            "Jump to next unanswered" are measured against this. */}
                        <View
                            ref={contentWrapperRef}
                            collapsable={false}
                            style={{ width: "100%", gap: layout.sectionGap }}
                        >
                            {errorMessage !== null ? (
                                <YStack pb="$3">
                                    <NoticeCard
                                        tone="danger"
                                        title="Sync note"
                                        body={errorMessage}
                                    />
                                </YStack>
                            ) : null}
                            <AuditStepContent step={step} />
                        </View>
                    </KeyboardAwareScrollView>
                </AuditRowScrollContext.Provider>

                <AuditFooterNav
                    busy={navBusy}
                    bottomInset={insets.bottom}
                    contentWidth={footerContentWidth}
                    onMeasure={setFooterHeight}
                    onBack={goBack}
                    onSaveExit={() => void exitToPlaces()}
                    onNext={() => void goNext()}
                    nextLabel={nextLabel}
                />
                {confirmDialog}
            </YStack>
        </>
    );
}

/** Choose the step body. Each step component subscribes to its own store slice. */
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

/**
 * Read the development-only audit step requested by screenshot automation.
 * Normal app links continue to resume from the step selected by the audit store.
 */
function parseScreenshotAuditStep(value: string | undefined): MobileYeeStepNumber | null {
    if (!__DEV__ || typeof value !== "string") {
        return null;
    }

    const step = Number(value);
    return Number.isInteger(step) && step >= 1 && step <= 9 ? (step as MobileYeeStepNumber) : null;
}

function getStepIncompleteMessage(
    step: MobileYeeStepNumber,
    draft: MobileAuditFormState,
    instrument: NormalizedInstrument | null,
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

    if (step >= 3 && step <= 8 && instrument !== null) {
        const section = getSectionForStep(instrument, step);
        if (section === null) {
            return null;
        }
        const completedCount = countAnsweredQuestions(section, draft.responses);
        const totalCount = countTotalQuestions(section);
        return completedCount === totalCount
            ? null
            : `${section.title} still has unanswered questions.`;
    }

    return null;
}
