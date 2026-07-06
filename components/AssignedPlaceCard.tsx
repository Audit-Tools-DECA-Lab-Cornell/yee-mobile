import { Clock3, MapPin, UploadCloud } from "components/icons";
import { Button, XStack, YStack } from "tamagui";
import { ScaledParagraph as Paragraph, ScaledText as Text } from "components/ui";
import { useDesignSystem, getPlaceStatusTone } from "lib/design-system";
import { getStatusLabel, type MobilePlaceView } from "lib/yee-mobile-selectors";

interface AssignedPlaceCardProps {
    readonly view: MobilePlaceView;
    /** Fired when the card's primary action is pressed. */
    readonly onPress: () => void;
    /** Override the derived action label (defaults from workflow status). */
    readonly actionLabel?: string;
}

/**
 * Assigned-place summary card shared by the Places and Execute tabs: name,
 * project, address, status badge, latest activity, sync label, and a single
 * primary action whose default label follows the workflow status. The owning
 * screen supplies the `onPress` so routing/selection stays tab-specific.
 */
export function AssignedPlaceCard({ view, onPress, actionLabel }: AssignedPlaceCardProps) {
    const designSystem = useDesignSystem();
    const tone = getPlaceStatusTone(mapStatusToPlaceTone(view.status), designSystem.colors);
    const isSubmitted = view.status === "submitted";
    const label =
        actionLabel ??
        (isSubmitted ? "View report" : view.status === "draft" ? "Continue draft" : "Start audit");

    return (
        <YStack
            rounded={designSystem.radii.lg}
            borderWidth={1}
            borderColor={designSystem.colors.border}
            bg={designSystem.colors.surface}
            overflow="hidden"
            style={{ boxShadow: designSystem.shadows.card }}
        >
            <XStack>
                <YStack width={4} style={{ backgroundColor: tone.accent }} />

                <YStack flex={1} p="$4" gap="$3">
                    <XStack justify="space-between" items="flex-start" gap="$3">
                        <YStack flex={1} gap="$1">
                            <Text
                                color={designSystem.colors.foreground}
                                fontFamily={designSystem.fonts.bodyBold}
                                fontSize={17}
                            >
                                {view.place.name}
                            </Text>
                            <Paragraph
                                color={designSystem.colors.mutedForeground}
                                fontFamily={designSystem.fonts.bodyMedium}
                            >
                                {view.place.project}
                            </Paragraph>
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
                                {getStatusLabel(view.status)}
                            </Text>
                        </YStack>
                    </XStack>

                    <XStack items="center" gap="$2">
                        <MapPin size={14} color={designSystem.colors.mutedForeground} />
                        <Paragraph
                            color={designSystem.colors.secondaryForeground}
                            fontFamily={designSystem.fonts.bodyMedium}
                        >
                            {view.place.address}
                        </Paragraph>
                    </XStack>

                    <YStack
                        rounded={designSystem.radii.md}
                        borderWidth={1}
                        borderColor={designSystem.colors.border}
                        bg={designSystem.colors.surfaceMuted}
                        p="$3"
                        gap="$3"
                    >
                        <XStack justify="space-between" items="center" gap="$2.5">
                            <XStack items="center" gap="$2" flex={1} style={{ minWidth: 0 }}>
                                <Clock3 size={14} color={designSystem.colors.mutedForeground} />
                                <Paragraph
                                    color={designSystem.colors.mutedForeground}
                                    fontFamily={designSystem.fonts.bodyMedium}
                                >
                                    {view.latestActivityLabel}
                                </Paragraph>
                            </XStack>
                            <XStack items="center" gap="$1.5">
                                <UploadCloud size={13} color={tone.text} />
                                <Paragraph
                                    style={{ color: tone.text }}
                                    fontFamily={designSystem.fonts.bodyBold}
                                    fontSize={12}
                                >
                                    {view.syncLabel}
                                </Paragraph>
                            </XStack>
                        </XStack>

                        <XStack gap="$2" flexWrap="wrap">
                            <PlaceActionButton
                                label={label}
                                variant={isSubmitted ? "secondary" : "primary"}
                                onPress={onPress}
                            />
                        </XStack>
                    </YStack>
                </YStack>
            </XStack>
        </YStack>
    );
}

function mapStatusToPlaceTone(status: MobilePlaceView["status"]) {
    if (status === "submitted") {
        return "submitted" as const;
    }
    if (status === "draft") {
        return "in_progress" as const;
    }
    return "not_started" as const;
}

interface PlaceActionButtonProps {
    readonly label: string;
    readonly onPress: () => void;
    readonly variant?: "primary" | "secondary";
}

function PlaceActionButton({ label, onPress, variant = "primary" }: PlaceActionButtonProps) {
    const designSystem = useDesignSystem();
    return (
        <Button
            onPress={onPress}
            rounded={designSystem.radii.button}
            bg={variant === "primary" ? designSystem.colors.primary : designSystem.colors.surface}
            borderWidth={1}
            borderColor={
                variant === "primary" ? designSystem.colors.primary : designSystem.colors.border
            }
            pressStyle={{ opacity: 0.92, scale: 0.985 }}
        >
            <Button.Text
                color={
                    variant === "primary"
                        ? designSystem.colors.primaryForeground
                        : designSystem.colors.foreground
                }
                fontFamily={designSystem.fonts.bodyBold}
            >
                {label}
            </Button.Text>
        </Button>
    );
}
