import { useMemo } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheckBig, CloudOff, Save, Send, TriangleAlert } from "@tamagui/lucide-icons";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { designSystem, getPlaceStatusTone } from "lib/design-system";
import { buildPlaceViews, getStatusLabel } from "lib/yee-mobile-selectors";
import { useDemoUiStore } from "stores/demo-ui-store";
import { useYeeMobileStore } from "stores/yee-mobile-store";

/**
 * Execution tab that now reflects the real assigned-place selection and offline draft state.
 */
export default function ExecuteScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const selectedPlaceId = useDemoUiStore((state) => state.selectedPlaceId);
    const { assignedPlaces, submittedAudits, draftsByPlace, syncQueue } = useYeeMobileStore(
        (state) => ({
            assignedPlaces: state.assignedPlaces,
            submittedAudits: state.submittedAudits,
            draftsByPlace: state.draftsByPlace,
            syncQueue: state.syncQueue,
        }),
    );

    const placeViews = useMemo(
        () => buildPlaceViews(assignedPlaces, draftsByPlace, submittedAudits),
        [assignedPlaces, draftsByPlace, submittedAudits],
    );
    const activePlaceView = useMemo(() => {
        return (
            placeViews.find((view) => view.place.id === selectedPlaceId) ?? placeViews[0] ?? null
        );
    }, [placeViews, selectedPlaceId]);

    if (activePlaceView === null) {
        return (
            <YStack flex={1} bg={designSystem.colors.background} px="$4" py="$6" justify="center">
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
                        Select a place to begin
                    </Text>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        Assigned places will appear here once the auditor has been synced from the
                        YEE backend.
                    </Paragraph>
                </YStack>
            </YStack>
        );
    }

    const tone = getPlaceStatusTone(mapStatusToPlaceTone(activePlaceView.status));
    const placeScore =
        activePlaceView.submission?.total_score ??
        activePlaceView.draft?.scorePreview?.total_score ??
        null;

    return (
        <YStack flex={1} bg={designSystem.colors.background}>
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                style={{ backgroundColor: designSystem.colors.background }}
                contentContainerStyle={{
                    paddingHorizontal: designSystem.spacing.screenPaddingHorizontal,
                    paddingTop: designSystem.spacing.screenPaddingVertical,
                    gap: 20,
                    paddingBottom: insets.bottom + 116,
                }}
            >
                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    p="$4"
                    gap="$3"
                    style={{ boxShadow: designSystem.shadows.card }}
                >
                    <XStack justify="space-between" items="center">
                        <YStack
                            rounded={designSystem.radii.sm}
                            px="$2"
                            py="$1"
                            bg={designSystem.colors.surfaceMuted}
                        >
                            <Text
                                color={designSystem.colors.warning}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                Mobile audit workspace
                            </Text>
                        </YStack>
                        <YStack
                            rounded={designSystem.radii.full}
                            px="$3"
                            py="$1"
                            style={{ backgroundColor: tone.surface }}
                        >
                            <Text
                                style={{ color: tone.text }}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={10}
                                textTransform="uppercase"
                                letterSpacing={1.2}
                            >
                                {getStatusLabel(activePlaceView.status)}
                            </Text>
                        </YStack>
                    </XStack>

                    <YStack gap="$1">
                        <Text
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.monoBold}
                            fontSize={12}
                            textTransform="uppercase"
                            letterSpacing={1.1}
                        >
                            {activePlaceView.place.project}
                        </Text>
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.headingBold}
                            fontSize={28}
                            lineHeight={32}
                        >
                            {activePlaceView.place.name}
                        </Text>
                        <Paragraph
                            color={designSystem.colors.mutedForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            {activePlaceView.place.address}
                        </Paragraph>
                    </YStack>

                    <Paragraph
                        fontFamily={designSystem.fonts.bodyBold}
                        style={{ color: tone.text }}
                    >
                        {activePlaceView.syncLabel}
                    </Paragraph>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        {activePlaceView.latestActivityLabel}
                    </Paragraph>
                </YStack>

                <YStack gap="$3">
                    <InfoCard
                        label="Backend audits logged"
                        value={activePlaceView.place.audits.toString()}
                    />
                    <InfoCard
                        label="Draft sync queue"
                        value={`${syncQueue.filter((item) => item.placeId === activePlaceView.place.id).length} pending`}
                    />
                    <InfoCard
                        label="Latest known score"
                        value={
                            placeScore === null ? "Not scored yet" : `${placeScore}% total score`
                        }
                    />
                </YStack>

                <YStack
                    rounded={designSystem.radii.lg}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    bg={designSystem.colors.surface}
                    p="$4"
                    gap="$3"
                    style={{ boxShadow: designSystem.shadows.card }}
                >
                    <XStack items="center" gap="$2.5">
                        <CloudOff size={15} color={designSystem.colors.primary} />
                        <Text
                            color={designSystem.colors.foreground}
                            fontFamily={designSystem.fonts.bodyBold}
                            fontSize={15}
                        >
                            Offline audit capture is ready
                        </Text>
                    </XStack>
                    <Paragraph
                        color={designSystem.colors.mutedForeground}
                        fontFamily={designSystem.fonts.bodyMedium}
                    >
                        This place is ready for the full YEE mobile survey workflow. Draft responses
                        are saved locally, and queued changes can sync back to the backend when
                        connectivity returns.
                    </Paragraph>
                    <YStack
                        rounded={designSystem.radii.md}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.input}
                        p="$3"
                        gap="$2.5"
                    >
                        <XStack items="center" gap="$2">
                            <CircleCheckBig size={14} color={designSystem.colors.success} />
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                Selected place comes from the real assigned-place cache
                            </Paragraph>
                        </XStack>
                        <XStack items="center" gap="$2">
                            <CircleCheckBig size={14} color={designSystem.colors.success} />
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                Draft and submitted status come from the shared offline YEE store
                            </Paragraph>
                        </XStack>
                        <XStack items="center" gap="$2">
                            <TriangleAlert size={14} color={designSystem.colors.warning} />
                            <Paragraph
                                color={designSystem.colors.secondaryForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                Survey steps, local draft storage, and queued submission sync are
                                active for this place
                            </Paragraph>
                        </XStack>
                    </YStack>
                </YStack>
            </ScrollView>

            <XStack
                position="absolute"
                gap="$3"
                style={{
                    left: designSystem.spacing.screenPaddingHorizontal,
                    right: designSystem.spacing.screenPaddingHorizontal,
                    bottom: insets.bottom + 16,
                }}
            >
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.surfaceMuted}
                    borderWidth={1}
                    borderColor={designSystem.colors.border}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    icon={<Save size={16} color={designSystem.colors.foreground} />}
                    onPress={() => router.push(`/audit/${activePlaceView.place.id}/1`)}
                >
                    <Button.Text
                        color={designSystem.colors.foreground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Open YEE survey
                    </Button.Text>
                </Button>
                <Button
                    flex={1}
                    rounded={designSystem.radii.full}
                    bg={designSystem.colors.primary}
                    borderWidth={1}
                    borderColor={designSystem.colors.primary}
                    pressStyle={{ opacity: 0.92, scale: 0.985 }}
                    icon={<Send size={16} color={designSystem.colors.primaryForeground} />}
                    onPress={() =>
                        router.push(
                            activePlaceView.status === "submitted"
                                ? "/(tabs)/reports"
                                : `/audit/${activePlaceView.place.id}/1`,
                        )
                    }
                >
                    <Button.Text
                        color={designSystem.colors.primaryForeground}
                        fontFamily={designSystem.fonts.bodyBold}
                    >
                        Open current audit
                    </Button.Text>
                </Button>
            </XStack>
        </YStack>
    );
}

function mapStatusToPlaceTone(status: "not_started" | "draft" | "submitted") {
    if (status === "submitted") {
        return "submitted" as const;
    }

    if (status === "draft") {
        return "in_progress" as const;
    }

    return "not_started" as const;
}

interface InfoCardProps {
    readonly label: string;
    readonly value: string;
}

function InfoCard({ label, value }: InfoCardProps) {
    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            p="$4"
            gap="$1.5"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <Paragraph
                color={designSystem.colors.mutedForeground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={11}
                textTransform="uppercase"
                letterSpacing={1.2}
            >
                {label}
            </Paragraph>
            <Text
                color={designSystem.colors.foreground}
                fontFamily={designSystem.fonts.bodyBold}
                fontSize={16}
            >
                {value}
            </Text>
        </YStack>
    );
}
