import { useCallback, useMemo, useRef } from "react";
import { Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { XStack, YStack } from "tamagui";
import { AssignedPlaceCard } from "components/AssignedPlaceCard";
import { ScaledParagraph as Paragraph, ScaledText as Text, ScreenHeader } from "components/ui";
import { useDesignSystem } from "lib/design-system";
import { getResponsiveContentContainerStyle, useResponsiveLayout } from "lib/responsive-layout";
import { useScreenshotScrollAutomation } from "lib/screenshot-automation";
import { getOfflineReadinessMessage } from "lib/yee-offline-readiness";
import { buildMobileAuditProjection } from "lib/yee-mobile-selectors";
import { useAuthStore } from "stores/auth-store";
import { useSelectionStore } from "stores/selection-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Assigned places tab for auditor field execution.
 */
export default function PlacesScreen() {
    const designSystem = useDesignSystem();
    const layout = useResponsiveLayout();
    const router = useRouter();
    const scrollViewRef = useRef<ScrollView>(null);
    const setSelectedPlaceId = useSelectionStore((state) => state.setSelectedPlaceId);
    const hasOfflineLoginCredentials = useAuthStore((state) => state.hasOfflineLoginCredentials);
    const { assignedPlaces, submittedAudits, draftsByPlace, syncQueue, isOnline } =
        useYeeMobileStore(
            useShallow((state) => ({
                assignedPlaces: state.assignedPlaces,
                submittedAudits: state.submittedAudits,
                draftsByPlace: state.draftsByPlace,
                syncQueue: state.syncQueue,
                isOnline: state.isOnline,
            })),
        );
    const hasCachedAssignedPlaces = useYeeMobileStore((state) => state.hasCachedAssignedPlaces);
    const hasCachedInstrument = useYeeMobileStore((state) => state.hasCachedInstrument);
    const isOfflineReady = useYeeMobileStore((state) => state.isOfflineReady);

    const projection = useMemo(
        () =>
            buildMobileAuditProjection({
                assignedPlaces,
                draftsByPlace,
                submittedAudits,
                syncQueue,
            }),
        [assignedPlaces, draftsByPlace, submittedAudits, syncQueue],
    );
    const placeViews = projection.placeViews;
    const summary = projection.summary;
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
        rerunKey: placeViews.length,
        scrollToOffset,
    });

    return (
        <ScrollView
            ref={scrollViewRef}
            contentInsetAdjustmentBehavior="automatic"
            style={{ backgroundColor: designSystem.colors.background }}
            contentContainerStyle={getResponsiveContentContainerStyle(layout, {
                bottomPadding: 132,
                gap: layout.sectionGap,
            })}
        >
            <YStack gap="$6">
                <ScreenHeader
                    title="My Audits"
                    subtitle="Your assigned places and their audit status."
                />

                <XStack gap="$3" flexWrap="wrap">
                    <SummaryTile label="Drafts" value={summary.draftCount} tone="draft" />
                    <SummaryTile
                        label="Submitted"
                        value={summary.submittedCount}
                        tone="submitted"
                    />
                    <SummaryTile label="Queued" value={summary.pendingSyncCount} tone="queued" />
                </XStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={
                        isOfflineReady ? designSystem.colors.success : designSystem.colors.warning
                    }
                    bg={
                        isOfflineReady
                            ? designSystem.colors.successSoft
                            : designSystem.colors.warningSoft
                    }
                    p="$3.5"
                    gap="$2"
                >
                    <Paragraph
                        color={
                            isOfflineReady
                                ? designSystem.colors.success
                                : designSystem.colors.warning
                        }
                        fontFamily={designSystem.fonts.bodyBold}
                        fontSize={12}
                        textTransform="uppercase"
                        letterSpacing={1.1}
                    >
                        {isOfflineReady ? "Ready for offline use" : "Online sync needed"}
                    </Paragraph>
                    <Paragraph
                        color={designSystem.colors.secondaryForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {isOfflineReady
                            ? "This device can capture audits without an internet connection."
                            : "Sign in once while online to prepare for offline field work."}
                    </Paragraph>
                </YStack>
            </YStack>

            <YStack gap="$3">
                {placeViews.length === 0 ? (
                    <EmptyStateCard
                        title="No assigned places yet"
                        body="Once a manager assigns places to this auditor, they will appear here and stay available for offline audit capture."
                    />
                ) : (
                    placeViews.map((view) => (
                        <AssignedPlaceCard
                            key={view.place.id}
                            view={view}
                            onPress={() => {
                                setSelectedPlaceId(view.place.id);
                                if (view.status === "submitted") {
                                    if (view.submission !== null) {
                                        router.push(`/reports/${view.submission.id}`);
                                        return;
                                    }
                                    router.push("/(tabs)/reports");
                                    return;
                                }
                                openAuditForPlace(view.place.id);
                            }}
                        />
                    ))
                )}
            </YStack>
        </ScrollView>
    );

    function openAuditForPlace(placeId: string) {
        if (!isOnline && !isOfflineReady) {
            Alert.alert("Offline setup incomplete", offlineReadinessMessage);
            return;
        }

        router.push(`/audit/${placeId}`);
    }
}

interface SummaryTileProps {
    readonly label: string;
    readonly value: number;
    readonly tone: "draft" | "submitted" | "queued";
}

function SummaryTile({ label, value, tone }: SummaryTileProps) {
    const designSystem = useDesignSystem();
    const palette =
        tone === "submitted"
            ? {
                  accent: designSystem.colors.success,
                  surface: designSystem.colors.successSoft,
                  text: designSystem.colors.success,
              }
            : tone === "queued"
              ? {
                    accent: designSystem.colors.warning,
                    surface: designSystem.colors.warningSoft,
                    text: designSystem.colors.warning,
                }
              : {
                    accent: designSystem.colors.primary,
                    surface: designSystem.colors.primarySoft,
                    text: designSystem.colors.primary,
                };

    return (
        <YStack
            flex={1}
            style={{ minWidth: 102, boxShadow: designSystem.shadows.card }}
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={palette.accent}
            bg={palette.surface}
            p="$3"
            gap="$1.5"
        >
            <YStack
                rounded={designSystem.radii.full}
                px="$2.5"
                py="$1"
                style={{
                    alignSelf: "flex-start",
                    backgroundColor: designSystem.colors.surface,
                }}
            >
                <Paragraph
                    style={{ color: palette.text }}
                    fontFamily={designSystem.fonts.bodyBold}
                    fontSize={10}
                    textTransform="uppercase"
                    letterSpacing={1.1}
                >
                    {label}
                </Paragraph>
            </YStack>
            <Text
                color={palette.text}
                fontFamily={designSystem.fonts.headingBold}
                fontSize={26}
                lineHeight={28}
            >
                {value.toString()}
            </Text>
        </YStack>
    );
}

interface EmptyStateCardProps {
    readonly title: string;
    readonly body: string;
}

function EmptyStateCard({ title, body }: EmptyStateCardProps) {
    const designSystem = useDesignSystem();
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$2.5"
        >
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
        </YStack>
    );
}
