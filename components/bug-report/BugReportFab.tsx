import { useToastController } from "@tamagui/toast";
import { Camera, Check, TriangleAlert, X } from "components/icons";
import { useGlobalSearchParams, useSegments } from "expo-router";
import { useDesignSystem } from "lib/design-system";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureScreen, releaseCapture } from "react-native-view-shot";
import { useAuthStore } from "stores/auth-store";
import {
    Button,
    Input,
    Paragraph,
    ScrollView,
    Separator,
    Sheet,
    Spinner,
    Text,
    TextArea,
    XStack,
    YStack,
} from "tamagui";

import { matchKnownIssues } from "lib/bug-report/api";
import {
    type BugReportRouteContext,
    buildMobileBugReportContext,
    isDeviceOnline,
} from "lib/bug-report/context";
import {
    clearBugReportDraft,
    readBugReportDraft,
    saveBugReportDraft,
} from "lib/bug-report/draft-storage";
import { isBugReportingEnabled } from "lib/bug-report/feature";
import { flushPendingBugReports } from "lib/bug-report/flush";
import {
    createPendingBugReportId,
    enqueueBugReport,
    persistScreenshotForQueue,
} from "lib/bug-report/queue";
import { isScreenshotUploadConfigured } from "lib/bug-report/screenshot";
import type { BugReportSeverity, KnownIssueMatch } from "lib/bug-report/types";

const SEVERITIES: readonly BugReportSeverity[] = ["blocking", "major", "minor"];

const SEVERITY_LABELS: Record<BugReportSeverity, string> = {
    blocking: "Blocking",
    major: "Major",
    minor: "Minor",
};

/** Dot color per severity, drawn from the active design-system palette. */
function severityColor(ds: ReturnType<typeof useDesignSystem>, severity: BugReportSeverity) {
    if (severity === "blocking") return ds.colors.danger;
    if (severity === "major") return ds.colors.warning;
    return ds.colors.info;
}

// Authenticated route groups where the report button is allowed to appear. Auth
// screens are intentionally excluded.
const AUTHENTICATED_GROUPS = new Set(["(tabs)", "audit", "reports", "settings"]);

// Known-issue deflection timeout (ms). Short so the auditor is not kept waiting
// when the network is slow or unavailable.
const DEFLECTION_TIMEOUT_MS = 4_000;

/**
 * Floating "Report an issue" button mounted once in the root layout. It appears
 * on every authenticated screen (never on auth) when developer mode is enabled,
 * and stays clear of the bottom tab bar.
 *
 * Reporting works fully offline: every finished report (including its screenshot)
 * is stored on-device in the local queue first. If the device is online the
 * report is sent right away; if not, it stays queued and the auditor is prompted
 * to submit it the next time the app is opened with a connection (see
 * `useBugReportFlushPrompt`). There is no background sync by design.
 */
export function BugReportFab() {
    const ds = useDesignSystem();
    const insets = useSafeAreaInsets();
    const toast = useToastController();
    const segments = useSegments();
    const params = useGlobalSearchParams<{
        placeId?: string;
        submissionId?: string;
        projectId?: string;
    }>();
    const session = useAuthStore((state) => state.session);

    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [severity, setSeverity] = useState<BugReportSeverity>("major");
    // Local file URI of the captured screen. The image is kept on-device and only
    // uploaded to Cloudinary when the queued report is flushed, so it survives
    // offline. `null` means no screenshot is attached.
    const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
    const [isAttaching, setIsAttaching] = useState(false);
    const [matches, setMatches] = useState<KnownIssueMatch[]>([]);
    const [hasCheckedMatches, setHasCheckedMatches] = useState(false);
    // True only during the brief deflection network check; the sheet closes
    // immediately after queuing so this never covers the actual send.
    const [isCheckingMatches, setIsCheckingMatches] = useState(false);

    /** Release the temporary capture file backing the current screenshot. */
    const releaseScreenshot = useCallback(() => {
        setScreenshotUri((current) => {
            if (current) {
                releaseCapture(current);
            }
            return null;
        });
    }, []);

    const captureAndAttachScreenshot = useCallback(async () => {
        if (!isScreenshotUploadConfigured()) {
            setOpen(true);
            return;
        }

        setIsAttaching(true);
        try {
            // Capture the underlying screen BEFORE the report sheet opens, so the
            // screenshot shows what the reporter was looking at, not the form. The
            // upload is deferred to submit/flush time so capture works offline.
            const capturedUri = await captureScreen({
                format: "png",
                quality: 1,
                result: "tmpfile",
            });
            setOpen(true);
            setScreenshotUri(capturedUri);
        } catch {
            // A screenshot is optional; never block the report on a capture failure.
            setOpen(true);
            toast.show("Couldn't attach the screen snapshot. You can still submit without it.");
        } finally {
            setIsAttaching(false);
        }
    }, [toast]);

    const handleOpenReport = useCallback(() => {
        setMatches([]);
        setHasCheckedMatches(false);
        releaseScreenshot();
        void captureAndAttachScreenshot();
    }, [captureAndAttachScreenshot, releaseScreenshot]);

    /** Close the sheet, discarding any not-yet-queued screenshot capture. */
    const handleSheetOpenChange = useCallback(
        (next: boolean) => {
            if (!next) {
                releaseScreenshot();
            }
            setOpen(next);
        },
        [releaseScreenshot],
    );

    // Restore any locally-saved draft when the sheet opens.
    useEffect(() => {
        if (!open) return;
        const draft = readBugReportDraft();
        if (draft) {
            setTitle(draft.title);
            setDescription(draft.description);
            setSeverity(draft.severity);
        }
    }, [open]);

    // Persist the draft as the reporter types so it survives going offline.
    useEffect(() => {
        if (!open) return;
        if (title.length === 0 && description.length === 0) return;
        saveBugReportDraft({ title, description, severity });
    }, [open, title, description, severity]);

    const segment0 = String(segments[0] ?? "");
    const isVisible =
        isBugReportingEnabled() && session !== null && AUTHENTICATED_GROUPS.has(segment0);

    const canSubmit =
        title.trim().length > 0 &&
        description.trim().length > 0 &&
        !isCheckingMatches &&
        !isAttaching;

    const resetForm = useCallback(() => {
        setMatches([]);
        setHasCheckedMatches(false);
        setIsCheckingMatches(false);
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || session === null) return;

        // Deflection: attempt once before the first real submit. No online gate -
        // the request times out quickly (DEFLECTION_TIMEOUT_MS) on a bad link and
        // falls through to queuing automatically, so the sheet never hangs.
        if (!hasCheckedMatches) {
            setIsCheckingMatches(true);
            try {
                const found = await matchKnownIssues(session, `${title} ${description}`, {
                    timeoutMs: DEFLECTION_TIMEOUT_MS,
                });
                setHasCheckedMatches(true);
                if (found.length > 0) {
                    setMatches(found);
                    setIsCheckingMatches(false);
                    return;
                }
            } catch {
                // Timeout or network error: fall through to queuing without deflection.
                setHasCheckedMatches(true);
            }
            setIsCheckingMatches(false);
        }

        // Auto-populate the audit context from navigation params.
        const routeContext: BugReportRouteContext = { route: segments.join("/") };
        if (typeof params.projectId === "string") routeContext.projectId = params.projectId;
        if (typeof params.placeId === "string") routeContext.placeId = params.placeId;
        if (typeof params.submissionId === "string")
            routeContext.submissionId = params.submissionId;

        const context = await buildMobileBugReportContext(routeContext);

        // Persist the screenshot into durable storage and enqueue the report
        // BEFORE releasing the captured image or closing the sheet, so neither can
        // be lost if the app is backgrounded mid-submit.
        const reportId = createPendingBugReportId();
        const screenshotLocalUri = screenshotUri
            ? persistScreenshotForQueue(screenshotUri, reportId)
            : undefined;
        enqueueBugReport({
            id: reportId,
            createdAt: new Date().toISOString(),
            title: title.trim(),
            description: description.trim(),
            severity,
            context,
            ...(context.project_id ? { projectId: context.project_id } : {}),
            ...(context.place_id ? { placeId: context.place_id } : {}),
            ...(context.yee_submission_id ? { submissionId: context.yee_submission_id } : {}),
            ...(screenshotLocalUri ? { screenshotLocalUri } : {}),
        });
        clearBugReportDraft();

        // Release the temporary capture file now that a durable copy exists.
        releaseScreenshot();

        // Close the sheet immediately - the auditor is not kept waiting while the
        // send happens.
        setTitle("");
        setDescription("");
        setSeverity("major");
        resetForm();
        setOpen(false);

        // Best-effort connectivity check for toast wording only. The flush proceeds
        // regardless (single-flight; deduplicates concurrent callers).
        const online = await isDeviceOnline();
        toast.show(
            online
                ? "Your report is saved on this device. We'll send it now."
                : "You're offline. Your report is saved on this device - we'll prompt you to send it when you're back online.",
        );

        // Drain the queue in the background. Errors are swallowed here; the report
        // is already queued and will be retried on the next flush prompt.
        void flushPendingBugReports(session);
    }, [
        canSubmit,
        description,
        hasCheckedMatches,
        params.placeId,
        params.projectId,
        params.submissionId,
        releaseScreenshot,
        resetForm,
        screenshotUri,
        segments,
        session,
        severity,
        title,
        toast,
    ]);

    const submitLabel = useMemo(
        () => (hasCheckedMatches && matches.length > 0 ? "Submit anyway" : "Submit report"),
        [hasCheckedMatches, matches.length],
    );

    if (!isVisible) {
        return null;
    }

    return (
        <>
            <YStack position="absolute" r="$4" b={insets.bottom + 88} z={50}>
                <Button
                    size="$4"
                    circular
                    bg={ds.colors.primary}
                    icon={<TriangleAlert size={20} color={ds.colors.primaryForeground} />}
                    onPress={handleOpenReport}
                    pressStyle={{ opacity: 0.9, scale: 0.97 }}
                    style={{ boxShadow: ds.shadows.elevated }}
                    accessibilityLabel="Report an issue"
                />
            </YStack>
            <Sheet
                modal
                open={open}
                onOpenChange={handleSheetOpenChange}
                snapPoints={[90]}
                snapPointsMode="percent"
                dismissOnSnapToBottom
                zIndex={100_000}
            >
                <Sheet.Overlay opacity={0.5} />
                <Sheet.Frame
                    bg={ds.colors.background}
                    p="$4"
                    gap="$3"
                    borderTopLeftRadius={ds.radii.lg}
                    borderTopRightRadius={ds.radii.lg}
                >
                    <Sheet.Handle bg={ds.colors.border} />
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <YStack gap="$4" pb={insets.bottom + 16}>
                            <XStack gap="$3" items="center">
                                <YStack
                                    width={40}
                                    height={40}
                                    rounded={ds.radii.full}
                                    bg={ds.colors.primarySoft}
                                    items="center"
                                    justify="center"
                                >
                                    <TriangleAlert size={20} color={ds.colors.primary} />
                                </YStack>
                                <YStack flex={1} gap="$1">
                                    <Text
                                        fontFamily={ds.fonts.headingBold}
                                        fontSize={20}
                                        color={ds.colors.foreground}
                                    >
                                        Report an issue
                                    </Text>
                                    <Paragraph
                                        fontFamily={ds.fonts.bodyMedium}
                                        fontSize={13}
                                        color={ds.colors.mutedForeground}
                                    >
                                        Tell us what went wrong. We attach your app version and
                                        device details automatically - never your audit answers.
                                    </Paragraph>
                                </YStack>
                            </XStack>

                            <Separator borderColor={ds.colors.border} />

                            <YStack gap="$1.5">
                                <Text fontFamily={ds.fonts.bodyMedium} color={ds.colors.foreground}>
                                    What happened?
                                </Text>
                                <Input
                                    value={title}
                                    maxLength={200}
                                    placeholder="Short summary of the problem"
                                    onChangeText={setTitle}
                                />
                            </YStack>

                            <YStack gap="$1.5">
                                <Text fontFamily={ds.fonts.bodyMedium} color={ds.colors.foreground}>
                                    Describe the problem
                                </Text>
                                <TextArea
                                    value={description}
                                    maxLength={5000}
                                    numberOfLines={5}
                                    placeholder="What did you expect, and what happened instead?"
                                    onChangeText={setDescription}
                                />
                            </YStack>

                            <YStack gap="$1.5">
                                <Text fontFamily={ds.fonts.bodyMedium} color={ds.colors.foreground}>
                                    How much does it block you?
                                </Text>
                                <XStack gap="$2">
                                    {SEVERITIES.map((value) => {
                                        const selected = severity === value;
                                        return (
                                            <Button
                                                key={value}
                                                flex={1}
                                                height={48}
                                                rounded={ds.radii.button}
                                                borderWidth={1}
                                                borderColor={
                                                    selected ? ds.colors.primary : ds.colors.border
                                                }
                                                bg={
                                                    selected
                                                        ? ds.colors.primarySoft
                                                        : ds.colors.surface
                                                }
                                                onPress={() => setSeverity(value)}
                                                pressStyle={{ opacity: 0.7 }}
                                                accessibilityLabel={SEVERITY_LABELS[value]}
                                            >
                                                <XStack gap="$2" items="center">
                                                    <YStack
                                                        width={8}
                                                        height={8}
                                                        rounded={ds.radii.full}
                                                        bg={severityColor(ds, value)}
                                                    />
                                                    <Text
                                                        fontFamily={
                                                            selected
                                                                ? ds.fonts.bodyBold
                                                                : ds.fonts.bodyMedium
                                                        }
                                                        fontSize={13}
                                                        color={
                                                            selected
                                                                ? ds.colors.primary
                                                                : ds.colors.foreground
                                                        }
                                                    >
                                                        {SEVERITY_LABELS[value]}
                                                    </Text>
                                                </XStack>
                                            </Button>
                                        );
                                    })}
                                </XStack>
                            </YStack>

                            {isScreenshotUploadConfigured() ? (
                                <YStack gap="$2">
                                    <XStack justify="space-between" items="center" px="$1">
                                        <Text
                                            fontFamily={ds.fonts.bodyMedium}
                                            color={ds.colors.foreground}
                                        >
                                            Screen snapshot
                                        </Text>
                                        {screenshotUri ? (
                                            <XStack
                                                gap="$1.5"
                                                items="center"
                                                flex={1}
                                                justify="flex-end"
                                                pl="$2"
                                            >
                                                <Check size={14} color={ds.colors.success} />
                                                <Text
                                                    fontSize={12}
                                                    color={ds.colors.success}
                                                    flex={1}
                                                    numberOfLines={2}
                                                    style={{ flexShrink: 1 }}
                                                >
                                                    A snapshot of this screen is attached.
                                                </Text>
                                            </XStack>
                                        ) : null}
                                    </XStack>

                                    {isAttaching ? (
                                        <XStack
                                            height={64}
                                            rounded={ds.radii.md}
                                            borderWidth={1}
                                            borderColor={ds.colors.border}
                                            bg={ds.colors.surfaceMuted}
                                            items="center"
                                            justify="center"
                                            gap="$2"
                                            px="$3"
                                        >
                                            <Spinner size="small" color={ds.colors.primary} />
                                            <Text
                                                fontSize={12}
                                                color={ds.colors.mutedForeground}
                                                flex={1}
                                                numberOfLines={2}
                                            >
                                                Attaching a snapshot of this screen automatically.
                                            </Text>
                                        </XStack>
                                    ) : screenshotUri ? (
                                        <YStack
                                            rounded={ds.radii.md}
                                            overflow="hidden"
                                            borderWidth={1}
                                            borderColor={ds.colors.border}
                                        >
                                            <Image
                                                source={{ uri: screenshotUri }}
                                                style={{ width: "100%", height: 180 }}
                                                resizeMode="cover"
                                            />
                                            <Button
                                                position="absolute"
                                                t="$2"
                                                r="$2"
                                                size="$2"
                                                circular
                                                style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
                                                icon={<X size={16} color="#fff" />}
                                                onPress={releaseScreenshot}
                                                accessibilityLabel="Remove screenshot"
                                            />
                                        </YStack>
                                    ) : (
                                        <XStack
                                            height={64}
                                            rounded={ds.radii.md}
                                            borderWidth={1}
                                            borderColor={ds.colors.border}
                                            bg={ds.colors.surfaceMuted}
                                            items="center"
                                            justify="center"
                                            gap="$2"
                                            px="$3"
                                        >
                                            <Camera size={16} color={ds.colors.mutedForeground} />
                                            <Text
                                                fontSize={12}
                                                color={ds.colors.mutedForeground}
                                                flex={1}
                                                numberOfLines={2}
                                            >
                                                No snapshot attached.
                                            </Text>
                                        </XStack>
                                    )}
                                    <Paragraph fontSize={11} color={ds.colors.mutedForeground}>
                                        We attach a picture of your current screen. Remove it if it
                                        shows anything sensitive.
                                    </Paragraph>
                                </YStack>
                            ) : null}

                            {matches.length > 0 ? (
                                <YStack
                                    gap="$2"
                                    borderColor={ds.colors.border}
                                    borderWidth={1}
                                    rounded={ds.radii.md}
                                    p="$3"
                                >
                                    <Text
                                        fontFamily={ds.fonts.bodySemiBold}
                                        color={ds.colors.foreground}
                                    >
                                        These known issues might match - check them first
                                    </Text>
                                    {matches.map((match) => (
                                        <YStack key={match.id} gap="$1">
                                            <Text
                                                fontFamily={ds.fonts.bodySemiBold}
                                                color={ds.colors.foreground}
                                            >
                                                {match.title}
                                            </Text>
                                            <Paragraph color={ds.colors.mutedForeground}>
                                                {match.symptoms}
                                            </Paragraph>
                                            {match.workaround ? (
                                                <Paragraph color={ds.colors.foreground}>
                                                    Workaround: {match.workaround}
                                                </Paragraph>
                                            ) : null}
                                            <Separator borderColor={ds.colors.border} mb="$1" />
                                        </YStack>
                                    ))}
                                </YStack>
                            ) : null}

                            <YStack gap="$2" mt="$2">
                                <Button
                                    testID="bug-report-submit"
                                    height={50}
                                    rounded={ds.radii.button}
                                    disabled={!canSubmit}
                                    opacity={canSubmit ? 1 : 0.5}
                                    bg={ds.colors.primary}
                                    onPress={handleSubmit}
                                    pressStyle={{ opacity: 0.85 }}
                                >
                                    {isCheckingMatches ? (
                                        <XStack gap="$2" items="center">
                                            <Spinner
                                                size="small"
                                                color={ds.colors.primaryForeground}
                                            />
                                            <Text
                                                fontFamily={ds.fonts.bodyBold}
                                                color={ds.colors.primaryForeground}
                                            >
                                                Checking…
                                            </Text>
                                        </XStack>
                                    ) : (
                                        <Text
                                            fontFamily={ds.fonts.bodyBold}
                                            color={ds.colors.primaryForeground}
                                        >
                                            {submitLabel}
                                        </Text>
                                    )}
                                </Button>
                                <Button
                                    height={44}
                                    chromeless
                                    onPress={() => handleSheetOpenChange(false)}
                                >
                                    <Text color={ds.colors.mutedForeground}>Cancel</Text>
                                </Button>
                            </YStack>
                        </YStack>
                    </ScrollView>
                </Sheet.Frame>
            </Sheet>
        </>
    );
}
