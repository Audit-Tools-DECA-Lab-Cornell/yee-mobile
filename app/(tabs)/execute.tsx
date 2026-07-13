import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { CheckCircle2, FileBarChart, Search, X } from "components/icons";
import { Button, XStack, YStack } from "tamagui";
import {
    Card,
    FieldInput,
    ScaledParagraph as Paragraph,
    ScaledText as Text,
    ScreenHeader,
} from "components/ui";
import { AssignedPlaceCard } from "components/AssignedPlaceCard";
import { getScoreBandTone, useDesignSystem } from "lib/design-system";
import { toScorePercentage } from "lib/yee-mobile-reporting";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import {
    buildMobileAuditProjection,
    getSubmissionSyncLabel,
    getSubmissionTimestampLabel,
} from "lib/yee-mobile-selectors";
import type { YeeMyAuditItem } from "lib/yee-types";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

type ExecuteTab = "todo" | "submitted";

/**
 * Execution tab. Two segments: "To do" browses every not-yet-submitted audit to
 * start or continue (like the Places tab), and "Submitted" lists finished audits
 * that open read-only. A search bar filters the active segment.
 */
export default function ExecuteScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const [tab, setTab] = useState<ExecuteTab>("todo");
    const [query, setQuery] = useState("");

    const selectedPlaceId = useSelectionStore((state) => state.selectedPlaceId);
    const setSelectedPlaceId = useSelectionStore((state) => state.setSelectedPlaceId);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const {
        assignedPlaces,
        submittedAudits,
        draftsByPlace,
        syncQueue,
        isOnline,
        isOfflineReady,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    } = useYeeMobileStore(
        useShallow((state) => ({
            assignedPlaces: state.assignedPlaces,
            submittedAudits: state.submittedAudits,
            draftsByPlace: state.draftsByPlace,
            syncQueue: state.syncQueue,
            isOnline: state.isOnline,
            isOfflineReady: state.isOfflineReady,
            hasCachedAssignedPlaces: state.hasCachedAssignedPlaces,
            hasCachedInstrument: state.hasCachedInstrument,
        })),
    );

    const projection = useMemo(
        () =>
            buildMobileAuditProjection({
                assignedPlaces,
                draftsByPlace,
                submittedAudits,
                syncQueue,
                selectedPlaceId,
            }),
        [assignedPlaces, draftsByPlace, submittedAudits, syncQueue, selectedPlaceId],
    );

    const executablePlaceViews = useMemo(
        () => projection.placeViews.filter((view) => view.status !== "submitted"),
        [projection.placeViews],
    );
    const submittedReports = projection.sortedReports;

    const normalizedQuery = query.trim().toLowerCase();
    const filteredTodo = useMemo(() => {
        if (normalizedQuery.length === 0) {
            return executablePlaceViews;
        }
        return executablePlaceViews.filter((view) =>
            `${view.place.name} ${view.place.project} ${view.place.address}`
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [executablePlaceViews, normalizedQuery]);
    const filteredSubmitted = useMemo(() => {
        if (normalizedQuery.length === 0) {
            return submittedReports;
        }
        return submittedReports.filter((audit) =>
            audit.place_name.toLowerCase().includes(normalizedQuery),
        );
    }, [submittedReports, normalizedQuery]);

    const offlineReadinessMessage = getOfflineReadinessMessage({
        hasOfflineLoginCredentials,
        hasCachedAssignedPlaces,
        hasCachedInstrument,
    });
    const scrollToOffset = useCallback((offset: number) => {
        scrollViewRef.current?.scrollTo({ y: offset, animated: false });
    }, []);

    useScreenshotScrollAutomation({
        contentReady: true,
        rerunKey: `${tab}:${normalizedQuery}:${filteredTodo.length}:${filteredSubmitted.length}`,
        scrollToOffset,
    });

    const openAuditForPlace = useCallback(
        (placeId: string) => {
            if (!isOnline && !isOfflineReady) {
                Alert.alert("Offline setup incomplete", offlineReadinessMessage);
                return;
            }
            router.push(`/audit/${placeId}`);
        },
        [isOnline, isOfflineReady, offlineReadinessMessage, router],
    );

    const viewSubmittedAudit = useCallback(
        (audit: YeeMyAuditItem) => {
            setSelectedPlaceId(audit.place_id);
            router.push(`/audit/${audit.place_id}/view?submissionId=${audit.id}`);
        },
        [router, setSelectedPlaceId],
    );

    return (
        <ScrollView
            ref={scrollViewRef}
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                bottomPadding: 132,
                gap: layout.sectionGap,
                // Content-light detail: cap at the readable column so it centers
                // instead of stretching to the full content track on tablet.
                maxWidth: layout.readableMaxWidth,
            })}
        >
            <ScreenHeader
                title="Execute"
                subtitle="Start or continue an audit, or review one you've submitted."
            />

            <SegmentedToggle
                tab={tab}
                todoCount={executablePlaceViews.length}
                submittedCount={submittedReports.length}
                onChange={setTab}
            />

            <FieldInput
                value={query}
                onChangeText={setQuery}
                placeholder={
                    tab === "todo" ? "Search audits to work on" : "Search submitted audits"
                }
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                leadingIcon={<Search size={18} color={designSystem.colors.mutedForeground} />}
                trailingAccessory={
                    query.length > 0 ? (
                        <YStack
                            p="$1"
                            cursor="pointer"
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                            pressStyle={{ opacity: 0.6 }}
                            onPress={() => setQuery("")}
                        >
                            <X size={16} color={designSystem.colors.mutedForeground} />
                        </YStack>
                    ) : undefined
                }
            />

            {tab === "todo" ? (
                <TodoList
                    views={filteredTodo}
                    hasAnyExecutable={executablePlaceViews.length > 0}
                    hasAnyPlaces={projection.placeViews.length > 0}
                    hasQuery={normalizedQuery.length > 0}
                    onStart={(placeId) => {
                        setSelectedPlaceId(placeId);
                        openAuditForPlace(placeId);
                    }}
                    onGoSubmitted={() => setTab("submitted")}
                />
            ) : (
                <SubmittedList
                    audits={filteredSubmitted}
                    hasAny={submittedReports.length > 0}
                    hasQuery={normalizedQuery.length > 0}
                    selectedPlaceId={selectedPlaceId}
                    onView={viewSubmittedAudit}
                />
            )}
        </ScrollView>
    );
}

interface SegmentedToggleProps {
    readonly tab: ExecuteTab;
    readonly todoCount: number;
    readonly submittedCount: number;
    readonly onChange: (tab: ExecuteTab) => void;
}

function SegmentedToggle({ tab, todoCount, submittedCount, onChange }: SegmentedToggleProps) {
    const designSystem = useDesignSystem();
    return (
        <XStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surfaceMuted}
            p="$1"
            gap="$1"
        >
            <SegmentButton
                label={`To do (${todoCount})`}
                active={tab === "todo"}
                onPress={() => onChange("todo")}
            />
            <SegmentButton
                label={`Submitted (${submittedCount})`}
                active={tab === "submitted"}
                onPress={() => onChange("submitted")}
            />
        </XStack>
    );
}

function SegmentButton({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const designSystem = useDesignSystem();
    return (
        <Button
            flex={1}
            rounded={designSystem.radii.button}
            bg={active ? designSystem.colors.surface : "transparent"}
            borderWidth={0}
            pressStyle={{ opacity: 0.92 }}
            accessibilityState={{ selected: active }}
            onPress={onPress}
            style={active ? { boxShadow: designSystem.shadows.card } : undefined}
        >
            <Button.Text
                color={
                    active ? designSystem.colors.foreground : designSystem.colors.mutedForeground
                }
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={14}
            >
                {label}
            </Button.Text>
        </Button>
    );
}

interface TodoListProps {
    readonly views: ReturnType<typeof buildMobileAuditProjection>["placeViews"];
    readonly hasAnyExecutable: boolean;
    readonly hasAnyPlaces: boolean;
    readonly hasQuery: boolean;
    readonly onStart: (placeId: string) => void;
    readonly onGoSubmitted: () => void;
}

function TodoList({
    views,
    hasAnyExecutable,
    hasAnyPlaces,
    hasQuery,
    onStart,
    onGoSubmitted,
}: TodoListProps) {
    const designSystem = useDesignSystem();

    // Nothing left to start: show the "all caught up" banner (replacing the old
    // dead-end empty screen). Submitted audits stay reachable via the toggle.
    if (!hasAnyExecutable) {
        if (!hasAnyPlaces) {
            return (
                <EmptyCard
                    title="No assigned places yet"
                    body="Once a manager assigns places to you, they will appear here ready for offline audit capture."
                />
            );
        }
        return (
            <YStack
                rounded={designSystem.radii.lg}
                borderWidth={1}
                borderColor={designSystem.colors.success}
                bg={designSystem.colors.successSoft}
                p="$4"
                gap="$3"
            >
                <XStack items="center" gap="$2.5">
                    <CheckCircle2 size={18} color={designSystem.colors.successText} />
                    <Text
                        style={{ color: designSystem.colors.successText }}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={15}
                    >
                        You&apos;re all caught up
                    </Text>
                </XStack>
                <Paragraph
                    color={designSystem.colors.secondaryForeground}
                    fontFamily={designSystem.fonts.bodyMedium}
                >
                    Every assigned audit on this device has been submitted. Submitted audits are
                    locked for editing — open the Submitted tab to review them.
                </Paragraph>
                <Button
                    rounded={designSystem.radii.button}
                    bg={designSystem.colors.surface}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    onPress={onGoSubmitted}
                    style={{ alignSelf: "flex-start" }}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        View submitted audits
                    </Button.Text>
                </Button>
            </YStack>
        );
    }

    if (views.length === 0 && hasQuery) {
        return <NoMatchesCard />;
    }

    return (
        <YStack gap="$3">
            {views.map((view) => (
                <AssignedPlaceCard
                    key={view.place.id}
                    view={view}
                    onPress={() => onStart(view.place.id)}
                />
            ))}
        </YStack>
    );
}

interface SubmittedListProps {
    readonly audits: ReturnType<typeof buildMobileAuditProjection>["sortedReports"];
    readonly hasAny: boolean;
    readonly hasQuery: boolean;
    readonly selectedPlaceId: string;
    readonly onView: (audit: YeeMyAuditItem) => void;
}

function SubmittedList({ audits, hasAny, hasQuery, selectedPlaceId, onView }: SubmittedListProps) {
    if (!hasAny) {
        return (
            <EmptyCard
                title="No submitted audits yet"
                body="Audits you submit will appear here so you can review them in read-only mode."
            />
        );
    }

    if (audits.length === 0 && hasQuery) {
        return <NoMatchesCard />;
    }

    return (
        <YStack gap="$3">
            {audits.map((audit) => (
                <SubmittedAuditCard
                    key={audit.id}
                    audit={audit}
                    highlighted={audit.place_id === selectedPlaceId}
                    onView={() => onView(audit)}
                />
            ))}
        </YStack>
    );
}

function SubmittedAuditCard({
    audit,
    highlighted,
    onView,
}: {
    audit: YeeMyAuditItem;
    highlighted: boolean;
    onView: () => void;
}) {
    const designSystem = useDesignSystem();
    const isPending = audit.syncState === "pending_upload" || audit.syncState === "sync_failed";
    const percentage = toScorePercentage(audit.total_score);

    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={highlighted ? designSystem.colors.success : designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$3"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <XStack justify="space-between" items="flex-start" gap="$3">
                <YStack flex={1} gap="$1">
                    <Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={16}
                    >
                        {audit.place_name}
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                        fontSize={12}
                    >
                        {getSubmissionTimestampLabel(audit)}
                    </Paragraph>
                </YStack>
                <YStack items="flex-end" gap="$0.5">
                    <Text
                        style={{
                            color: isPending
                                ? designSystem.colors.warningText
                                : getScoreBandTone(percentage, designSystem.scoreBands).text,
                        }}
                        fontFamily={designSystem.fonts.headingBold}
                        fontSize={20}
                    >
                        {percentage}%
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                        fontSize={12}
                    >
                        {getSubmissionSyncLabel(audit)}
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
                    bg={highlighted ? designSystem.colors.success : designSystem.colors.primary}
                    width={`${percentage}%`}
                />
            </YStack>

            <Button
                rounded={designSystem.radii.button}
                bg={designSystem.colors.surfaceMuted}
                borderWidth={1}
                borderColor={designSystem.colors.border}
                pressStyle={{ opacity: 0.92, scale: 0.985 }}
                icon={<FileBarChart size={16} color={designSystem.colors.foreground} />}
                onPress={onView}
            >
                <Button.Text
                    color={designSystem.colors.foreground}
                    fontFamily={designSystem.fonts.bodyBold}
                >
                    View audit
                </Button.Text>
            </Button>
        </YStack>
    );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
    const designSystem = useDesignSystem();
    return (
        <Card gap="$2.5">
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
            >
                {title}
            </Text>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                {body}
            </Paragraph>
        </Card>
    );
}

function NoMatchesCard() {
    const designSystem = useDesignSystem();
    return (
        <Card gap="$2">
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={15}
            >
                No matches
            </Text>
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyMedium}
            >
                No audits match your search. Try a different place name.
            </Paragraph>
        </Card>
    );
}
